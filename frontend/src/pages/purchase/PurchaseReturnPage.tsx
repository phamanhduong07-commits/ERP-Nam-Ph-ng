/**
 * Trang Trả hàng / Giảm giá hàng mua
 *
 * Quy trình:
 *  1. Tạo phiếu (Nháp) → chọn NCC, loại (tra_hang | giam_gia), nhập giá trị
 *  2. Duyệt → ghi sổ công nợ + bút toán kế toán tự động
 *  3. Huỷ (chỉ khi còn Nháp)
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert, Badge, Button, Col, DatePicker, Descriptions, Drawer,
  Form, InputNumber, Modal, Popconfirm, Row, Select, Space,
  Statistic, Table, Tag, Tooltip, Typography, message, Input,
} from 'antd'
import {
  CheckOutlined, CloseOutlined, DeleteOutlined, FileExcelOutlined,
  MinusCircleOutlined, PlusOutlined, RollbackOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  purchaseReturnsApi,
  LOAI_LABELS, TRANG_THAI_COLOR, TRANG_THAI_LABELS,
} from '../../api/purchaseReturns'
import type { PurchaseReturnListItem, PurchaseReturn, CreatePurchaseReturnPayload } from '../../api/purchaseReturns'
import { suppliersApi, Supplier } from '../../api/suppliers'
import { exportToExcel } from '../../utils/exportUtils'
import { warehouseApi } from '../../api/warehouse'

const { Title, Text } = Typography

const fmtVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + 'đ'

function StatusBadge({ status }: { status: string }) {
  const color = TRANG_THAI_COLOR[status] || 'default'
  return <Tag color={color}>{TRANG_THAI_LABELS[status] || status}</Tag>
}

export default function PurchaseReturnPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterSupplier, setFilterSupplier] = useState<number | undefined>()
  const [filterLoai, setFilterLoai] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const [thue_suat, setThueSuat] = useState(0)
  const [tong_tien_hang, setTongTienHang] = useState(0)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: listData, isLoading } = useQuery({
    queryKey: ['purchase-returns', page, filterSupplier, filterLoai, filterTrangThai, filterXuong],
    queryFn: () => purchaseReturnsApi.list({
      supplier_id: filterSupplier,
      loai: filterLoai,
      trang_thai: filterTrangThai,
      phan_xuong_id: filterXuong,
      page,
      page_size: 20,
    }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })

  const { data: detail } = useQuery({
    queryKey: ['purchase-return-detail', detailId],
    queryFn: () => purchaseReturnsApi.get(detailId!).then(r => r.data),
    enabled: !!detailId,
  })

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: CreatePurchaseReturnPayload) => purchaseReturnsApi.create(data),
    onSuccess: () => {
      message.success('Đã tạo phiếu trả hàng')
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      setCreateOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi tạo phiếu'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => purchaseReturnsApi.approve(id),
    onSuccess: () => {
      message.success('Đã duyệt — sổ công nợ đã được cập nhật')
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      qc.invalidateQueries({ queryKey: ['purchase-return-detail', detailId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi duyệt'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => purchaseReturnsApi.cancel(id),
    onSuccess: () => {
      message.success('Đã huỷ phiếu')
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      qc.invalidateQueries({ queryKey: ['purchase-return-detail', detailId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi huỷ'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseReturnsApi.delete(id),
    onSuccess: () => {
      message.success('Đã xoá phiếu')
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      setDetailId(null)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  // ── Columns list ──────────────────────────────────────────────────────────────
  const columns: ColumnsType<PurchaseReturnListItem> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 140,
      render: (v: string, r) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailId(r.id)}>
          <Text code style={{ fontSize: 12 }}>{v}</Text>
        </Button>
      ),
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'ten_ncc',
      ellipsis: true,
    },
    {
      title: 'Xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 120,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'tra_hang' ? 'orange' : 'blue'}>{LOAI_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: 'Tổng TT',
      dataIndex: 'tong_thanh_toan',
      width: 130,
      align: 'right',
      render: (v: number) => <Text strong style={{ color: '#fa8c16' }}>{fmtVND(v)}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, r: PurchaseReturnListItem) => (
        <Space>
          {r.trang_thai === 'nhap' && (
            <Tooltip title="Duyệt">
              <Button
                type="primary" size="small" icon={<CheckOutlined />}
                onClick={() => approveMut.mutate(r.id)}
                loading={approveMut.isPending}
              />
            </Tooltip>
          )}
          {r.trang_thai === 'nhap' && (
            <Popconfirm title="Xoá phiếu này?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ── Form create ───────────────────────────────────────────────────────────────
  const tien_thue = Math.round(tong_tien_hang * thue_suat / 100)
  const tong_tt = tong_tien_hang + tien_thue

  function handleCreate(values: any) {
    const items = (values.items || []).map((it: any) => ({
      paper_material_id: null,
      other_material_id: null,
      ten_hang: it.ten_hang || '',
      so_luong: it.so_luong || 0,
      dvt: it.dvt || 'Kg',
      don_gia: it.don_gia || 0,
      ghi_chu: it.ghi_chu || null,
    }))
    createMut.mutate({
      supplier_id: values.supplier_id,
      ngay: values.ngay.format('YYYY-MM-DD'),
      loai: values.loai,
      invoice_id: values.invoice_id || null,
      ly_do: values.ly_do || null,
      thue_suat: thue_suat,
      tong_tien_hang: tong_tien_hang,
      ghi_chu: values.ghi_chu || null,
      items,
    })
  }

  // Safe map for options
  const supplierOptions = Array.isArray(suppliers) 
    ? suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi })) 
    : []

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <RollbackOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
            <Title level={4} style={{ margin: 0 }}>Trả hàng / Giảm giá hàng mua</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              style={{ color: '#217346', borderColor: '#217346' }}
              onClick={() => exportToExcel(`TraHangNCC_${dayjs().format('YYYYMMDD')}`, [{
                name: 'Trả hàng NCC',
                headers: ['Số phiếu', 'Ngày', 'Nhà cung cấp', 'Loại', 'Tổng thanh toán', 'Trạng thái'],
                rows: (listData?.items ?? []).map((r: PurchaseReturnListItem) => [
                  r.so_phieu,
                  dayjs(r.ngay).format('DD/MM/YYYY'),
                  r.ten_ncc,
                  LOAI_LABELS[r.loai] || r.loai,
                  r.tong_thanh_toan,
                  TRANG_THAI_LABELS[r.trang_thai] || r.trang_thai,
                ]),
                colWidths: [18, 12, 25, 14, 16, 12],
              }])}
            >
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Tạo phiếu
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Filter */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col>
          <Select
            style={{ width: 220 }}
            placeholder="Tất cả NCC"
            allowClear
            showSearch
            optionFilterProp="label"
            value={filterSupplier}
            onChange={v => { setFilterSupplier(v); setPage(1) }}
            options={supplierOptions}
          />
        </Col>
        <Col>
          <Select
            style={{ width: 140 }}
            placeholder="Loại"
            allowClear
            value={filterLoai}
            onChange={v => { setFilterLoai(v); setPage(1) }}
            options={[
              { value: 'tra_hang', label: 'Trả hàng' },
              { value: 'giam_gia', label: 'Giảm giá' },
            ]}
          />
        </Col>
        <Col>
          <Select
            style={{ width: 140 }}
            placeholder="Trạng thái"
            allowClear
            value={filterTrangThai}
            onChange={v => { setFilterTrangThai(v); setPage(1) }}
            options={[
              { value: 'nhap', label: 'Nháp' },
              { value: 'da_duyet', label: 'Đã duyệt' },
              { value: 'huy', label: 'Đã huỷ' },
            ]}
          />
        </Col>
        <Col>
          <Select
            style={{ width: 160 }}
            placeholder="Tất cả xưởng"
            allowClear
            value={filterXuong}
            onChange={v => { setFilterXuong(v); setPage(1) }}
            options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))}
          />
        </Col>
      </Row>

      <Table<PurchaseReturnListItem>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={listData?.items ?? []}
        columns={columns}
        pagination={{
          current: page,
          pageSize: 20,
          total: listData?.total ?? 0,
          onChange: setPage,
          showTotal: t => `${t} phiếu`,
        }}
        scroll={{ x: 800 }}
      />

      {/* ── Drawer chi tiết ── */}
      <Drawer
        title={
          detail ? (
            <Space>
              <Text code>{detail.so_phieu}</Text>
              <Tag color={detail.loai === 'tra_hang' ? 'orange' : 'blue'}>
                {LOAI_LABELS[detail.loai]}
              </Tag>
              <StatusBadge status={detail.trang_thai} />
            </Space>
          ) : 'Chi tiết phiếu'
        }
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={620}
        extra={
          detail && detail.trang_thai === 'nhap' ? (
            <Space>
              <Button
                type="primary" icon={<CheckOutlined />}
                loading={approveMut.isPending}
                onClick={() => approveMut.mutate(detail.id)}
              >
                Duyệt phiếu
              </Button>
              <Popconfirm
                title="Huỷ phiếu này?"
                onConfirm={() => cancelMut.mutate(detail.id)}
              >
                <Button danger icon={<CloseOutlined />}>Huỷ</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {detail.trang_thai === 'da_duyet' && (
              <Alert
                type="success"
                showIcon
                message="Đã duyệt — sổ công nợ và bút toán kế toán đã được ghi nhận"
              />
            )}

            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Ngày">
                {dayjs(detail.ngay).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Loại">
                <Tag color={detail.loai === 'tra_hang' ? 'orange' : 'blue'}>
                  {LOAI_LABELS[detail.loai]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nhà cung cấp" span={2}>
                {detail.ten_ncc}
              </Descriptions.Item>
              {detail.ly_do && (
                <Descriptions.Item label="Lý do" span={2}>{detail.ly_do}</Descriptions.Item>
              )}
              {detail.invoice_id && (
                <Descriptions.Item label="Hóa đơn gốc">#{detail.invoice_id}</Descriptions.Item>
              )}
            </Descriptions>

            <Row gutter={12}>
              <Col span={8}>
                <Statistic
                  title="Tiền hàng"
                  value={detail.tong_tien_hang}
                  formatter={v => fmtVND(Number(v))}
                  valueStyle={{ fontSize: 15 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={`Thuế (${detail.thue_suat}%)`}
                  value={detail.tien_thue}
                  formatter={v => fmtVND(Number(v))}
                  valueStyle={{ fontSize: 15 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Tổng thanh toán"
                  value={detail.tong_thanh_toan}
                  formatter={v => fmtVND(Number(v))}
                  valueStyle={{ fontSize: 15, color: '#fa8c16' }}
                />
              </Col>
            </Row>

            {detail.trang_thai === 'da_duyet' && (
              <Alert
                type="info"
                showIcon
                message={
                  detail.loai === 'tra_hang'
                    ? 'Bút toán: Nợ TK 331 / Có TK 152 + TK 133'
                    : 'Bút toán: Nợ TK 331 / Có TK 632'
                }
              />
            )}

            {detail.items.length > 0 && (
              <Table
                rowKey="id"
                size="small"
                dataSource={detail.items}
                pagination={false}
                columns={[
                  { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                  { title: 'SL', dataIndex: 'so_luong', width: 80, align: 'right' },
                  { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
                  {
                    title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right',
                    render: (v: number) => fmtVND(v),
                  },
                  {
                    title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, align: 'right',
                    render: (v: number) => <Text strong>{fmtVND(v)}</Text>,
                  },
                ]}
              />
            )}
          </Space>
        )}
      </Drawer>

      {/* ── Modal tạo phiếu ── */}
      <Modal
        title={
          <Space>
            <RollbackOutlined />
            <span>Tạo phiếu trả hàng / giảm giá</span>
          </Space>
        }
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Tạo phiếu"
        confirmLoading={createMut.isPending}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ loai: 'tra_hang', ngay: dayjs() }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={supplierOptions}
                  placeholder="Chọn NCC"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ngay" label="Ngày" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'tra_hang', label: 'Trả hàng' },
                  { value: 'giam_gia', label: 'Giảm giá' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ly_do" label="Lý do">
                <Input.TextArea rows={2} placeholder="Hàng lỗi, sai quy cách..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoice_id" label="Số HĐ gốc (nếu có)">
                <InputNumber style={{ width: '100%' }} placeholder="ID hóa đơn mua" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Tiền hàng (chưa thuế)" required>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/,/g, ''))}
                  min={0}
                  onChange={v => setTongTienHang(Number(v) || 0)}
                  value={tong_tien_hang || undefined}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Thuế suất (%)">
                <Select
                  value={thue_suat}
                  onChange={setThueSuat}
                  options={[
                    { value: 0, label: '0% (không thuế)' },
                    { value: 8, label: '8%' },
                    { value: 10, label: '10%' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Tổng thanh toán">
                <Text strong style={{ color: '#fa8c16', fontSize: 16 }}>{fmtVND(tong_tt)}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ({fmtVND(tong_tien_hang)} + thuế {fmtVND(tien_thue)})
                </Text>
              </Form.Item>
            </Col>
          </Row>

          {/* Items */}
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 13 }}>Chi tiết hàng (tuỳ chọn)</Text>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => add()}>
                    Thêm dòng
                  </Button>
                </div>
                {fields.map(field => (
                  <Row key={field.key} gutter={8} align="middle" style={{ marginBottom: 4 }}>
                    <Col flex="auto">
                      <Form.Item name={[field.name, 'ten_hang']} noStyle>
                        <Input placeholder="Tên hàng" />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 80 }}>
                      <Form.Item name={[field.name, 'so_luong']} noStyle>
                        <InputNumber placeholder="SL" style={{ width: '100%' }} min={0} />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 60 }}>
                      <Form.Item name={[field.name, 'dvt']} noStyle>
                        <Input placeholder="ĐVT" />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 110 }}>
                      <Form.Item name={[field.name, 'don_gia']} noStyle>
                        <InputNumber placeholder="Đơn giá" style={{ width: '100%' }} min={0} />
                      </Form.Item>
                    </Col>
                    <Col>
                      <MinusCircleOutlined
                        style={{ color: '#ff4d4f', cursor: 'pointer' }}
                        onClick={() => remove(field.name)}
                      />
                    </Col>
                  </Row>
                ))}
              </>
            )}
          </Form.List>

          <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginTop: 12 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
