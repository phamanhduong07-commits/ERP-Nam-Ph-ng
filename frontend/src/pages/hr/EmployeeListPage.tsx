import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Drawer, Input, InputNumber, Select, Space, Table, Typography, message, Row, Col, Tag, Avatar, Statistic, Tooltip, Badge,
} from 'antd'
import { PlusOutlined, EditOutlined, UserOutlined, SearchOutlined, DownloadOutlined, UploadOutlined, WarningOutlined, MobileOutlined, LockOutlined, UnlockOutlined, TeamOutlined, CheckCircleOutlined, StopOutlined, IdcardOutlined, CaretDownOutlined } from '@ant-design/icons'
import { hrApi, Employee } from '../../api/hr'
import EmployeeProfileModal from '../../components/hr/EmployeeProfileModal'
import { phapNhanApi } from '../../api/phap_nhan'
import { theoDoiApi } from '../../api/theoDoi'
import { downloadTemplate } from '../../utils/excelUtils'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function EmployeeListPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    phap_nhan_id: undefined as number | undefined,
    phan_xuong_id: undefined as number | undefined,
  })
  const [boPhanFilter, setBoPhanFilter] = useState<number | undefined>()
  const [trangThaiFilter, setTrangThaiFilter] = useState<string | undefined>()
  const [accountFilter, setAccountFilter] = useState<'all' | 'has' | 'none'>('all')
  // Quick filter từ URL — dashboard alert chip click vào sẽ kéo theo
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Đọc filter param từ URL khi mount (vd: ?filter=no_account)
  useEffect(() => {
    const f = searchParams.get('filter')
    if (f) {
      setQuickFilter(f)
      // Map sang state filter cũ tương đương
      if (f === 'no_account') setAccountFilter('none')
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Queries
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hr-employees', search, filters],
    queryFn: () => hrApi.listEmployees({ search, ...filters }).then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => theoDoiApi.listPhanXuong().then((r: any) => r.data),
  })

  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const { data: positions = [] } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => hrApi.listPositions().then(r => r.data),
  })

  const { data: expiring = [] } = useQuery({
    queryKey: ['hr-expiring-contracts'],
    queryFn: () => hrApi.listExpiringContracts().then(r => r.data),
  })

  // Mutations
  // Note: Sprint A — saveMut removed, EmployeeProfileModal tự xử lý save logic.
  const issueAccMut = useMutation({
    mutationFn: (id: number) => hrApi.issueAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      message.success('Đã cấp tài khoản Mobile thành công. Vui lòng liên hệ HR để nhận mật khẩu.', 6)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Cấp tài khoản thất bại')
    },
  })

  const toggleAccMut = useMutation({
    mutationFn: (id: number) => hrApi.toggleAccountStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      message.success('Đã cập nhật trạng thái tài khoản')
    }
  })

  // ─── Inline edit mutation: cập nhật 1 field bất kỳ của NV ───
  const inlineEditMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Employee> }) =>
      hrApi.updateEmployee(id, data),
    onMutate: async ({ id, data }) => {
      // Optimistic update — đổi cache trước khi API trả về
      await qc.cancelQueries({ queryKey: ['hr-employees'] })
      const prev = qc.getQueryData<Employee[]>(['hr-employees', search, filters])
      qc.setQueryData<Employee[]>(['hr-employees', search, filters], (old) =>
        (old || []).map(e => e.id === id ? { ...e, ...data } : e)
      )
      return { prev }
    },
    onError: (err: any, _vars, ctx) => {
      // Rollback nếu fail
      if (ctx?.prev) qc.setQueryData(['hr-employees', search, filters], ctx.prev)
      message.error(err?.response?.data?.detail || 'Cập nhật thất bại')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      message.success({ content: 'Đã lưu', duration: 1.5 })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setOpen(true)
  }

  // ─── Client-side filter (bộ phận / trạng thái / tài khoản) ───
  // Set IDs NV có HĐ sắp hết hạn (cho quick filter)
  const expiringEmpIds = useMemo(
    () => new Set((expiring || []).map((c: any) => c.employee_id)),
    [expiring]
  )

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (boPhanFilter && (e as any).bo_phan_id !== boPhanFilter) return false
      if (trangThaiFilter && e.trang_thai !== trangThaiFilter) return false
      if (accountFilter === 'has' && !(e as any).has_account) return false
      if (accountFilter === 'none' && (e as any).has_account) return false
      // ─── Quick filter từ Dashboard ───
      if (quickFilter === 'contracts_expiring_60') {
        if (!expiringEmpIds.has(e.id)) return false
      }
      if (quickFilter === 'missing_info') {
        const missing = !e.cccd || !e.so_dien_thoai || !(e as any).so_so_bhxh
        if (!missing) return false
      }
      return true
    })
  }, [employees, boPhanFilter, trangThaiFilter, accountFilter, quickFilter, expiringEmpIds])

  // ─── Stats summary ───
  const stats = useMemo(() => {
    const total = employees.length
    const dangLam = employees.filter(e => e.trang_thai === 'dang_lam').length
    const daNghi = employees.filter(e => e.trang_thai === 'da_nghi').length
    const hasAcc = employees.filter(e => (e as any).has_account).length
    return { total, dangLam, daNghi, hasAcc }
  }, [employees])

  // ─── Helper: avatar màu deterministic theo họ tên ───
  const getAvatarColor = (name: string) => {
    const colors = ['#1677ff', '#13c2c2', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#faad14', '#a0d911']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
    return colors[Math.abs(hash) % colors.length]
  }

  const TRANG_THAI_META: Record<string, { color: string; label: string; dot: string }> = {
    dang_lam: { color: 'success', label: 'Đang làm', dot: '#52c41a' },
    tam_nghi: { color: 'warning', label: 'Tạm nghỉ', dot: '#faad14' },
    da_nghi:  { color: 'default', label: 'Đã nghỉ',  dot: '#bfbfbf' },
  }

  const columns = [
    {
      title: 'Mã NV',
      dataIndex: 'ma_nv',
      width: 92,
      fixed: 'left' as const,
      render: (v: string, r: Employee) => (
        <a
          onClick={() => openEdit(r)}
          title="Xem chi tiết hồ sơ"
          style={{
            fontWeight: 600,
            display: 'inline-block',
            padding: '2px 8px',
            background: '#f0f5ff',
            color: '#1677ff',
            borderRadius: 4,
            fontSize: 12,
            letterSpacing: 0.5,
          }}
        >
          {v}
        </a>
      ),
    },
    {
      title: 'Nhân viên',
      dataIndex: 'ho_ten',
      width: 280,
      render: (v: string, r: Employee) => (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => openEdit(r)}
          title="Xem chi tiết hồ sơ"
        >
          <Avatar style={{ backgroundColor: getAvatarColor(v || 'NV'), flexShrink: 0 }} size={36}>
            {(v || 'NV').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                color: '#262626',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#8c8c8c',
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r.ten_chuc_vu || '— chưa xếp chức vụ —'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: <Tooltip title="Click cell để đổi nhanh">Bộ phận <EditOutlined style={{ fontSize: 10, opacity: 0.4 }} /></Tooltip>,
      dataIndex: 'bo_phan_id',
      width: 190,
      render: (v: number, r: Employee) => (
        <Select
          value={v}
          variant="borderless"
          placeholder={<Text type="secondary">— chọn —</Text>}
          style={{ width: '100%' }}
          showSearch
          allowClear
          optionFilterProp="label"
          options={(depts || []).map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))}
          onChange={(newId) => {
            if (newId === v) return
            inlineEditMut.mutate({ id: r.id, data: { bo_phan_id: newId ?? null } as any })
          }}
          suffixIcon={<CaretDownOutlined style={{ color: '#bfbfbf', fontSize: 11 }} />}
          className="inline-edit-select"
          popupMatchSelectWidth={250}
        />
      ),
    },
    {
      title: <Tooltip title="Click cell để đổi nhanh">Pháp nhân <EditOutlined style={{ fontSize: 10, opacity: 0.4 }} /></Tooltip>,
      dataIndex: 'phap_nhan_id',
      width: 160,
      render: (v: number, r: Employee) => (
        <Select
          value={v}
          variant="borderless"
          placeholder={<Text type="secondary">— chọn —</Text>}
          style={{ width: '100%' }}
          showSearch
          allowClear
          optionFilterProp="label"
          options={(phapNhanList || []).map((p: any) => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
          onChange={(newId) => {
            if (newId === v) return
            inlineEditMut.mutate({ id: r.id, data: { phap_nhan_id: newId ?? null } as any })
          }}
          suffixIcon={<CaretDownOutlined style={{ color: '#bfbfbf', fontSize: 11 }} />}
          className="inline-edit-select"
        />
      ),
    },
    {
      title: 'SĐT',
      dataIndex: 'so_dien_thoai',
      width: 115,
      render: (v: string) => v ? <Text copyable={{ text: v, tooltips: ['Copy', 'Đã copy'] }} style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: <Tooltip title="Click để chỉnh hệ số (0-10)">Hệ số <EditOutlined style={{ fontSize: 10, opacity: 0.4 }} /></Tooltip>,
      dataIndex: 'he_so_ca_nhan',
      width: 90,
      align: 'center' as const,
      render: (v: number, r: Employee) => (
        <InputNumber
          value={Number(v || 0)}
          min={0}
          max={10}
          step={0.1}
          precision={2}
          size="small"
          variant="borderless"
          style={{ width: 72, textAlign: 'center', color: '#1677ff', fontWeight: 600 }}
          controls={true}
          className="inline-edit-number"
          onBlur={(e) => {
            const newVal = parseFloat((e.target as HTMLInputElement).value || '0')
            if (Math.abs(newVal - Number(v || 0)) < 0.001) return
            inlineEditMut.mutate({ id: r.id, data: { he_so_ca_nhan: newVal } as any })
          }}
          onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
        />
      ),
    },
    {
      title: <Tooltip title="Click để đổi trạng thái">Trạng thái <EditOutlined style={{ fontSize: 10, opacity: 0.4 }} /></Tooltip>,
      dataIndex: 'trang_thai',
      width: 140,
      render: (v: string, r: Employee) => (
        <Select
          value={v}
          variant="borderless"
          style={{ width: '100%' }}
          onChange={(newVal) => {
            if (newVal === v) return
            inlineEditMut.mutate({ id: r.id, data: { trang_thai: newVal } })
          }}
          options={[
            { value: 'dang_lam', label: <Badge status="success" text="Đang làm" /> },
            { value: 'tam_nghi', label: <Badge status="warning" text="Tạm nghỉ" /> },
            { value: 'da_nghi',  label: <Badge status="default" text="Đã nghỉ" /> },
          ]}
          suffixIcon={<CaretDownOutlined style={{ color: '#bfbfbf', fontSize: 11 }} />}
          className="inline-edit-select"
        />
      ),
    },
    {
      title: 'Tài khoản',
      key: 'account',
      width: 150,
      render: (_: any, r: Employee) => (
        (r as any).has_account ? (
          <Space size={4}>
            <Tooltip title={(r as any).user_status ? 'Đang hoạt động' : 'Đã khóa'}>
              <Tag
                color={(r as any).user_status ? 'cyan' : 'default'}
                icon={(r as any).user_status ? <UnlockOutlined /> : <LockOutlined />}
                style={{ margin: 0, fontFamily: 'monospace' }}
              >
                {(r as any).username}
              </Tag>
            </Tooltip>
            <Tooltip title={(r as any).user_status ? 'Khóa tài khoản' : 'Mở khóa'}>
              <Button
                size="small"
                type="text"
                danger={(r as any).user_status}
                icon={(r as any).user_status ? <LockOutlined /> : <UnlockOutlined />}
                onClick={() => toggleAccMut.mutate(r.id)}
              />
            </Tooltip>
          </Space>
        ) : (
          <Button
            size="small"
            type="dashed"
            icon={<MobileOutlined />}
            onClick={() => issueAccMut.mutate(r.id)}
            loading={issueAccMut.isPending && issueAccMut.variables === r.id}
          >
            Cấp TK
          </Button>
        )
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      fixed: 'right' as const,
      render: (_: any, r: Employee) => (
        <Tooltip title="Chỉnh sửa nhanh">
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {expiring.length > 0 && (
        <Alert
          message={`Có ${expiring.length} nhân viên sắp hết hạn hợp đồng lao động!`}
          description={expiring.map(c => `${c.ho_ten} (${dayjs(c.ngay_het_han).format('DD/MM/YYYY')})`).join(', ')}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          action={
            <Button
              size="small" type="primary" ghost
              onClick={() => {
                const first = expiring[0]
                if (!first) return
                const emp = employees.find(e => e.id === first.employee_id)
                if (emp) openEdit(emp)
                else message.info('Không tìm thấy nhân viên trong danh sách hiện tại')
              }}
            >
              Xử lý ngay
            </Button>
          }
        />
      )}
      {/* ─── Title + Actions ─── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Danh sách nhân viên
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Quản lý hồ sơ nhân sự — click vào tên hoặc mã NV để xem chi tiết
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate('employee')}>
              Tải file mẫu
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm nhân viên
            </Button>
          </Space>
        </Col>
      </Row>

      {/* ─── Stats cards ─── */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#8c8c8c' }}>Tổng nhân viên</Text>}
              value={stats.total}
              valueStyle={{ fontSize: 22, color: '#1677ff', fontWeight: 600 }}
              prefix={<TeamOutlined style={{ fontSize: 16 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#8c8c8c' }}>Đang làm việc</Text>}
              value={stats.dangLam}
              valueStyle={{ fontSize: 22, color: '#52c41a', fontWeight: 600 }}
              prefix={<CheckCircleOutlined style={{ fontSize: 16 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#8c8c8c' }}>Đã nghỉ</Text>}
              value={stats.daNghi}
              valueStyle={{ fontSize: 22, color: '#bfbfbf', fontWeight: 600 }}
              prefix={<StopOutlined style={{ fontSize: 16 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: '#8c8c8c' }}>Đã cấp tài khoản</Text>}
              value={stats.hasAcc}
              suffix={<Text type="secondary" style={{ fontSize: 13 }}>/ {stats.total}</Text>}
              valueStyle={{ fontSize: 22, color: '#13c2c2', fontWeight: 600 }}
              prefix={<IdcardOutlined style={{ fontSize: 16 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* ─── Filters ─── */}
      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 10 } }}>
        <Space wrap size={8}>
          <Input
            placeholder="Tìm tên, mã NV..."
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            allowClear
            onPressEnter={(e: any) => setSearch(e.target.value)}
            onBlur={(e: any) => setSearch(e.target.value)}
            onChange={(e: any) => { if (!e.target.value) setSearch('') }}
          />
          <Select
            placeholder="Pháp nhân"
            style={{ width: 160 }}
            allowClear
            options={(phapNhanList || []).map((p: any) => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            onChange={v => setFilters(f => ({ ...f, phap_nhan_id: v }))}
          />
          <Select
            placeholder="Bộ phận"
            style={{ width: 180 }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={(depts || []).map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))}
            value={boPhanFilter}
            onChange={setBoPhanFilter}
          />
          <Select
            placeholder="Trạng thái"
            style={{ width: 130 }}
            allowClear
            value={trangThaiFilter}
            onChange={setTrangThaiFilter}
            options={[
              { value: 'dang_lam', label: '● Đang làm' },
              { value: 'tam_nghi', label: '● Tạm nghỉ' },
              { value: 'da_nghi', label: '● Đã nghỉ' },
            ]}
          />
          <Select
            style={{ width: 150 }}
            value={accountFilter}
            onChange={setAccountFilter}
            options={[
              { value: 'all', label: 'Tất cả tài khoản' },
              { value: 'has', label: '✓ Đã cấp TK' },
              { value: 'none', label: '✗ Chưa cấp TK' },
            ]}
          />
          {(boPhanFilter || trangThaiFilter || accountFilter !== 'all' || filters.phap_nhan_id || search) && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setBoPhanFilter(undefined)
                setTrangThaiFilter(undefined)
                setAccountFilter('all')
                setFilters({ phap_nhan_id: undefined, phan_xuong_id: undefined })
                setSearch('')
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 13 }}>
            Hiển thị <b>{filteredEmployees.length}</b> / {stats.total} nhân viên
          </Text>
        </Space>
      </Card>

      {/* ─── Quick filter banner (từ Dashboard alert) ─── */}
      {quickFilter && (
        <Alert
          type="info" showIcon
          style={{ marginBottom: 12 }}
          message={
            <Space>
              <span>
                Đang lọc theo:{' '}
                <strong>
                  {quickFilter === 'no_account' ? 'Nhân viên chưa được cấp tài khoản đăng nhập'
                    : quickFilter === 'contracts_expiring_60' ? 'Hợp đồng lao động sắp hết hạn trong 60 ngày'
                    : quickFilter === 'missing_info' ? 'Hồ sơ chưa đầy đủ (thiếu CCCD/SĐT/BHXH)'
                    : quickFilter}
                </strong>
              </span>
              <Button size="small" type="link" onClick={() => {
                setQuickFilter(null)
                setAccountFilter('all')
                setSearchParams({})
              }}>
                ✕ Bỏ lọc nhanh
              </Button>
            </Space>
          }
        />
      )}

      {/* ─── Table ─── */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filteredEmployees}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{
            pageSize: 25,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} nhân viên`,
            size: 'default',
          }}
          scroll={{ x: 1100 }}
          rowClassName={(r) => r.trang_thai === 'da_nghi' ? 'opacity-row' : ''}
        />
      </Card>
      <style>{`
        .opacity-row { opacity: 0.55; }
        .opacity-row:hover { opacity: 1; }

        /* ─── Inline edit: hint visual để biết cell click được ─── */
        .inline-edit-select.ant-select .ant-select-selector,
        .inline-edit-number .ant-input-number-input-wrap input {
          background: #fafafa !important;
          border: 1px dashed transparent !important;
          border-radius: 4px;
          transition: all 0.15s;
        }
        .inline-edit-select.ant-select:hover .ant-select-selector,
        .inline-edit-number:hover .ant-input-number-input-wrap input {
          background: #e6f4ff !important;
          border-color: #91caff !important;
        }
        .inline-edit-select.ant-select.ant-select-focused .ant-select-selector,
        .inline-edit-number.ant-input-number-focused .ant-input-number-input-wrap input {
          background: #fff !important;
          border-color: #1677ff !important;
        }
        /* Caret luôn hiện rõ (không chỉ khi hover như AntD default) */
        .inline-edit-select.ant-select .ant-select-arrow {
          opacity: 0.7;
          right: 8px;
        }
        .inline-edit-select.ant-select:hover .ant-select-arrow {
          opacity: 1;
        }
        /* InputNumber: hiện cả 2 mũi tên lên xuống (controls) cho rõ là editable */
        .inline-edit-number .ant-input-number-handler-wrap {
          opacity: 0.5;
        }
        .inline-edit-number:hover .ant-input-number-handler-wrap {
          opacity: 1;
        }
      `}</style>

      <EmployeeProfileModal
        open={open}
        employee={editing}
        onClose={() => { setOpen(false); setEditing(null) }}
        onSaved={(emp) => {
          qc.invalidateQueries({ queryKey: ["hr-employees"] })
          setEditing(emp)
        }}
      />

      <Drawer
        title="Xem trước dữ liệu Import Nhân viên"
        width={900}
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportData([])
        }}
        extra={
          <Space>
            <Button onClick={() => setImportOpen(false)}>Huỷ</Button>
            <Button 
              type="primary" 
              disabled={importData.length === 0 || importData.some(r => r._error)} 
              onClick={async () => {
                message.loading('Đang xử lý import...')
                // Gửi importData lên API bulk create
                const validData = importData.map(r => {
                  const { _error, _status, ...clean } = r;
                  return clean;
                });
                // Giả lập gửi lên API
                try {
                  await hrApi.bulkCreateEmployees(validData)
                  if (validData.some((row: any) => row.luong_co_ban || row.phu_cap_chuyen_can || row.phu_cap_trach_nhiem || row.phu_cap_nha_o_com || row.phu_cap_dien_thoai || row.phu_cap_khac)) {
                    await hrApi.importContractAllowances(validData)
                  }
                  message.success(`Đã import thành công ${validData.length} nhân viên`)
                  setImportOpen(false)
                  setImportData([])
                  qc.invalidateQueries({ queryKey: ['hr-employees'] })
                } catch (e: any) {
                  message.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Import nhan vien that bai')
                }
              }}
            >
              Xác nhận Lưu vào Hệ thống
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Bước 1: Tải file lên. Bước 2: Kiểm tra bảng xem trước. Bước 3: Nhấn Xác nhận nếu không có lỗi đỏ.</Text>
          <div style={{ marginTop: 10 }}>
            <Input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (evt) => {
                  const bstr = evt.target?.result
                  const wb = XLSX.read(bstr, { type: 'binary' })
                  const wsname = wb.SheetNames[0]
                  const ws = wb.Sheets[wsname]
                  const data = XLSX.utils.sheet_to_json(ws)
                  
                  // Validation logic
                  const validated = data.map((row: any) => {
                    let error = ''
                    if (!row.ma_nv) error = 'Thiếu mã nhân viên'
                    if (!row.ho_ten) error = 'Thiếu họ tên'
                    if (row.he_so_ca_nhan && (row.he_so_ca_nhan < 1 || row.he_so_ca_nhan > 3)) error = 'Hệ số phải từ 1.0 - 3.0'
                    
                    return {
                      ...row,
                      _error: error,
                      _status: error ? 'error' : 'success'
                    }
                  })
                  setImportData(validated)
                }
                reader.readAsBinaryString(file)
              }} 
            />
          </div>
        </div>

        <Table 
          size="small"
          dataSource={importData}
          pagination={false}
          columns={[
            { title: 'Trạng thái', dataIndex: '_status', width: 100, render: (v, r) => (
              <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? 'Hợp lệ' : r._error}</Tag>
            )},
            { title: 'Mã NV', dataIndex: 'ma_nv' },
            { title: 'Họ tên', dataIndex: 'ho_ten' },
            { title: 'Hệ số', dataIndex: 'he_so_ca_nhan', align: 'center' },
            { title: 'Xưởng', dataIndex: 'phan_xuong' },
            { title: 'Chức vụ', dataIndex: 'chuc_vu' },
            { title: 'Lương CB', dataIndex: 'luong_co_ban', align: 'right' as const, render: (v: number) => v?.toLocaleString?.() },
            { title: 'PC chuyên cần', dataIndex: 'phu_cap_chuyen_can', align: 'right' as const, render: (v: number) => v?.toLocaleString?.() },
            { title: 'PC trách nhiệm', dataIndex: 'phu_cap_trach_nhiem', align: 'right' as const, render: (v: number) => v?.toLocaleString?.() },
          ]}
        />
      </Drawer>
    </div>
  )
}
