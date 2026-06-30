import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Empty, Spin, Tag, Tooltip,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined,
  CarOutlined, PrinterOutlined, SettingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import { productsApi } from '../../api/products'
import { salesOrdersApi } from '../../api/salesOrders'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import QuickAddSelect from '../../components/QuickAddSelect'
import { QUICK_ADD_CONFIGS } from '../../config/quickAddConfigs'
import { taiSanInApi } from '../../api/taiSanIn'
import type { ProductFull } from '../../api/products'
import EmptyState from "../../components/EmptyState"
import OrderItemSpecModal, { EMPTY_SPEC } from './components/OrderItemSpecModal'
import type { OrderItemSpec } from './components/OrderItemSpecModal'

const { Title, Text } = Typography

interface OrderLine {
  key: string
  product_id: number
  product: ProductFull
  so_luong: number
  don_gia: number
  ty_le_giam_gia: number
  so_tien_giam_gia: number
  ngay_giao_hang: string | null
  ghi_chu_san_pham: string | null
  yeu_cau_in: string | null
  phan_xuong_id: number | null
  spec: OrderItemSpec
}

interface ExtraLine {
  key: string
  ten_hang: string
  don_gia: number
  ghi_chu: string
}

interface PendingTaiSan {
  key: string
  loai: 'ban_in' | 'khuon_be'
  mo_ta: string
  gia_tri: number
  ghi_chu: string
}

