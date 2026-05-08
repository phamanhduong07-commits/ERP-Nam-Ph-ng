import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography,
} from 'antd'
import { DeleteOutlined, FileExcelOutlined, FileTextOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { message } from 'antd'
import { theoDoiApi, STAGE_COLORS } from '../../api/theoDoi'
import type { DonHangTheoDoiRow } from '../../api/theoDoi'
import {
  yeuCauApi, deliveriesApi,
  YEU_CAU_TRANG_THAI_LABELS, YEU_CAU_TRANG_THAI_COLORS,
  CONG_NO_LABELS, CONG_NO_COLORS,
} from '../../api/deliveries'
import type { YeuCauGiaoHang, DeliveryOrder } from '../../api/deliveries'
import { xeApi, taiXeApi, donGiaVanChuyenApi } from '../../api/simpleApis'
import type { Xe, TaiXe, DonGiaVanChuyen } from '../../api/simpleApis'
import { warehousesApi } from '../../api/warehouses'
import type { Warehouse } from '../../api/warehouses'
import { warehouseApi } from '../../api/warehouse'
import type { TonKhoTPRow } from '../../api/warehouse'
import { usersApi } from '../../api/usersApi'
import type { NhanVien } from '../../api/usersApi'
import { billingApi } from '../../api/billing'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'
import { printDocument, exportToExcel } from '../../utils/exportUtils'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'
const fmtMoney = (v: number) =>
  v ? new Intl.NumberFormat('vi-VN').format(v) : '0'

export default function GiaoHangPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehousesApi.list().then(r => r.data) })
  const { data: xeList = [] } = useQuery({ queryKey: ['xe'], queryFn: () => xeApi.list().then(r => r.data) })
  const { data: taiXeList = [] } = useQuery({ queryKey: ['tai-xe'], queryFn: () => taiXeApi.list().then(r => r.data) })
  const { data: donGiaList = [] } = useQuery({ queryKey: ['don-gia-van-chuyen'], queryFn: () => donGiaVanChuyenApi.list().then(r => r.data) })
  const { data: nvList = [] } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) })

  const [ycFilter, setYCFilter] = useState<{
    ten_khach: string; nv_theo_doi_id: number | undefined
    so_lenh: string; so_don: string
    tu_ngay: string | undefined; den_ngay: string | undefined
  }>({ ten_khach: '', nv_theo_doi_id: undefined, so_lenh: '', so_don: '', tu_ngay: undefined, den_ngay: undefined })

  const { data: yeuCauList = [], isLoading: loadingYC } = useQuery({
    queryKey: ['yeu-cau-giao-hang', ycFilter],
    queryFn: () => yeuCauApi.list({
      ten_khach: ycFilter.ten_khach || undefined,
      nv_theo_doi_id: ycFilter.nv_theo_doi_id,
      so_lenh: ycFilter.so_lenh || undefined,
      so_don: ycFilter.so_don || undefined,
      tu_ngay: ycFilter.tu_ngay,
      den_ngay: ycFilter.den_ngay,
    }).then(r => r.data),
  })

  const [doFilter, setDOFilter] = useState<{
    ten_khach: string; nv_theo_doi_id: number | undefined
    so_lenh: string; so_don: string
    tu_ngay: string | undefined; den_ngay: string | undefined
  }>({ ten_khach: '', nv_theo_doi_id: undefined, so_lenh: '', so_don: '', tu_ngay: undefined, den_ngay: undefined })

  const { data: deliveryList = [], isLoading: loadingDO } = useQuery({
    queryKey: ['deliveries', doFilter],
    queryFn: () => deliveriesApi.list({
      ten_khach: doFilter.ten_khach || undefined,
      nv_theo_doi_id: doFilter.nv_theo_doi_id,
      so_lenh: doFilter.so_lenh || undefined,
      so_don: doFilter.so_don || undefined,
      tu_ngay: doFilter.tu_ngay,
      den_ngay: doFilter.den_ngay,
    }).then(r => r.data),
  })

  const [stockFilter, setStockFilter] = useState<{
    ten_khach: string; nv_theo_doi_id: number | undefined
    so_lenh: string; tu_ngay: string | undefined; den_ngay: string | undefined
  }>({ ten_khach: '', nv_theo_doi_id: undefined, so_lenh: '', tu_ngay: undefined, den_ngay: undefined })
  const [selectedStockKeys, setSelectedStockKeys] = useState<number[]>([])

  const { data: stockRows = [], isLoading: loadingStock } = useQuery({
    queryKey: ['ton-kho-tp-lsx-delivery', stockFilter],
    queryFn: () => warehouseApi.getTonKhoTpLsx({
      ten_khach: stockFilter.ten_khach || undefined,
      nv_theo_doi_id: stockFilter.nv_theo_doi_id,
      so_lenh: stockFilter.so_lenh || undefined,
      tu_ngay: stockFilter.tu_ngay,
      den_ngay: stockFilter.den_ngay,
    }).then(r => r.data),
  })

  const availableStockRows = useMemo(
    () => stockRows.filter(r => r.ton_kho > 0),
    [stockRows],
  )
  const selectedStockRows = availableStockRows.filter(r => selectedStockKeys.includes(r.production_order_id))

  const [includeHT, setIncludeHT] = useState(false)
  const [poSearch, setPOSearch] = useState('')
  const [poNvId, setPONvId] = useState<number | undefined>()
  const [poKhach, setPOKhach] = useState<string | undefined>()
  const [poDates, setPODates] = useState<[string | undefined, string | undefined]>([undefined, undefined])

  const { data: theoDoiRows = [], isLoading: loadingTD, refetch: refetchTD } = useQuery({
    queryKey: ['theo-doi-giao', includeHT],
    queryFn: () => theoDoiApi.getDonHang({ include_hoan_thanh: includeHT }).then(r => r.data),
  })

  const poKhachOptions = useMemo(() => {
    const seen = new Set<string>()
    return theoDoiRows
      .map(r => r.ten_khach_hang)
      .filter((v): v is string => !!v && !seen.has(v) && !!seen.add(v))
      .sort()
      .map(v => ({ label: v, value: v }))
  }, [theoDoiRows])

  const filteredPORows = useMemo(() => {
    let data = theoDoiRows
    if (poNvId) data = data.filter(r => r.nv_theo_doi_id === poNvId)
    if (poKhach) data = data.filter(r => r.ten_khach_hang === poKhach)
    if (poDates[0]) data = data.filter(r => r.ngay_giao_hang && r.ngay_giao_hang >= poDates[0]!)
    if (poDates[1]) data = data.filter(r => r.ngay_giao_hang && r.ngay_giao_hang <= poDates[1]!)
    if (poSearch.trim()) {
      const s = poSearch.toLowerCase()
      data = data.filter(r =>
        (r.so_lenh ?? '').toLowerCase().includes(s) ||
        (r.ten_khach_hang ?? '').toLowerCase().includes(s) ||
        (r.ten_hang ?? '').toLowerCase().includes(s) ||
        (r.so_don ?? '').toLowerCase().includes(s)
      )
    }
    return data
  }, [theoDoiRows, poNvId, poKhach, poDates, poSearch])

  const [selectedPOKeys, setSelectedPOKeys] = useState<number[]>([])
  const selectedPORows = theoDoiRows.filter(r => r.production_order_id != null && selectedPOKeys.includes(r.production_order_id))

  const [showYCModal, setShowYCModal] = useState(false)
  const [ycForm] = Form.useForm()
  const [ycItems, setYCItems] = useState<Array<{
    production_order_id: number | null; so_lenh: string | null; ten_hang: string
    phan_xuong_id: number | null; warehouse_id: number | null
    so_luong: number; dvt: string; dien_tich: number | null; trong_luong: number | null; ghi_chu: string
  }>>([])

  const openYCModal = () => {
    if (!selectedPORows.length) { message.warning('Chọn ít nhất 1 lệnh SX'); return }
    setYCItems(selectedPORows.map(r => ({
      production_order_id: r.production_order_id,
      so_lenh: r.so_lenh,
      ten_hang: r.ten_hang || '',
      phan_xuong_id: r.phan_xuong_id,
      warehouse_id: null,
      so_luong: r.so_luong_ke_hoach,
      dvt: 'Thùng',
      dien_tich: null,
      trong_luong: null,
      ghi_chu: '',
    })))
    ycForm.resetFields()
    ycForm.setFieldsValue({ ngay_yeu_cau: dayjs() })
    setShowYCModal(true)
  }

  const createYCMutation = useMutation({
    mutationFn: (payload: Parameters<typeof yeuCauApi.create>[0]) => yeuCauApi.create(payload).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo yêu cầu giao hàng thành công')
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
      setShowYCModal(false)
      setSelectedPOKeys([])
    },
    onError: (e: unknown) => message.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Lỗi tạo yêu cầu'),
  })

  const handleSaveYC = async () => {
    const vals = await ycForm.validateFields()
    for (const it of ycItems) {
      if (!it.warehouse_id) { message.warning(`Chưa chọn kho cho lệnh ${it.so_lenh}`); return }
    }
    createYCMutation.mutate({
      ngay_yeu_cau: vals.ngay_yeu_cau.format('YYYY-MM-DD'),
      ngay_giao_yeu_cau: vals.ngay_giao_yeu_cau ? vals.ngay_giao_yeu_cau.format('YYYY-MM-DD') : undefined,
      dia_chi_giao: vals.dia_chi_giao,
      nguoi_nhan: vals.nguoi_nhan,
      ghi_chu: vals.ghi_chu,
      items: ycItems.map(it => ({
        production_order_id: it.production_order_id!,
        warehouse_id: it.warehouse_id!,
        so_luong: it.so_luong,
        dvt: it.dvt,
        dien_tich: it.dien_tich ?? undefined,
        trong_luong: it.trong_luong ?? undefined,
        ghi_chu: it.ghi_chu || undefined,
      })),
    })
  }

  const [showDOModal, setShowDOModal] = useState(false)
  const [selectedYC, setSelectedYC] = useState<YeuCauGiaoHang | null>(null)
  const [directCustomerId, setDirectCustomerId] = useState<number | null>(null)
  const [directSalesOrderId, setDirectSalesOrderId] = useState<number | null>(null)
  const [doForm] = Form.useForm()
  const [doItems, setDOItems] = useState<Array<{
    production_order_id: number | null; so_lenh: string | null; ten_hang: string
    product_id?: number | null; sales_order_item_id?: number | null
    so_luong: number; dvt: string; dien_tich: number; trong_luong: number; the_tich: number
    don_gia: number; thanh_tien: number; ghi_chu: string; ton_kho?: number
  }>>([])

  const openDOModal = (yc: YeuCauGiaoHang) => {
    setSelectedYC(yc)
    setDOItems(yc.items.map(it => ({
      production_order_id: it.production_order_id,
      so_lenh: it.so_lenh,
      ten_hang: it.ten_hang,
      product_id: it.product_id,
      sales_order_item_id: it.sales_order_item_id,
      so_luong: it.so_luong,
      dvt: it.dvt,
      dien_tich: it.dien_tich || 0,
      trong_luong: it.trong_luong || 0,
      the_tich: it.the_tich || 0,
      don_gia: 0,
      thanh_tien: 0,
      ghi_chu: '',
    })))
    doForm.resetFields()
    doForm.setFieldsValue({ ngay_xuat: dayjs() })
    setDirectCustomerId(null)
    setDirectSalesOrderId(null)
    setShowDOModal(true)
  }

  const openDirectDOModal = () => {
    if (!selectedStockRows.length) {
      message.warning('Chọn ít nhất 1 dòng tồn kho thành phẩm')
      return
    }

    const customerIds = Array.from(new Set(selectedStockRows.map(r => r.customer_id).filter((v): v is number => v != null)))
    if (customerIds.length !== 1) {
      message.warning('Chỉ tạo một phiếu bán hàng cho cùng một khách hàng')
      return
    }

    const warehouseIds = Array.from(new Set(selectedStockRows.map(r => r.warehouse_id).filter((v): v is number => v != null)))
    if (warehouseIds.length !== 1) {
      message.warning('Chỉ tạo một phiếu bán hàng từ cùng một kho thành phẩm')
      return
    }

    const firstRow = selectedStockRows[0]
    const salesOrderIds = Array.from(new Set(selectedStockRows.map(r => r.sales_order_id).filter((v): v is number => v != null)))
    setSelectedYC(null)
    setDirectCustomerId(customerIds[0])
    setDirectSalesOrderId(salesOrderIds.length === 1 ? salesOrderIds[0] : null)
    setDOItems(selectedStockRows.map(r => {
      const donGia = r.don_gia || 0
      const soLuong = r.ton_kho
      return {
        production_order_id: r.production_order_id,
        so_lenh: r.so_lenh,
        ten_hang: r.ten_hang || '',
        product_id: r.product_id,
        sales_order_item_id: r.sales_order_item_id,
        so_luong: soLuong,
        dvt: r.dvt || 'Thùng',
        dien_tich: r.dien_tich || 0,
        trong_luong: r.trong_luong || 0,
        the_tich: r.the_tich || 0,
        don_gia: donGia,
        thanh_tien: donGia * soLuong,
        ghi_chu: '',
        ton_kho: r.ton_kho,
      }
    }))
    doForm.resetFields()
    doForm.setFieldsValue({
      ngay_xuat: dayjs(),
      warehouse_id: warehouseIds[0],
      ghi_chu: firstRow.so_don ? `Xuất từ kho thành phẩm - ${firstRow.so_don}` : 'Xuất từ kho thành phẩm',
    })
    setShowDOModal(true)
  }

  const createDOMutation = useMutation({
    mutationFn: (payload: Parameters<typeof deliveriesApi.create>[0]) => deliveriesApi.create(payload).then(r => r.data),
    onSuccess: (delivery) => {
      message.success({
        content: (
          <Space>
            <span>Tạo phiếu giao hàng thành công</span>
            <Button size="small" icon={<PrinterOutlined />} onClick={() => printDelivery(delivery)}>
              In phiếu giao hàng
            </Button>
          </Space>
        ),
        duration: 8,
      })
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-tp-lsx-delivery'] })
      setShowDOModal(false)
      setSelectedYC(null)
      setDirectCustomerId(null)
      setDirectSalesOrderId(null)
      setSelectedStockKeys([])
    },
    onError: (e: unknown) => message.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const createInvoiceMutation = useMutation({
    mutationFn: (deliveryId: number) => billingApi.createFromDelivery(deliveryId),
    onSuccess: (invoice) => {
      message.success('Tạo hóa đơn bán hàng thành công')
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
      navigate(`/billing/invoices/${invoice.id}`)
    },
    onError: (e: unknown) => message.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Lỗi tạo hóa đơn'),
  })

  const handleSaveDO = async () => {
    const vals = await doForm.validateFields()
    if (!selectedYC && !directCustomerId) {
      message.warning('Chưa xác định khách hàng cho phiếu bán hàng')
      return
    }
    const overStock = doItems.find(it => it.ton_kho != null && it.so_luong > it.ton_kho)
    if (overStock) {
      message.warning(`Số lượng xuất của ${overStock.so_lenh || overStock.ten_hang} vượt tồn kho`)
      return
    }
    const donGia = donGiaList.find((d: DonGiaVanChuyen) => d.id === vals.don_gia_vc_id)
    createDOMutation.mutate({
      ngay_xuat: vals.ngay_xuat.format('YYYY-MM-DD'),
      warehouse_id: vals.warehouse_id,
      sales_order_id: directSalesOrderId ?? undefined,
      customer_id: selectedYC?.customer_id ?? directCustomerId ?? undefined,
      yeu_cau_id: selectedYC?.id,
      dia_chi_giao: selectedYC?.dia_chi_giao ?? undefined,
      nguoi_nhan: selectedYC?.nguoi_nhan ?? undefined,
      xe_id: vals.xe_id ?? undefined,
      tai_xe_id: vals.tai_xe_id ?? undefined,
      lo_xe: vals.lo_xe ?? undefined,
      don_gia_vc_id: vals.don_gia_vc_id ?? undefined,
      tien_van_chuyen: donGia ? Number(donGia.don_gia) : vals.tien_van_chuyen ?? undefined,
      ghi_chu: vals.ghi_chu ?? undefined,
      items: doItems.map(it => ({
        production_order_id: it.production_order_id ?? undefined,
        product_id: it.product_id ?? undefined,
        sales_order_item_id: it.sales_order_item_id ?? undefined,
        ten_hang: it.ten_hang,
        so_luong: it.so_luong,
        dvt: it.dvt,
        dien_tich: it.dien_tich > 0 ? it.dien_tich : undefined,
        trong_luong: it.trong_luong > 0 ? it.trong_luong : undefined,
        the_tich: it.the_tich > 0 ? it.the_tich : undefined,
        don_gia: it.don_gia || undefined,
        ghi_chu: it.ghi_chu || undefined,
      })),
    })
  }

  const tongTienHang = doItems.reduce((s, it) => s + it.thanh_tien, 0)

  const printDelivery = (delivery: DeliveryOrder) => {
    const rows = delivery.items.map((it, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>${it.so_lenh || ''}</td>
        <td>${it.ten_hang || ''}</td>
        <td class="right">${fmtN(it.so_luong)}</td>
        <td class="center">${it.dvt || ''}</td>
        <td class="right">${fmtMoney(it.don_gia)}</td>
        <td class="right">${fmtMoney(it.thanh_tien)}</td>
        <td class="right">${fmtN(it.dien_tich)}</td>
        <td class="right">${fmtN(it.trong_luong)}</td>
        <td class="right">${fmtN(it.the_tich)}</td>
      </tr>
    `).join('')

    printDocument({
      title: `Phiếu giao hàng ${delivery.so_phieu}`,
      subtitle: 'PHIẾU GIAO HÀNG',
      logoUrl: namPhuongLogo,
      companyName: 'CÔNG TY TNHH SX TM NAM PHƯƠNG',
      documentNumber: delivery.so_phieu || '—',
      documentDate: fmtDate(delivery.ngay_xuat),
      fields: [
        { label: 'Khách hàng', value: delivery.ten_khach || '—' },
        { label: 'Số đơn', value: delivery.so_don || '—' },
        { label: 'Số lệnh', value: delivery.items?.[0]?.so_lenh || '—' },
        { label: 'Kho xuất', value: delivery.ten_kho || '—' },
        { label: 'Ngày xuất', value: fmtDate(delivery.ngay_xuat) },
        { label: 'Xe', value: delivery.bien_so || delivery.xe_van_chuyen || '—' },
        { label: 'Tài xế', value: delivery.ten_tai_xe || '—' },
        { label: 'Người nhận', value: delivery.nguoi_nhan || '—' },
        { label: 'Địa chỉ giao', value: delivery.dia_chi_giao || '—' },
      ],
      bodyHtml: `
        <table>
          <thead><tr>
            <th>STT</th><th>LSX</th><th>Tên hàng</th><th>SL</th><th>DVT</th>
            <th>Đơn giá</th><th>Thành tiền</th><th>m²</th><th>kg</th><th>m³</th>
          </tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="6" class="right">Tổng</td>
              <td class="right">${fmtMoney(delivery.tong_tien_hang)}</td>
              <td class="right">${fmtN(delivery.tong_dien_tich)}</td>
              <td class="right">${fmtN(delivery.tong_trong_luong)}</td>
              <td class="right">${fmtN(delivery.tong_the_tich)}</td>
            </tr>
          </tbody>
        </table>
        <div class="summary-box">
          <div class="summary-item"><div class="s-label">Tiền hàng</div><div class="s-value">${fmtMoney(delivery.tong_tien_hang)}</div></div>
          <div class="summary-item"><div class="s-label">Vận chuyển</div><div class="s-value">${fmtMoney(delivery.tien_van_chuyen)}</div></div>
          <div class="summary-item"><div class="s-label">Tổng thanh toán</div><div class="s-value">${fmtMoney(delivery.tong_thanh_toan)}</div></div>
          <div class="summary-item"><div class="s-label">Tổng m³</div><div class="s-value">${fmtN(delivery.tong_the_tich)}</div></div>
        </div>
        <div class="signature-grid">
          <div class="signature-box"><div class="sign-name">Người lập phiếu</div></div>
          <div class="signature-box"><div class="sign-name">Thủ kho</div></div>
          <div class="signature-box"><div class="sign-name">Người nhận hàng</div></div>
        </div>
      `,
    })
  }

  const ycCols: ColumnsType<YeuCauGiaoHang> = [
    { title: 'Số YC', dataIndex: 'so_yeu_cau', width: 140, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Ngày YC', dataIndex: 'ngay_yeu_cau', width: 95, render: (v: string) => fmtDate(v) },
    { title: 'Ngày giao YC', dataIndex: 'ngay_giao_yeu_cau', width: 105, render: (v: string | null) => fmtDate(v) },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 140 },
    {
      title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 150, ellipsis: true,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Kho TP', dataIndex: 'ten_kho_tp', width: 140, ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    { title: '∑ m²', dataIndex: 'tong_dien_tich', width: 80, render: (v: number) => fmtN(v) },
    { title: '∑ kg', dataIndex: 'tong_trong_luong', width: 80, render: (v: number) => fmtN(v) },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: (v: string) => <Tag color={YEU_CAU_TRANG_THAI_COLORS[v] || 'default'}>{YEU_CAU_TRANG_THAI_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Thao tác', width: 160, fixed: 'right',
      render: (_: unknown, row: YeuCauGiaoHang) => (
        <Space size={4}>
          {row.trang_thai !== 'da_tao_phieu' && row.trang_thai !== 'huy' && (
            <Button size="small" type="primary" onClick={() => openDOModal(row)}>Tạo phiếu BH</Button>
          )}
          {row.trang_thai === 'moi' && (
            <Popconfirm title="Xoá yêu cầu này?" onConfirm={() =>
              yeuCauApi.delete(row.id).then(() => {
                message.success('Đã xoá')
                qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
              })
            }>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const doCols: ColumnsType<DeliveryOrder> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 150, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 95, render: (v: string) => fmtDate(v) },
    { title: 'Khách hàng', dataIndex: 'ten_khach', width: 140 },
    { title: 'Xe', dataIndex: 'bien_so', width: 110, render: (v: string | null) => v ?? '—' },
    { title: 'Tài xế', dataIndex: 'ten_tai_xe', width: 120, render: (v: string | null) => v ?? '—' },
    { title: '∑ m²', dataIndex: 'tong_dien_tich', width: 80, render: (v: number) => fmtN(v) },
    { title: '∑ kg', dataIndex: 'tong_trong_luong', width: 80, render: (v: number) => fmtN(v) },
    { title: '∑ m³', dataIndex: 'tong_the_tich', width: 80, render: (v: number) => fmtN(v) },
    { title: 'Tổng TT (₫)', dataIndex: 'tong_thanh_toan', width: 120, render: (v: number) => fmtMoney(v) },
    {
      title: 'Công nợ', dataIndex: 'trang_thai_cong_no', width: 110,
      render: (v: string) => <Tag color={CONG_NO_COLORS[v] || 'default'}>{CONG_NO_LABELS[v] || v}</Tag>,
    },
    {
      title: '',
      width: 88,
      fixed: 'right',
      render: (_: unknown, row: DeliveryOrder) => (
        <Space size={4}>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => printDelivery(row)} />
          <Button
            size="small"
            icon={<FileTextOutlined />}
            loading={createInvoiceMutation.isPending}
            disabled={!row.tong_tien_hang}
            onClick={() => createInvoiceMutation.mutate(row.id)}
          />
        </Space>
      ),
    },
  ]

  const stockCols: ColumnsType<TonKhoTPRow> = [
    { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 120, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Số đơn', dataIndex: 'so_don', width: 120, render: (v: string | null) => v ?? <Text type="secondary">-</Text> },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 140 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'Kho TP', dataIndex: 'ten_phan_xuong', width: 120, render: (v: string | null) => v ?? <Text type="secondary">-</Text> },
    {
      title: 'Tồn',
      dataIndex: 'ton_kho',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.ton_kho - b.ton_kho,
      render: (v: number, r) => <Text strong>{fmtN(v)} {r.dvt}</Text>,
    },
    { title: 'm²', dataIndex: 'dien_tich', width: 80, align: 'right', render: (v: number) => fmtN(v) },
    { title: 'kg', dataIndex: 'trong_luong', width: 80, align: 'right', render: (v: number) => fmtN(v) },
    { title: 'm³', dataIndex: 'the_tich', width: 80, align: 'right', render: (v: number) => fmtN(v) },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right', render: (v: number) => fmtMoney(v) },
    { title: 'NV theo dõi', dataIndex: 'ten_nv_theo_doi', width: 120, render: (v: string | null) => v ?? <Text type="secondary">-</Text> },
  ]

  const poCols: ColumnsType<DonHangTheoDoiRow> = [
    { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 130 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, width: 180 },
    { title: 'NV theo dõi', dataIndex: 'ten_nv_theo_doi', width: 120, render: (v: string | null) => v ?? '—' },
    { title: 'SL kế hoạch', dataIndex: 'so_luong_ke_hoach', width: 100, render: (v: number) => fmtN(v) },
    { title: 'Ngày giao', dataIndex: 'ngay_giao_hang', width: 95, render: (v: string | null) => fmtDate(v) },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 100 },
    { title: 'Giai đoạn', dataIndex: 'stage_label', width: 110, render: (v: string, r: DonHangTheoDoiRow) => <Tag color={STAGE_COLORS[r.stage]}>{v}</Tag> },
  ]

  const handleExportYC = () => {
    exportToExcel(`yeu_cau_giao_hang_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Yêu cầu giao hàng',
      headers: ['Số YC', 'Ngày YC', 'Ngày giao', 'Khách hàng', 'Kho TP', 'Địa chỉ giao', 'Tổng m²', 'Tổng kg', 'Trạng thái'],
      rows: yeuCauList.map((r: YeuCauGiaoHang) => [
        r.so_yeu_cau,
        fmtDate(r.ngay_yeu_cau),
        fmtDate(r.ngay_giao_yeu_cau),
        r.ten_khach_hang ?? '',
        r.ten_kho_tp ?? '',
        r.dia_chi_giao ?? '',
        r.tong_dien_tich,
        r.tong_trong_luong,
        YEU_CAU_TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
      ]),
      colWidths: [16, 12, 12, 24, 18, 28, 10, 10, 14],
    }])
  }

  const handleExportDO = () => {
    exportToExcel(`phieu_ban_hang_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Phiếu bán hàng',
      headers: ['Số phiếu', 'Ngày xuất', 'Khách hàng', 'Biển số xe', 'Tài xế', 'm²', 'kg', 'm³', 'Tiền hàng (đ)', 'Tổng TT (đ)', 'Công nợ'],
      rows: deliveryList.map((r: DeliveryOrder) => [
        r.so_phieu,
        fmtDate(r.ngay_xuat),
        r.ten_khach ?? '',
        r.bien_so ?? '',
        r.ten_tai_xe ?? '',
        r.tong_dien_tich,
        r.tong_trong_luong,
        r.tong_the_tich,
        r.tong_tien_hang,
        r.tong_thanh_toan,
        CONG_NO_LABELS[r.trang_thai_cong_no] ?? r.trang_thai_cong_no,
      ]),
      colWidths: [16, 12, 24, 14, 18, 10, 10, 10, 16, 16, 16],
    }])
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Giao hàng</Title>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Tabs
            size="small"
            items={[
              {
                key: 'yeu-cau',
                label: 'Yêu cầu giao hàng',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <Card size="small" title="Chọn lệnh sản xuất cần giao">
                      <Row gutter={8} style={{ marginBottom: 8 }}>
                        <Col>
                          <Input
                            placeholder="Tìm LSX / khách / hàng..."
                            prefix={<SearchOutlined />}
                            style={{ width: 220 }}
                            value={poSearch}
                            onChange={e => setPOSearch(e.target.value)}
                            allowClear
                          />
                        </Col>
                        <Col>
                          <Select
                            placeholder="Khách hàng"
                            allowClear
                            style={{ width: 180 }}
                            showSearch
                            optionFilterProp="label"
                            options={poKhachOptions}
                            value={poKhach}
                            onChange={v => setPOKhach(v)}
                          />
                        </Col>
                        <Col>
                          <Select
                            placeholder="NV theo dõi"
                            allowClear
                            style={{ width: 180 }}
                            showSearch
                            optionFilterProp="label"
                            options={nvList.map((nv: NhanVien) => ({ value: nv.id, label: nv.ho_ten || nv.username }))}
                            value={poNvId}
                            onChange={v => setPONvId(v)}
                          />
                        </Col>
                        <Col>
                          <DatePicker.RangePicker
                            format="DD/MM/YYYY"
                            placeholder={['Ngày giao từ', 'đến ngày']}
                            style={{ width: 250 }}
                            allowClear
                            onChange={dates => setPODates([
                              dates?.[0]?.format('YYYY-MM-DD'),
                              dates?.[1]?.format('YYYY-MM-DD'),
                            ])}
                          />
                        </Col>
                        <Col>
                          <Button
                            type={includeHT ? 'primary' : 'default'}
                            size="small"
                            onClick={() => setIncludeHT(v => !v)}
                          >
                            {includeHT ? 'Ẩn hoàn thành' : 'Hiện hoàn thành'}
                          </Button>
                        </Col>
                        <Col>
                          <Button size="small" onClick={() => refetchTD()}>Làm mới</Button>
                        </Col>
                        <Col flex="auto" />
                        <Col>
                          <Text type="secondary" style={{ fontSize: 12 }}>{filteredPORows.length} lệnh</Text>
                        </Col>
                        <Col>
                          <Button
                            type="primary"
                            disabled={!selectedPOKeys.length}
                            onClick={openYCModal}
                          >
                            Tạo yêu cầu giao hàng ({selectedPOKeys.length})
                          </Button>
                        </Col>
                      </Row>
                      <Table<DonHangTheoDoiRow>
                        rowKey={r => r.production_order_id != null ? r.production_order_id : `so-${r.sales_order_id}`}
                        size="small"
                        loading={loadingTD}
                        dataSource={filteredPORows}
                        columns={poCols}
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                        scroll={{ x: 800 }}
                        rowSelection={{
                          type: 'checkbox',
                          selectedRowKeys: selectedPOKeys,
                          onChange: keys => setSelectedPOKeys(keys as number[]),
                          getCheckboxProps: (record: DonHangTheoDoiRow) => ({ disabled: record.production_order_id === null }),
                        }}
                      />
                    </Card>

                    <Card size="small" title="Danh sách yêu cầu giao hàng">
                      <Row gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={4}>
                          <Input
                            placeholder="Khách hàng"
                            allowClear
                            value={ycFilter.ten_khach}
                            onChange={e => setYCFilter(f => ({ ...f, ten_khach: e.target.value }))}
                          />
                        </Col>
                        <Col span={4}>
                          <Select
                            placeholder="NV theo dõi"
                            allowClear
                            style={{ width: '100%' }}
                            value={ycFilter.nv_theo_doi_id}
                            onChange={v => setYCFilter(f => ({ ...f, nv_theo_doi_id: v }))}
                            options={nvList.map((nv: NhanVien) => ({ value: nv.id, label: nv.ho_ten || nv.username }))}
                            showSearch
                            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                          />
                        </Col>
                        <Col span={3}>
                          <Input
                            placeholder="Số đơn"
                            allowClear
                            value={ycFilter.so_don}
                            onChange={e => setYCFilter(f => ({ ...f, so_don: e.target.value }))}
                          />
                        </Col>
                        <Col span={3}>
                          <Input
                            placeholder="Lệnh SX"
                            allowClear
                            value={ycFilter.so_lenh}
                            onChange={e => setYCFilter(f => ({ ...f, so_lenh: e.target.value }))}
                          />
                        </Col>
                        <Col span={6}>
                          <DatePicker.RangePicker
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                            onChange={dates => setYCFilter(f => ({
                              ...f,
                              tu_ngay: dates?.[0]?.format('YYYY-MM-DD'),
                              den_ngay: dates?.[1]?.format('YYYY-MM-DD'),
                            }))}
                          />
                        </Col>
                        <Col>
                          <Button onClick={() => setYCFilter({ ten_khach: '', nv_theo_doi_id: undefined, so_lenh: '', so_don: '', tu_ngay: undefined, den_ngay: undefined })}>
                            Xoá lọc
                          </Button>
                        </Col>
                        <Col>
                          <Button icon={<FileExcelOutlined />} onClick={handleExportYC}>
                            Xuất Excel
                          </Button>
                        </Col>
                      </Row>
                      <Table<YeuCauGiaoHang>
                        rowKey="id"
                        size="small"
                        loading={loadingYC}
                        dataSource={yeuCauList}
                        columns={ycCols}
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                        scroll={{ x: 900 }}
                        expandable={{
                          expandedRowRender: (row: YeuCauGiaoHang) => (
                            <Table
                              size="small"
                              rowKey="id"
                              dataSource={row.items}
                              pagination={false}
                              columns={[
                                { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130 },
                                { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                                { title: 'Kho xuất', dataIndex: 'ten_kho', width: 120 },
                                { title: 'SL', dataIndex: 'so_luong', width: 80, render: (v: number) => fmtN(v) },
                                { title: 'DVT', dataIndex: 'dvt', width: 60 },
                                { title: 'm²', dataIndex: 'dien_tich', width: 80, render: (v: number) => fmtN(v) },
                                { title: 'kg', dataIndex: 'trong_luong', width: 80, render: (v: number) => fmtN(v) },
                              ]}
                            />
                          ),
                        }}
                      />
                    </Card>
                  </Space>
                ),
              },
              {
                key: 'phieu-ban-hang',
                label: 'Phiếu bán hàng',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Card size="small" title="Tạo phiếu bán hàng từ kho thành phẩm">
                      <Row gutter={8} style={{ marginBottom: 8 }}>
                        <Col span={4}>
                          <Input
                            placeholder="Khách hàng"
                            allowClear
                            value={stockFilter.ten_khach}
                            onChange={e => setStockFilter(f => ({ ...f, ten_khach: e.target.value }))}
                          />
                        </Col>
                        <Col span={4}>
                          <Select
                            placeholder="NV theo dõi"
                            allowClear
                            style={{ width: '100%' }}
                            value={stockFilter.nv_theo_doi_id}
                            onChange={v => setStockFilter(f => ({ ...f, nv_theo_doi_id: v }))}
                            options={nvList.map((nv: NhanVien) => ({ value: nv.id, label: nv.ho_ten || nv.username }))}
                            showSearch
                            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                          />
                        </Col>
                        <Col span={3}>
                          <Input
                            placeholder="Lệnh SX"
                            allowClear
                            value={stockFilter.so_lenh}
                            onChange={e => setStockFilter(f => ({ ...f, so_lenh: e.target.value }))}
                          />
                        </Col>
                        <Col span={6}>
                          <DatePicker.RangePicker
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                            onChange={dates => setStockFilter(f => ({
                              ...f,
                              tu_ngay: dates?.[0]?.format('YYYY-MM-DD'),
                              den_ngay: dates?.[1]?.format('YYYY-MM-DD'),
                            }))}
                          />
                        </Col>
                        <Col>
                          <Button onClick={() => setStockFilter({ ten_khach: '', nv_theo_doi_id: undefined, so_lenh: '', tu_ngay: undefined, den_ngay: undefined })}>
                            Xoá lọc
                          </Button>
                        </Col>
                        <Col flex="auto" />
                        <Col>
                          <Button type="primary" disabled={!selectedStockKeys.length} onClick={openDirectDOModal}>
                            Tạo phiếu từ tồn kho ({selectedStockKeys.length})
                          </Button>
                        </Col>
                      </Row>
                      <Table<TonKhoTPRow>
                        rowKey="production_order_id"
                        size="small"
                        loading={loadingStock}
                        dataSource={availableStockRows}
                        columns={stockCols}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        scroll={{ x: 950 }}
                        rowSelection={{
                          type: 'checkbox',
                          selectedRowKeys: selectedStockKeys,
                          onChange: keys => setSelectedStockKeys(keys as number[]),
                          getCheckboxProps: (record) => ({
                            disabled: !record.customer_id || !record.warehouse_id || record.ton_kho <= 0,
                          }),
                        }}
                      />
                    </Card>
                    <Card size="small" title="Danh sách phiếu bán hàng">
                    <Row gutter={8}>
                      <Col span={4}>
                        <Input
                          placeholder="Khách hàng"
                          allowClear
                          value={doFilter.ten_khach}
                          onChange={e => setDOFilter(f => ({ ...f, ten_khach: e.target.value }))}
                        />
                      </Col>
                      <Col span={4}>
                        <Select
                          placeholder="NV theo dõi"
                          allowClear
                          style={{ width: '100%' }}
                          value={doFilter.nv_theo_doi_id}
                          onChange={v => setDOFilter(f => ({ ...f, nv_theo_doi_id: v }))}
                          options={nvList.map((nv: NhanVien) => ({ value: nv.id, label: nv.ho_ten || nv.username }))}
                          showSearch
                          filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        />
                      </Col>
                      <Col span={3}>
                        <Input
                          placeholder="Số đơn"
                          allowClear
                          value={doFilter.so_don}
                          onChange={e => setDOFilter(f => ({ ...f, so_don: e.target.value }))}
                        />
                      </Col>
                      <Col span={3}>
                        <Input
                          placeholder="Lệnh SX"
                          allowClear
                          value={doFilter.so_lenh}
                          onChange={e => setDOFilter(f => ({ ...f, so_lenh: e.target.value }))}
                        />
                      </Col>
                      <Col span={6}>
                        <DatePicker.RangePicker
                          format="DD/MM/YYYY"
                          style={{ width: '100%' }}
                          onChange={dates => setDOFilter(f => ({
                            ...f,
                            tu_ngay: dates?.[0]?.format('YYYY-MM-DD'),
                            den_ngay: dates?.[1]?.format('YYYY-MM-DD'),
                          }))}
                        />
                      </Col>
                      <Col>
                        <Button onClick={() => setDOFilter({ ten_khach: '', nv_theo_doi_id: undefined, so_lenh: '', so_don: '', tu_ngay: undefined, den_ngay: undefined })}>
                          Xoá lọc
                        </Button>
                      </Col>
                      <Col>
                        <Button icon={<FileExcelOutlined />} onClick={handleExportDO}>
                          Xuất Excel
                        </Button>
                      </Col>
                    </Row>
                    <Table<DeliveryOrder>
                      rowKey="id"
                      size="small"
                      loading={loadingDO}
                      dataSource={deliveryList}
                      columns={doCols}
                      pagination={{ pageSize: 30, showSizeChanger: false }}
                      scroll={{ x: 1050 }}
                      expandable={{
                        expandedRowRender: (row: DeliveryOrder) => (
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={row.items}
                            pagination={false}
                            columns={[
                              { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130 },
                              { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                              { title: 'SL', dataIndex: 'so_luong', width: 80, render: (v: number) => fmtN(v) },
                              { title: 'DVT', dataIndex: 'dvt', width: 60 },
                              { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, render: (v: number) => fmtMoney(v) },
                              { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, render: (v: number) => fmtMoney(v) },
                              { title: 'm²', dataIndex: 'dien_tich', width: 80, render: (v: number) => fmtN(v) },
                              { title: 'kg', dataIndex: 'trong_luong', width: 80, render: (v: number) => fmtN(v) },
                              { title: 'm³', dataIndex: 'the_tich', width: 80, render: (v: number) => fmtN(v) },
                            ]}
                          />
                        ),
                      }}
                    />
                    </Card>
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      </Card>

      {/* Modal tạo yêu cầu giao hàng */}
      <Modal
        title="Tạo yêu cầu giao hàng"
        open={showYCModal}
        onCancel={() => setShowYCModal(false)}
        onOk={handleSaveYC}
        okText="Tạo yêu cầu"
        confirmLoading={createYCMutation.isPending}
        width={900}
      >
        <Form form={ycForm} layout="vertical" style={{ marginBottom: 12 }}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="ngay_yeu_cau" label="Ngày yêu cầu" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ngay_giao_yeu_cau" label="Ngày giao yêu cầu">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nguoi_nhan" label="Người nhận">
                <Input placeholder="Tên người nhận hàng" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dia_chi_giao" label="Địa chỉ giao">
                <Input placeholder="Địa chỉ giao hàng" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Table
          size="small"
          rowKey="production_order_id"
          dataSource={ycItems}
          pagination={false}
          columns={[
            { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 120 },
            { title: 'Tên hàng', dataIndex: 'ten_hang', width: 160, ellipsis: true },
            {
              title: 'Kho xuất', width: 160,
              render: (_: unknown, row: typeof ycItems[0], idx: number) => (
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={row.warehouse_id}
                  placeholder="Chọn kho"
                  onChange={v => setYCItems(prev => prev.map((it, i) => i === idx ? { ...it, warehouse_id: v } : it))}
                  options={warehouses
                    .filter((w: Warehouse) => !row.phan_xuong_id || w.phan_xuong_id === row.phan_xuong_id)
                    .map((w: Warehouse) => ({ label: w.ten_kho, value: w.id }))}
                  showSearch
                  optionFilterProp="label"
                />
              ),
            },
            {
              title: 'SL giao', width: 90,
              render: (_: unknown, row: typeof ycItems[0], idx: number) => (
                <InputNumber
                  size="small"
                  min={0}
                  value={row.so_luong}
                  style={{ width: 80 }}
                  onChange={v => setYCItems(prev => prev.map((it, i) => i === idx ? { ...it, so_luong: v ?? it.so_luong } : it))}
                />
              ),
            },
            {
              title: 'm²', width: 80,
              render: (_: unknown, row: typeof ycItems[0], idx: number) => (
                <InputNumber
                  size="small"
                  min={0}
                  value={row.dien_tich}
                  placeholder="auto"
                  style={{ width: 72 }}
                  onChange={v => setYCItems(prev => prev.map((it, i) => i === idx ? { ...it, dien_tich: v } : it))}
                />
              ),
            },
            {
              title: 'kg', width: 80,
              render: (_: unknown, row: typeof ycItems[0], idx: number) => (
                <InputNumber
                  size="small"
                  min={0}
                  value={row.trong_luong}
                  style={{ width: 72 }}
                  onChange={v => setYCItems(prev => prev.map((it, i) => i === idx ? { ...it, trong_luong: v } : it))}
                />
              ),
            },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}><Text strong>Tổng</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4}><Text strong>{fmtN(ycItems.reduce((s, it) => s + (it.dien_tich ?? 0), 0))}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={5}><Text strong>{fmtN(ycItems.reduce((s, it) => s + (it.trong_luong ?? 0), 0))}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>

      {/* Modal tạo phiếu bán hàng */}
      <Modal
        title={`Tạo phiếu bán hàng${selectedYC ? ` — ${selectedYC.so_yeu_cau}` : ' từ kho thành phẩm'}`}
        open={showDOModal}
        onCancel={() => { setShowDOModal(false); setSelectedYC(null); setDirectCustomerId(null); setDirectSalesOrderId(null) }}
        onOk={handleSaveDO}
        okText="Tạo phiếu"
        confirmLoading={createDOMutation.isPending}
        width={1000}
      >
        <Form form={doForm} layout="vertical" style={{ marginBottom: 12 }}>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="ngay_xuat" label="Ngày xuất" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="warehouse_id" label="Kho xuất" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho" showSearch optionFilterProp="label"
                  options={warehouses.map((w: Warehouse) => ({ label: `${w.ten_kho} (${w.loai_kho})`, value: w.id }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="xe_id" label="Xe">
                <Select placeholder="Chọn xe" allowClear showSearch optionFilterProp="label"
                  options={xeList.filter((x: Xe) => x.trang_thai).map((x: Xe) => ({
                    label: `${x.bien_so}${x.loai_xe ? ` (${x.loai_xe})` : ''}${x.trong_tai ? ` — ${x.trong_tai}T` : ''}`,
                    value: x.id,
                  }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tai_xe_id" label="Tài xế">
                <Select placeholder="Chọn tài xế" allowClear showSearch optionFilterProp="label"
                  options={taiXeList.filter((t: TaiXe) => t.trang_thai).map((t: TaiXe) => ({ label: t.ho_ten, value: t.id }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lo_xe" label="Lơ xe">
                <Input placeholder="Tên lơ xe" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="don_gia_vc_id" label="Tuyến vận chuyển">
                <Select placeholder="Chọn tuyến" allowClear showSearch optionFilterProp="label"
                  options={donGiaList.filter((d: DonGiaVanChuyen) => d.trang_thai).map((d: DonGiaVanChuyen) => ({
                    label: `${d.ten_tuyen} — ${fmtMoney(d.don_gia)}đ`,
                    value: d.id,
                  }))}
                  onChange={v => {
                    const dg = donGiaList.find((d: DonGiaVanChuyen) => d.id === v)
                    if (dg) doForm.setFieldValue('tien_van_chuyen', dg.don_gia)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tien_van_chuyen" label="Tiền vận chuyển (đ)">
                <InputNumber style={{ width: '100%' }} min={0} formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Table
          size="small"
          rowKey="production_order_id"
          dataSource={doItems}
          pagination={false}
          columns={[
            { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 120 },
            { title: 'Tên hàng', dataIndex: 'ten_hang', width: 150, ellipsis: true },
            {
              title: 'SL',
              dataIndex: 'so_luong',
              width: 90,
              render: (_: number, row: typeof doItems[0], idx: number) => (
                <InputNumber
                  size="small"
                  min={0.001}
                  max={row.ton_kho}
                  value={row.so_luong}
                  style={{ width: 82 }}
                  onChange={v => setDOItems(prev => prev.map((it, i) => {
                    if (i !== idx) return it
                    const soLuong = v ?? it.so_luong
                    const ratio = it.so_luong > 0 ? soLuong / it.so_luong : 1
                    return {
                      ...it,
                      so_luong: soLuong,
                      dien_tich: it.dien_tich * ratio,
                      trong_luong: it.trong_luong * ratio,
                      the_tich: it.the_tich * ratio,
                      thanh_tien: soLuong * it.don_gia,
                    }
                  }))}
                />
              ),
            },
            { title: 'DVT', dataIndex: 'dvt', width: 55 },
            {
              title: 'Đơn giá', width: 110,
              render: (_: unknown, row: typeof doItems[0], idx: number) => (
                <InputNumber
                  size="small"
                  min={0}
                  value={row.don_gia}
                  style={{ width: 100 }}
                  formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  onChange={v => setDOItems(prev => prev.map((it, i) => {
                    if (i !== idx) return it
                    const dg = v ?? 0
                    return { ...it, don_gia: dg, thanh_tien: dg * it.so_luong }
                  }))}
                />
              ),
            },
            { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 110, render: (v: number) => fmtMoney(v) },
            {
              title: 'm²', width: 80,
              render: (_: unknown, row: typeof doItems[0], idx: number) => (
                <InputNumber size="small" min={0} value={row.dien_tich} style={{ width: 72 }}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, dien_tich: v ?? 0 } : it))} />
              ),
            },
            {
              title: 'kg', width: 80,
              render: (_: unknown, row: typeof doItems[0], idx: number) => (
                <InputNumber size="small" min={0} value={row.trong_luong} style={{ width: 72 }}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, trong_luong: v ?? 0 } : it))} />
              ),
            },
            {
              title: 'm³', width: 80,
              render: (_: unknown, row: typeof doItems[0], idx: number) => (
                <InputNumber size="small" min={0} value={row.the_tich} style={{ width: 72 }}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, the_tich: v ?? 0 } : it))} />
              ),
            },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={5}><Text strong>Tổng tiền hàng</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={5}><Text strong style={{ color: '#1677ff' }}>{fmtMoney(tongTienHang)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={6}><Text strong>{fmtN(doItems.reduce((s, it) => s + it.dien_tich, 0))}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={7}><Text strong>{fmtN(doItems.reduce((s, it) => s + it.trong_luong, 0))}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={8}><Text strong>{fmtN(doItems.reduce((s, it) => s + it.the_tich, 0))}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>
    </div>
  )
}

