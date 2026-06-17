/**
 * HR: Bảng lương tháng — chốt + duyệt thanh toán (Sprint D.5)
 * Workflow: du_thao (engine) → da_chot (HR) → da_thanh_toan (BGĐ)
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Table, Select, Statistic,
  Modal, message, Popconfirm, Alert, Tooltip, Input,
} from 'antd'
import {
  DollarOutlined, CalculatorOutlined, CheckCircleOutlined, BankOutlined,
  ReloadOutlined, UnlockOutlined, DeleteOutlined, LineChartOutlined, DownloadOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { hrApi } from '../../api/hr'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0))

const STATUS_COLOR: Record<string, string> = {
  du_thao: 'orange',
  da_chot: 'blue',
  da_thanh_toan: 'green',
}
const STATUS_LABEL: Record<string, string> = {
  du_thao: 'Dự thảo',
  da_chot: 'Đã chốt',
  da_thanh_toan: 'Đã thanh toán',
}

export default function PayrollRunsPage() {
  const qc = useQueryClient()
  const now = new Date()
  const [filters, setFilters] = useState({
    nam: now.getFullYear(),
    thang: now.getMonth() + 1,
    bo_phan_id: undefined as number | undefined,
    trang_thai: undefined as string | undefined,
  })
  const [search, setSearch] = useState('')

  const { data: deps = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['payroll-runs-summary', filters.nam, filters.thang, filters.bo_phan_id],
    queryFn: () => hrApi.payrollRunsSummary({
      nam: filters.nam,
      thang: filters.thang,
      bo_phan_id: filters.bo_phan_id,
    }).then(r => r.data),
  })

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['payroll-runs', filters],
    queryFn: () => hrApi.listPayrollRuns(filters).then(r => r.data),
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const s = search.toLowerCase()
    return rows.filter((r: any) =>
      r.ho_ten?.toLowerCase().includes(s) ||
      r.ma_nv?.toLowerCase().includes(s) ||
      r.bo_phan?.toLowerCase().includes(s)
    )
  }, [rows, search])

  const exportExcel = () => {
    if (!filtered.length) {
      message.warning('Không có dữ liệu để xuất')
      return
    }
    const data = filtered.map((r: any, idx: number) => ({
      'STT': idx + 1,
      'Mã NV': r.ma_nv || '',
      'Họ tên': r.ho_ten || '',
      'Bộ phận': r.bo_phan || '',
      'Công quy đổi': Number(r.cong_quy_doi || 0),
      'Hệ số CN': Number(r.he_so_ca_nhan_snapshot || 0),
      'Lương sản phẩm': Number(r.luong_san_pham || 0),
      'Bù tối thiểu vùng': Number(r.bu_toi_thieu_vung || 0),
      'Cộng thêm': Number(r.phu_cap || 0),
      'Bảo hiểm': Number(r.bao_hiem || 0),
      'Tạm ứng': Number(r.tam_ung || 0),
      'Tổng thu nhập': Number(r.tong_thu_nhap || 0),
      'THỰC LĨNH': Number(r.thuc_linh || 0),
      'Trạng thái': STATUS_LABEL[r.trang_thai] || r.trang_thai,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [
      { wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 18 },
      { wch: 12 }, { wch: 9 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 18 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `T${filters.thang}-${filters.nam}`)
    XLSX.writeFile(wb, `Bang_luong_T${String(filters.thang).padStart(2, '0')}_${filters.nam}.xlsx`)
    message.success(`Đã xuất ${filtered.length} dòng ra Excel`)
  }

  // Mutations
  const calcMut = useMutation({
    mutationFn: () => hrApi.engineCommit({
      nam: filters.nam,
      thang: filters.thang,
      bo_phan_id: filters.bo_phan_id,
    }),
    onSuccess: (resp: any) => {
      const d = resp.data || {}
      const s = d.summary || {}
      if (d.warning) {
        message.warning(d.warning)
        return
      }
      message.success({
        content: `Đã tính lương: ${s.so_nv_tinh ?? d.success ?? 0} nhân viên • Tổng quỹ thực lĩnh ${fmt(s.tong_thuc_linh || 0)}đ`,
        duration: 5,
      })
      const boQua = s.so_nv_bo_qua || 0
      const am = s.so_nv_thuc_linh_am || 0
      if (boQua > 0) {
        message.info(`Bỏ qua ${boQua} NV chưa có thu nhập (chưa có sản lượng/chấm công) — không tạo bảng lương âm.`, 6)
      }
      if (am > 0) {
        message.warning(`⚠️ ${am} NV có thực lĩnh ÂM (khấu trừ > thu nhập) — cần rà soát trước khi chốt.`, 8)
      }
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      qc.invalidateQueries({ queryKey: ['payroll-runs-summary'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Tính lương thất bại'),
  })

  const chotMut = useMutation({
    mutationFn: (ghi_chu?: string) => hrApi.chotPayroll({
      nam: filters.nam,
      thang: filters.thang,
      bo_phan_id: filters.bo_phan_id,
      ghi_chu,
      xac_nhan_tat_ca: !filters.bo_phan_id,
    }),
    onSuccess: (resp: any) => {
      message.success(`Đã chốt ${resp.data?.chot} bảng lương — NV xem được trên Mobile`)
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      qc.invalidateQueries({ queryKey: ['payroll-runs-summary'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Chốt thất bại'),
  })

  const payMut = useMutation({
    mutationFn: () => hrApi.duyetThanhToanPayroll({
      nam: filters.nam,
      thang: filters.thang,
      bo_phan_id: filters.bo_phan_id,
      xac_nhan_tat_ca: !filters.bo_phan_id,
    }),
    onSuccess: (resp: any) => {
      message.success(`BGĐ duyệt thanh toán ${resp.data?.duyet} bảng lương`)
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      qc.invalidateQueries({ queryKey: ['payroll-runs-summary'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Duyệt thất bại'),
  })

  const delDraftMut = useMutation({
    mutationFn: () => hrApi.deleteDraftRuns({
      nam: filters.nam,
      thang: filters.thang,
      bo_phan_id: filters.bo_phan_id,
      xac_nhan_tat_ca: !filters.bo_phan_id,
    }),
    onSuccess: (resp: any) => {
      message.success(`Đã xóa ${resp.data?.deleted} bảng dự thảo`)
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      qc.invalidateQueries({ queryKey: ['payroll-runs-summary'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Xóa thất bại'),
  })

  const unlockMut = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) => hrApi.moKhoaPayrollRun(id, ly_do),
    onSuccess: () => {
      message.success('Đã mở khóa — phiếu chuyển về dự thảo')
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Mở khóa thất bại'),
  })

  const promptUnlock = (id: number) => {
    Modal.confirm({
      title: 'Mở khóa bảng lương',
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            message="Lưu ý: Mở khóa sẽ đưa phiếu về trạng thái dự thảo. Phải nhập lý do tối thiểu 20 ký tự để audit thanh tra."
            style={{ marginBottom: 12 }}
          />
          <Input.TextArea
            id="mokhoa-ly-do"
            rows={3}
            placeholder="VD: Phát hiện sai sót sản lượng tổ A ngày 5/6 — cần tính lại theo dữ liệu chấm công mới..."
          />
        </div>
      ),
      okText: 'Mở khóa',
      okType: 'danger',
      onOk: () => {
        const el = document.getElementById('mokhoa-ly-do') as HTMLTextAreaElement
        const ly_do = (el?.value || '').trim()
        if (ly_do.length < 20) {
          message.error('Lý do mở khóa phải tối thiểu 20 ký tự')
          return Promise.reject()
        }
        return unlockMut.mutateAsync({ id, ly_do })
      },
    })
  }

  const counts = summary?.by_trang_thai || {}
  const hasDraft = (counts['du_thao'] || 0) > 0
  const hasChot = (counts['da_chot'] || 0) > 0

  const columns = [
    {
      title: 'Mã NV', dataIndex: 'ma_nv', key: 'ma_nv', width: 100,
      fixed: 'left' as const,
    },
    {
      title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten',
      fixed: 'left' as const, width: 180,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: 'Bộ phận', dataIndex: 'bo_phan', key: 'bo_phan', width: 140 },
    {
      title: 'Lương SP', dataIndex: 'luong_san_pham', key: 'luong_san_pham', width: 120,
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Bù tối thiểu vùng', dataIndex: 'bu_toi_thieu_vung', key: 'bu_toi_thieu_vung', width: 140,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#52c41a' }}>+{fmt(v)}</Text> : '—',
    },
    {
      title: 'Cộng thêm', dataIndex: 'phu_cap', key: 'phu_cap', width: 110,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#52c41a' }}>+{fmt(v)}</Text> : '—',
    },
    {
      title: 'Bảo hiểm', dataIndex: 'bao_hiem', key: 'bao_hiem', width: 110,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#ff4d4f' }}>−{fmt(v)}</Text> : '—',
    },
    {
      title: 'Tạm ứng', dataIndex: 'tam_ung', key: 'tam_ung', width: 110,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#ff4d4f' }}>−{fmt(v)}</Text> : '—',
    },
    {
      title: 'Tổng thu nhập', dataIndex: 'tong_thu_nhap', key: 'tong_thu_nhap', width: 130,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#fa8c16' }}>{fmt(v)}</Text>,
    },
    {
      title: 'THỰC LĨNH', dataIndex: 'thuc_linh', key: 'thuc_linh', width: 130,
      align: 'right' as const,
      fixed: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: Number(v) < 0 ? '#cf1322' : '#389e0d', fontSize: 14 }}>
          {Number(v) < 0 ? '⚠️ ' : ''}{fmt(v)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', key: 'trang_thai', width: 130,
      fixed: 'right' as const,
      render: (v: string, r: any) => (
        <Space size={4}>
          <Tag color={STATUS_COLOR[v] || 'default'}>{STATUS_LABEL[v] || v}</Tag>
          {v !== 'du_thao' && (
            <Tooltip title="Mở khóa (ADMIN) — phải nhập lý do">
              <Button
                size="small"
                type="text"
                icon={<UnlockOutlined />}
                onClick={() => promptUnlock(r.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('hr-payroll-runs', columns, { nonHideable: ['ma_nv'] })

  return (
    <div style={{ padding: 16 }}>
      <style>{`.payroll-row-negative > td { background: #fff1f0 !important; }`}</style>
      {/* Hero */}
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          color: '#fff',
        }}
        styles={{ body: { color: '#fff' } }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <BankOutlined /> Bảng lương tháng {String(filters.thang).padStart(2, '0')}/{filters.nam}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              Quy chế Lương Nam Phương — Điều 14 quy trình tính lương + Điều 15.5 + Điều 16
            </Text>
          </Col>
          <Col>
            <Space wrap>
              <Select
                value={filters.thang}
                onChange={(v) => setFilters(f => ({ ...f, thang: v }))}
                style={{ width: 110 }}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: i + 1, label: `Tháng ${String(i + 1).padStart(2, '0')}`,
                }))}
              />
              <Select
                value={filters.nam}
                onChange={(v) => setFilters(f => ({ ...f, nam: v }))}
                style={{ width: 100 }}
                options={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => ({ value: y, label: y }))}
              />
              <Select
                placeholder="Bộ phận (tất cả)"
                allowClear
                value={filters.bo_phan_id}
                onChange={(v) => setFilters(f => ({ ...f, bo_phan_id: v }))}
                style={{ width: 180 }}
                options={deps.map(d => ({ value: d.id, label: d.ten_bo_phan }))}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Tải lại</Button>
              <Button icon={<DownloadOutlined />} onClick={exportExcel}>Xuất Excel</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Số NV" value={summary?.total || 0} prefix={<LineChartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Quỹ lương sản phẩm"
              value={fmt(summary?.quy_luong_san_pham || 0)}
              suffix="đ"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Bù tối thiểu vùng"
              value={fmt(summary?.quy_bu_toi_thieu_vung || 0)}
              suffix="đ"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Statistic
              title="QUỸ THỰC LĨNH"
              value={fmt(summary?.quy_thuc_linh || 0)}
              suffix="đ"
              valueStyle={{ color: '#389e0d', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Status counts + Actions */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="📊 Trạng thái bảng lương" size="small">
            <Space wrap size="middle">
              <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>
                Dự thảo: {counts['du_thao'] || 0}
              </Tag>
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                Đã chốt: {counts['da_chot'] || 0}
              </Tag>
              <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                Đã thanh toán: {counts['da_thanh_toan'] || 0}
              </Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="⚡ Hành động" size="small">
            <Space wrap>
              <Popconfirm
                title="Tính lương tự động (Engine)"
                description={
                  <div style={{ maxWidth: 320 }}>
                    Engine sẽ chạy 6 công thức Quy chế (Điều 7-13) + bù tối thiểu vùng,
                    áp dụng phụ cấp/khấu trừ đã duyệt. Bảng đã thanh toán sẽ được giữ nguyên.
                  </div>
                }
                onConfirm={() => calcMut.mutate()}
                okText="Chạy engine"
              >
                <Button type="primary" icon={<CalculatorOutlined />} loading={calcMut.isPending}>
                  Tính lương tự động
                </Button>
              </Popconfirm>

              <Popconfirm
                title={`Chốt ${counts['du_thao'] || 0} bảng dự thảo?`}
                description="Sau khi chốt, NV xem được trên Mobile và bắt đầu đếm 15 ngày khiếu nại (Điều 16)"
                onConfirm={() => chotMut.mutate(undefined)}
                okText="Chốt bảng"
                disabled={!hasDraft}
              >
                <Button
                  icon={<CheckCircleOutlined />}
                  loading={chotMut.isPending}
                  disabled={!hasDraft}
                >
                  Chốt tháng ({counts['du_thao'] || 0})
                </Button>
              </Popconfirm>

              <Popconfirm
                title={`BGĐ duyệt chi trả ${counts['da_chot'] || 0} bảng đã chốt?`}
                description="Bảng đã thanh toán sẽ bị khóa hoàn toàn — không sửa được."
                onConfirm={() => payMut.mutate()}
                okText="Duyệt thanh toán"
                disabled={!hasChot}
              >
                <Button
                  type="primary"
                  icon={<BankOutlined />}
                  loading={payMut.isPending}
                  disabled={!hasChot}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Duyệt chi trả ({counts['da_chot'] || 0})
                </Button>
              </Popconfirm>

              <Popconfirm
                title={`Xóa ${counts['du_thao'] || 0} bảng dự thảo để tính lại?`}
                description="Chỉ xóa bảng dự thảo — bảng đã chốt/thanh toán không ảnh hưởng."
                onConfirm={() => delDraftMut.mutate()}
                okText="Xóa & tính lại"
                okType="danger"
                disabled={!hasDraft}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={delDraftMut.isPending}
                  disabled={!hasDraft}
                >
                  Xóa dự thảo
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        title={`Chi tiết bảng lương (${filtered.length})`}
        extra={
          <Space>
            <Input.Search
              placeholder="Tìm tên / mã NV / bộ phận"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              placeholder="Lọc trạng thái"
              allowClear
              value={filters.trang_thai}
              onChange={(v) => setFilters(f => ({ ...f, trang_thai: v }))}
              style={{ width: 160 }}
              options={[
                { value: 'du_thao', label: 'Dự thảo' },
                { value: 'da_chot', label: 'Đã chốt' },
                { value: 'da_thanh_toan', label: 'Đã thanh toán' },
              ]}
            />
            {settingsButton}
          </Space>
        }
      >
        <Table
          dataSource={filtered}
          loading={isLoading}
          rowKey="id"
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          rowClassName={(r: any) => (Number(r.thuc_linh) < 0 ? 'payroll-row-negative' : '')}
          columns={displayColumns}
          summary={(data) => {
            const total = data.reduce((acc: any, r: any) => ({
              luong_sp: acc.luong_sp + Number(r.luong_san_pham || 0),
              bu: acc.bu + Number(r.bu_toi_thieu_vung || 0),
              cong_them: acc.cong_them + Number(r.phu_cap || 0),
              bh: acc.bh + Number(r.bao_hiem || 0),
              tu: acc.tu + Number(r.tam_ung || 0),
              ttn: acc.ttn + Number(r.tong_thu_nhap || 0),
              tl: acc.tl + Number(r.thuc_linh || 0),
            }), { luong_sp: 0, bu: 0, cong_them: 0, bh: 0, tu: 0, ttn: 0, tl: 0 })
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0} colSpan={3}>TỔNG ({data.length} NV)</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{fmt(total.luong_sp)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">{fmt(total.bu)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">{fmt(total.cong_them)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">{fmt(total.bh)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">{fmt(total.tu)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">{fmt(total.ttn)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">
                    <Text strong style={{ color: '#389e0d' }}>{fmt(total.tl)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
      </Card>
    </div>
  )
}
