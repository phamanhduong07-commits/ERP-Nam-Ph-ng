import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Table, message,
  Modal, Form, Input, InputNumber, Select, Row, Col, Divider, Alert, DatePicker,
  Steps, Badge, Tooltip, Radio,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SaveOutlined, PrinterOutlined, FileTextOutlined, BankOutlined,
  DollarOutlined, ExclamationCircleOutlined, CheckOutlined, SendOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  salesReturnsApi, type SalesReturn,
  SALES_RETURN_TRANG_THAI_LABELS, SALES_RETURN_TRANG_THAI_COLORS, TINH_TRANG_HANG_LABELS,
} from '../../api/salesReturns'
import { customerRefundApi, journalApi, TRANG_THAI_HOAN_TIEN } from '../../api/accounting'
import type { CustomerRefundVoucher } from '../../api/accounting'
import { printDocument, buildHtmlTable, fmtVND } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'
import PhotoCapture from '../../components/PhotoCapture'

const { Title, Text } = Typography
const { confirm } = Modal

const PHUONG_AN_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  chua_xuat_hd: {
    label: 'Chưa xuất hóa đơn',
    color: 'green',
    icon: <CheckOutlined />,
    desc: 'Đã giảm công nợ phải thu. Chưa có hóa đơn cần điều chỉnh.',
  },
  da_xuat_hd: {
    label: 'Đã xuất hóa đơn',
    color: 'orange',
    icon: <ExclamationCircleOutlined />,
    desc: 'Đã xuất hóa đơn nhưng chưa thu tiền. Cần tạo hóa đơn điều chỉnh giảm.',
  },
  da_thu_tien: {
    label: 'Đã thu tiền',
    color: 'red',
    icon: <DollarOutlined />,
    desc: 'Khách đã thanh toán. Cần hoàn tiền hoặc bù trừ công nợ kỳ sau.',
  },
}

