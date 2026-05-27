import { useState } from 'react'
import {
  Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm,
  Select, Space, Table, Tag, Tooltip, App,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, FileTextOutlined,
  PlusOutlined, StopOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  hdtApi, HoaDonDienTu, HoaDonItem,
  TRANG_THAI_HDT, TRANG_THAI_HDT_COLOR,
} from '../../api/hoaDonDienTu'
import type { SalesInvoice } from '../../api/billing'
import type { DeliveryOrder, DeliveryOrderItem } from '../../api/deliveries'
import { useAuthStore } from '../../store/auth'
import { fmtVND } from '../../utils/exportUtils'

interface ApiError {
  response?: { data?: { detail?: string } }
}

/** DeliveryOrderItem extended with the optional ma_hang field present on some items */
interface DeliveryOrderItemWithMaHang extends DeliveryOrderItem {
  ma_hang?: string
}

const HDT_ROLES = ['KE_TOAN', 'KE_TOAN_CONG_NO', 'KE_TOAN_TRUONG', 'GIAM_DOC', 'ADMIN']

interface Props {
  invoice: SalesInvoice
  deliveryOrder?: DeliveryOrder | null
}

export default function HoaDonDienTuCard({ invoice, deliveryOrder }: Props) {
  const { user } = useAuthStore()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const canCreate = HDT_ROLES.includes(user?.role ?? '')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showHuyModal, setShowHuyModal] = useState<HoaDonDienTu | null>(null)
  const [createForm] = Form.useForm()
  const [huyForm] = Form.useForm()

  const { data: hdtList = [], isLoading } = useQuery({
    queryKey: ['hoa-don-dien-tu', { sales_invoice_id: invoice.id }],
    queryFn: () => hdtApi.list({ sales_invoice_id: invoice.id }).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu', { sales_invoice_id: invoice.id }] })

  // Tạo items mặc định từ delivery order hoặc fallback 1 dòng
  const buildDefaultItems = (): HoaDonItem[] => {
    if (deliveryOrder?.items && deliveryOrder.items.length > 0) {
      return deliveryOrder.items.map(it => ({
        ten_hang: it.ten_hang,
        ma_hang: (it as DeliveryOrderItemWithMaHang).ma_hang ?? '',
        don_vi: it.dvt,
        so_luong: it.so_luong,
        don_gia: it.don_gia,
        thanh_tien: it.thanh_tien,
        thue_suat: `${invoice.ty_le_vat ?? 10}%`,
      }))
    }
    return [{
      ten_hang: 'Thùng carton (theo đơn hàng)',
      ma_hang: '',
      don_vi: 'Thùng',
      so_luong: 1,
      don_gia: Number(invoice.tong_tien_hang),
      thanh_tien: Number(invoice.tong_tien_hang),
      thue_suat: `${invoice.ty_le_vat ?? 10}%`,
    }]
  }

  const openCreateModal = () => {
    createForm.setFieldsValue({
      ngay_lap: dayjs(),
      loai_hd: '1',
      ten_khach_hang: invoice.ten_don_vi ?? '',
      ma_so_thue_kh: invoice.ma_so_thue ?? '',
      dia_chi_kh: invoice.dia_chi ?? '',
      ghi_chu: '',
    })
    setShowCreateModal(true)
  }

  const createMut = useMutation({
    mutationFn: (values: Record<string, unknown> & { ngay_lap: dayjs.Dayjs; loai_hd: string; ten_khach_hang: string; ma_so_thue_kh?: string; dia_chi_kh?: string; ghi_chu?: string }) => hdtApi.create({
      ngay_lap: values.ngay_lap.format('YYYY-MM-DD'),
      loai_hd: values.loai_hd,
      ten_khach_hang: values.ten_khach_hang,
      ma_so_thue_kh: values.ma_so_thue_kh || undefined,
      dia_chi_kh: values.dia_chi_kh || undefined,
      tong_tien_hang: Number(invoice.tong_tien_hang),
      tien_thue_gtgt: Number(invoice.tien_vat ?? 0),
      tong_cong: Number(invoice.tong_cong),
      items: buildDefaultItems(),
      sales_order_id: invoice.sales_order_id ?? undefined,
      sales_invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      phap_nhan_id: invoice.phap_nhan_id ?? undefined,
      ghi_chu: values.ghi_chu || undefined,
    }),
    onSuccess: () => {
      message.success('Đã tạo hóa đơn điện tử')
      setShowCreateModal(false)
      createForm.resetFields()
      invalidate()
    },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo HĐDT'),
  })

  const phatHanhMut = useMutation({
    mutationFn: (id: number) => hdtApi.phatHanh(id),
    onSuccess: () => { invalidate(); message.success('Phát hành thành công') },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi phát hành MISA'),
  })

  const syncMut = useMutation({
    mutationFn: (id: number) => hdtApi.syncStatus(id),
    onSuccess: () => { invalidate(); message.success('Đã đồng bộ trạng thái') },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi sync'),
  })

  const huyMut = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) => hdtApi.huy(id, ly_do),
    onSuccess: () => {
      invalidate()
      message.success('Đã hủy hóa đơn điện tử')
      setShowHuyModal(null)
      huyForm.resetFields()
    },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy HĐDT'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => hdtApi.delete(id),
    onSuccess: () => { invalidate(); message.success('Đã xóa HĐDT nháp') },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi xóa'),
  })

  const columns: ColumnsType<HoaDonDienTu> = [
    {
      title: 'Số HĐ',
      dataIndex: 'so_hoa_don',
      width: 140,
      render: v => v || <span style={{ color: '#aaa' }}>Chưa phát hành</span>,
    },
    { title: 'Ký hiệu', dataIndex: 'ky_hieu', width: 90 },
    {
      title: 'Ngày lập',
      dataIndex: 'ngay_lap',
      width: 100,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      width: 130,
      align: 'right',
      render: v => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: v => <Tag color={TRANG_THAI_HDT_COLOR[v] ?? 'default'}>{TRANG_THAI_HDT[v] ?? v}</Tag>,
    },
    {
      title: 'Thao tác',
      width: 160,
      render: (_, r) => (
        <Space size="small">
          {r.pdf_url && (
            <Tooltip title="Xem PDF">
              <Button size="small" icon={<FileTextOutlined />}
                onClick={() => window.open(r.pdf_url!, '_blank')} />
            </Tooltip>
          )}
          {r.trang_thai === 'nhap' && (
            <Tooltip title="Phát hành lên MISA">
              <Popconfirm title="Phát hành HĐDT lên MISA?" onConfirm={() => phatHanhMut.mutate(r.id)}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  loading={phatHanhMut.isPending} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.misa_id && r.trang_thai !== 'nhap' && (
            <Tooltip title="Sync trạng thái từ MISA">
              <Button size="small" icon={<SyncOutlined />}
                loading={syncMut.isPending}
                onClick={() => syncMut.mutate(r.id)} />
            </Tooltip>
          )}
          {r.trang_thai === 'da_phat_hanh' && (
            <Tooltip title="Hủy HĐDT">
              <Button size="small" danger icon={<StopOutlined />}
                onClick={() => setShowHuyModal(r)} />
            </Tooltip>
          )}
          {r.trang_thai === 'nhap' && (
            <Tooltip title="Xóa nháp">
              <Popconfirm title="Xóa HĐDT nháp?" onConfirm={() => deleteMut.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const isInvoiceIssued = ['da_phat_hanh', 'da_tt_mot_phan', 'da_tt_du', 'qua_han'].includes(invoice.trang_thai)

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined style={{ color: '#722ed1' }} />
            <span>Hóa đơn điện tử (MISA)</span>
            {hdtList.length > 0 && <Tag color="purple">{hdtList.length} HĐ</Tag>}
          </Space>
        }
        extra={
          canCreate && isInvoiceIssued && (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
            >
              Tạo HĐDT
            </Button>
          )
        }
        style={{ marginBottom: 16 }}
      >
        {hdtList.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#aaa' }}>
            Chưa có hóa đơn điện tử
            {!isInvoiceIssued && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Phát hành hóa đơn bán hàng trước khi tạo HĐDT
              </div>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={hdtList}
            rowKey="id"
            size="small"
            loading={isLoading}
            pagination={false}
          />
        )}
      </Card>

      {/* Modal tạo HĐDT */}
      <Modal
        title="Tạo hóa đơn điện tử"
        open={showCreateModal}
        onCancel={() => { setShowCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        okText="Tạo HĐDT (Nháp)"
        confirmLoading={createMut.isPending}
        destroyOnClose
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={createMut.mutate}>
          <Form.Item name="ngay_lap" label="Ngày lập" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="loai_hd" label="Loại hóa đơn" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="1">01 — HĐ GTGT</Select.Option>
              <Select.Option value="2">02 — HĐ bán hàng</Select.Option>
              <Select.Option value="7">07 — Phiếu xuất kho</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="ten_khach_hang" label="Tên khách hàng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ma_so_thue_kh" label="Mã số thuế KH">
            <Input />
          </Form.Item>
          <Form.Item name="dia_chi_kh" label="Địa chỉ KH">
            <Input.TextArea rows={2} />
          </Form.Item>

          {/* Thông tin tài chính chỉ đọc */}
          <div style={{
            background: '#f6f8ff', borderRadius: 6, padding: '10px 14px',
            marginBottom: 16, fontSize: 13, border: '1px solid #e6eaff',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#4a6cf7' }}>Thông tin tài chính (từ hóa đơn bán)</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <span style={{ color: '#888' }}>Tiền hàng: </span>
                <strong>{fmtVND(invoice.tong_tien_hang)}</strong>
              </div>
              <div>
                <span style={{ color: '#888' }}>VAT ({invoice.ty_le_vat}%): </span>
                <strong>{fmtVND(invoice.tien_vat ?? 0)}</strong>
              </div>
              <div>
                <span style={{ color: '#888' }}>Tổng cộng: </span>
                <strong style={{ color: '#1677ff' }}>{fmtVND(invoice.tong_cong)}</strong>
              </div>
            </div>
          </div>

          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal hủy HĐDT */}
      <Modal
        title="Hủy hóa đơn điện tử"
        open={!!showHuyModal}
        onCancel={() => { setShowHuyModal(null); huyForm.resetFields() }}
        onOk={() => huyForm.validateFields().then(vals => {
          if (showHuyModal) huyMut.mutate({ id: showHuyModal.id, ly_do: vals.ly_do })
        })}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={huyMut.isPending}
        destroyOnClose
      >
        <Form form={huyForm} layout="vertical">
          <Form.Item name="ly_do" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
            <Input.TextArea rows={3} placeholder="Mô tả lý do hủy hóa đơn điện tử..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
