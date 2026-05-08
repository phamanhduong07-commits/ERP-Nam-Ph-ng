import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Table, message,
  Modal, Form, Input, InputNumber, Select, Row, Col, Divider, Alert, DatePicker,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SaveOutlined, PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesReturnsApi, type SalesReturn, SALES_RETURN_TRANG_THAI_LABELS, SALES_RETURN_TRANG_THAI_COLORS, TINH_TRANG_HANG_LABELS } from '../../api/salesReturns'
import { customerRefundApi, CustomerRefundVoucher, TRANG_THAI_HOAN_TIEN } from '../../api/accounting'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'
import { printDocument, buildHtmlTable, fmtVND } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography
const { confirm } = Modal

export default function SalesReturnDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isCreateRoute = id === 'create'
  const returnId = Number(id)
  const hasValidReturnId = !isCreateRoute && Number.isInteger(returnId) && returnId > 0
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()

  const { data: returnData, isLoading } = useQuery({
    queryKey: ['sales-return', id],
    queryFn: () => salesReturnsApi.get(returnId).then(r => r.data),
    enabled: hasValidReturnId,
  })

  const { data: refundVoucher } = useQuery<CustomerRefundVoucher | null>({
    queryKey: ['customer-refund-for-return', returnId],
    queryFn: () => customerRefundApi.list({ sales_return_id: returnId, page_size: 1 })
      .then((d: any) => d.items?.[0] ?? null),
    enabled: hasValidReturnId && returnData?.trang_thai === 'da_duyet',
  })

  const approveMutation = useMutation({
    mutationFn: () => salesReturnsApi.approve(returnId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu trả hàng')
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho-tp-lsx'] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => salesReturnsApi.cancel(returnId),
    onSuccess: () => {
      message.success('Đã hủy phiếu trả hàng')
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho-tp-lsx'] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => salesReturnsApi.update(returnId, data),
    onSuccess: () => {
      message.success('Đã cập nhật phiếu trả hàng')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    },
  })

  const handleApprove = () => {
    confirm({
      title: 'Xác nhận duyệt phiếu trả hàng',
      content: `Bạn có chắc muốn duyệt phiếu trả hàng ${returnData?.so_phieu_tra}?`,
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: () => approveMutation.mutate(),
    })
  }

  const handleCancel = () => {
    confirm({
      title: 'Xác nhận hủy phiếu trả hàng',
      content: `Bạn có chắc muốn hủy phiếu trả hàng ${returnData?.so_phieu_tra}?`,
      okText: 'Hủy phiếu',
      okType: 'danger',
      cancelText: 'Không',
      onOk: () => cancelMutation.mutate(),
    })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ngay_tra: dayjs(values.ngay_tra).format('YYYY-MM-DD'),
        ly_do_tra: values.ly_do_tra,
        ghi_chu: values.ghi_chu,
        items: returnData?.items.map(item => ({
          sales_order_item_id: item.sales_order_item_id,
          so_luong_tra: values[`so_luong_tra_${item.id}`],
          don_gia_tra: values[`don_gia_tra_${item.id}`],
          ly_do_tra: values[`ly_do_tra_${item.id}`],
          tinh_trang_hang: values[`tinh_trang_hang_${item.id}`],
          ghi_chu: values[`ghi_chu_${item.id}`],
        })),
      }
      updateMutation.mutate(payload)
    } catch (err) {
      // Form validation error
    }
  }

  const columns: ColumnsType<SalesReturn['items'][0]> = [
    {
      title: 'Tên hàng',
      dataIndex: ['sales_order_item', 'ten_hang'],
      ellipsis: true,
    },
    {
      title: 'SL đã bán',
      width: 100,
      align: 'center',
      render: (_, r) => r.sales_order_item?.so_luong || 0,
    },
    {
      title: 'SL trả',
      width: 100,
      render: (_, r) => editing ? (
        <Form.Item
          name={`so_luong_tra_${r.id}`}
          initialValue={r.so_luong_tra}
          rules={[{ required: true, message: 'Nhập số lượng' }]}
        >
          <InputNumber
            min={1}
            max={r.sales_order_item?.so_luong || 0}
            style={{ width: 80 }}
          />
        </Form.Item>
      ) : (
        r.so_luong_tra
      ),
    },
    {
      title: 'Đơn giá trả',
      width: 120,
      render: (_, r) => editing ? (
        <Form.Item
          name={`don_gia_tra_${r.id}`}
          initialValue={r.don_gia_tra}
          rules={[{ required: true, message: 'Nhập đơn giá' }]}
        >
          <InputNumber
            min={0}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            style={{ width: 100 }}
          />
        </Form.Item>
      ) : (
        new Intl.NumberFormat('vi-VN').format(r.don_gia_tra) + 'đ'
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <Text strong>
          {new Intl.NumberFormat('vi-VN').format(r.thanh_tien_tra)}đ
        </Text>
      ),
    },
    {
      title: 'Tình trạng',
      width: 120,
      render: (_, r) => editing ? (
        <Form.Item
          name={`tinh_trang_hang_${r.id}`}
          initialValue={r.tinh_trang_hang}
        >
          <Select style={{ width: 100 }}>
            {Object.entries(TINH_TRANG_HANG_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      ) : (
        TINH_TRANG_HANG_LABELS[r.tinh_trang_hang] || r.tinh_trang_hang
      ),
    },
    {
      title: 'Lý do',
      width: 150,
      render: (_, r) => editing ? (
        <Form.Item name={`ly_do_tra_${r.id}`} initialValue={r.ly_do_tra}>
          <Input placeholder="Lý do trả..." size="small" />
        </Form.Item>
      ) : (
        r.ly_do_tra || '—'
      ),
    },
  ]

  const companyInfo = usePhapNhanForPrint()

  const handlePrintNhapKho = () => {
    if (!returnData) return
    const tableHtml = buildHtmlTable(
      [
        { header: 'STT', align: 'center' },
        { header: 'Tên hàng' },
        { header: 'SL nhập', align: 'center' },
        { header: 'ĐVT', align: 'center' },
        { header: 'Đơn giá', align: 'right' },
        { header: 'Thành tiền', align: 'right' },
        { header: 'Tình trạng' },
        { header: 'Ghi chú' },
      ],
      returnData.items.map((item, i) => [
        i + 1,
        item.sales_order_item?.ten_hang ?? '—',
        item.so_luong_tra,
        item.sales_order_item?.dvt ?? '',
        fmtVND(item.don_gia_tra),
        fmtVND(item.thanh_tien_tra),
        TINH_TRANG_HANG_LABELS[item.tinh_trang_hang] ?? item.tinh_trang_hang,
        item.ghi_chu ?? '—',
      ]),
      { totalRow: ['', 'TỔNG CỘNG', '', '', '', fmtVND(returnData.tong_tien_tra), '', ''] },
    )
    printDocument({
      companyInfo,
      title: `Phiếu nhập kho trả hàng ${returnData.so_phieu_tra}`,
      subtitle: 'PHIẾU NHẬP KHO (HÀNG TRẢ VỀ)',
      logoUrl: namPhuongLogo,
      documentNumber: returnData.so_phieu_tra,
      documentDate: dayjs(returnData.ngay_tra).format('DD/MM/YYYY'),
      status: 'Đã nhập kho',
      fields: [
        { label: 'Khách trả hàng', value: returnData.customer ? `[${returnData.customer.ma_kh}] ${returnData.customer.ten_viet_tat}` : '—' },
        { label: 'Đơn hàng gốc', value: returnData.sales_order?.so_don ?? '—' },
        { label: 'Lý do nhập', value: returnData.ly_do_tra ?? '—' },
        { label: 'Người duyệt', value: returnData.ten_nguoi_duyet ?? '—' },
        { label: 'Ngày duyệt', value: returnData.approved_at ? dayjs(returnData.approved_at).format('DD/MM/YYYY') : '—' },
      ],
      bodyHtml: tableHtml,
      footerHtml: `<div style="font-size:10px;color:#888">Mẫu nội bộ — Phiếu nhập kho hàng trả. Căn cứ: Phiếu trả hàng ${returnData.so_phieu_tra}</div>`,
    })
  }

  const handlePrint = () => {
    if (!returnData) return
    const tableHtml = buildHtmlTable(
      [
        { header: 'STT', align: 'center' },
        { header: 'Tên hàng' },
        { header: 'SL trả', align: 'center' },
        { header: 'ĐVT', align: 'center' },
        { header: 'Đơn giá', align: 'right' },
        { header: 'Thành tiền', align: 'right' },
        { header: 'Tình trạng' },
        { header: 'Lý do' },
      ],
      returnData.items.map((item, i) => [
        i + 1,
        item.sales_order_item?.ten_hang ?? '—',
        item.so_luong_tra,
        item.sales_order_item?.dvt ?? '',
        fmtVND(item.don_gia_tra),
        fmtVND(item.thanh_tien_tra),
        TINH_TRANG_HANG_LABELS[item.tinh_trang_hang] ?? item.tinh_trang_hang,
        item.ly_do_tra ?? '—',
      ]),
      {
        totalRow: ['', 'TỔNG CỘNG', '', '', '', fmtVND(returnData.tong_tien_tra), '', ''],
      },
    )
    printDocument({
      companyInfo,
      title: `Phiếu trả hàng ${returnData.so_phieu_tra}`,
      subtitle: 'PHIẾU TRẢ HÀNG BÁN',
      logoUrl: namPhuongLogo,
      documentNumber: returnData.so_phieu_tra,
      documentDate: dayjs(returnData.ngay_tra).format('DD/MM/YYYY'),
      status: SALES_RETURN_TRANG_THAI_LABELS[returnData.trang_thai] ?? returnData.trang_thai,
      fields: [
        { label: 'Khách hàng', value: returnData.customer ? `[${returnData.customer.ma_kh}] ${returnData.customer.ten_viet_tat}` : '—' },
        { label: 'Đơn hàng gốc', value: returnData.sales_order?.so_don ?? '—' },
        { label: 'Lý do trả', value: returnData.ly_do_tra ?? '—' },
        { label: 'Người tạo', value: returnData.ten_nguoi_tao ?? '—' },
        { label: 'Người duyệt', value: returnData.ten_nguoi_duyet ?? '—' },
      ],
      bodyHtml: tableHtml,
      footerHtml: returnData.ghi_chu ? `<div><strong>Ghi chú:</strong> ${returnData.ghi_chu}</div>` : '',
    })
  }

  if (isCreateRoute) {
    return <Navigate to="/sales/returns/create" replace />
  }

  if (!hasValidReturnId) {
    return <Navigate to="/sales/returns" replace />
  }

  if (isLoading || !returnData) {
    return <div>Loading...</div>
  }

  const canEdit = returnData.trang_thai === 'moi'
  const canApprove = returnData.trang_thai === 'moi'
  const canCancel = returnData.trang_thai === 'moi'
  const salesOrder = returnData.sales_order

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/returns')}>
            Quay lại
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Phiếu trả hàng: {returnData.so_phieu_tra}
          </Title>
          <Tag color={SALES_RETURN_TRANG_THAI_COLORS[returnData.trang_thai]}>
            {SALES_RETURN_TRANG_THAI_LABELS[returnData.trang_thai]}
          </Tag>
        </Space>
        <Space>
          {canEdit && !editing && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Sửa
            </Button>
          )}
          {editing && (
            <>
              <Button onClick={() => setEditing(false)}>Hủy</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={updateMutation.isPending}
                onClick={handleSave}
              >
                Lưu
              </Button>
            </>
          )}
          {canApprove && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={approveMutation.isPending}
              onClick={handleApprove}
            >
              Duyệt
            </Button>
          )}
          {canCancel && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              loading={cancelMutation.isPending}
              onClick={handleCancel}
            >
              Hủy phiếu
            </Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            In phiếu trả hàng
          </Button>
          {returnData.trang_thai === 'da_duyet' && (
            <Button icon={<PrinterOutlined />} onClick={handlePrintNhapKho}>
              In phiếu nhập kho
            </Button>
          )}
        </Space>
      </Space>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="Thông tin phiếu trả">
            {editing ? (
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="ngay_tra"
                      label="Ngày trả"
                      initialValue={dayjs(returnData.ngay_tra)}
                      rules={[{ required: true }]}
                    >
                      <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="ly_do_tra"
                      label="Lý do trả"
                      initialValue={returnData.ly_do_tra}
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="ghi_chu" label="Ghi chú" initialValue={returnData.ghi_chu}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            ) : (
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Số phiếu">{returnData.so_phieu_tra}</Descriptions.Item>
                <Descriptions.Item label="Ngày trả">{dayjs(returnData.ngay_tra).format('DD/MM/YYYY')}</Descriptions.Item>
                <Descriptions.Item label="Đơn hàng bán">
                  {salesOrder ? (
                    <Button
                      type="link"
                      onClick={() => navigate(`/sales/orders/${salesOrder.id}`)}
                    >
                      {salesOrder.so_don}
                    </Button>
                  ) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {returnData.customer ? `[${returnData.customer.ma_kh}] ${returnData.customer.ten_viet_tat}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Lý do trả">{returnData.ly_do_tra}</Descriptions.Item>
                <Descriptions.Item label="Tổng tiền trả">
                  <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                    {new Intl.NumberFormat('vi-VN').format(returnData.tong_tien_tra)}đ
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Người tạo">{returnData.ten_nguoi_tao || '—'}</Descriptions.Item>
                <Descriptions.Item label="Người duyệt">{returnData.ten_nguoi_duyet || '—'}</Descriptions.Item>
                <Descriptions.Item label="Ghi chú" span={2}>{returnData.ghi_chu || '—'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>

      <Divider />

      {returnData.trang_thai === 'da_duyet' && (
        <Alert
          message="Phiếu trả hàng đã được duyệt"
          description="Hàng trả đã được nhập lại vào kho. Kiểm tra tồn kho để xác nhận."
          type="success"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {returnData.trang_thai === 'da_duyet' && (
        <Card
          size="small"
          title="Phiếu hoàn tiền khách hàng"
          style={{ marginBottom: 16 }}
          extra={refundVoucher && (
            <Button size="small" type="link" onClick={() => navigate(`/accounting/customer-refunds/${refundVoucher.id}`)}>
              Xem chi tiết
            </Button>
          )}
        >
          {refundVoucher ? (
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="Số phiếu">
                <a onClick={() => navigate(`/accounting/customer-refunds/${refundVoucher.id}`)}>
                  {refundVoucher.so_phieu}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền">
                <Text strong style={{ color: '#1b168e' }}>
                  {Number(refundVoucher.so_tien).toLocaleString('vi-VN')} ₫
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={TRANG_THAI_HOAN_TIEN[refundVoucher.trang_thai]?.color ?? 'default'}>
                  {TRANG_THAI_HOAN_TIEN[refundVoucher.trang_thai]?.label ?? refundVoucher.trang_thai}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">Đang tải thông tin phiếu hoàn tiền...</Text>
          )}
        </Card>
      )}

      <Card title="Chi tiết sản phẩm trả">
        {editing && (
          <Alert
            message="Đang ở chế độ chỉnh sửa"
            description="Thay đổi thông tin và nhấn Lưu để cập nhật phiếu trả hàng."
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          columns={columns}
          dataSource={returnData.items}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}
