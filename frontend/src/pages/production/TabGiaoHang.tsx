import React, { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  message, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Typography, Tag
} from 'antd'
import { DeleteOutlined, FileTextOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import { theoDoiApi, STAGE_COLORS } from '../../api/theoDoi'
import { yeuCauApi, deliveriesApi, YEU_CAU_TRANG_THAI_LABELS, YEU_CAU_TRANG_THAI_COLORS, CONG_NO_LABELS, CONG_NO_COLORS } from '../../api/deliveries'
import type { YeuCauGiaoHang, DeliveryOrder } from '../../api/deliveries'
import { xeApi, taiXeApi, donGiaVanChuyenApi } from '../../api/simpleApis'
import type { Xe, TaiXe, DonGiaVanChuyen } from '../../api/simpleApis'
import { warehouseApi } from '../../api/warehouse'
import type { TonKho, TonKhoTPRow, TonKhoPhoiLsxRow } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import type { Warehouse } from '../../api/warehouses'
import { customersApi } from '../../api/customers'
import { billingApi } from '../../api/billing'

const { Text } = Typography

const DO_TRANG_THAI_LABELS: Record<string, string> = {
  nhap: 'Nháp',
  da_xuat: 'Đã xuất',
  da_giao: 'Đã giao',
  huy: 'Huỷ',
}
const DO_TRANG_THAI_COLORS: Record<string, string> = {
  nhap: 'default',
  da_xuat: 'blue',
  da_giao: 'green',
  huy: 'red',
}

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'

const fmtMoney = (v: number) =>
  v ? new Intl.NumberFormat('vi-VN').format(v) : '0'

export default function TabGiaoHang(_props?: { initialSelectedPOKeys?: number[] }) {
  const qc = useQueryClient()

  // ── Master data ────────────────────────────────────────────────────────────
  const { data: allWarehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehousesApi.list().then(r => r.data) })
  const { data: xeList = [] } = useQuery({ queryKey: ['xe'], queryFn: () => xeApi.list().then(r => r.data) })
  const { data: taiXeList = [] } = useQuery({ queryKey: ['tai-xe'], queryFn: () => taiXeApi.list().then(r => r.data) })
  const { data: donGiaList = [] } = useQuery({ queryKey: ['don-gia-van-chuyen'], queryFn: () => donGiaVanChuyenApi.list().then(r => r.data) })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-all'], queryFn: () => customersApi.all().then(r => r.data) })

  const pickableWarehouses = allWarehouses.filter(w => ['PHOI', 'THANH_PHAM', 'KHO_KHAC'].includes(w.loai_kho))

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('ton-kho-tp')

  // ── 1. Tồn kho Thành phẩm (Thùng) ──────────────────────────────────────────
  const [tpFilter, setTPFilter] = useState({ ten_khach: '', so_lenh: '' })
  const { data: tonKhoTP = [], isLoading: loadingTP } = useQuery({
    queryKey: ['warehouse-ton-kho-tp', tpFilter],
    queryFn: () => warehouseApi.getTonKhoTpLsx(tpFilter).then(r => r.data),
  })
  const [selectedTPKeys, setSelectedTPKeys] = useState<React.Key[]>([])

  // ── 2. Tồn kho Phôi (Giấy tấm) ──────────────────────────────────────────────
  const [phoiFilter, setPhoiFilter] = useState({ search: '' })
  const { data: tonKhoPhoi = [], isLoading: loadingPhoi } = useQuery({
    queryKey: ['warehouse-ton-kho-phoi-lsx', phoiFilter],
    queryFn: () => warehouseApi.getTonKhoPhoiLsx(phoiFilter).then(r => r.data),
  })
  const [selectedPhoiKeys, setSelectedPhoiKeys] = useState<React.Key[]>([])

  // ── 3. Yêu cầu giao hàng ───────────────────────────────────────────────────
  const { data: yeuCauList = [], isLoading: loadingYC } = useQuery({
    queryKey: ['yeu-cau-giao-hang'],
    queryFn: () => yeuCauApi.list({ trang_thai: 'moi' }).then(r => r.data),
  })

  // ── 4. Lịch sử Phiếu BH ───────────────────────────────────────────────────
  const [doFilter, setDOFilter] = useState({ tu_ngay: dayjs().subtract(7, 'day').format('YYYY-MM-DD'), den_ngay: dayjs().format('YYYY-MM-DD') })
  const [doStatusFilter, setDoStatusFilter] = useState<string | null>(null)
  const { data: deliveryList = [], isLoading: loadingDO } = useQuery({
    queryKey: ['deliveries', doFilter],
    queryFn: () => deliveriesApi.list(doFilter).then(r => r.data),
  })
  const filteredDeliveryList = doStatusFilter
    ? deliveryList.filter(d => d.trang_thai === doStatusFilter)
    : deliveryList

  // ── Modals logic ──────────────────────────────────────────────────────────
  const [showDOModal, setShowDOModal] = useState(false)
  const [isRequest, setIsRequest] = useState(false)
  const [selectedYC, setSelectedYC] = useState<YeuCauGiaoHang | null>(null)
  const [doForm] = Form.useForm()
  const [doItems, setDOItems] = useState<any[]>([])

  const openDOModalFromTP = () => {
    const selectedRows = tonKhoTP.filter(r => selectedTPKeys.includes(r.production_order_id))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }
    
    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      product_id: r.product_id,
      sales_order_item_id: r.sales_order_item_id,
      so_lenh: r.so_lenh,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: r.dvt || 'Thùng',
      don_gia: r.don_gia || 0,
      thanh_tien: r.ton_kho * (r.don_gia || 0),
      dien_tich: r.dien_tich || 0,
      trong_luong: r.trong_luong || 0,
      ghi_chu: '',
    })))
    
    doForm.resetFields()
    doForm.setFieldsValue({ 
      ngay_xuat: dayjs(),
      customer_id: selectedRows[0].customer_id,
      dia_chi_giao: selectedRows[0].dia_chi_giao,
      warehouse_id: selectedRows[0].warehouse_id
    })
    setIsRequest(false)
    setShowDOModal(true)
  }

  const openYCModalFromTP = () => {
    const selectedRows = tonKhoTP.filter(r => selectedTPKeys.includes(r.production_order_id))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }
    
    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      product_id: r.product_id,
      sales_order_item_id: r.sales_order_item_id,
      so_lenh: r.so_lenh,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: r.dvt || 'Thùng',
      dien_tich: r.dien_tich || 0,
      trong_luong: r.trong_luong || 0,
    })))
    
    doForm.resetFields()
    doForm.setFieldsValue({ 
      ngay_xuat: dayjs(),
      customer_id: selectedRows[0].customer_id,
      dia_chi_giao: selectedRows[0].dia_chi_giao,
      warehouse_id: selectedRows[0].warehouse_id
    })
    setIsRequest(true)
    setShowDOModal(true)
  }

  const openDOModalFromPhoi = () => {
    const selectedRows = tonKhoPhoi.filter(r => selectedPhoiKeys.includes(`${r.production_order_id}-${r.warehouse_id}`))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }
    
    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: 'Tấm',
      don_gia: 0,
      thanh_tien: 0,
      dien_tich: 0,
      trong_luong: 0,
      ghi_chu: '',
    })))
    
    const r0 = selectedRows[0]
    doForm.resetFields()
    doForm.setFieldsValue({ 
      ngay_xuat: dayjs(), 
      customer_id: customers.find(c => c.ten_viet_tat === r0.ten_khach_hang)?.id,
      warehouse_id: r0.warehouse_id
    })
    setIsRequest(false)
    setShowDOModal(true)
  }

  const openYCModalFromPhoi = () => {
    const selectedRows = tonKhoPhoi.filter(r => selectedPhoiKeys.includes(`${r.production_order_id}-${r.warehouse_id}`))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }

    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: 'Tấm',
      dien_tich: 0,
      trong_luong: 0,
    })))

    const r0 = selectedRows[0]
    doForm.resetFields()
    doForm.setFieldsValue({
      ngay_xuat: dayjs(),
      customer_id: customers.find(c => c.ten_viet_tat === r0.ten_khach_hang)?.id,
      warehouse_id: r0.warehouse_id 
    })
    setIsRequest(true)
    setShowDOModal(true)
  }

  const openDOModalFromYC = (yc: YeuCauGiaoHang) => {
    setSelectedYC(yc)
    setDOItems(yc.items.map(it => ({
      production_order_id: it.production_order_id,
      ten_hang: it.ten_hang,
      so_luong: it.so_luong,
      dvt: it.dvt,
      don_gia: 0,
      thanh_tien: 0,
      dien_tich: it.dien_tich,
      trong_luong: it.trong_luong,
      ghi_chu: '',
    })))
    doForm.resetFields()
    doForm.setFieldsValue({ 
      ngay_xuat: dayjs(),
      customer_id: yc.customer_id,
      dia_chi_giao: yc.dia_chi_giao,
      nguoi_nhan: yc.nguoi_nhan,
      warehouse_id: yc.items[0]?.warehouse_id
    })
    setIsRequest(false)
    setShowDOModal(true)
  }

  const createYCMutation = useMutation({
    mutationFn: (payload: any) => yeuCauApi.create(payload).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo yêu cầu giao hàng thành công')
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
      setShowDOModal(false)
      setSelectedTPKeys([])
      setSelectedPhoiKeys([])
      setActiveTab('yeu-cau')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo yêu cầu'),
  })

  const createDOMutation = useMutation({
    mutationFn: (payload: any) => deliveriesApi.create(payload).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo phiếu bán hàng thành công')
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
      qc.invalidateQueries({ queryKey: ['warehouse-ton-kho-tp'] })
      qc.invalidateQueries({ queryKey: ['warehouse-ton-kho-phoi'] })
      setShowDOModal(false)
      setSelectedYC(null)
      setSelectedTPKeys([])
      setSelectedPhoiKeys([])
      setActiveTab('phieu-ban-hang')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, trang_thai }: { id: number; trang_thai: string }) =>
      deliveriesApi.updateStatus(id, trang_thai),
    onSuccess: () => {
      message.success('Đổi trạng thái thành công')
      qc.invalidateQueries({ queryKey: ['deliveries'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi đổi trạng thái'),
  })

  const createInvoiceMutation = useMutation({
    mutationFn: (deliveryId: number) => billingApi.createFromDelivery(deliveryId),
    onSuccess: () => {
      message.success('Tạo hóa đơn thành công')
      qc.invalidateQueries({ queryKey: ['deliveries'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo hóa đơn'),
  })

  const handlePrint = (order: DeliveryOrder) => {
    const fmtD = (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : ''
    const fmtM = (v: number) => new Intl.NumberFormat('vi-VN').format(v)
    const rows = order.items.map(it => `
      <tr>
        <td style="border:1px solid #ccc;padding:4px;text-align:center">${it.so_lenh || '—'}</td>
        <td style="border:1px solid #ccc;padding:4px">${it.ten_hang}</td>
        <td style="border:1px solid #ccc;padding:4px;text-align:right">${fmtM(it.so_luong)}</td>
        <td style="border:1px solid #ccc;padding:4px;text-align:center">${it.dvt}</td>
        <td style="border:1px solid #ccc;padding:4px;text-align:right">${it.don_gia ? fmtM(it.don_gia) : '—'}</td>
        <td style="border:1px solid #ccc;padding:4px;text-align:right">${it.thanh_tien ? fmtM(it.thanh_tien) : '—'}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Phiếu bán hàng ${order.so_phieu}</title>
      <style>
        body{font-family:'Times New Roman',serif;font-size:11pt;margin:15mm 12mm}
        h2{text-align:center;font-size:15pt;letter-spacing:2px;margin:8px 0}
        .info{line-height:1.9;font-size:10.5pt}
        .label{font-weight:bold;min-width:120px;display:inline-block}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#E65100;color:#fff;border:1px solid #ccc;padding:5px;font-size:10pt}
        .total td{font-weight:bold;background:#FFF3E0;border:1px solid #ccc;padding:5px}
        .sig{width:100%;margin-top:40px;text-align:center}
        .sig td{width:33%;vertical-align:top;font-size:9.5pt}
        @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()" style="margin-bottom:12px;padding:6px 16px;cursor:pointer">🖨️ In phiếu</button>
      <h2>PHIẾU BÁN HÀNG</h2>
      <div style="text-align:center;font-size:9pt;margin-bottom:8px">Số: <b>${order.so_phieu}</b> — Ngày ${fmtD(order.ngay_xuat)}</div>
      <div class="info">
        <div><span class="label">Khách hàng:</span>${order.ten_khach || ''}</div>
        <div><span class="label">Địa chỉ giao:</span>${order.dia_chi_giao || ''}</div>
        <div><span class="label">Người nhận:</span>${order.nguoi_nhan || ''}</div>
        <div><span class="label">Kho xuất:</span>${order.ten_kho || ''}</div>
        ${order.bien_so ? `<div><span class="label">Xe vận chuyển:</span>${order.bien_so}${order.ten_tai_xe ? ' — ' + order.ten_tai_xe : ''}</div>` : ''}
      </div>
      <table>
        <thead><tr>
          <th>Lệnh SX</th><th>Tên hàng</th><th>Số lượng</th><th>ĐVT</th><th>Đơn giá</th><th>Thành tiền</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total">
          <td colspan="5" style="text-align:right;border:1px solid #ccc;padding:5px">Tổng cộng:</td>
          <td style="text-align:right;border:1px solid #ccc;padding:5px">${fmtM(order.tong_thanh_toan)}đ</td>
        </tr></tfoot>
      </table>
      <table class="sig"><tr>
        <td><div style="font-weight:bold">Người nhận hàng</div><div style="font-style:italic;font-size:8.5pt">(Ký, họ tên)</div></td>
        <td><div style="font-weight:bold">Thủ kho</div><div style="font-style:italic;font-size:8.5pt">(Ký, họ tên)</div></td>
        <td><div style="font-weight:bold">Người lập phiếu</div><div style="font-style:italic;font-size:8.5pt">(Ký, họ tên)</div></td>
      </tr></table>
      </body></html>`
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) { message.warning('Trình duyệt chặn popup — vui lòng cho phép popup để in'); return }
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  const handleSaveModal = async () => {
    const vals = await doForm.validateFields()
    if (isRequest) {
      createYCMutation.mutate({
        ngay_yeu_cau: vals.ngay_xuat.format('YYYY-MM-DD'),
        customer_id: vals.customer_id,
        dia_chi_giao: vals.dia_chi_giao,
        nguoi_nhan: vals.nguoi_nhan,
        ghi_chu: vals.ghi_chu,
        items: doItems.map(it => ({
          production_order_id: it.production_order_id,
          warehouse_id: vals.warehouse_id,
          so_luong: it.so_luong,
          dvt: it.dvt,
          dien_tich: it.dien_tich,
          trong_luong: it.trong_luong,
          ghi_chu: it.ghi_chu,
        })),
      })
    } else {
      createDOMutation.mutate({
        ...vals,
        ngay_xuat: vals.ngay_xuat.format('YYYY-MM-DD'),
        yeu_cau_id: selectedYC?.id,
        items: doItems.map(it => ({
          ...it,
          production_order_id: it.production_order_id || undefined,
          product_id: it.product_id || undefined,
          paper_material_id: it.paper_material_id || undefined,
          don_gia: it.don_gia || undefined,
        })),
      })
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────
  const tpCols: ColumnsType<TonKhoTPRow> = [
    { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 120, render: v => <Text code>{v}</Text> },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 150 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'Tồn kho', dataIndex: 'ton_kho', align: 'right', width: 100, render: v => <Text strong style={{ color: '#1677ff' }}>{fmtN(v)}</Text> },
    { title: 'ĐVT', dataIndex: 'dvt', width: 80 },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 120 },
  ]

  const phoiCols: ColumnsType<TonKhoPhoiLsxRow> = [
    { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 120, render: v => <Text code>{v}</Text> },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 150 },
    { title: 'Tên hàng', dataIndex: 'ten_hang' },
    { title: 'Kho', dataIndex: 'ten_kho', width: 150 },
    { title: 'Tồn kho', dataIndex: 'ton_kho', align: 'right', width: 120, render: v => <Text strong style={{ color: '#fa8c16' }}>{fmtN(v)}</Text> },
    { title: 'Khổ/Cắt', render: (_, r) => r.chieu_kho ? `${r.chieu_kho}x${r.chieu_cat}` : '—', width: 100 },
  ]

  const ycCols: ColumnsType<YeuCauGiaoHang> = [
    { title: 'Số YC', dataIndex: 'so_yeu_cau', width: 160 },
    { title: 'Ngày YC', dataIndex: 'ngay_yeu_cau', width: 100, render: fmtDate },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 140,
      render: (v: string) => <Tag color={YEU_CAU_TRANG_THAI_COLORS[v]}>{YEU_CAU_TRANG_THAI_LABELS[v] || v}</Tag> },
    { title: '', width: 90,
      render: (_: unknown, r: YeuCauGiaoHang) => (
        <Button size="small" type="primary" onClick={() => openDOModalFromYC(r)}>Lập phiếu</Button>
      ) },
  ]

  const DO_NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
    nhap:    [{ value: 'da_xuat', label: 'Đánh dấu Đã xuất' }, { value: 'huy', label: 'Huỷ phiếu' }],
    da_xuat: [{ value: 'da_giao', label: 'Đánh dấu Đã giao' }, { value: 'nhap', label: 'Quay về Nháp' }],
    da_giao: [{ value: 'huy', label: 'Huỷ phiếu' }],
    huy:     [],
  }

  const doCols: ColumnsType<DeliveryOrder> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 150, render: v => <Text code>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay_xuat', width: 95, render: fmtDate },
    { title: 'Khách hàng', dataIndex: 'ten_khach', ellipsis: true },
    { title: 'Tuyến', dataIndex: 'ten_tuyen', width: 110 },
    { title: 'Tổng TT', dataIndex: 'tong_thanh_toan', width: 120, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtMoney(v)}đ</Text> },
    { title: 'Công nợ', dataIndex: 'trang_thai_cong_no', width: 120,
      render: (v: string) => <Tag color={CONG_NO_COLORS[v]}>{CONG_NO_LABELS[v] || v}</Tag> },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: (v: string) => <Tag color={DO_TRANG_THAI_COLORS[v]}>{DO_TRANG_THAI_LABELS[v] || v}</Tag> },
    {
      title: 'Thao tác', width: 200, fixed: 'right' as const,
      render: (_: unknown, row: DeliveryOrder) => {
        const nextOpts = DO_NEXT_STATUS[row.trang_thai] ?? []
        return (
          <Space size={4}>
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(row)} />
            {nextOpts.length > 0 && (
              <Select
                size="small"
                placeholder="Đổi TT"
                style={{ width: 120 }}
                options={nextOpts}
                loading={updateStatusMutation.isPending}
                onChange={(v: string) => updateStatusMutation.mutate({ id: row.id, trang_thai: v })}
                value={null}
              />
            )}
            {row.trang_thai === 'da_xuat' && (
              <Button
                size="small"
                type="primary"
                ghost
                loading={createInvoiceMutation.isPending}
                onClick={() => createInvoiceMutation.mutate(row.id)}
              >
                HĐ
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'ton-kho-tp',
            label: <span>📦 1. Tồn kho Thành phẩm (Thùng)</span>,
            children: (
              <Card size="small">
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={6}><Input placeholder="Tìm số lệnh..." allowClear value={tpFilter.so_lenh} onChange={e => setTPFilter(f => ({ ...f, so_lenh: e.target.value }))} /></Col>
                  <Col span={6}><Input placeholder="Tên khách hàng..." allowClear value={tpFilter.ten_khach} onChange={e => setTPFilter(f => ({ ...f, ten_khach: e.target.value }))} /></Col>
                  <Col flex="auto" />
                  <Col>
                    <Space>
                      <Button icon={<FileTextOutlined />} disabled={!selectedTPKeys.length} onClick={openYCModalFromTP}>Tạo YC giao hàng ({selectedTPKeys.length})</Button>
                      <Button type="primary" icon={<FileTextOutlined />} disabled={!selectedTPKeys.length} onClick={openDOModalFromTP}>Lập phiếu BH trực tiếp ({selectedTPKeys.length})</Button>
                    </Space>
                  </Col>
                </Row>
                <Table
                  size="small"
                  rowKey="production_order_id"
                  loading={loadingTP}
                  dataSource={tonKhoTP}
                  columns={tpCols}
                  rowSelection={{ selectedRowKeys: selectedTPKeys, onChange: setSelectedTPKeys }}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            )
          },
          {
            key: 'ton-kho-phoi',
            label: <span>📑 2. Tồn kho Phôi (Giấy tấm)</span>,
            children: (
              <Card size="small">
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={6}>
                    <Select
                      placeholder="Lọc theo kho"
                      style={{ width: '100%' }}
                      allowClear
                      onChange={v => setPhoiFilter(f => ({ ...f, warehouse_id: v }))}
                      options={pickableWarehouses.filter(w => w.loai_kho === 'PHOI').map(w => ({ value: w.id, label: w.ten_kho }))}
                    />
                  </Col>
                  <Col span={6}><Input.Search placeholder="Tìm tên hàng..." onSearch={v => setPhoiFilter(f => ({ ...f, search: v }))} allowClear /></Col>
                  <Col flex="auto" />
                  <Col>
                    <Space>
                      <Button icon={<FileTextOutlined />} disabled={!selectedPhoiKeys.length} onClick={openYCModalFromPhoi}>Tạo YC giao hàng ({selectedPhoiKeys.length})</Button>
                      <Button type="primary" icon={<FileTextOutlined />} disabled={!selectedPhoiKeys.length} onClick={openDOModalFromPhoi}>Lập phiếu BH trực tiếp ({selectedPhoiKeys.length})</Button>
                    </Space>
                  </Col>
                </Row>
                <Table
                  size="small"
                  rowKey={r => `${r.production_order_id}-${r.warehouse_id}`}
                  loading={loadingPhoi}
                  dataSource={tonKhoPhoi}
                  columns={phoiCols}
                  rowSelection={{ selectedRowKeys: selectedPhoiKeys, onChange: setSelectedPhoiKeys }}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            )
          },
          {
            key: 'yeu-cau',
            label: <span>🚚 3. Yêu cầu giao hàng (Mới)</span>,
            children: (
              <Card size="small">
                <Table 
                  size="small" rowKey="id" loading={loadingYC} dataSource={yeuCauList} columns={ycCols} 
                  expandable={{
                    expandedRowRender: (row: YeuCauGiaoHang) => (
                      <Table size="small" rowKey="id" dataSource={row.items} pagination={false}
                        columns={[
                          { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130, render: v => v || 'Từ kho' },
                          { title: 'Tên hàng', dataIndex: 'ten_hang' },
                          { title: 'SL', dataIndex: 'so_luong', width: 80, render: v => fmtN(v) },
                        ]}
                      />
                    ),
                  }}
                />
              </Card>
            )
          },
          {
            key: 'phieu-ban-hang',
            label: <span>📜 4. Lịch sử Phiếu BH</span>,
            children: (
              <Card size="small">
                <Row gutter={8} style={{ marginBottom: 12 }} align="middle">
                  <Col>
                    <DatePicker.RangePicker
                      format="DD/MM/YYYY"
                      defaultValue={[dayjs().subtract(7, 'day'), dayjs()]}
                      onChange={dates => setDOFilter({ tu_ngay: dates?.[0]?.format('YYYY-MM-DD') || '', den_ngay: dates?.[1]?.format('YYYY-MM-DD') || '' })}
                    />
                  </Col>
                  <Col>
                    <Select
                      placeholder="Tất cả trạng thái"
                      allowClear
                      style={{ width: 160 }}
                      onChange={(v: string | null) => setDoStatusFilter(v ?? null)}
                      options={Object.entries(DO_TRANG_THAI_LABELS).map(([k, label]) => ({ value: k, label }))}
                    />
                  </Col>
                  <Col flex="auto" />
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {filteredDeliveryList.length} phiếu
                    </Text>
                  </Col>
                </Row>
                <Table
                  size="small"
                  rowKey="id"
                  loading={loadingDO}
                  dataSource={filteredDeliveryList}
                  columns={doCols}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1100 }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* ── Modal DO/YC ── */}
      <Modal title={isRequest ? "Tạo yêu cầu giao hàng" : "Lập phiếu bán hàng"} open={showDOModal} onCancel={() => setShowDOModal(false)} onOk={handleSaveModal} width={1100}>
        <Form form={doForm} layout="vertical">
          <Row gutter={12}>
            <Col span={6}><Form.Item name="ngay_xuat" label={isRequest ? "Ngày yêu cầu" : "Ngày xuất"} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}>
              <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
                <Select placeholder="Chọn khách hàng" showSearch optionFilterProp="label" options={customers.map(c => ({ label: c.ten_viet_tat, value: c.id }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="warehouse_id" label="Kho xuất" rules={[{ required: true }]}>
                <Select placeholder="Chọn kho" options={allWarehouses.map(w => ({ label: w.ten_kho, value: w.id }))} />
              </Form.Item>
            </Col>
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="xe_id" label="Xe">
                  <Select placeholder="Chọn xe" allowClear options={xeList.map(x => ({ label: x.bien_so, value: x.id }))} />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
        <Table
          size="small"
          rowKey={(_, idx) => idx ?? 0}
          dataSource={doItems}
          pagination={false}
          columns={[
            { title: 'Nguồn', dataIndex: 'so_lenh', width: 120, render: (v: any) => v || 'Từ kho' },
            { title: 'Tên hàng', dataIndex: 'ten_hang' },
            {
              title: 'Số lượng', width: 120,
              render: (_: any, row: any, idx: number) => (
                <InputNumber
                  size="small" style={{ width: '100%' }} value={row.so_luong}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, so_luong: v || 0, thanh_tien: (v || 0) * (it.don_gia || 0) } : it))}
                />
              )
            },
            !isRequest && {
              title: 'Đơn giá', width: 140,
              render: (_: any, row: any, idx: number) => (
                <InputNumber
                  size="small" style={{ width: '100%' }} value={row.don_gia}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, don_gia: v || 0, thanh_tien: (v || 0) * (it.so_luong || 0) } : it))}
                />
              )
            },
            !isRequest && { title: 'Thành tiền', width: 140, render: (_: any, row: any) => fmtMoney(row.thanh_tien), align: 'right' },
          ].filter(Boolean) as any}
          summary={() => !isRequest ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Text strong type="danger">{fmtMoney(doItems.reduce((s, it) => s + (it.thanh_tien || 0), 0))}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
      </Modal>
    </Space>
  )
}