export default function SalesReturnDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isCreateRoute = id === 'create'
  const returnId = Number(id)
  const hasValidReturnId = !isCreateRoute && Number.isInteger(returnId) && returnId > 0
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()
  const [refundForm] = Form.useForm()
  const [refundModalOpen, setRefundModalOpen] = useState(false)

  const { data: returnData, isLoading } = useQuery({
    queryKey: ['sales-return', id],
    queryFn: () => salesReturnsApi.get(returnId).then(r => r.data),
    enabled: hasValidReturnId,
  })

  const { data: refundVoucher, refetch: refetchVoucher } = useQuery<CustomerRefundVoucher | null>({
    queryKey: ['customer-refund-for-return', returnId],
    queryFn: () => customerRefundApi.list({ sales_return_id: returnId, page_size: 1 })
      .then((d: any) => d.items?.[0] ?? null),
    enabled: hasValidReturnId && returnData?.trang_thai === 'da_duyet',
  })

  const { data: journalData } = useQuery({
    queryKey: ['journal-for-return', returnId],
    queryFn: () => journalApi.list({ chung_tu_loai: 'sales_returns', chung_tu_id: returnId, page_size: 20 }),
    enabled: hasValidReturnId && returnData?.trang_thai === 'da_duyet',
  })

  const approveMutation = useMutation({
    mutationFn: () => salesReturnsApi.approve(returnId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu trả hàng — hàng đã nhập kho, công nợ đã cập nhật')
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      queryClient.invalidateQueries({ queryKey: ['customer-refund-for-return', returnId] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Có lỗi xảy ra'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => salesReturnsApi.cancel(returnId),
    onSuccess: () => {
      message.success('Đã hủy phiếu trả hàng')
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Có lỗi xảy ra'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => salesReturnsApi.update(returnId, data),
    onSuccess: () => {
      message.success('Đã cập nhật phiếu trả hàng')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Có lỗi xảy ra'),
  })

  const refundUpdateMutation = useMutation({
    mutationFn: (data: { hinh_thuc?: string; tk_hoan_tien?: string; dien_giai?: string }) =>
      customerRefundApi.update(refundVoucher!.id, data),
    onSuccess: () => {
      message.success('Đã cập nhật phiếu hoàn tiền')
      refetchVoucher()
      setRefundModalOpen(false)
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Có lỗi xảy ra'),
  })

  const refundApproveMutation = useMutation({
    mutationFn: () => customerRefundApi.approve(refundVoucher!.id),
    onSuccess: () => {
      message.success('Đã duyệt phiếu hoàn tiền')
      refetchVoucher()
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Có lỗi xảy ra'),
  })

  const handleApprove = () => {
    confirm({
      title: 'Xác nhận duyệt phiếu trả hàng',
      content: (
        <div>
          <p>Duyệt phiếu <strong>{returnData?.so_phieu_tra}</strong>?</p>
          <p style={{ color: '#666', fontSize: 13 }}>
            Hệ thống sẽ: nhập hàng vào kho · giảm công nợ phải thu · ghi bút toán 155/632 và 5213/131
          </p>
        </div>
      ),
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: () => approveMutation.mutate(),
    })
  }

  const handleCancel = () => {
    confirm({
      title: 'Xác nhận hủy phiếu trả hàng',
      content: `Hủy phiếu ${returnData?.so_phieu_tra}? Nếu đã duyệt, hàng sẽ được xuất lại khỏi kho.`,
      okText: 'Hủy phiếu',
      okType: 'danger',
      cancelText: 'Không',
      onOk: () => cancelMutation.mutate(),
    })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      updateMutation.mutate({
        ngay_tra: dayjs(values.ngay_tra).format('YYYY-MM-DD'),
        ly_do_tra: values.ly_do_tra,
        ghi_chu: values.ghi_chu,
        items: returnData?.items.map(item => ({
          delivery_order_item_id: item.delivery_order_item_id ?? undefined,
          sales_order_item_id: item.sales_order_item_id,
          so_luong_tra: values[`so_luong_tra_${item.id}`],
          don_gia_tra: values[`don_gia_tra_${item.id}`],
          ly_do_tra: values[`ly_do_tra_${item.id}`],
          tinh_trang_hang: values[`tinh_trang_hang_${item.id}`],
          ghi_chu: values[`ghi_chu_${item.id}`],
        })),
      })
    } catch {
      // form validation
    }
  }

  const handleRefundSubmit = async () => {
    try {
      const values = await refundForm.validateFields()
      refundUpdateMutation.mutate({
        hinh_thuc: values.hinh_thuc,
        tk_hoan_tien: values.hinh_thuc === 'hoan_tien' ? values.tk_hoan_tien : undefined,
        dien_giai: values.dien_giai,
      })
    } catch {
      // form validation
    }
  }

  const companyInfo = usePhapNhanForPrint()

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
      { totalRow: ['', 'TỔNG CỘNG', '', '', '', fmtVND(returnData.tong_tien_tra), '', ''] },
    )
    printDocument({
      companyInfo,
      title: `Phiếu trả hàng ${returnData.so_phieu_tra}`,
      subtitle: 'PHIẾU TRẢ HÀNG BÁN',
      logoUrl: companyInfo?.logo || '/logo_namphuong.png',
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
      logoUrl: companyInfo?.logo || '/logo_namphuong.png',
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
      footerHtml: `<div style="font-size:10px;color:#888">Căn cứ: Phiếu trả hàng ${returnData.so_phieu_tra}</div>`,
    })
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
        <Form.Item name={`so_luong_tra_${r.id}`} initialValue={r.so_luong_tra} rules={[{ required: true }]}>
          <InputNumber min={1} max={r.sales_order_item?.so_luong || 0} style={{ width: 80 }} />
        </Form.Item>
      ) : (
        <Text strong>{r.so_luong_tra}</Text>
      ),
    },
    {
      title: 'Đơn giá trả',
      width: 130,
      render: (_, r) => editing ? (
        <Form.Item name={`don_gia_tra_${r.id}`} initialValue={r.don_gia_tra} rules={[{ required: true }]}>
          <InputNumber min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} style={{ width: 110 }} />
        </Form.Item>
      ) : (
        new Intl.NumberFormat('vi-VN').format(r.don_gia_tra) + 'đ'
      ),
    },
    {
      title: 'Thành tiền',
      width: 130,
      align: 'right',
      render: (_, r) => (
        <Text strong style={{ color: '#cf1322' }}>
          {new Intl.NumberFormat('vi-VN').format(r.thanh_tien_tra)}đ
        </Text>
      ),
    },
    {
      title: 'Tình trạng hàng',
      width: 130,
      render: (_, r) => editing ? (
        <Form.Item name={`tinh_trang_hang_${r.id}`} initialValue={r.tinh_trang_hang}>
          <Select style={{ width: 110 }}>
            {Object.entries(TINH_TRANG_HANG_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      ) : (
        <Tag color={r.tinh_trang_hang === 'tot' ? 'green' : r.tinh_trang_hang === 'loi' ? 'orange' : 'red'}>
          {TINH_TRANG_HANG_LABELS[r.tinh_trang_hang] || r.tinh_trang_hang}
        </Tag>
      ),
    },
    {
      title: 'Lý do trả',
      width: 160,
      render: (_, r) => editing ? (
        <Form.Item name={`ly_do_tra_${r.id}`} initialValue={r.ly_do_tra}>
          <Input placeholder="Lý do..." size="small" />
        </Form.Item>
      ) : (
        r.ly_do_tra || '—'
      ),
    },
  ]

  if (isCreateRoute) return <Navigate to="/sales/returns/create" replace />
  if (!hasValidReturnId) return <Navigate to="/sales/returns" replace />
  if (isLoading || !returnData) return <div style={{ padding: 40 }}>Đang tải...</div>

  const canEdit = returnData.trang_thai === 'moi'
  const canApprove = returnData.trang_thai === 'moi'
  const canCancel = returnData.trang_thai !== 'huy'
  const salesOrder = returnData.sales_order
  const phuongAn = returnData.phuong_an_can_tru
  const phuongAnInfo = phuongAn ? PHUONG_AN_LABELS[phuongAn] : null

  const stepCurrent =
    returnData.trang_thai === 'huy' ? -1 :
    returnData.trang_thai === 'da_duyet' && refundVoucher?.trang_thai === 'da_duyet' ? 3 :
    returnData.trang_thai === 'da_duyet' ? 2 : 1

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/returns')}>
            Quay lại
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Phiếu trả hàng: <Text style={{ color: '#1677ff' }}>{returnData.so_phieu_tra}</Text>
          </Title>
          <Tag color={SALES_RETURN_TRANG_THAI_COLORS[returnData.trang_thai]} style={{ fontSize: 13 }}>
            {SALES_RETURN_TRANG_THAI_LABELS[returnData.trang_thai]}
          </Tag>
        </Space>
        <Space wrap>
          {canEdit && !editing && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Sửa</Button>
          )}
          {editing && (
            <>
              <Button onClick={() => setEditing(false)}>Hủy sửa</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={updateMutation.isPending} onClick={handleSave}>Lưu</Button>
            </>
          )}
          {canApprove && !editing && (
            <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending} onClick={handleApprove}>
              Duyệt phiếu
            </Button>
          )}
          {canCancel && !editing && (
            <Tooltip title={returnData.trang_thai === 'da_duyet' ? 'Hủy sẽ đảo ngược nhập kho và bút toán' : ''}>
              <Button danger icon={<CloseCircleOutlined />} loading={cancelMutation.isPending} onClick={handleCancel}>
                Hủy phiếu
              </Button>
            </Tooltip>
          )}
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>In phiếu trả</Button>
          {returnData.trang_thai === 'da_duyet' && (
            <Button icon={<PrinterOutlined />} onClick={handlePrintNhapKho}>In phiếu nhập kho</Button>
          )}
          {returnData.trang_thai === 'da_duyet' && returnData.sales_order_id && (
            <Tooltip title="Tạo phiếu giao hàng mới cho đơn hàng này (giao bù cho khách)">
              <Button
                icon={<SendOutlined />}
                onClick={() => navigate(`/sales/orders/${returnData.sales_order_id}`)}
              >
                Tạo giao hàng bù
              </Button>
            </Tooltip>
          )}
        </Space>
      </Space>

      {/* Progress Steps */}
      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <Steps
          size="small"
          current={stepCurrent}
          status={returnData.trang_thai === 'huy' ? 'error' : 'process'}
          items={[
            {
              title: 'Tạo phiếu',
              description: dayjs(returnData.created_at).format('DD/MM HH:mm'),
            },
            {
              title: returnData.trang_thai === 'huy' ? 'Đã hủy' : 'Duyệt phiếu',
              description: returnData.approved_at
                ? dayjs(returnData.approved_at).format('DD/MM HH:mm')
                : 'Chờ duyệt',
            },
            {
              title: 'Xử lý tài chính',
              description: phuongAn && phuongAnInfo
                ? <Tag color={phuongAnInfo.color}>{phuongAnInfo.label}</Tag>
                : (returnData.trang_thai === 'da_duyet' ? 'Đang xử lý' : ''),
            },
            {
              title: 'Hoàn tất',
              description: refundVoucher?.trang_thai === 'da_duyet' ? 'Đã xử lý' : '',
            },
          ]}
        />
      </Card>

      <Row gutter={16}>
        {/* Left — Thông tin phiếu */}
        <Col xs={24} xl={16}>
          {/* Thông tin chung */}
          <Card
            title={<Space><FileTextOutlined /> Thông tin phiếu trả</Space>}
            style={{ marginBottom: 16 }}
          >
            {editing ? (
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="ngay_tra" label="Ngày trả" initialValue={dayjs(returnData.ngay_tra)} rules={[{ required: true }]}>
                      <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="ly_do_tra" label="Lý do trả" initialValue={returnData.ly_do_tra} rules={[{ required: true }]}>
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
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2, md: 3 }}
                size="small"
                labelStyle={{ fontWeight: 600, background: '#fafafa', width: 130 }}
              >
                <Descriptions.Item label="Số phiếu">
                  <Text copyable strong style={{ color: '#1677ff' }}>{returnData.so_phieu_tra}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày trả">
                  {dayjs(returnData.ngay_tra).format('DD/MM/YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Đơn hàng gốc">
                  {salesOrder ? (
                    <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/sales/orders/${salesOrder.id}`)}>
                      {salesOrder.so_don}
                    </Button>
                  ) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng" span={2}>
                  {returnData.customer ? (
                    <Space>
                      <Text strong>{returnData.customer.ten_viet_tat}</Text>
                      <Text type="secondary">[{returnData.customer.ma_kh}]</Text>
                    </Space>
                  ) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Lý do trả">{returnData.ly_do_tra}</Descriptions.Item>
                <Descriptions.Item label="Người tạo">{returnData.ten_nguoi_tao || '—'}</Descriptions.Item>
                <Descriptions.Item label="Người duyệt">{returnData.ten_nguoi_duyet || '—'}</Descriptions.Item>
                <Descriptions.Item label="Tổng tiền trả">
                  <Text strong style={{ fontSize: 18, color: '#cf1322' }}>
                    {new Intl.NumberFormat('vi-VN').format(returnData.tong_tien_tra)}đ
                  </Text>
                </Descriptions.Item>
                {returnData.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={3}>{returnData.ghi_chu}</Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Card>

          {/* Chi tiết sản phẩm */}
          <Card title={`Chi tiết sản phẩm trả (${returnData.items.length} dòng)`}>
            {editing && (
              <Alert
                message="Đang ở chế độ chỉnh sửa"
                type="info"
                style={{ marginBottom: 12 }}
                showIcon
              />
            )}
            <Table
              columns={columns}
              dataSource={returnData.items}
              rowKey="id"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#fff7e6' }}>
                    <Table.Summary.Cell index={0} colSpan={4} align="right">
                      <Text strong>Tổng tiền trả:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#cf1322' }}>
                        {new Intl.NumberFormat('vi-VN').format(returnData.tong_tien_tra)}đ
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        {/* Right — Xử lý tài chính */}
        <Col xs={24} xl={8}>
          {/* Panel xử lý tài chính */}
          {returnData.trang_thai === 'da_duyet' && (
            <Card
              title={<Space><BankOutlined style={{ color: '#1677ff' }} /> Xử lý tài chính</Space>}
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              {/* Nhập kho */}
              <Alert
                message="✓ Đã nhập kho"
                description={`Hàng trả đã được nhập lại kho. Ngày duyệt: ${returnData.approved_at ? dayjs(returnData.approved_at).format('DD/MM/YYYY HH:mm') : '—'}`}
                type="success"
                style={{ marginBottom: 12 }}
              />

              {/* Phân loại case */}
              {phuongAnInfo && (
                <>
                  <Divider style={{ margin: '12px 0', fontSize: 12, color: '#888' }}>
                    Phương án cấn trừ
                  </Divider>
                  {phuongAn === 'chua_xuat_hd' && (
                    <Alert
                      icon={<CheckOutlined />}
                      message="Chưa xuất hóa đơn"
                      description="Đã giảm công nợ phải thu khách hàng. Không cần điều chỉnh hóa đơn."
                      type="success"
                      showIcon
                    />
                  )}

                  {phuongAn === 'da_xuat_hd' && (
                    <Alert
                      icon={<ExclamationCircleOutlined />}
                      message="Đã xuất hóa đơn — chưa thu tiền"
                      description={
                        <div>
                          <p style={{ marginBottom: 8 }}>
                            Đã giảm công nợ phải thu. Cần tạo <strong>hóa đơn điều chỉnh giảm</strong> để đối chiếu với hóa đơn gốc.
                          </p>
                          {returnData.so_hoa_don && (
                            <Button
                              size="small"
                              type="link"
                              icon={<FileTextOutlined />}
                              style={{ padding: 0 }}
                              onClick={() => navigate(`/billing/invoices/${returnData.sales_invoice_id}`)}
                            >
                              Xem HĐ {returnData.so_hoa_don}
                            </Button>
                          )}
                        </div>
                      }
                      type="warning"
                      showIcon
                    />
                  )}

                  {phuongAn === 'da_thu_tien' && (
                    <Alert
                      icon={<DollarOutlined />}
                      message="Đã thu tiền — cần hoàn trả khách"
                      description={
                        <div>
                          <p style={{ marginBottom: 4 }}>
                            Khách đã thanh toán đủ. Cần xử lý hoàn tiền hoặc bù trừ đơn kỳ sau.
                          </p>
                          {returnData.so_hoa_don && (
                            <Button
                              size="small"
                              type="link"
                              icon={<FileTextOutlined />}
                              style={{ padding: 0 }}
                              onClick={() => navigate(`/billing/invoices/${returnData.sales_invoice_id}`)}
                            >
                              Xem HĐ {returnData.so_hoa_don}
                            </Button>
                          )}
                        </div>
                      }
                      type="error"
                      showIcon
                    />
                  )}
                </>
              )}

              {/* Phiếu hoàn tiền */}
              {refundVoucher && (
                <>
                  <Divider style={{ margin: '12px 0', fontSize: 12, color: '#888' }}>
                    Phiếu hoàn tiền
                  </Divider>
                  <div style={{
                    background: refundVoucher.trang_thai === 'da_duyet' ? '#f6ffed' : '#fffbe6',
                    border: `1px solid ${refundVoucher.trang_thai === 'da_duyet' ? '#b7eb8f' : '#ffe58f'}`,
                    borderRadius: 6,
                    padding: '12px 14px',
                  }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text strong>{refundVoucher.so_phieu}</Text>
                      <Tag color={TRANG_THAI_HOAN_TIEN[refundVoucher.trang_thai]?.color}>
                        {TRANG_THAI_HOAN_TIEN[refundVoucher.trang_thai]?.label}
                      </Tag>
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Số tiền hoàn: </Text>
                      <Text strong style={{ color: '#1677ff' }}>
                        {Number(refundVoucher.so_tien).toLocaleString('vi-VN')}đ
                      </Text>
                    </div>
                    {refundVoucher.hinh_thuc && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Hình thức: </Text>
                        <Text style={{ fontSize: 12 }}>
                          {refundVoucher.hinh_thuc === 'bu_tru' ? '🔄 Bù trừ công nợ' :
                           refundVoucher.hinh_thuc === 'hoan_tien' ?
                             (refundVoucher.tk_hoan_tien === '111' ? '💵 Hoàn tiền mặt' : '🏦 Hoàn qua ngân hàng')
                           : '—'}
                        </Text>
                      </div>
                    )}

                    {refundVoucher.trang_thai === 'nhap' && (
                      <Space style={{ marginTop: 10, width: '100%' }} direction="vertical" size={6}>
                        {!refundVoucher.hinh_thuc && (
                          <Alert
                            message="Chọn hình thức hoàn tiền để duyệt phiếu"
                            type="info"
                            style={{ fontSize: 12 }}
                          />
                        )}
                        <Space>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              refundForm.setFieldsValue({
                                hinh_thuc: refundVoucher.hinh_thuc || 'bu_tru',
                                tk_hoan_tien: refundVoucher.tk_hoan_tien || '112',
                                dien_giai: refundVoucher.dien_giai,
                              })
                              setRefundModalOpen(true)
                            }}
                          >
                            Cập nhật hình thức
                          </Button>
                          {refundVoucher.hinh_thuc && (
                            <Button
                              size="small"
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              loading={refundApproveMutation.isPending}
                              onClick={() => {
                                confirm({
                                  title: 'Xác nhận duyệt phiếu hoàn tiền',
                                  content: `Duyệt phiếu ${refundVoucher.so_phieu} — ${Number(refundVoucher.so_tien).toLocaleString('vi-VN')}đ?`,
                                  okText: 'Duyệt',
                                  cancelText: 'Hủy',
                                  onOk: () => refundApproveMutation.mutate(),
                                })
                              }}
                            >
                              Duyệt hoàn tiền
                            </Button>
                          )}
                          <Button
                            size="small"
                            type="link"
                            onClick={() => navigate(`/accounting/customer-refunds/${refundVoucher.id}`)}
                          >
                            Xem chi tiết →
                          </Button>
                        </Space>
                      </Space>
                    )}

                    {refundVoucher.trang_thai === 'da_duyet' && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="success" style={{ fontSize: 12 }}>
                          ✓ Đã duyệt{refundVoucher.ngay_duyet ? ` — ${dayjs(refundVoucher.ngay_duyet).format('DD/MM/YYYY')}` : ''}
                        </Text>
                        <Button
                          size="small"
                          type="link"
                          style={{ fontSize: 12, paddingLeft: 4 }}
                          onClick={() => navigate(`/accounting/customer-refunds/${refundVoucher.id}`)}
                        >
                          Xem chi tiết
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Tóm tắt khi phiếu chưa duyệt */}
          {returnData.trang_thai === 'moi' && (
            <Card style={{ marginBottom: 16, background: '#e6f4ff', border: '1px solid #91caff' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong style={{ color: '#0958d9' }}>Khi duyệt phiếu này:</Text>
                <Text style={{ fontSize: 13 }}>✓ Hàng được nhập lại vào kho</Text>
                <Text style={{ fontSize: 13 }}>✓ Giảm công nợ phải thu khách hàng</Text>
                <Text style={{ fontSize: 13 }}>✓ Bút toán Nợ 155 / Có 632 (giá vốn)</Text>
                <Text style={{ fontSize: 13 }}>✓ Bút toán Nợ 5213 / Có 131 (doanh thu)</Text>
                <Text style={{ fontSize: 13 }}>✓ Tự động tạo phiếu hoàn tiền (nháp)</Text>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Tổng tiền trả: </Text>
                  <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                    {new Intl.NumberFormat('vi-VN').format(returnData.tong_tien_tra)}đ
                  </Text>
                </div>
              </Space>
            </Card>
          )}

          {/* Bút toán đã ghi */}
          {returnData.trang_thai === 'da_duyet' && journalData?.items?.length > 0 && (
            <Card
              title={<Space><BankOutlined style={{ color: '#722ed1' }} /> Bút toán đã ghi</Space>}
              size="small"
              style={{ marginBottom: 16 }}
              styles={{ body: { padding: '8px 12px' } }}
            >
              {journalData.items.map((je: any) => (
                <div key={je.id} style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {je.loai_but_toan === 'NHAP_TRA_HANG' ? 'Giá vốn' : 'Doanh thu'}
                    {' — '}{je.dien_giai}
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    {(je.lines || []).map((line: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        padding: '2px 0',
                        borderBottom: i < je.lines.length - 1 ? '1px dashed #f0f0f0' : undefined,
                      }}>
                        <Space size={4}>
                          {line.so_tien_no > 0
                            ? <Tag color="blue" style={{ fontSize: 11, padding: '0 4px' }}>Nợ {line.so_tk}</Tag>
                            : <Tag color="green" style={{ fontSize: 11, padding: '0 4px' }}>Có {line.so_tk}</Tag>
                          }
                          <Text type="secondary" style={{ fontSize: 11 }}>{line.dien_giai}</Text>
                        </Space>
                        <Text strong style={{ fontSize: 12, color: line.so_tien_no > 0 ? '#1677ff' : '#389e0d' }}>
                          {Number(line.so_tien_no || line.so_tien_co).toLocaleString('vi-VN')}đ
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Ảnh đính kèm */}
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <PhotoCapture
              module="sales_returns"
              recordId={returnId}
              label="Ảnh hàng trả / biên bản"
              readOnly={returnData.trang_thai === 'huy'}
            />
          </Card>

          {returnData.trang_thai === 'huy' && (
            <Alert
              message="Phiếu đã bị hủy"
              description="Mọi thay đổi về kho và công nợ đã được hoàn nguyên."
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </Col>
      </Row>

      {/* Modal chọn hình thức hoàn tiền */}
      <Modal
        title={<Space><DollarOutlined /> Cập nhật hình thức hoàn tiền</Space>}
        open={refundModalOpen}
        onCancel={() => setRefundModalOpen(false)}
        onOk={handleRefundSubmit}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={refundUpdateMutation.isPending}
        width={420}
      >
        <Form form={refundForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="hinh_thuc" label="Hình thức xử lý" rules={[{ required: true, message: 'Chọn hình thức' }]}>
            <Radio.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="bu_tru" style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong>Bù trừ công nợ</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Giảm vào đơn hàng kỳ sau, không trả tiền mặt
                    </Text>
                  </div>
                </Radio>
                <Radio value="hoan_tien" style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong>Hoàn tiền</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Trả tiền mặt hoặc chuyển khoản cho khách
                    </Text>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.hinh_thuc !== cur.hinh_thuc}>
            {({ getFieldValue }) =>
              getFieldValue('hinh_thuc') === 'hoan_tien' ? (
                <Form.Item name="tk_hoan_tien" label="Tài khoản hoàn tiền" rules={[{ required: true }]}>
                  <Radio.Group>
                    <Radio value="111">💵 TK 111 — Tiền mặt</Radio>
                    <Radio value="112">🏦 TK 112 — Ngân hàng</Radio>
                  </Radio.Group>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item name="dien_giai" label="Diễn giải">
            <Input.TextArea rows={2} placeholder="Ghi chú thêm về việc hoàn tiền..." />
          </Form.Item>

          <Alert
            message={`Số tiền hoàn: ${refundVoucher ? Number(refundVoucher.so_tien).toLocaleString('vi-VN') + 'đ' : '—'}`}
            type="info"
          />
        </Form>
      </Modal>
    </div>
  )
}
