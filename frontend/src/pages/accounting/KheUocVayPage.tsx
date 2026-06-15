import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AutoComplete, Button, Card, Col, DatePicker, Descriptions, Drawer, Dropdown, Form, Input,
  InputNumber, message, Modal, Radio, Row, Select, Space, Table, Tabs, Tag, Typography,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined, CalendarOutlined, StopOutlined, DownloadOutlined, MoreOutlined,
  CopyOutlined, DeleteOutlined, PercentageOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import client from '../../api/client'
import PageLayout from '../../components/PageLayout'
import ImportExcelButton from '../../components/ImportExcelButton'
import { usePhapNhan } from '../../hooks/useMasterData'
import { fmtVND } from '../../utils/exportUtils'

const { Text } = Typography

interface LichTraNo {
  id: number
  ky_so: number
  ngay_den_han: string
  so_tien_goc: number
  so_tien_lai: number
  tong_cong: number
  trang_thai: string
  ngay_tra_thuc: string | null
  so_tien_tra_thuc: number | null
}

interface KheUocVay {
  id: number
  so_khe_uoc: string
  ngay_ky: string
  ngay_hieu_luc: string
  ngay_ket_thuc: string
  to_chuc_cho_vay: string
  so_tien_vay: number
  lai_suat: number
  ky_tinh_lai: string
  phuong_thuc_tra: string
  tai_khoan_nhan: string | null
  tai_san_the_chap: string | null
  ghi_chu: string | null
  trang_thai: string
  phap_nhan_id: number | null
  // Extended fields
  hop_dong_tin_dung: string | null
  tk_no_goc: string | null
  tk_lai_vay: string | null
  loai_tien: string
  phuong_thuc_giai_ngan: string | null
  ten_ngan_hang_thu_huong: string | null
  loai_lai_suat: string
  co_so_tinh_lai: string
  phuong_thuc_dieu_chinh: string
  lai_suat_qua_han: number
  ngay_tra_lai_dau_tien: string | null
  phuong_thuc_tra_no: string | null
  tai_khoan_chuyen_vao: string | null
  ten_ngan_hang_tra: string | null
  lich_tra: LichTraNo[]
}

const TRANG_THAI: Record<string, { label: string; color: string }> = {
  hieu_luc: { label: 'Hiệu lực', color: 'blue' },
  da_tra:   { label: 'Đã trả',   color: 'green' },
  huy:      { label: 'Hủy',      color: 'red'   },
}

const TRANG_THAI_KY: Record<string, { label: string; color: string }> = {
  chua_tra: { label: 'Chưa trả', color: 'orange' },
  da_tra:   { label: 'Đã trả',   color: 'green'  },
  qua_han:  { label: 'Quá hạn',  color: 'red'    },
}

const PHUONG_THUC = [
  { value: 'gop_deu',  label: 'Góp đều (Annuity)' },
  { value: 'goc_deu',  label: 'Gốc đều' },
  { value: 'cuoi_ky',  label: 'Cuối kỳ (Bullet)' },
]

const KY_TINH_LAI = [
  { value: 'thang', label: 'Hàng tháng' },
  { value: 'quy',   label: 'Hàng quý' },
  { value: 'nam',   label: 'Hàng năm' },
]

