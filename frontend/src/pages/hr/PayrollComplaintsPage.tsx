/**
 * HR: Xử lý khiếu nại tiền lương (Sprint D.5 — Điều 16 Quy chế)
 * Workflow 4 bước Điều 16: moi → dang_xu_ly → co_sai_sot / khong_sai_sot
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Table, Select, Statistic,
  Modal, message, Alert, Form, Input, Switch, InputNumber, Tooltip,
} from 'antd'
import {
  AlertOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  ReloadOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hrApi } from '../../api/hr'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography
const { TextArea } = Input

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0))

const STATUS_LABEL: Record<string, string> = {
  moi: 'Mới gửi',
  dang_xu_ly: 'Đang xử lý',
  co_sai_sot: 'Có sai sót — đã điều chỉnh',
  khong_sai_sot: 'Không có sai sót',
  het_han: 'Hết hạn',
}
const STATUS_COLOR: Record<string, string> = {
  moi: 'orange',
  dang_xu_ly: 'blue',
  co_sai_sot: 'green',
  khong_sai_sot: 'red',
  het_han: 'default',
}

const SUB_LOAI_DIEU_CHINH = [
  { value: 'tang_thuong_sp', label: 'Tăng/thưởng sản phẩm' },
  { value: 'boi_duong', label: 'Bồi dưỡng' },
  { value: 'cong_nhat', label: 'Tiền công nhật' },
  { value: 'pc_khac', label: 'Phụ cấp khác (mặc định)' },
]

export default function PayrollComplaintsPage() {
  const qc = useQueryClient()
  const now = new Date()
  const [filters, setFilters] = useState({
    nam: now.getFullYear(),
    thang: now.getMonth() + 1,
    trang_thai: undefined as string | undefined,
    bo_phan_id: undefined as number | undefined,
  })
  const [resolveOpen, setResolveOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form] = Form.useForm()
  const watchedCoSaiSot = Form.useWatch('co_sai_sot', form)

  const { data: deps = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['complaints-summary', filters.nam, filters.thang],
    queryFn: () => hrApi.complaintsSummary({ nam: filters.nam, thang: filters.thang }).then(r => r.data),
  })

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['complaints-list', filters],
    queryFn: () => hrApi.listComplaints(filters).then(r => r.data),
  })

  const takeMut = useMutation({
    mutationFn: (id: number) => hrApi.takeComplaint(id),
    onSuccess: () => {
      message.success('Đã nhận tiếp xử lý khiếu nại')
      qc.invalidateQueries({ queryKey: ['complaints-list'] })
      qc.invalidateQueries({ queryKey: ['complaints-summary'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không thể nhận'),
  })

  const resolveMut = useMutation({
    mutationFn: (data: any) => hrApi.resolveComplaint(selected!.id, data),
    onSuccess: () => {
      message.success('Đã kết luận khiếu nại')
      setResolveOpen(false)
      setSelected(null)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['complaints-list'] })
      qc.invalidateQueries({ queryKey: ['complaints-summary'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Kết luận thất bại'),
  })

  const expireMut = useMutation({
    mutationFn: () => hrApi.autoExpireComplaints(),
    onSuccess: (resp: any) => {
      message.success(`Đã cập nhật ${resp.data?.updated || 0} khiếu nại quá hạn`)
      qc.invalidateQueries({ queryKey: ['complaints-list'] })
    },
  })

  const counts = summary?.by_trang_thai || {}

  const columns = [
    {
      title: 'Mã NV', dataIndex: 'ma_nv', key: 'ma_nv', width: 100, fixed: 'left' as const,
    },
    {
      title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten', width: 180, fixed: 'left' as const,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: 'Bộ phận', dataIndex: 'bo_phan', key: 'bo_phan', width: 140 },
    { title: 'Kỳ', key: 'ky', width: 100, render: (_: unknown, r: any) => `${r.thang}/${r.nam}` },
    {
      title: 'Lý do khiếu nại', dataIndex: 'ly_do', key: 'ly_do', width: 280,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text style={{ display: 'block', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Số tiền KN', dataIndex: 'so_tien_khieu_nai', key: 'so_tien_khieu_nai', width: 120,
      align: 'right' as const,
      render: (v: number) => v ? fmt(v) + 'đ' : '—',
    },
    {
      title: 'Ngày gửi', dataIndex: 'created_at', key: 'created_at', width: 130,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Hạn 15 ngày LV', key: 'han', width: 130,
      render: (_: unknown, r: any) => {
        const remain = r.so_ngay_con_lai
        return (
          <Tooltip title={`Hạn chốt: ${dayjs(r.han_chot).format('DD/MM/YYYY')}`}>
            <Tag color={remain > 7 ? 'green' : remain > 0 ? 'orange' : 'red'}>
              {remain > 0 ? `Còn ${remain} ngày` : 'Quá hạn'}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', key: 'trang_thai', width: 200,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Người xử lý', dataIndex: 'nguoi_xu_ly_ten', key: 'nguoi_xu_ly_ten', width: 140,
    },
    {
      title: 'Hành động', key: 'act', width: 220, fixed: 'right' as const,
      render: (_: unknown, r: any) => (
        <Space>
          {r.trang_thai === 'moi' && (
            <Button size="small" type="primary" loading={takeMut.isPending} onClick={() => takeMut.mutate(r.id)}>
              Nhận xử lý
            </Button>
          )}
          {(r.trang_thai === 'moi' || r.trang_thai === 'dang_xu_ly') && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setSelected(r)
                form.resetFields()
                form.setFieldValue('co_sai_sot', true)
                setResolveOpen(true)
              }}
            >
              Kết luận
            </Button>
          )}
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('hr-payroll-complaints', columns, { nonHideable: ['ma_nv'] })

  return (
    <div style={{ padding: 16 }}>
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #fa541c 0%, #d4380d 100%)',
          color: '#fff',
        }}
        styles={{ body: { color: '#fff' } }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <AlertOutlined /> Xử lý khiếu nại tiền lương (Điều 16)
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              Quy trình 4 bước: NV phản hồi → HR/QC kiểm tra → có sai sót (điều chỉnh kỳ sau) / không có sai sót (giải thích).
              <br />Thời hạn: 15 ngày làm việc kể từ ngày nhận phiếu lương.
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
                options={[now.getFullYear() - 1, now.getFullYear()].map(y => ({ value: y, label: y }))}
              />
              <Select
                placeholder="Bộ phận"
                allowClear
                value={filters.bo_phan_id}
                onChange={(v) => setFilters(f => ({ ...f, bo_phan_id: v }))}
                style={{ width: 180 }}
                options={deps.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Tải lại</Button>
              <Button icon={<ClockCircleOutlined />} loading={expireMut.isPending} onClick={() => expireMut.mutate()}>
                Cập nhật quá hạn
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Tổng khiếu nại" value={summary?.tong || 0} prefix={<AlertOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ borderTop: '3px solid #fa8c16' }}>
            <Statistic title="Mới gửi" value={counts.moi || 0} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ borderTop: '3px solid #1677ff' }}>
            <Statistic title="Đang xử lý" value={counts.dang_xu_ly || 0} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card style={{ borderTop: '3px solid #52c41a' }}>
            <Statistic
              title="Đã kết luận"
              value={(counts.co_sai_sot || 0) + (counts.khong_sai_sot || 0)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        title={`Danh sách khiếu nại (${rows.length})`}
        extra={
          <Space>
            <Select
              placeholder="Trạng thái"
              allowClear
              value={filters.trang_thai}
              onChange={(v) => setFilters(f => ({ ...f, trang_thai: v }))}
              style={{ width: 180 }}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
            {settingsButton}
          </Space>
        }
      >
        <Table
          dataSource={rows}
          loading={isLoading}
          rowKey="id"
          size="small"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 30 }}
          columns={displayColumns}
          expandable={{
            expandedRowRender: (r: any) => (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div>
                  <Text strong>Nội dung đầy đủ:</Text> {r.ly_do}
                </div>
                {r.bang_chung && (
                  <div>
                    <Text strong>Bằng chứng:</Text> {r.bang_chung}
                  </div>
                )}
                {r.ket_qua && (
                  <Alert
                    type={r.trang_thai === 'co_sai_sot' ? 'success' : 'warning'}
                    showIcon
                    message={
                      <>
                        <Text strong>Kết luận HR:</Text> {r.ket_qua}
                        {r.so_tien_dieu_chinh && (
                          <div>
                            <Text strong>Số tiền điều chỉnh:</Text> {fmt(r.so_tien_dieu_chinh)}đ
                            {r.adjustment_id && (
                              <Tag color="blue" style={{ marginLeft: 8 }}>
                                Đã tạo khoản điều chỉnh #{r.adjustment_id}
                              </Tag>
                            )}
                          </div>
                        )}
                      </>
                    }
                  />
                )}
              </Space>
            ),
            rowExpandable: (r: any) => r.ly_do.length > 50 || !!r.bang_chung || !!r.ket_qua,
          }}
        />
      </Card>

      {/* Modal kết luận */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            Kết luận khiếu nại — {selected?.ho_ten} • Kỳ {selected?.thang}/{selected?.nam}
          </Space>
        }
        open={resolveOpen}
        onCancel={() => { setResolveOpen(false); setSelected(null) }}
        onOk={() => form.submit()}
        okText="Lưu kết luận"
        cancelText="Hủy"
        confirmLoading={resolveMut.isPending}
        width={620}
        destroyOnClose
      >
        {selected && (
          <Alert
            type="info"
            message={
              <Text>
                <Text strong>Lý do khiếu nại:</Text> {selected.ly_do}
                {selected.so_tien_khieu_nai && (
                  <>
                    <br />
                    <Text strong>Số tiền NV đề xuất:</Text> {fmt(selected.so_tien_khieu_nai)}đ
                  </>
                )}
              </Text>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical" onFinish={(v) => resolveMut.mutate(v)} initialValues={{ co_sai_sot: true }}>
          <Form.Item
            name="co_sai_sot"
            label="Kết luận (Điều 16)"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Có sai sót — điều chỉnh"
              unCheckedChildren="Không có sai sót — giải thích"
            />
          </Form.Item>

          <Form.Item
            name="ket_qua"
            label="Nội dung kết luận / giải thích"
            rules={[
              { required: true, message: 'Vui lòng nhập kết luận' },
              { min: 10, max: 2000 },
            ]}
          >
            <TextArea
              rows={4}
              placeholder={
                watchedCoSaiSot
                  ? 'VD: Sau khi đối chiếu chấm công + sản lượng, công ty xác nhận thiếu 200.000đ tiền công nhật ngày 5/6/2026. Sẽ điều chỉnh vào kỳ lương tháng 7.'
                  : 'VD: Sau khi kiểm tra dữ liệu chấm công và sản lượng, số liệu là đúng. Giải thích: tháng này NV nghỉ 4 ngày không có đơn (chi tiết...). Liên hệ tổ trưởng nếu cần thêm thông tin.'
              }
            />
          </Form.Item>

          {watchedCoSaiSot && (
            <>
              <Form.Item
                name="so_tien_dieu_chinh"
                label="Số tiền điều chỉnh (Điều 16 — điều chỉnh kỳ lương gần nhất)"
                rules={[{ required: true, message: 'Nhập số tiền điều chỉnh' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={50000}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  addonAfter="đ"
                />
              </Form.Item>

              <Form.Item name="tao_dieu_chinh_ky_sau" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Tự tạo PayrollAdjustment kỳ sau" unCheckedChildren="Không tự tạo" />
              </Form.Item>

              <Form.Item
                name="sub_loai_dieu_chinh"
                label="Loại điều chỉnh"
                initialValue="pc_khac"
                tooltip="Sẽ được tạo thành 1 dòng PayrollAdjustment ở trạng thái dự thảo cho kỳ lương kế tiếp"
              >
                <Select options={SUB_LOAI_DIEU_CHINH} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
