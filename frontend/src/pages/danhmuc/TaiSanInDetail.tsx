import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Button, Space, Tag, Table, Modal, Form, Select,
  InputNumber, Input, message, Popconfirm, Divider, Alert, Tooltip,
  Statistic, Row, Col,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons'
import {
  taiSanInApi, type TaiSanInDetail as TaiSanInDetailType,
  LOAI_LABELS, NGUOI_CHI_TRA_LABELS, TRANG_THAI_LABELS, TRANG_THAI_COLORS,
  type TaiSanTrangThai,
} from '../../api/taiSanIn'
import { productsApi } from '../../api/products'
import type { ColumnsType } from 'antd/es/table'
import type { SanPhamLink } from '../../api/taiSanIn'

const NEXT_TRANG_THAI: Record<TaiSanTrangThai, TaiSanTrangThai[]> = {
  cho_mua:    ['dang_mua'],
  dang_mua:   ['dang_dung'],
  dang_dung:  ['hong', 'da_tra_khach', 'mat'],
  hong:       ['mat', 'da_tra_khach'],
  da_tra_khach: [],
  mat:        [],
}

const TRANG_THAI_BTN_LABEL: Record<TaiSanTrangThai, string> = {
  cho_mua: 'Chờ mua',
  dang_mua: 'Đang mua',
  dang_dung: 'Nhập kho / Đang dùng',
  hong: 'Đánh hỏng',
  da_tra_khach: 'Trả khách',
  mat: 'Mất',
}