export default function KheUocVayPage() {
  const qc = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [selected, setSelected] = useState<KheUocVay | null>(null)
  const [activeTab, setActiveTab] = useState<string>('info')
  const [createOpen, setCreateOpen] = useState(false)
  const [createTab, setCreateTab] = useState('giai_ngan')
  const [traNoOpen, setTraNoOpen] = useState(false)
  const [traNoKy, setTraNoKy] = useState<LichTraNo | null>(null)
  const [drawerEditMode, setDrawerEditMode] = useState(false)
  const [drawerEditTab, setDrawerEditTab] = useState('giai_ngan')
  const [traTruocHanOpen, setTraTruocHanOpen] = useState(false)
  const [traTruocHanRow, setTraTruocHanRow] = useState<KheUocVay | null>(null)
  const [tatToanOpen, setTatToanOpen] = useState(false)
  const [tatToanRow, setTatToanRow] = useState<KheUocVay | null>(null)
  const [form] = Form.useForm()
  const [formEdit] = Form.useForm()
  const [formTraNo] = Form.useForm()
  const [formTraTruocHan] = Form.useForm()
  const [formTatToan] = Form.useForm()

  const traGocWatch = Form.useWatch('tra_goc', formTraTruocHan)
  const traLaiWatch = Form.useWatch('tra_lai', formTraTruocHan)
  const phiKhacWatch = Form.useWatch('phi_khac', formTraTruocHan)
  const tongTraTruoc = (Number(traGocWatch) || 0) + (Number(traLaiWatch) || 0) + (Number(phiKhacWatch) || 0)

  const noGocWatch = Form.useWatch('no_goc_phai_tra', formTatToan)
  const tienLaiTatToanWatch = Form.useWatch('tien_lai_phai_tra', formTatToan)
  const tienPhatWatch = Form.useWatch('tien_phat_tra_truoc', formTatToan)
  const tongTatToan = (Number(noGocWatch) || 0) + (Number(tienLaiTatToanWatch) || 0) + (Number(tienPhatWatch) || 0)

  const { data: list, isLoading } = useQuery({
    queryKey: ['khe-uoc-vay', filterTrangThai, filterPhapNhan],
    queryFn: () => client.get('/accounting/khe-uoc-vay', {
      params: { trang_thai: filterTrangThai, phap_nhan_id: filterPhapNhan },
    }).then(r => r.data),
  })

  const { data: nganHangList } = useQuery({
    queryKey: ['ngan-hang-active'],
    queryFn: () => client.get('/ngan-hang', { params: { trang_thai: true } }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const nganHangOptions = (nganHangList ?? []).map((b: { ten_day_du: string }) => ({
    value: b.ten_day_du,
    label: b.ten_day_du,
  }))

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['khe-uoc-vay-detail', selected?.id],
    queryFn: () =>
      selected ? client.get(`/accounting/khe-uoc-vay/${selected.id}`).then(r => r.data) : null,
    enabled: !!selected,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      client.post('/accounting/khe-uoc-vay', body).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo khế ước thành công')
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      setCreateOpen(false)
      form.resetFields()
    },
    onError: () => message.error('Tạo thất bại'),
  })

  const generateMutation = useMutation({
    mutationFn: (id: number) =>
      client.post(`/accounting/khe-uoc-vay/${id}/generate-schedule`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã sinh lịch trả nợ')
      refetchDetail()
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
    },
    onError: () => message.error('Sinh lịch thất bại'),
  })

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) =>
      client.delete(`/accounting/khe-uoc-vay/${id}/schedule`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã xóa lịch trả nợ')
      refetchDetail()
    },
    onError: () => message.error('Xóa lịch thất bại'),
  })

  const traNoMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      client.patch(`/accounting/khe-uoc-vay/${id}/tra-no`, body).then(r => r.data),
    onSuccess: () => {
      message.success('Đã đánh dấu đã trả')
      setTraNoOpen(false)
      formTraNo.resetFields()
      refetchDetail()
    },
    onError: () => message.error('Thao tác thất bại'),
  })

  const tatToanMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      client.patch(`/accounting/khe-uoc-vay/${id}/ket-thuc`, body).then(r => r.data),
    onSuccess: () => {
      message.success('Đã tất toán khoản vay thành công')
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      setTatToanOpen(false)
      formTatToan.resetFields()
      setTatToanRow(null)
      setSelected(null)
    },
    onError: () => message.error('Tất toán thất bại'),
  })

  // ketThucMutation removed — replaced by tatToanMutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      client.delete(`/accounting/khe-uoc-vay/${id}`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã xóa khế ước')
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      setSelected(null)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg ?? 'Xóa thất bại')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      client.put(`/accounting/khe-uoc-vay/${id}`, body).then(r => r.data),
    onSuccess: (data) => {
      const laiSuatChanged = data.lai_suat !== selected?.lai_suat
      if (laiSuatChanged) {
        message.success('Đã cập nhật — lịch trả nợ cũ bị xóa, vui lòng sinh lại')
      } else {
        message.success('Đã cập nhật khế ước')
      }
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      refetchDetail()
      setDrawerEditMode(false)
    },
    onError: () => message.error('Cập nhật thất bại'),
  })

  const nhanBanMutation = useMutation({
    mutationFn: (id: number) =>
      client.post(`/accounting/khe-uoc-vay/${id}/nhan-ban`).then(r => r.data),
    onSuccess: (data: KheUocVay) => {
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      setSelected(data)
      setDrawerEditTab('giai_ngan')
      setDrawerEditMode(true)
      message.success(`Đã nhân bản — đang chỉnh sửa ${data.so_khe_uoc}`)
    },
    onError: () => message.error('Nhân bản thất bại'),
  })

  const traTruocHanMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      client.patch(`/accounting/khe-uoc-vay/${id}/tra-truoc-han`, body).then(r => r.data),
    onSuccess: () => {
      message.success('Đã tất toán trước hạn')
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      setTraTruocHanOpen(false)
      formTraTruocHan.resetFields()
      setSelected(null)
    },
    onError: () => message.error('Thao tác thất bại'),
  })

  const currentDetail: KheUocVay = detail ?? selected

  useEffect(() => {
    if (!drawerEditMode || !currentDetail) return
    formEdit.setFieldsValue({
      to_chuc_cho_vay: currentDetail.to_chuc_cho_vay,
      phap_nhan_id: currentDetail.phap_nhan_id,
      ghi_chu: currentDetail.ghi_chu,
      tk_no_goc: currentDetail.tk_no_goc,
      tk_lai_vay: currentDetail.tk_lai_vay,
      hop_dong_tin_dung: currentDetail.hop_dong_tin_dung,
      loai_tien: currentDetail.loai_tien ?? 'VND',
      so_tien_vay: currentDetail.so_tien_vay,
      tai_khoan_nhan: currentDetail.tai_khoan_nhan,
      phuong_thuc_giai_ngan: currentDetail.phuong_thuc_giai_ngan,
      ten_ngan_hang_thu_huong: currentDetail.ten_ngan_hang_thu_huong,
      tai_san_the_chap: currentDetail.tai_san_the_chap,
      lai_suat: Number(currentDetail.lai_suat),
      lai_suat_qua_han: Number(currentDetail.lai_suat_qua_han ?? 0),
      loai_lai_suat: currentDetail.loai_lai_suat ?? 'du_no_goc',
      co_so_tinh_lai: currentDetail.co_so_tinh_lai ?? '365',
      phuong_thuc_dieu_chinh: currentDetail.phuong_thuc_dieu_chinh ?? 'co_dinh',
      ky_tinh_lai: currentDetail.ky_tinh_lai,
      phuong_thuc_tra: currentDetail.phuong_thuc_tra,
      phuong_thuc_tra_no: currentDetail.phuong_thuc_tra_no,
      tai_khoan_chuyen_vao: currentDetail.tai_khoan_chuyen_vao,
      ten_ngan_hang_tra: currentDetail.ten_ngan_hang_tra,
    })
  }, [drawerEditMode, currentDetail])

  const items: KheUocVay[] = list ?? []

  const phapNhanMap = Object.fromEntries(
    phapNhanList.map((p: { id: number; ten_phap_nhan: string }) => [p.id, p.ten_phap_nhan])
  )

  function thoiHanThang(ku: KheUocVay) {
    const hl = dayjs(ku.ngay_hieu_luc)
    const kt = dayjs(ku.ngay_ket_thuc)
    return (kt.year() - hl.year()) * 12 + (kt.month() - hl.month())
  }

  function computeStats(lich: LichTraNo[]) {
    const paid = lich.filter(l => l.trang_thai === 'da_tra')
    const pending = lich.filter(l => l.trang_thai === 'chua_tra' || l.trang_thai === 'qua_han')
    const gocDaTra = paid.reduce((s, l) => s + Number(l.so_tien_goc), 0)
    const laiDaTra = paid.reduce((s, l) => s + Number(l.so_tien_lai), 0)
    const laiPhaitra = pending.reduce((s, l) => s + Number(l.so_tien_lai), 0)
    const nextGoc = [...pending]
      .filter(l => Number(l.so_tien_goc) > 0)
      .sort((a, b) => a.ky_so - b.ky_so)[0]
    const nextLai = [...pending]
      .filter(l => Number(l.so_tien_lai) > 0)
      .sort((a, b) => a.ky_so - b.ky_so)[0]
    return { gocDaTra, laiDaTra, laiPhaitra, nextGoc, nextLai }
  }

  const columns: ColumnsType<KheUocVay> = [
    {
      title: 'STT',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Số hợp đồng/Số khế ước',
      dataIndex: 'so_khe_uoc',
      width: 180,
      fixed: 'left',
      render: (v, r) => <a onClick={() => setSelected(r)}>{v}</a>,
    },
    {
      title: 'Ngày giải ngân',
      dataIndex: 'ngay_hieu_luc',
      width: 120,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Ngày ký',
      dataIndex: 'ngay_ky',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Thời hạn vay',
      width: 110,
      align: 'center',
      render: (_, r) => `${thoiHanThang(r)} tháng`,
    },
    {
      title: 'Đối tượng cho vay',
      dataIndex: 'to_chuc_cho_vay',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Loại tiền',
      width: 80,
      align: 'center',
      render: () => 'VNĐ',
    },
    {
      title: 'Hạn mức tín dụng',
      dataIndex: 'so_tien_vay',
      width: 140,
      align: 'right',
      render: v => fmtVND(v),
    },
    {
      title: 'Giá trị khoản vay',
      dataIndex: 'so_tien_vay',
      key: 'gtri_kv',
      width: 140,
      align: 'right',
      render: v => fmtVND(v),
    },
    {
      title: 'Giá trị đã giải ngân',
      dataIndex: 'so_tien_vay',
      key: 'gtri_gn',
      width: 140,
      align: 'right',
      render: v => fmtVND(v),
    },
    {
      title: 'Nợ gốc đã trả',
      width: 130,
      align: 'right',
      render: (_, r) => fmtVND(computeStats(r.lich_tra).gocDaTra),
    },
    {
      title: 'Dư nợ hiện tại',
      width: 130,
      align: 'right',
      render: (_, r) => {
        const duNo = Number(r.so_tien_vay) - computeStats(r.lich_tra).gocDaTra
        return <Text type={duNo > 0 ? 'danger' : undefined}>{fmtVND(duNo)}</Text>
      },
    },
    {
      title: 'Lãi phải trả',
      width: 120,
      align: 'right',
      render: (_, r) => fmtVND(computeStats(r.lich_tra).laiPhaitra),
    },
    {
      title: 'Lãi đã trả',
      width: 120,
      align: 'right',
      render: (_, r) => fmtVND(computeStats(r.lich_tra).laiDaTra),
    },
    {
      title: 'Lãi suất hiện tại',
      dataIndex: 'lai_suat',
      width: 120,
      align: 'right',
      render: v => `${v}%/năm`,
    },
    {
      title: 'Mục đích vay',
      dataIndex: 'ghi_chu',
      width: 160,
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 100,
      render: v => {
        const s = TRANG_THAI[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
    {
      title: 'Ngày trả gốc tiếp theo',
      width: 150,
      align: 'center',
      render: (_, r) => {
        const next = computeStats(r.lich_tra).nextGoc
        return next ? dayjs(next.ngay_den_han).format('DD/MM/YYYY') : '—'
      },
    },
    {
      title: 'Ngày trả lãi tiếp theo',
      width: 150,
      align: 'center',
      render: (_, r) => {
        const next = computeStats(r.lich_tra).nextLai
        return next ? dayjs(next.ngay_den_han).format('DD/MM/YYYY') : '—'
      },
    },
    {
      title: 'Thuộc hợp đồng tín dụng',
      width: 170,
      ellipsis: true,
      render: (_, r) => phapNhanMap[r.phap_nhan_id ?? 0] ?? '—',
    },
    {
      title: '',
      width: 48,
      fixed: 'right',
      align: 'center',
      render: (_, r) => {
        const alive = r.trang_thai === 'hieu_luc'
        const menuItems: MenuProps['items'] = [
          {
            key: 'view_info',
            label: 'Xem tình hình thực hiện',
            onClick: () => { setSelected(r); setActiveTab('info') },
          },
          {
            key: 'view_lich',
            label: <strong>Xem lịch trả nợ</strong>,
            onClick: () => { setSelected(r); setActiveTab('schedule') },
          },
          { type: 'divider' },
          {
            key: 'tra_truoc_han',
            label: 'Trả nợ trước hạn',
            disabled: !alive,
            onClick: () => { setTraTruocHanRow(r); setTraTruocHanOpen(true) },
          },
          {
            key: 'lai_suat',
            label: 'Thay đổi lãi suất',
            icon: <PercentageOutlined />,
            disabled: !alive,
            onClick: () => {
              setSelected(r)
              setDrawerEditTab('lai_suat')
              setDrawerEditMode(true)
            },
          },
          {
            key: 'tat_toan',
            label: 'Tất toán khoản vay',
            icon: <StopOutlined />,
            disabled: !alive,
            onClick: () => { setTatToanRow(r); setTatToanOpen(true) },
          },
          { type: 'divider' },
          {
            key: 'nhan_ban',
            label: 'Nhân bản',
            icon: <CopyOutlined />,
            onClick: () => Modal.confirm({
              title: 'Nhân bản khế ước?',
              content: `Tạo bản sao của ${r.so_khe_uoc} với số khế ước mới.`,
              onOk: () => nhanBanMutation.mutate(r.id),
            }),
          },
          {
            key: 'xoa',
            label: <span style={{ color: '#ff4d4f' }}>Xóa</span>,
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            onClick: () => Modal.confirm({
              title: 'Xóa khế ước?',
              content: 'Chỉ xóa được nếu chưa có kỳ thanh toán nào.',
              okType: 'danger',
              okText: 'Xóa',
              onOk: () => deleteMutation.mutate(r.id),
            }),
          },
        ]
        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        )
      },
    },
  ]

  const lichColumns: ColumnsType<LichTraNo> = [
    { title: 'Kỳ', dataIndex: 'ky_so', width: 50, align: 'center' },
    { title: 'Ngày đến hạn', dataIndex: 'ngay_den_han', width: 120, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Tiền gốc', dataIndex: 'so_tien_goc', align: 'right', render: v => fmtVND(v) },
    { title: 'Tiền lãi', dataIndex: 'so_tien_lai', align: 'right', render: v => fmtVND(v) },
    { title: 'Tổng cộng', dataIndex: 'tong_cong', align: 'right', render: v => <Text strong>{fmtVND(v)}</Text> },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const s = TRANG_THAI_KY[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
    {
      title: '',
      width: 90,
      render: (_, r) =>
        r.trang_thai === 'chua_tra' ? (
          <Button
            size="small"
            type="link"
            onClick={() => {
              setTraNoKy(r)
              setTraNoOpen(true)
            }}
          >
            Trả nợ
          </Button>
        ) : null,
    },
  ]

  return (
    <PageLayout
      title="Khế ước đi vay"
      actions={
        <Space>
          <ImportExcelButton
            endpoint="/accounting/khe-uoc-vay"
            templateFilename="mau_import_khe_uoc_di_vay.xlsx"
            buttonText="Import Excel"
            onImported={() => qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={() => {
              const params = new URLSearchParams()
              if (filterTrangThai) params.set('trang_thai', filterTrangThai)
              if (filterPhapNhan) params.set('phap_nhan_id', String(filterPhapNhan))
              window.open(`/api/accounting/khe-uoc-vay/export?${params}`, '_blank')
            }}
          >
            Export Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Tạo khế ước
          </Button>
        </Space>
      }
    >
      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12}>
          <Col>
            <Select
              style={{ width: 160 }}
              allowClear
              placeholder="Trạng thái"
              onChange={v => setFilterTrangThai(v)}
              options={Object.entries(TRANG_THAI).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 200 }}
              allowClear
              placeholder="Pháp nhân"
              onChange={v => setFilterPhapNhan(v)}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
        </Row>
      </Card>

      <Table<KheUocVay>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 2600 }}
        pagination={{ pageSize: 15, showTotal: t => `${t} khế ước` }}
      />

      {/* Detail Drawer */}
      <Drawer
        title={currentDetail ? `${currentDetail.so_khe_uoc} — ${currentDetail.to_chuc_cho_vay}` : ''}
        open={!!selected}
        onClose={() => { setSelected(null); setDrawerEditMode(false) }}
        width={800}
        extra={
          currentDetail?.trang_thai === 'hieu_luc' && (
            drawerEditMode ? (
              <Space>
                <Button onClick={() => setDrawerEditMode(false)}>Hủy</Button>
                <Button
                  type="primary"
                  loading={updateMutation.isPending}
                  onClick={() =>
                    formEdit.validateFields().then(v =>
                      updateMutation.mutate({
                        id: currentDetail.id,
                        body: {
                          ...v,
                          ngay_tra_lai_dau_tien: v.ngay_tra_lai_dau_tien?.format?.('YYYY-MM-DD') ?? v.ngay_tra_lai_dau_tien,
                        },
                      })
                    )
                  }
                >
                  Lưu thay đổi
                </Button>
              </Space>
            ) : (
              <Space>
                <Button onClick={() => {
                  setDrawerEditTab('giai_ngan')
                  setDrawerEditMode(true)
                }}>
                  Chỉnh sửa
                </Button>
                <Button
                  icon={<CalendarOutlined />}
                  loading={generateMutation.isPending}
                  onClick={() => generateMutation.mutate(currentDetail.id)}
                >
                  Sinh lịch
                </Button>
                {(currentDetail.lich_tra?.length ?? 0) > 0 && (
                  <Button
                    danger
                    onClick={() =>
                      Modal.confirm({
                        title: 'Xóa lịch trả nợ?',
                        content: 'Toàn bộ lịch trả nợ sẽ bị xóa để tái tạo.',
                        onOk: () => deleteScheduleMutation.mutate(currentDetail.id),
                      })
                    }
                  >
                    Xóa lịch
                  </Button>
                )}
              </Space>
            )
          )
        }
      >
        {currentDetail && (
          <Tabs
            activeKey={drawerEditMode ? drawerEditTab : activeTab}
            onChange={drawerEditMode ? setDrawerEditTab : setActiveTab}
            items={[
              {
                key: drawerEditMode ? 'giai_ngan' : 'info',
                label: drawerEditMode ? 'Thông tin giải ngân' : 'Thông tin',
                children: drawerEditMode ? (
                  <Form form={formEdit} layout="vertical">
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="to_chuc_cho_vay" label="Tổ chức cho vay" rules={[{ required: true }]}>
                          <AutoComplete options={nganHangOptions} placeholder="Tên ngân hàng"
                            filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())} allowClear />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="phap_nhan_id" label="Pháp nhân">
                          <Select allowClear options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={8}><Form.Item name="tk_no_goc" label="TK hạch toán nợ gốc"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="tk_lai_vay" label="TK hạch toán lãi vay"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="hop_dong_tin_dung" label="Hợp đồng tín dụng"><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item name="ghi_chu" label="Mục đích vay"><Input.TextArea rows={2} /></Form.Item>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name="loai_tien" label="Loại tiền">
                          <Select options={[{ value: 'VND', label: 'VNĐ' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={16}><Form.Item name="so_tien_vay" label="Số tiền vay"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} min={0} /></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="phuong_thuc_giai_ngan" label="Phương thức giải ngân">
                          <Select allowClear options={[{ value: 'chuyen_khoan', label: 'Chuyển khoản' }, { value: 'tien_mat', label: 'Tiền mặt' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={12}><Form.Item name="tai_khoan_nhan" label="TK nhận tiền vay"><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item name="ten_ngan_hang_thu_huong" label="Ngân hàng thụ hưởng">
                      <AutoComplete options={nganHangOptions} placeholder="Tên ngân hàng thụ hưởng"
                        filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())} allowClear />
                    </Form.Item>
                    <Form.Item name="tai_san_the_chap" label="Tài sản thế chấp"><Input.TextArea rows={2} /></Form.Item>
                  </Form>
                ) : (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Số khế ước">{currentDetail.so_khe_uoc}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">
                      <Tag color={TRANG_THAI[currentDetail.trang_thai]?.color}>
                        {TRANG_THAI[currentDetail.trang_thai]?.label}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổ chức cho vay" span={2}>{currentDetail.to_chuc_cho_vay}</Descriptions.Item>
                    <Descriptions.Item label="Hợp đồng tín dụng">{currentDetail.hop_dong_tin_dung ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Pháp nhân">{phapNhanMap[currentDetail.phap_nhan_id ?? 0] ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="TK hạch toán nợ gốc">{currentDetail.tk_no_goc ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="TK hạch toán lãi vay">{currentDetail.tk_lai_vay ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Mục đích vay" span={2}>{currentDetail.ghi_chu ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Loại tiền">{currentDetail.loai_tien}</Descriptions.Item>
                    <Descriptions.Item label="Số tiền vay">{fmtVND(currentDetail.so_tien_vay)}</Descriptions.Item>
                    <Descriptions.Item label="Ngày ký">{dayjs(currentDetail.ngay_ky).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Ngày giải ngân">{dayjs(currentDetail.ngay_hieu_luc).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Ngày đến hạn">{dayjs(currentDetail.ngay_ket_thuc).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Phương thức giải ngân">{currentDetail.phuong_thuc_giai_ngan ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="TK nhận tiền vay">{currentDetail.tai_khoan_nhan ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ngân hàng thụ hưởng">{currentDetail.ten_ngan_hang_thu_huong ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Lãi suất">{currentDetail.lai_suat}%/năm</Descriptions.Item>
                    <Descriptions.Item label="Lãi suất quá hạn">{currentDetail.lai_suat_qua_han}%/năm</Descriptions.Item>
                    <Descriptions.Item label="Loại lãi suất">
                      {currentDetail.loai_lai_suat === 'du_no_goc' ? 'Tính trên dư nợ gốc' : 'Tính trên gốc ban đầu'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Cơ sở tính lãi">
                      {currentDetail.co_so_tinh_lai === 'actual' ? 'Thực tế' : `${currentDetail.co_so_tinh_lai} ngày/năm`}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phương thức điều chỉnh">
                      {currentDetail.phuong_thuc_dieu_chinh === 'co_dinh' ? 'Cố định' : currentDetail.phuong_thuc_dieu_chinh === 'dinh_ky' ? 'Định kỳ' : 'Thỏa thuận'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Kỳ tính lãi">
                      {KY_TINH_LAI.find(k => k.value === currentDetail.ky_tinh_lai)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phương thức trả gốc">
                      {PHUONG_THUC.find(p => p.value === currentDetail.phuong_thuc_tra)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày trả lãi đầu tiên">
                      {currentDetail.ngay_tra_lai_dau_tien ? dayjs(currentDetail.ngay_tra_lai_dau_tien).format('DD/MM/YYYY') : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phương thức trả nợ">{currentDetail.phuong_thuc_tra_no ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Tài khoản trả nợ">{currentDetail.tai_khoan_chuyen_vao ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ngân hàng trả">{currentDetail.ten_ngan_hang_tra ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Tài sản thế chấp" span={2}>{currentDetail.tai_san_the_chap ?? '—'}</Descriptions.Item>
                  </Descriptions>
                ),
              },
              ...(drawerEditMode ? [
                {
                  key: 'lai_suat',
                  label: 'Lãi suất',
                  children: (
                    <Form form={formEdit} layout="vertical">
                      <Form.Item name="loai_lai_suat" label="Loại lãi suất">
                        <Radio.Group>
                          <Radio value="du_no_goc">Tính trên dư nợ gốc</Radio>
                          <Radio value="goc_ban_dau">Tính trên gốc ban đầu</Radio>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item name="co_so_tinh_lai" label="Cơ sở tính lãi (ngày/năm)">
                        <Radio.Group>
                          <Radio value="360">360 ngày</Radio>
                          <Radio value="365">365 ngày</Radio>
                          <Radio value="actual">Thực tế</Radio>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item name="phuong_thuc_dieu_chinh" label="Phương thức điều chỉnh lãi suất">
                        <Radio.Group>
                          <Radio value="co_dinh">Cố định</Radio>
                          <Radio value="dinh_ky">Định kỳ</Radio>
                          <Radio value="thoa_thuan">Thỏa thuận</Radio>
                        </Radio.Group>
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="lai_suat" label="Lãi suất (%/năm)" rules={[{ required: true }]}>
                            <InputNumber style={{ width: '100%' }} min={0.01} max={99.99} step={0.1} addonAfter="%/năm" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="lai_suat_qua_han" label="Lãi suất quá hạn (%/năm)">
                            <InputNumber style={{ width: '100%' }} min={0} max={99.99} step={0.1} addonAfter="%/năm" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  ),
                },
                {
                  key: 'tra_no',
                  label: 'Hình thức trả nợ',
                  children: (
                    <Form form={formEdit} layout="vertical">
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="phuong_thuc_tra" label="Trả gốc">
                            <Select options={PHUONG_THUC} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="ky_tinh_lai" label="Trả lãi">
                            <Select options={KY_TINH_LAI} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="ngay_tra_lai_dau_tien" label="Ngày trả lãi đầu tiên">
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                      </Form.Item>
                      <Form.Item name="phuong_thuc_tra_no" label="Phương thức trả nợ">
                        <Select allowClear options={[
                          { value: 'chuyen_khoan', label: 'Chuyển khoản' },
                          { value: 'tien_mat', label: 'Tiền mặt' },
                          { value: 'trich_no', label: 'Trích nợ tự động' },
                        ]} />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="tai_khoan_chuyen_vao" label="Chuyển vào tài khoản">
                            <Input placeholder="VD: 341111" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="ten_ngan_hang_tra" label="Ngân hàng trả">
                            <AutoComplete options={nganHangOptions} placeholder="Tên ngân hàng"
                              filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())} allowClear />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  ),
                },
              ] : []),
              {
                key: 'schedule',
                label: `Lịch trả nợ (${currentDetail.lich_tra?.length ?? 0})`,
                children: (
                  <Table<LichTraNo>
                    columns={lichColumns}
                    dataSource={currentDetail.lich_tra ?? []}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    summary={rows => {
                      const totalGoc = rows.reduce((s, r) => s + Number(r.so_tien_goc), 0)
                      const totalLai = rows.reduce((s, r) => s + Number(r.so_tien_lai), 0)
                      const totalTong = rows.reduce((s, r) => s + Number(r.tong_cong), 0)
                      return (
                        <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                          <Table.Summary.Cell index={0} colSpan={2}>Tổng</Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">{fmtVND(totalGoc)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">{fmtVND(totalLai)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">{fmtVND(totalTong)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={5} colSpan={2} />
                        </Table.Summary.Row>
                      )
                    }}
                    locale={{ emptyText: 'Chưa có lịch — nhấn "Sinh lịch" để tạo' }}
                  />
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Create Modal */}
      <Modal
        title="Tạo khế ước đi vay"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); setCreateTab('giai_ngan') }}
        onOk={() =>
          form.validateFields().then(v => {
            createMutation.mutate({
              ...v,
              ngay_ky: v.ngay_ky?.format('YYYY-MM-DD'),
              ngay_hieu_luc: v.ngay_hieu_luc?.format('YYYY-MM-DD'),
              ngay_ket_thuc: v.ngay_ket_thuc?.format('YYYY-MM-DD'),
              ngay_tra_lai_dau_tien: v.ngay_tra_lai_dau_tien?.format('YYYY-MM-DD'),
            })
          })
        }
        confirmLoading={createMutation.isPending}
        width={680}
      >
        <Form form={form} layout="vertical">
          {/* Header fields */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="to_chuc_cho_vay" label="Tổ chức cho vay" rules={[{ required: true }]}>
                <AutoComplete
                  options={nganHangOptions}
                  placeholder="Tìm hoặc nhập tên ngân hàng"
                  filterOption={(input, opt) =>
                    (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phap_nhan_id" label="Pháp nhân">
                <Select
                  allowClear
                  options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="tk_no_goc" label="TK hạch toán nợ gốc">
                <Input placeholder="VD: 34111" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tk_lai_vay" label="TK hạch toán lãi vay">
                <Input placeholder="VD: 3423" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hop_dong_tin_dung" label="Hợp đồng tín dụng">
                <Input placeholder="Số HĐTD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Mục đích vay">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Tabs
            activeKey={createTab}
            onChange={setCreateTab}
            style={{ marginTop: 4 }}
            items={[
              {
                key: 'giai_ngan',
                label: 'Thông tin giải ngân',
                children: (
                  <>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name="loai_tien" label="Loại tiền" initialValue="VND">
                          <Select options={[{ value: 'VND', label: 'VNĐ' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={16}>
                        <Form.Item name="so_tien_vay" label="Số tiền vay" rules={[{ required: true }]}>
                          <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} min={0} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name="ngay_ky" label="Ngày ký" rules={[{ required: true }]}>
                          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="ngay_hieu_luc" label="Ngày giải ngân" rules={[{ required: true }]}>
                          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="ngay_ket_thuc" label="Ngày đến hạn" rules={[{ required: true }]}>
                          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="phuong_thuc_giai_ngan" label="Phương thức giải ngân">
                          <Select allowClear options={[
                            { value: 'chuyen_khoan', label: 'Chuyển khoản' },
                            { value: 'tien_mat', label: 'Tiền mặt' },
                          ]} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="tai_khoan_nhan" label="Tài khoản nhận tiền vay">
                          <Input placeholder="VD: 112.01" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="ten_ngan_hang_thu_huong" label="Tên ngân hàng thụ hưởng">
                      <AutoComplete options={nganHangOptions} placeholder="Tên ngân hàng thụ hưởng"
                        filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())} allowClear />
                    </Form.Item>
                    <Form.Item name="tai_san_the_chap" label="Tài sản thế chấp">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'lai_suat',
                label: 'Lãi suất',
                children: (
                  <>
                    <Form.Item name="loai_lai_suat" label="Loại lãi suất" initialValue="du_no_goc">
                      <Radio.Group>
                        <Radio value="du_no_goc">Tính trên dư nợ gốc</Radio>
                        <Radio value="goc_ban_dau">Tính trên gốc ban đầu</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item name="co_so_tinh_lai" label="Cơ sở tính lãi (ngày/năm)" initialValue="365">
                      <Radio.Group>
                        <Radio value="360">360 ngày</Radio>
                        <Radio value="365">365 ngày</Radio>
                        <Radio value="actual">Thực tế</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item name="phuong_thuc_dieu_chinh" label="Phương thức điều chỉnh lãi suất" initialValue="co_dinh">
                      <Radio.Group>
                        <Radio value="co_dinh">Cố định</Radio>
                        <Radio value="dinh_ky">Định kỳ</Radio>
                        <Radio value="thoa_thuan">Thỏa thuận</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="lai_suat" label="Lãi suất (%/năm)" rules={[{ required: true }]}>
                          <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} addonAfter="%/năm" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="lai_suat_qua_han" label="Lãi suất quá hạn (%/năm)" initialValue={0}>
                          <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} addonAfter="%/năm" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'tra_no',
                label: 'Hình thức trả nợ',
                children: (
                  <>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="phuong_thuc_tra" label="Trả gốc" initialValue="gop_deu">
                          <Select options={PHUONG_THUC} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="ky_tinh_lai" label="Trả lãi" initialValue="thang">
                          <Select options={KY_TINH_LAI} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="ngay_tra_lai_dau_tien" label="Ngày trả lãi đầu tiên">
                      <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                    <Form.Item name="phuong_thuc_tra_no" label="Phương thức trả nợ">
                      <Select allowClear options={[
                        { value: 'chuyen_khoan', label: 'Chuyển khoản' },
                        { value: 'tien_mat', label: 'Tiền mặt' },
                        { value: 'trich_no', label: 'Trích nợ tự động' },
                      ]} />
                    </Form.Item>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="tai_khoan_chuyen_vao" label="Chuyển vào tài khoản">
                          <Input placeholder="VD: 341111" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="ten_ngan_hang_tra" label="Tên ngân hàng trả">
                          <AutoComplete
                            options={nganHangOptions}
                            placeholder="Tên ngân hàng"
                            filterOption={(input, opt) =>
                              (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            allowClear
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* Tra no modal */}
      <Modal
        title={`Đánh dấu đã trả — Kỳ ${traNoKy?.ky_so}`}
        open={traNoOpen}
        onCancel={() => { setTraNoOpen(false); formTraNo.resetFields() }}
        onOk={() =>
          formTraNo.validateFields().then(v => {
            if (!selected || !traNoKy) return
            traNoMutation.mutate({
              id: selected.id,
              body: {
                ky_so: traNoKy.ky_so,
                ngay_tra_thuc: v.ngay_tra_thuc?.format('YYYY-MM-DD'),
                so_tien_tra_thuc: v.so_tien_tra_thuc,
              },
            })
          })
        }
        confirmLoading={traNoMutation.isPending}
      >
        {traNoKy && (
          <div style={{ marginBottom: 16 }}>
            <Text>Số tiền cần trả: <Text strong>{fmtVND(traNoKy.tong_cong)}</Text></Text>
          </div>
        )}
        <Form form={formTraNo} layout="vertical">
          <Form.Item name="ngay_tra_thuc" label="Ngày trả thực" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" defaultValue={dayjs()} />
          </Form.Item>
          <Form.Item name="so_tien_tra_thuc" label="Số tiền trả thực (đ)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              min={0}
              defaultValue={traNoKy?.tong_cong}
            />
          </Form.Item>
        </Form>
      </Modal>
      {/* Modal Trả nợ trước hạn */}
      {traTruocHanRow && (() => {
        const stats = computeStats(traTruocHanRow.lich_tra)
        const defaultGoc = Number(traTruocHanRow.so_tien_vay) - stats.gocDaTra
        const defaultLai = stats.laiPhaitra
        return (
          <Modal
            title={`Trả nợ trước hạn — ${traTruocHanRow.so_khe_uoc}`}
            open={traTruocHanOpen}
            onCancel={() => { setTraTruocHanOpen(false); formTraTruocHan.resetFields() }}
            footer={[
              <Button key="huy" onClick={() => { setTraTruocHanOpen(false); formTraTruocHan.resetFields() }}>
                Hủy
              </Button>,
              <Button
                key="thuc_hien"
                type="primary"
                loading={traTruocHanMutation.isPending}
                onClick={() =>
                  formTraTruocHan.validateFields().then(v => {
                    traTruocHanMutation.mutate({
                      id: traTruocHanRow.id,
                      body: {
                        ngay_tra_thuc: v.ngay_tra_thuc?.format('YYYY-MM-DD'),
                        loai_tien: v.loai_tien ?? 'VND',
                        hinh_thuc: v.hinh_thuc ?? 'chuyen_khoan',
                        tra_goc: v.tra_goc ?? 0,
                        tra_lai: v.tra_lai ?? 0,
                        phi_khac: v.phi_khac ?? 0,
                      },
                    })
                  })
                }
              >
                Thực hiện
              </Button>,
            ]}
            width={500}
          >
            <Form
              form={formTraTruocHan}
              layout="vertical"
              initialValues={{
                ngay_tra_thuc: dayjs(),
                loai_tien: traTruocHanRow.loai_tien ?? 'VND',
                hinh_thuc: 'chuyen_khoan',
                tra_goc: defaultGoc,
                tra_lai: defaultLai,
                phi_khac: 0,
              }}
            >
              <Row gutter={12} align="middle">
                <Col span={9}>
                  <Form.Item name="ngay_tra_thuc" label="Ngày trả nợ" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item name="loai_tien" label="Loại tiền">
                    <Select options={[
                      { value: 'VND', label: 'VNĐ' },
                      { value: 'USD', label: 'USD' },
                      { value: 'EUR', label: 'EUR' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={8} style={{ textAlign: 'right', paddingTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Tổng trả trước</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>
                    {fmtVND(tongTraTruoc)}
                  </div>
                </Col>
              </Row>

              <Form.Item name="hinh_thuc" label="Hình thức">
                <Select options={[
                  { value: 'chuyen_khoan', label: 'Chuyển khoản' },
                  { value: 'tien_mat', label: 'Tiền mặt' },
                  { value: 'trich_no', label: 'Trích nợ tự động' },
                ]} />
              </Form.Item>

              <Form.Item name="tra_goc" label="Trả gốc">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  min={0}
                />
              </Form.Item>
              <Form.Item name="tra_lai" label="Trả lãi">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  min={0}
                />
              </Form.Item>
              <Form.Item name="phi_khac" label="Phí khác">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  min={0}
                />
              </Form.Item>
            </Form>
          </Modal>
        )
      })()}
      {/* Modal Tất toán khoản vay */}
      {tatToanRow && (() => {
        const stats = computeStats(tatToanRow.lich_tra)
        const defaultNoGoc = Number(tatToanRow.so_tien_vay) - stats.gocDaTra
        const defaultLai = stats.laiPhaitra
        return (
          <Modal
            title="Tất toán khoản vay"
            open={tatToanOpen}
            onCancel={() => { setTatToanOpen(false); formTatToan.resetFields(); setTatToanRow(null) }}
            footer={[
              <Button key="huy" onClick={() => { setTatToanOpen(false); formTatToan.resetFields(); setTatToanRow(null) }}>
                Hủy
              </Button>,
              <Button
                key="thuc_hien"
                type="primary"
                loading={tatToanMutation.isPending}
                onClick={() =>
                  formTatToan.validateFields().then(v =>
                    tatToanMutation.mutate({
                      id: tatToanRow.id,
                      body: {
                        ngay_tat_toan: v.ngay_tat_toan?.format('YYYY-MM-DD'),
                        loai_tien: v.loai_tien ?? 'VND',
                        tien_phat_tra_truoc: v.tien_phat_tra_truoc ?? 0,
                      },
                    })
                  )
                }
              >
                Thực hiện
              </Button>,
            ]}
            width={500}
          >
            <Form
              form={formTatToan}
              layout="vertical"
              initialValues={{
                ngay_tat_toan: dayjs(),
                loai_tien: tatToanRow.loai_tien ?? 'VND',
                no_goc_phai_tra: defaultNoGoc,
                tien_lai_phai_tra: defaultLai,
                tien_phat_tra_truoc: 0,
              }}
            >
              <Row gutter={12} align="middle">
                <Col span={9}>
                  <Form.Item name="ngay_tat_toan" label="Ngày tất toán" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item name="loai_tien" label="Loại tiền">
                    <Select options={[
                      { value: 'VND', label: 'VNĐ' },
                      { value: 'USD', label: 'USD' },
                      { value: 'EUR', label: 'EUR' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={8} style={{ textAlign: 'right', paddingTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Tổng phải trả</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1677ff' }}>
                    {fmtVND(tongTatToan)}
                  </div>
                </Col>
              </Row>

              <Form.Item name="no_goc_phai_tra" label="Nợ gốc phải trả">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  min={0}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="tien_lai_phai_tra" label="Tiền lãi phải trả">
                    <InputNumber
                      style={{ width: '100%' }}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      min={0}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tien_phat_tra_truoc" label="Tiền phạt trả trước">
                    <InputNumber
                      style={{ width: '100%' }}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      min={0}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>
        )
      })()}
    </PageLayout>
  )
}