export default function OrderCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [lines, setLines] = useState<OrderLine[]>([])
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([])
  const [pendingTaiSan, setPendingTaiSan] = useState<PendingTaiSan[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomerMaKh, setSelectedCustomerMaKh] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [customerOptions, setCustomerOptions] = useState<{ value: number; label: string }[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [specModalOpen, setSpecModalOpen] = useState(false)
  const [specModalTarget, setSpecModalTarget] = useState<string | null>(null)

  const autoFillSoPoKh = (maKh: string | null, ngayDon?: unknown) => {
    const d = ngayDon ? dayjs(ngayDon as string) : dayjs()
    const dateStr = d.format('DDMMYYYY')
    form.setFieldValue('so_po_kh', `${maKh ?? 'KH'}${dateStr}`)
  }

  const handleCustomerSearch = async (q: string) => {
    if (!q || q.length < 1) return
    setCustomerSearching(true)
    try {
      const res = await customersApi.list({ search: q, page_size: 30 })
      setCustomerOptions(
        res.data.items.map(c => ({
          value: c.id,
          label: `[${c.ma_kh}] ${c.ten_viet_tat}`,
        }))
      )
    } finally {
      setCustomerSearching(false)
    }
  }

  const { data: phapNhanList } = useQuery({
    queryKey: ['phap-nhan-all'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then((r) => r.data),
  })

  const { data: phanXuongRaw } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })
  const phanXuongList = Array.isArray(phanXuongRaw) ? phanXuongRaw : []

  const { data: nhanVienRaw } = useQuery({
    queryKey: ['sale-users'],
    queryFn: () => customersApi.saleUsers().then(r => r.data),
  })
  const nhanVienList = Array.isArray(nhanVienRaw) ? nhanVienRaw : []

  const { data: products } = useQuery({
    queryKey: ['products', productSearch, selectedCustomerId],
    queryFn: () => productsApi.list({
      search: productSearch,
      ma_kh_id: selectedCustomerId || undefined,
      page_size: 50,
    }).then((r) => r.data.items),
    enabled: true,
  })

  const addLine = (product: ProductFull) => {
    if (lines.find((l) => l.product_id === product.id)) {
      message.warning('Sản phẩm đã có trong đơn hàng')
      return
    }
    setLines((prev) => [...prev, {
      key: String(product.id),
      product_id: product.id,
      product,
      so_luong: 1,
      don_gia: Number(product.gia_ban) || 0,
      ty_le_giam_gia: 0,
      so_tien_giam_gia: 0,
      ngay_giao_hang: null,
      ghi_chu_san_pham: null,
      yeu_cau_in: null,
      phan_xuong_id: null,
      spec: {
        ...EMPTY_SPEC,
        loai_thung: product.loai_thung ?? null,
        dai: product.dai ? Number(product.dai) : null,
        rong: product.rong ? Number(product.rong) : null,
        cao: product.cao ? Number(product.cao) : null,
        so_lop: product.so_lop ? Number(product.so_lop) : null,
        to_hop_song: product.to_hop_song ?? null,
        mat: product.mat ?? null,
        mat_dl: product.mat_dl ?? null,
        song_1: product.song_1 ?? null,
        song_1_dl: product.song_1_dl ?? null,
        mat_1: product.mat_1 ?? null,
        mat_1_dl: product.mat_1_dl ?? null,
        song_2: product.song_2 ?? null,
        song_2_dl: product.song_2_dl ?? null,
        mat_2: product.mat_2 ?? null,
        mat_2_dl: product.mat_2_dl ?? null,
        song_3: product.song_3 ?? null,
        song_3_dl: product.song_3_dl ?? null,
        mat_3: product.mat_3 ?? null,
        mat_3_dl: product.mat_3_dl ?? null,
        so_mau: product.so_mau ? Number(product.so_mau) : null,
        loai_lan: product.loai_lan ?? null,
        loai_in: product.loai_in === 1 ? 'flexo' : product.loai_in === 2 ? 'ky_thuat_so' : null,
        c_tham: product.chong_tham === 1 ? '1 mặt' : product.chong_tham === 2 ? '2 mặt' : null,
        can_man: product.can_mang === 1 ? '1 mặt' : product.can_mang === 2 ? '2 mặt' : null,
      },
    }])
  }

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))

  const addExtraLine = (preset?: Partial<ExtraLine>) => {
    setExtraLines(prev => [...prev, {
      key: `extra-${Date.now()}`,
      ten_hang: preset?.ten_hang ?? '',
      don_gia: preset?.don_gia ?? 0,
      ghi_chu: preset?.ghi_chu ?? '',
    }])
  }

  const removeExtraLine = (key: string) => setExtraLines(prev => prev.filter(l => l.key !== key))

  const updateExtraLine = (key: string, field: keyof ExtraLine, value: unknown) => {
    setExtraLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }

  const addPendingTaiSan = (loai: 'ban_in' | 'khuon_be') => {
    setPendingTaiSan(prev => [...prev, {
      key: `tsi-${Date.now()}`,
      loai,
      mo_ta: '',
      gia_tri: 0,
      ghi_chu: '',
    }])
  }

  const removePendingTaiSan = (key: string) => setPendingTaiSan(prev => prev.filter(t => t.key !== key))

  const updatePendingTaiSan = (key: string, field: keyof PendingTaiSan, value: unknown) => {
    setPendingTaiSan(prev => prev.map(t => t.key === key ? { ...t, [field]: value } : t))
  }

  const updateLine = (key: string, field: keyof OrderLine, value: unknown) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l))
  }

  const openSpecModal = (key: string) => {
    setSpecModalTarget(key)
    setSpecModalOpen(true)
  }

  const handleSpecSave = (spec: OrderItemSpec) => {
    if (specModalTarget) updateLine(specModalTarget, 'spec', spec)
    setSpecModalOpen(false)
    setSpecModalTarget(null)
  }

  const tongTienHang = lines.reduce((s, l) => {
    const tienHang = l.so_luong * l.don_gia
    if (l.ty_le_giam_gia > 0) return s + tienHang * (1 - l.ty_le_giam_gia / 100)
    if (l.so_tien_giam_gia > 0) return s + Math.max(0, tienHang - l.so_tien_giam_gia)
    return s + tienHang
  }, 0) + extraLines.reduce((s, l) => s + l.don_gia, 0) + pendingTaiSan.reduce((s, t) => s + t.gia_tri, 0)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (lines.length === 0 && extraLines.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 sản phẩm')
        return
      }
      setSaving(true)
      const today = dayjs().format('YYYY-MM-DD')
      const payload = {
        customer_id: values.customer_id,
        ngay_don: dayjs(values.ngay_don).format('YYYY-MM-DD'),
        so_po_kh: values.so_po_kh || undefined,
        phap_nhan_id: values.phap_nhan_id ?? null,
        phap_nhan_sx_id: values.phap_nhan_sx_id ?? null,
        phan_xuong_id: values.phan_xuong_id ?? null,
        nv_kinh_doanh_id: values.nv_kinh_doanh_id ?? null,
        nv_theo_doi_id: values.nv_theo_doi_id ?? null,
        ngay_giao_hang: values.ngay_giao_hang
          ? dayjs(values.ngay_giao_hang).format('YYYY-MM-DD')
          : undefined,
        dia_chi_giao: values.dia_chi_giao,
        ghi_chu: values.ghi_chu,
        ty_le_giam_gia: values.ty_le_giam_gia || 0,
        so_tien_giam_gia: values.so_tien_giam_gia || 0,
        chi_phi_bang_in: values.chi_phi_bang_in || 0,
        chi_phi_khuon: values.chi_phi_khuon || 0,
        chi_phi_van_chuyen: values.chi_phi_van_chuyen || 0,
        ty_le_vat: values.ty_le_vat ?? 8,
        dieu_khoan: values.dieu_khoan || null,
        items: [
          ...lines.map((l) => ({
            product_id: l.product_id,
            ten_hang: l.product.ten_hang,
            so_luong: l.so_luong,
            don_gia: l.don_gia,
            ty_le_giam_gia: l.ty_le_giam_gia,
            so_tien_giam_gia: l.so_tien_giam_gia,
            dvt: l.product.dvt,
            ngay_giao_hang: l.ngay_giao_hang || undefined,
            ghi_chu_san_pham: l.ghi_chu_san_pham || undefined,
            yeu_cau_in: l.yeu_cau_in || undefined,
            phan_xuong_id: l.phan_xuong_id || undefined,
            ...l.spec,
          })),
          ...extraLines.map((l) => ({
            product_id: null,
            ten_hang: l.ten_hang || 'Dịch vụ',
            so_luong: 1,
            don_gia: l.don_gia,
            ty_le_giam_gia: 0,
            so_tien_giam_gia: 0,
            dvt: 'lần',
            ghi_chu_san_pham: l.ghi_chu || undefined,
          })),
          ...pendingTaiSan.filter(t => t.gia_tri > 0).map(t => ({
            product_id: null,
            ten_hang: `${t.loai === 'ban_in' ? 'Bản in' : 'Khuôn bế'}${t.mo_ta ? ` - ${t.mo_ta}` : ''}`,
            so_luong: 1,
            don_gia: t.gia_tri,
            ty_le_giam_gia: 0,
            so_tien_giam_gia: 0,
            dvt: 'bộ',
            ghi_chu_san_pham: t.ghi_chu || undefined,
          })),
        ],
      }
      const res = await salesOrdersApi.create(payload)
      const orderId = res.data.id
      const sodon = res.data.so_don

      if (pendingTaiSan.length > 0) {
        await Promise.allSettled(
          pendingTaiSan.map(t =>
            taiSanInApi.create({
              loai: t.loai,
              mo_ta: t.mo_ta || undefined,
              gia_tri: t.gia_tri,
              ghi_chu: t.ghi_chu || undefined,
              customer_id: values.customer_id,
              sales_order_thu_id: orderId,
              ngay_tao: today,
            })
          )
        )
        message.success(`Tạo đơn hàng ${sodon} + ${pendingTaiSan.length} đề xuất bản in thành công`)
      } else {
        message.success(`Tạo đơn hàng ${sodon} thành công`)
      }

      navigate(`/sales/orders/${orderId}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (msg) message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const specTargetLine = lines.find(l => l.key === specModalTarget)

  const columns: ColumnsType<OrderLine> = [
    {
      title: 'Mã SP',
      dataIndex: ['product', 'ma_amis'],
      width: 100,
      render: (v) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Tên hàng hoá',
      dataIndex: ['product', 'ten_hang'],
      ellipsis: true,
    },
    {
      title: 'KT',
      width: 40,
      align: 'center',
      render: (_, r) => (
        <Tooltip title="Thông số kỹ thuật">
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openSpecModal(r.key)}
            type={r.spec.so_lop ? 'primary' : 'default'}
            ghost={!!r.spec.so_lop}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Số lượng',
      width: 110,
      render: (_, r) => (
        <InputNumber
          min={1}
          value={r.so_luong}
          onChange={(v) => updateLine(r.key, 'so_luong', v || 1)}
          style={{ width: 90 }}
        />
      ),
    },
    {
      title: 'Đơn giá',
      width: 130,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.don_gia}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(r.key, 'don_gia', v || 0)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: '% Giảm',
      width: 75,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={100}
          value={r.ty_le_giam_gia}
          onChange={(v) => updateLine(r.key, 'ty_le_giam_gia', v || 0)}
          style={{ width: 60 }}
        />
      ),
    },
    {
      title: 'Giảm tiền',
      width: 100,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.so_tien_giam_gia}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(r.key, 'so_tien_giam_gia', v || 0)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => {
        const tienHang = r.so_luong * r.don_gia
        const thanhTien = r.ty_le_giam_gia > 0
          ? tienHang * (1 - r.ty_le_giam_gia / 100)
          : r.so_tien_giam_gia > 0
          ? Math.max(0, tienHang - r.so_tien_giam_gia)
          : tienHang
        return <Text strong>{new Intl.NumberFormat('vi-VN').format(thanhTien)}</Text>
      },
    },
    {
      title: 'Ghi chú',
      width: 150,
      render: (_, r) => (
        <Input
          placeholder="Ghi chú..."
          value={r.ghi_chu_san_pham || ''}
          onChange={(e) => updateLine(r.key, 'ghi_chu_san_pham', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Xưởng SX',
      width: 120,
      render: (_, r) => (
        <Select
          size="small"
          allowClear
          placeholder="Theo đơn"
          style={{ width: '100%' }}
          value={r.phan_xuong_id ?? undefined}
          onChange={(v) => updateLine(r.key, 'phan_xuong_id', v ?? null)}
          options={phanXuongList
            .filter((p: { trang_thai: boolean }) => p.trang_thai)
            .map((p: { id: number; ten_xuong: string }) => ({ value: p.id, label: p.ten_xuong }))}
        />
      ),
    },
    {
      title: '',
      width: 36,
      render: (_, r) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(r.key)}
        />
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/orders')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>Tạo đơn hàng mới</Title>
      </Space>

      <Row gutter={16}>
        {/* Thông tin đơn hàng */}
        <Col xs={24} lg={16}>
          <Card title="Thông tin đơn hàng" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="customer_id"
                    label="Khách hàng"
                    rules={[{ required: true, message: 'Chọn khách hàng' }]}
                  >
                    <QuickAddSelect
                      config={QUICK_ADD_CONFIGS.customer}
                      showSearch
                      filterOption={false}
                      placeholder="Gõ để tìm khách hàng..."
                      notFoundContent={customerSearching ? <Spin size="small" /> : 'Gõ tên / mã KH...'}
                      onSearch={handleCustomerSearch}
                      onChange={(v) => {
                        setSelectedCustomerId(v as number)
                        customersApi.get(v as number).then(r => {
                          if (r.data?.dia_chi_giao_hang) form.setFieldValue('dia_chi_giao', r.data.dia_chi_giao_hang)
                          if (r.data?.dieu_khoan_tt) form.setFieldValue('dieu_khoan', r.data.dieu_khoan_tt)
                          const maKh = r.data?.ma_kh ?? null
                          setSelectedCustomerMaKh(maKh)
                          autoFillSoPoKh(maKh, form.getFieldValue('ngay_don'))
                        })
                      }}
                      options={customerOptions}
                      onCreated={(rec) =>
                        setCustomerOptions(prev => [...prev, {
                          value: rec.id as number,
                          label: `[${(rec.ma_kh as string) ?? ''}] ${(rec.ten_viet_tat as string) ?? ''}`.trim(),
                        }])
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="ngay_don"
                    label="Ngày đơn"
                    initialValue={dayjs()}
                    rules={[{ required: true }]}
                  >
                    <DatePicker
                      format="DD/MM/YYYY"
                      style={{ width: '100%' }}
                      onChange={(d) => {
                        if (selectedCustomerMaKh) autoFillSoPoKh(selectedCustomerMaKh, d)
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="ngay_giao_hang" label="Ngày giao hàng">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="so_po_kh" label="Số PO KH">
                    <Input placeholder="Tự động sinh hoặc nhập tay..." allowClear />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phap_nhan_id" label="Pháp nhân bán hàng">
                    <Select
                      showSearch allowClear placeholder="Chọn pháp nhân..."
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={phapNhanList?.map((p) => ({
                        value: p.id,
                        label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phap_nhan_sx_id" label="Pháp nhân sản xuất">
                    <Select
                      showSearch allowClear placeholder="Chọn pháp nhân SX..."
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={phapNhanList?.map((p) => ({
                        value: p.id,
                        label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phan_xuong_id" label="Nơi sản xuất mặc định">
                    <Select
                      allowClear placeholder="Chọn xưởng sản xuất..."
                      options={phanXuongList
                        .filter((p: { trang_thai: boolean }) => p.trang_thai)
                        .map((p: { id: number; ten_xuong: string }) => ({ value: p.id, label: p.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nv_kinh_doanh_id" label="NV phụ trách">
                    <Select
                      showSearch allowClear optionFilterProp="label"
                      placeholder="Chọn nhân viên..."
                      options={nhanVienList.map((nv: { id: number; ho_ten: string }) => ({ value: nv.id, label: nv.ho_ten }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nv_theo_doi_id" label="NV theo dõi đơn hàng">
                    <Select
                      showSearch allowClear optionFilterProp="label"
                      placeholder="Chọn nhân viên..."
                      options={nhanVienList.map((nv: { id: number; ho_ten: string }) => ({ value: nv.id, label: nv.ho_ten }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="dia_chi_giao" label="Địa chỉ giao hàng">
                    <Input placeholder="Địa chỉ giao hàng..." />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="ghi_chu" label="Ghi chú đơn hàng">
                    <Input.TextArea rows={2} placeholder="Ghi chú..." />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item name="ty_le_giam_gia" label="% Giảm giá đơn hàng">
                    <InputNumber min={0} max={100} placeholder="0" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="so_tien_giam_gia" label="Số tiền giảm giá đơn hàng">
                    <InputNumber
                      min={0} placeholder="0"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item name="chi_phi_bang_in" label="Chi phí bản in (đ)">
                    <InputNumber
                      min={0} placeholder="0"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="chi_phi_khuon" label="Chi phí khuôn bế (đ)">
                    <InputNumber
                      min={0} placeholder="0"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="chi_phi_van_chuyen" label="Chi phí vận chuyển (đ)">
                    <InputNumber
                      min={0} placeholder="0"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item name="ty_le_vat" label="VAT (%)" initialValue={8}>
                    <InputNumber min={0} max={100} placeholder="8" style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item name="dieu_khoan" label="Điều khoản thanh toán">
                    <Input.TextArea rows={1} placeholder="Thanh toán trong 30 ngày..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Danh sách sản phẩm */}
          <Card title={`Chi tiết đơn hàng (${lines.length} dòng)`}>
            <Table
              columns={columns}
              dataSource={lines}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 1000 }}
              locale={{ emptyText: <Empty description="Chưa có sản phẩm. Chọn từ danh sách bên phải." /> }}
              summary={() => lines.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={7} align="right">
                      <Text strong>Tổng tiền hàng:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text>{new Intl.NumberFormat('vi-VN').format(tongTienHang)}đ</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null}
            />

            {/* Dòng phí / dịch vụ (vận chuyển, v.v.) */}
            {extraLines.length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 13, color: '#888', margin: '12px 0 8px' }}>
                  Phí / Dịch vụ
                </Divider>
                <Table
                  dataSource={extraLines}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  showHeader={false}
                  columns={[
                    {
                      dataIndex: 'ten_hang',
                      render: (v, r) => (
                        <Input
                          value={v}
                          placeholder="Tên phí / dịch vụ (VD: Phí vận chuyển)"
                          onChange={e => updateExtraLine(r.key, 'ten_hang', e.target.value)}
                          size="small"
                        />
                      ),
                    },
                    {
                      width: 140,
                      dataIndex: 'don_gia',
                      render: (v, r) => (
                        <InputNumber
                          value={v} min={0}
                          formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          onChange={val => updateExtraLine(r.key, 'don_gia', val || 0)}
                          size="small" style={{ width: '100%' }} addonAfter="đ"
                        />
                      ),
                    },
                    {
                      width: 160,
                      dataIndex: 'ghi_chu',
                      render: (v, r) => (
                        <Input
                          value={v} placeholder="Ghi chú"
                          onChange={e => updateExtraLine(r.key, 'ghi_chu', e.target.value)}
                          size="small"
                        />
                      ),
                    },
                    {
                      width: 40,
                      render: (_, r) => (
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeExtraLine(r.key)} />
                      ),
                    },
                  ] as ColumnsType<ExtraLine>}
                />
              </>
            )}

            <Space style={{ marginTop: 8 }} wrap>
              <Button
                size="small"
                icon={<CarOutlined />}
                onClick={() => addExtraLine({ ten_hang: 'Phí vận chuyển' })}
              >
                + Phí vận chuyển
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => addExtraLine()}
              >
                + Phí / dịch vụ khác
              </Button>
            </Space>

            <Divider />
            <Row justify="end">
              <Col>
                <Space>
                  <Button onClick={() => navigate('/sales/orders')}>Huỷ</Button>
                  <Button type="primary" loading={saving} onClick={handleSubmit}>
                    Lưu đơn hàng
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Đề xuất bản in / khuôn bế */}
          <Card
            size="small"
            title={
              <Space>
                <PrinterOutlined />
                <span>Đề xuất bản in / khuôn bế</span>
                {pendingTaiSan.length > 0 && <Tag color="blue">{pendingTaiSan.length}</Tag>}
              </Space>
            }
            style={{ marginTop: 16 }}
            extra={
              <Space size={6}>
                <Button size="small" onClick={() => addPendingTaiSan('ban_in')}>+ Bản in</Button>
                <Button size="small" onClick={() => addPendingTaiSan('khuon_be')}>+ Khuôn bế</Button>
              </Space>
            }
          >
            {pendingTaiSan.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đề xuất bản in / khuôn bế" />
            ) : (
              <Table
                dataSource={pendingTaiSan}
                rowKey="key"
                pagination={false}
                size="small"
                showHeader={false}
                columns={[
                  {
                    width: 100,
                    dataIndex: 'loai',
                    render: (v: string) => (
                      <Tag color={v === 'ban_in' ? 'blue' : 'purple'}>
                        {v === 'ban_in' ? 'Bản in' : 'Khuôn bế'}
                      </Tag>
                    ),
                  },
                  {
                    dataIndex: 'mo_ta',
                    render: (v, r) => (
                      <Input
                        value={v}
                        placeholder="Mô tả ngắn (VD: bản in 4 màu hộp 30×20)"
                        onChange={e => updatePendingTaiSan(r.key, 'mo_ta', e.target.value)}
                        size="small"
                      />
                    ),
                  },
                  {
                    width: 160,
                    dataIndex: 'gia_tri',
                    render: (v, r) => (
                      <InputNumber
                        value={v} min={0}
                        formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        onChange={val => updatePendingTaiSan(r.key, 'gia_tri', val ?? 0)}
                        size="small" style={{ width: '100%' }} addonAfter="đ"
                      />
                    ),
                  },
                  {
                    width: 170,
                    dataIndex: 'ghi_chu',
                    render: (v, r) => (
                      <Input
                        value={v} placeholder="Ghi chú"
                        onChange={e => updatePendingTaiSan(r.key, 'ghi_chu', e.target.value)}
                        size="small"
                      />
                    ),
                  },
                  {
                    width: 40,
                    render: (_, r) => (
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removePendingTaiSan(r.key)} />
                    ),
                  },
                ] as ColumnsType<PendingTaiSan>}
              />
            )}
            {pendingTaiSan.length > 0 && (
              <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                <b>Giá tính KH</b>: giá bán cho khách hàng — sẽ được thêm vào dòng đơn hàng. Giá mua từ NCC để Thiết kế điền sau.
              </div>
            )}
          </Card>
        </Col>

        {/* Panel chọn sản phẩm */}
        <Col xs={24} lg={8}>
          <Card title="Chọn sản phẩm" style={{ position: 'sticky', top: 24 }}>
            <Input
              placeholder="Tìm sản phẩm..."
              prefix={<PlusOutlined />}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {products?.map((p) => (
                <Card
                  key={p.id}
                  size="small"
                  hoverable
                  onClick={() => addLine(p)}
                  style={{ marginBottom: 6, cursor: 'pointer' }}
                >
                  <Text strong style={{ fontSize: 12 }}>[{p.ma_amis}]</Text>
                  <br />
                  <Text style={{ fontSize: 12 }}>{p.ten_hang}</Text>
                  <br />
                  <Space size={4}>
                    {p.dai && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {Number(p.dai)}×{Number(p.rong ?? 0)}×{Number(p.cao ?? 0)}cm
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 11 }}>{p.so_lop} lớp</Text>
                    <Text style={{ fontSize: 11, color: '#1677ff' }}>
                      {new Intl.NumberFormat('vi-VN').format(Number(p.gia_ban))}đ
                    </Text>
                  </Space>
                </Card>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <OrderItemSpecModal
        open={specModalOpen}
        spec={specTargetLine?.spec ?? EMPTY_SPEC}
        tenHang={specTargetLine?.product.ten_hang}
        onClose={() => { setSpecModalOpen(false); setSpecModalTarget(null) }}
        onSave={handleSpecSave}
      />
    </div>
  )
}