export default function TaiSanInDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addSpForm] = Form.useForm()
  const [addSpOpen, setAddSpOpen] = useState(false)
  const [linkPoOpen, setLinkPoOpen] = useState(false)
  const [linkSoOpen, setLinkSoOpen] = useState(false)
  const [linkPhieuChiOpen, setLinkPhieuChiOpen] = useState(false)
  const [linkPoForm] = Form.useForm()
  const [linkSoForm] = Form.useForm()
  const [linkPcForm] = Form.useForm()

  const numId = Number(id)

  const { data: obj, isLoading } = useQuery({
    queryKey: ['tai-san-in', numId],
    queryFn: () => taiSanInApi.get(numId).then(r => r.data),
    enabled: !!numId,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products-for-customer', obj?.customer_id],
    queryFn: () => productsApi.byCustomer(obj!.customer_id).then(r => r.data),
    enabled: !!obj?.customer_id,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tai-san-in', numId] })

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof taiSanInApi.update>[1]) =>
      taiSanInApi.update(numId, data),
    onSuccess: () => { invalidate(); message.success('Đã cập nhật') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const addSpMut = useMutation({
    mutationFn: (data: { san_pham_id: number; ghi_chu?: string }) =>
      taiSanInApi.addSanPham(numId, data),
    onSuccess: () => {
      invalidate()
      setAddSpOpen(false)
      addSpForm.resetFields()
      message.success('Đã thêm sản phẩm')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const removeSpMut = useMutation({
    mutationFn: (spId: number) => taiSanInApi.removeSanPham(numId, spId),
    onSuccess: () => { invalidate(); message.success('Đã gỡ sản phẩm') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  if (isLoading || !obj) return <Card loading />

  const isCongTy = obj.nguoi_chi_tra === 'cong_ty'
  const linkedSpIds = new Set(obj.san_pham_links.map(l => l.san_pham_id))
  const availableProducts = products.filter((p: any) => !linkedSpIds.has(p.id))

  const sanLuongThucTe = Number(obj.san_luong_thuc_te ?? 0)
  const dieuKienHoan =
    obj.san_luong_dinh_muc_hoan != null &&
    sanLuongThucTe >= Number(obj.san_luong_dinh_muc_hoan)

  const nextStates = NEXT_TRANG_THAI[obj.trang_thai as TaiSanTrangThai] ?? []

  const spColumns: ColumnsType<SanPhamLink> = [
    { title: 'Mã AMIS', dataIndex: 'ma_amis', width: 120 },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 120 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'Ghi chú', dataIndex: 'ghi_chu' },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, row) => (
        <Popconfirm title="Gỡ liên kết?" onConfirm={() => removeSpMut.mutate(row.san_pham_id)}>
          <Button type="link" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tai-san-in')}>
        Danh sách
      </Button>

      {/* Header Card */}
      <Card
        title={
          <Space>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{obj.ma_tai_san}</span>
            <Tag color={obj.loai === 'ban_in' ? 'blue' : 'purple'}>
              {LOAI_LABELS[obj.loai as keyof typeof LOAI_LABELS]}
            </Tag>
            <Tag color={TRANG_THAI_COLORS[obj.trang_thai as TaiSanTrangThai]}>
              {TRANG_THAI_LABELS[obj.trang_thai as TaiSanTrangThai]}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            {nextStates.map((st) => (
              <Popconfirm
                key={st}
                title={`Chuyển sang "${TRANG_THAI_LABELS[st]}"?`}
                onConfirm={() => updateMut.mutate({ trang_thai: st })}
              >
                <Button size="small">{TRANG_THAI_BTN_LABEL[st]}</Button>
              </Popconfirm>
            ))}
          </Space>
        }
      >
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Loại">
            {LOAI_LABELS[obj.loai as keyof typeof LOAI_LABELS]}
          </Descriptions.Item>
          <Descriptions.Item label="Mô tả">{obj.mo_ta || '—'}</Descriptions.Item>
          <Descriptions.Item label="Khách hàng">{obj.ten_khach}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{obj.ngay_tao}</Descriptions.Item>
          <Descriptions.Item label="Người chi trả">
            {NGUOI_CHI_TRA_LABELS[obj.nguoi_chi_tra as keyof typeof NGUOI_CHI_TRA_LABELS]}
          </Descriptions.Item>
          <Descriptions.Item label="Giá trị">
            <strong>{Number(obj.gia_tri).toLocaleString('vi-VN')} đ</strong>
          </Descriptions.Item>
          {obj.ghi_chu && (
            <Descriptions.Item label="Ghi chú" span={2}>{obj.ghi_chu}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Liên thông NCC */}
      <Card
        size="small"
        title="Đơn mua hàng NCC"
        extra={
          <Button size="small" onClick={() => setLinkPoOpen(true)}>
            {obj.purchase_order_id ? 'Thay đổi' : 'Liên kết'}
          </Button>
        }
      >
        {obj.purchase_order_id ? (
          <Link to={`/purchase-orders/${obj.purchase_order_id}`}>
            {obj.so_po}
          </Link>
        ) : (
          <span style={{ color: '#999' }}>Chưa liên kết đơn mua hàng</span>
        )}
      </Card>

      {/* Tài chính — chỉ hiện khi khách hàng trả */}
      {!isCongTy && (
        <Card size="small" title="Tài chính">
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small" title="Thu tiền khách hàng" type="inner">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Đơn hàng thu">
                    {obj.sales_order_thu_id ? (
                      <Link to={`/sales-orders/${obj.sales_order_thu_id}`}>
                        {obj.so_don_thu}
                      </Link>
                    ) : (
                      <span style={{ color: '#999' }}>Chưa liên kết</span>
                    )}
                    <Button
                      size="small"
                      type="link"
                      onClick={() => setLinkSoOpen(true)}
                      style={{ marginLeft: 8 }}
                    >
                      {obj.sales_order_thu_id ? 'Thay đổi' : 'Liên kết'}
                    </Button>
                  </Descriptions.Item>
                  <Descriptions.Item label="Đã thu tiền">
                    {obj.da_thu_tien ? (
                      <Tag color="success" icon={<CheckCircleOutlined />}>Đã thu</Tag>
                    ) : (
                      <Space>
                        <Tag color="warning">Chưa thu</Tag>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => updateMut.mutate({ da_thu_tien: true })}
                        >
                          Đánh dấu đã thu
                        </Button>
                      </Space>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="Hoàn tiền" type="inner">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Định mức hoàn">
                    {obj.san_luong_dinh_muc_hoan != null ? (
                      <Space>
                        <strong>{Number(obj.san_luong_dinh_muc_hoan).toLocaleString('vi-VN')} cái</strong>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => {
                            const v = prompt('Định mức hoàn (cái):', String(obj.san_luong_dinh_muc_hoan))
                            if (v && !isNaN(Number(v))) {
                              updateMut.mutate({ san_luong_dinh_muc_hoan: Number(v) })
                            }
                          }}
                        >
                          Sửa
                        </Button>
                      </Space>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => {
                          const v = prompt('Nhập định mức hoàn (cái):')
                          if (v && !isNaN(Number(v))) {
                            updateMut.mutate({ san_luong_dinh_muc_hoan: Number(v) })
                          }
                        }}
                      >
                        Đặt định mức
                      </Button>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sản lượng thực tế">
                    <Space>
                      <strong>{sanLuongThucTe.toLocaleString('vi-VN')} cái</strong>
                      {obj.san_luong_dinh_muc_hoan != null && (
                        dieuKienHoan ? (
                          <Tag color="success" icon={<CheckCircleOutlined />}>Đủ điều kiện hoàn</Tag>
                        ) : (
                          <Tag color="default" icon={<WarningOutlined />}>
                            Còn thiếu {(Number(obj.san_luong_dinh_muc_hoan) - sanLuongThucTe).toLocaleString('vi-VN')}
                          </Tag>
                        )
                      )}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Phiếu chi hoàn">
                    {obj.cash_payment_hoan_id ? (
                      <Space>
                        <Tag color="success" icon={<CheckCircleOutlined />}>Đã hoàn tiền</Tag>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => setLinkPhieuChiOpen(true)}
                        >
                          Xem phiếu chi
                        </Button>
                      </Space>
                    ) : (
                      <Space>
                        <Tag color="default">Chưa hoàn</Tag>
                        {dieuKienHoan && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => setLinkPhieuChiOpen(true)}
                          >
                            Liên kết phiếu chi
                          </Button>
                        )}
                      </Space>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {/* Sản phẩm liên kết */}
      <Card
        size="small"
        title={`Sản phẩm liên kết (${obj.san_pham_links.length})`}
        extra={
          <Tooltip
            title={
              obj.loai === 'ban_in' && obj.san_pham_links.length >= 1
                ? 'Bản in chỉ liên kết 1 sản phẩm'
                : undefined
            }
          >
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setAddSpOpen(true)}
              disabled={obj.loai === 'ban_in' && obj.san_pham_links.length >= 1}
            >
              Thêm sản phẩm
            </Button>
          </Tooltip>
        }
      >
        {obj.loai === 'ban_in' && (
          <Alert
            message="Bản in chỉ được liên kết với 1 sản phẩm duy nhất"
            type="info"
            showIcon
            style={{ marginBottom: 8 }}
          />
        )}
        <Table
          columns={spColumns}
          dataSource={obj.san_pham_links}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Chưa có sản phẩm liên kết' }}
        />
      </Card>

      {/* Modal thêm sản phẩm */}
      <Modal
        title="Thêm sản phẩm liên kết"
        open={addSpOpen}
        onCancel={() => { setAddSpOpen(false); addSpForm.resetFields() }}
        onOk={() => addSpForm.submit()}
        confirmLoading={addSpMut.isPending}
      >
        <Form
          form={addSpForm}
          layout="vertical"
          onFinish={(v) => addSpMut.mutate(v)}
        >
          <Form.Item name="san_pham_id" label="Sản phẩm" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={availableProducts.map((p: any) => ({
                value: p.id,
                label: `${p.ma_amis} — ${p.ten_hang}`,
              }))}
              placeholder="Chọn sản phẩm"
            />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal liên kết PO */}
      <Modal
        title="Liên kết đơn mua hàng NCC"
        open={linkPoOpen}
        onCancel={() => { setLinkPoOpen(false); linkPoForm.resetFields() }}
        onOk={() => linkPoForm.submit()}
        confirmLoading={updateMut.isPending}
      >
        <Form
          form={linkPoForm}
          layout="vertical"
          initialValues={{ purchase_order_id: obj.purchase_order_id }}
          onFinish={(v) => {
            updateMut.mutate({ purchase_order_id: v.purchase_order_id || null })
            setLinkPoOpen(false)
          }}
        >
          <Form.Item name="purchase_order_id" label="Số đơn mua hàng (ID)">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="Nhập ID đơn mua hàng" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal liên kết SO thu tiền */}
      <Modal
        title="Liên kết đơn hàng thu tiền"
        open={linkSoOpen}
        onCancel={() => { setLinkSoOpen(false); linkSoForm.resetFields() }}
        onOk={() => linkSoForm.submit()}
        confirmLoading={updateMut.isPending}
      >
        <Form
          form={linkSoForm}
          layout="vertical"
          initialValues={{ sales_order_thu_id: obj.sales_order_thu_id }}
          onFinish={(v) => {
            updateMut.mutate({ sales_order_thu_id: v.sales_order_thu_id || null })
            setLinkSoOpen(false)
          }}
        >
          <Form.Item name="sales_order_thu_id" label="ID đơn hàng thu tiền bản in/khuôn bế">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="Nhập ID đơn hàng" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal liên kết phiếu chi hoàn tiền */}
      <Modal
        title="Liên kết phiếu chi hoàn tiền"
        open={linkPhieuChiOpen}
        onCancel={() => { setLinkPhieuChiOpen(false); linkPcForm.resetFields() }}
        onOk={() => linkPcForm.submit()}
        confirmLoading={updateMut.isPending}
      >
        <Form
          form={linkPcForm}
          layout="vertical"
          initialValues={{ cash_payment_hoan_id: obj.cash_payment_hoan_id }}
          onFinish={(v) => {
            updateMut.mutate({
              cash_payment_hoan_id: v.cash_payment_hoan_id || null,
              da_hoan_tien: !!v.cash_payment_hoan_id,
            })
            setLinkPhieuChiOpen(false)
          }}
        >
          <Form.Item name="cash_payment_hoan_id" label="ID phiếu chi hoàn tiền">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="Nhập ID phiếu chi" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
