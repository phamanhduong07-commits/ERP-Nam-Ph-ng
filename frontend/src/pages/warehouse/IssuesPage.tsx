import { useState, useEffect } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Radio, Row, Segmented, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message, Divider,
} from 'antd'
import {
  FileExcelOutlined, PrinterOutlined, PlusOutlined, DeleteOutlined,
  ExportOutlined, MinusCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  warehouseApi, CreateMaterialIssuePayload, MaterialIssue, MaterialIssueItem, TonKhoNVLRow, PhanXuong,
} from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { productionOrdersApi } from '../../api/productionOrders'
import { productionPlansApi } from '../../api/productionPlans'
import {
  buildHtmlTable, smartExportExcel, smartPrintPdf, resolveSinglePhapNhanId, downloadBlob,
} from '../../utils/exportUtils'
import { usePermission } from '../../hooks/usePermission'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

const fmtVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v)

const DVT_OPTIONS = ['Kg', 'Tấn', 'Cuộn', 'Tờ', 'Cái', 'Bộ', 'Hộp', 'Lít', 'Lần', 'Gói', 'm', 'm²'].map(v => ({ value: v, label: v }))

const FILTER_KEY = 'WAREHOUSE_ISSUES_FILTERS'

// ── Tab 1: Danh sách phiếu xuất NVL ─────────────────────────────────────────

function TabDanhSachXuatNVL() {
  const { hasPermission, canApprove } = usePermission()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem(FILTER_KEY)
    if (!saved) return
    try {
      const f = JSON.parse(saved)
      if (typeof f.filterPhapNhan === 'number') setFilterPhapNhan(f.filterPhapNhan)
      if (typeof f.filterXuong === 'number') setFilterXuong(f.filterXuong)
      if (typeof f.filterKho === 'number') setFilterKho(f.filterKho)
      if (typeof f.filterTrangThai === 'string') setFilterTrangThai(f.filterTrangThai)
      if (typeof f.tuNgay === 'string') setTuNgay(f.tuNgay)
      if (typeof f.denNgay === 'string') setDenNgay(f.denNgay)
    } catch { /* ignore corrupt filter cache */ }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ filterPhapNhan, filterXuong, filterKho, filterTrangThai, tuNgay, denNgay }))
  }, [filterPhapNhan, filterXuong, filterKho, filterTrangThai, tuNgay, denNgay])
  const [formPxId, setFormPxId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectMode, setSelectMode] = useState<'lsx' | 'khsx'>('lsx')
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([])
  const [planLsxList, setPlanLsxList] = useState<{ id: number; so_lenh: string }[]>([])
  const [loadingPlanLsx, setLoadingPlanLsx] = useState(false)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats = paperPage?.items ?? []

  const { data: otherPage } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const otherMats = otherPage?.items ?? []

  const { data: lsxPaged } = useQuery({
    queryKey: ['production-orders-list'],
    queryFn: () => productionOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const lsxList = lsxPaged?.items ?? []

  const { data: khsxPage, isLoading: loadingKhsx } = useQuery({
    queryKey: ['production-plans-for-issue'],
    queryFn: () => productionPlansApi.list({ page_size: 100 }).then(r => r.data),
    staleTime: 60_000,
  })
  const khsxList = khsxPage?.items ?? []

  const { data: issueList = [], isLoading } = useQuery({
    queryKey: ['material-issues', filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listMaterialIssues({
      warehouse_id: filterKho, phap_nhan_id: filterPhapNhan, phan_xuong_id: filterXuong,
      tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const phapNhanOptions = Array.from(new Map(
    warehouses.filter(w => w.phap_nhan_id).map(w => [
      w.phap_nhan_id,
      { value: w.phap_nhan_id!, label: w.ten_phap_nhan || `PN #${w.phap_nhan_id}` },
    ])
  ).values())

  const xuongOptions = Array.from(new Map(
    warehouses
      .filter(w => w.phan_xuong_id && (!filterPhapNhan || w.phap_nhan_id === filterPhapNhan))
      .map(w => [w.phan_xuong_id, { value: w.phan_xuong_id!, label: w.ten_xuong || `Xuong #${w.phan_xuong_id}` }])
  ).values())

  const warehouseOptions = warehouses
    .filter(w => w.trang_thai)
    .filter(w => !filterPhapNhan || w.phap_nhan_id === filterPhapNhan)
    .filter(w => !filterXuong || w.phan_xuong_id === filterXuong)
    .map(w => ({ value: w.id, label: w.ten_kho }))


  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteMaterialIssue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-nvl'] })
      message.success('Đã xoá phiếu xuất')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xoá'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => warehouseApi.approveMaterialIssue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-nvl'] })
      message.success('Đã duyệt phiếu xuất')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi duyệt'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => warehouseApi.cancelMaterialIssue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-nvl'] })
      message.success('Đã huỷ phiếu xuất')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi huỷ'),
  })

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      mat_id: matId,
      ten_hang: mat.ten,
      dvt: mat.dvt || 'Kg',
      don_gia: Number(mat.gia_mua || 0),
    }
    form.setFieldValue('items', updated)
  }

  const clearMatSelect = (itemName: number) => {
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = { ...updated[itemName], mat_id: undefined, ten_hang: '', don_gia: 0 }
    form.setFieldValue('items', updated)
  }

  const handleKhsxChange = async (planIds: number[]) => {
    setSelectedPlanIds(planIds)
    if (!planIds.length) {
      setPlanLsxList([])
      form.setFieldValue('production_order_ids', [])
      return
    }
    setLoadingPlanLsx(true)
    try {
      const plans = await Promise.all(planIds.map(id => productionPlansApi.get(id).then(r => r.data)))
      // collect unique so_lenh from all plan lines
      const soLenhs = new Set(plans.flatMap(p => (p.lines ?? []).map(l => l.so_lenh).filter(Boolean)))
      // match so_lenh → id using lsxList (already loaded)
      const matched = lsxList.filter(l => soLenhs.has(l.so_lenh))
      const lsxItems = matched.map(l => ({ id: l.id, so_lenh: l.so_lenh }))
      setPlanLsxList(lsxItems)
      form.setFieldValue('production_order_ids', lsxItems.map(l => l.id))
      if (lsxItems.length) {
        const pxId = matched[0].phan_xuong_id ?? null
        setFormPxId(pxId)
        const gcWh = warehouses.find(w => w.loai_kho === 'GIAY_CUON' && w.trang_thai && w.phan_xuong_id === pxId)
        const nlWh = warehouses.find(w => w.loai_kho === 'NVL_PHU' && w.trang_thai && w.phan_xuong_id === pxId)
        form.setFieldValue('warehouse_id', (gcWh ?? nlWh)?.id ?? undefined)
      }
    } catch {
      message.error('Không thể tải chi tiết KHSX')
    } finally {
      setLoadingPlanLsx(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const orderIds: number[] = v.production_order_ids ?? []
      if (!orderIds.length) { message.warning('Chọn ít nhất 1 lệnh sản xuất'); return }
      const items = (v.items as Array<Record<string, unknown>> || []).map(it => ({
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id as number | null ?? null) : null,
        other_material_id: ['khac', 'muc_in'].includes(it.loai_vat_tu as string) ? (it.mat_id as number | null ?? null) : null,
        ten_hang: (it.ten_hang as string) || '',
        so_luong_ke_hoach: (it.so_luong_ke_hoach as number) || 0,
        so_luong_thuc_xuat: it.so_luong_thuc_xuat as number,
        dvt: (it.dvt as string) || 'Kg',
        don_gia: (it.don_gia as number) || 0,
        ghi_chu: (it.ghi_chu as string) || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      setIsSubmitting(true)
      await Promise.all(orderIds.map(orderId =>
        warehouseApi.createMaterialIssue({
          ngay_xuat: v.ngay_xuat.format('YYYY-MM-DD'),
          production_order_id: orderId,
          warehouse_id: v.warehouse_id,
          ghi_chu: v.ghi_chu || null,
          items: items as CreateMaterialIssuePayload['items'],
        })
      ))
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-nvl'] })
      message.success(orderIds.length === 1 ? 'Đã tạo phiếu xuất NVL' : `Đã tạo ${orderIds.length} phiếu xuất NVL`)
      setOpen(false)
      form.resetFields()
    } catch (e: unknown) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạo phiếu')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrintIssue = (r: MaterialIssue) => {
    if (!r.phap_nhan_id) {
      message.error('Phiếu xuất NVL chưa có pháp nhân nên không thể in')
      return
    }
    const cols = [
      { header: 'Tên hàng', key: 'ten_hang' },
      { header: 'ĐVT', key: 'dvt', align: 'center' as const },
      { header: 'SL kế hoạch', key: 'so_luong_ke_hoach', align: 'right' as const },
      { header: 'SL thực xuất', key: 'so_luong_thuc_xuat', align: 'right' as const },
      { header: 'Đơn giá', key: 'don_gia', align: 'right' as const },
      { header: 'Thành tiền', key: 'thanh_tien', align: 'right' as const },
    ]
    const rowData = r.items.map((it: MaterialIssueItem) => ({
      ten_hang: it.ten_hang,
      dvt: it.dvt,
      so_luong_ke_hoach: it.so_luong_ke_hoach > 0
        ? Number(it.so_luong_ke_hoach).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—',
      so_luong_thuc_xuat: Number(it.so_luong_thuc_xuat).toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
      don_gia: it.don_gia > 0 ? fmtVND(it.don_gia) + 'đ' : '—',
      thanh_tien: fmtVND(it.so_luong_thuc_xuat * it.don_gia) + 'đ',
    }))
    const table = buildHtmlTable(
      cols.map(c => ({ header: c.header, align: c.align })),
      rowData.map(row => cols.map(c => (row as Record<string, unknown>)[c.key])) as (string | number | null | undefined)[][]
    )
    smartPrintPdf('MATERIAL_ISSUE', {
      subtitle: 'PHIẾU XUẤT NGUYÊN VẬT LIỆU',
      document_number: r.so_phieu,
      document_date: r.ngay_xuat ?? '',
      warehouse_name: r.ten_kho ?? '—',
      so_lenh: r.so_lenh ?? '—',
      ghi_chu: r.ghi_chu ?? '—',
      body_html: table,
    }, r.phap_nhan_id)
  }

  const handleExportIssueExcel = async (id: number, soPhieu: string) => {
    try {
      const blob = await warehouseApi.exportMaterialIssueExcel(id)
      downloadBlob(blob, `XNVL_${soPhieu || id}.xlsx`)
    } catch {
      message.error('Không thể xuất Excel. Kiểm tra lại cấu hình mẫu Excel MATERIAL_ISSUE.')
    }
  }

  const handleExportExcel = () => {
    const resolvedPhapNhanId = resolveSinglePhapNhanId(issueList)
    if (!issueList.length) { message.warning('Không có dữ liệu để xuất Excel'); return }
    if (!resolvedPhapNhanId) {
      message.error('Chỉ xuất Excel khi danh sách thuộc một pháp nhân. Vui lòng lọc dữ liệu trước.')
      return
    }
    const exportData = issueList.map((r: MaterialIssue) => ({
      ...r,
      so_lenh: r.so_lenh ?? '',
      trang_thai_lbl: r.trang_thai === 'da_xuat' ? 'Đã xuất' : r.trang_thai === 'huy' ? 'Huỷ' : 'Nhập',
    }))
    smartExportExcel('MATERIAL_ISSUE', exportData, [
      { key: 'so_phieu', label: 'Số phiếu', width: 18 },
      { key: 'ngay_xuat', label: 'Ngày xuất', width: 12 },
      { key: 'ten_kho', label: 'Kho', width: 18 },
      { key: 'so_lenh', label: 'Lệnh SX', width: 16 },
      { key: 'trang_thai_lbl', label: 'Trạng thái', width: 12 },
    ], `XuatNVL_${dayjs().format('YYYYMMDD')}`, resolvedPhapNhanId)
  }

  const tongTien = issueList.reduce(
    (sum: number, r: MaterialIssue) =>
      sum + r.items.reduce((s: number, it: MaterialIssueItem) => s + it.so_luong_thuc_xuat * it.don_gia, 0),
    0
  )

  const columns = [
    {
      title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#fa8c16' }}>{v}</Text>,
    },
    { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 110 },
    { title: 'Kho xuất', dataIndex: 'ten_kho', width: 150 },
    {
      title: 'LSX', dataIndex: 'so_lenh', width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Số MH', width: 80, align: 'center' as const,
      render: (_: unknown, r: MaterialIssue) => r.items.length,
    },
    {
      title: 'Tổng tiền', width: 130, align: 'right' as const,
      render: (_: unknown, r: MaterialIssue) => {
        const total = r.items.reduce(
          (s: number, it: MaterialIssueItem) => s + it.so_luong_thuc_xuat * it.don_gia, 0
        )
        return total > 0
          ? <Text strong>{fmtVND(total)}đ</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'TT', dataIndex: 'trang_thai', width: 90,
      render: (v: string) => (
        <Tag color={v === 'da_xuat' ? 'green' : v === 'huy' ? 'red' : 'default'}>
          {v === 'da_xuat' ? 'Đã xuất' : v === 'huy' ? 'Huỷ' : 'Nhập'}
        </Tag>
      ),
    },
    { title: 'Người lập', dataIndex: 'created_by_name', width: 120, render: (v: string | null) => v || '—' },
    {
      title: '', width: 120,
      render: (_: unknown, r: MaterialIssue) => (
        <Space size={4}>
          <Tooltip title="In phiếu">
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintIssue(r)} />
          </Tooltip>
          <Tooltip title="Xuất Excel phiếu">
            <Button size="small" icon={<FileExcelOutlined />}
              style={{ color: '#217346', borderColor: '#217346' }}
              onClick={() => handleExportIssueExcel(r.id, r.so_phieu)} />
          </Tooltip>
          {r.trang_thai === 'nhap' && (
            <>
              {canApprove && (
                <Popconfirm
                  title="Duyệt xuất kho phiếu này?"
                  onConfirm={() => approveMut.mutate(r.id)}
                  okText="Duyệt"
                  cancelText="Không"
                >
                  <Tooltip title="Duyệt phiếu">
                    <Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
                  </Tooltip>
                </Popconfirm>
              )}
              <Popconfirm
                title="Xoá phiếu xuất này?"
                onConfirm={() => deleteMut.mutate(r.id)}
                okButtonProps={{ danger: true }}
                disabled={!hasPermission('inventory.export')}
              >
                <Tooltip title="Xoá phiếu">
                  <Button danger size="small" icon={<DeleteOutlined />}
                    disabled={!hasPermission('inventory.export')} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {r.trang_thai === 'da_xuat' && canApprove && (
            <Popconfirm
              title="Hủy phiếu xuất kho này? (Hoàn trả tồn kho và đảo bút toán kế toán)"
              onConfirm={() => cancelMut.mutate(r.id)}
              okButtonProps={{ danger: true }}
              okText="Hủy phiếu"
              cancelText="Không"
            >
              <Tooltip title="Hủy phiếu">
                <Button type="text" size="small" icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: MaterialIssue) => (
    <div>
      {r.created_by_name && (
        <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
          Người lập: <strong>{r.created_by_name}</strong>
        </div>
      )}
      <Table
        dataSource={r.items}
      rowKey={(_, i) => `${r.id}-${i}`}
      size="small"
      pagination={false}
      locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        {
          title: 'SL kế hoạch', dataIndex: 'so_luong_ke_hoach', width: 110, align: 'right' as const,
          render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—',
        },
        {
          title: 'SL thực xuất', dataIndex: 'so_luong_thuc_xuat', width: 120, align: 'right' as const,
          render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text>,
        },
        {
          title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
          render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—',
        },
        {
          title: 'Thành tiền', width: 130, align: 'right' as const,
          render: (_: unknown, it: MaterialIssueItem) => {
            const tt = it.so_luong_thuc_xuat * it.don_gia
            return tt > 0 ? <Text strong>{fmtVND(tt)}đ</Text> : '—'
          },
        },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
    </div>
  )

  return (
    <>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={5}>
          <Select
            placeholder="Pháp nhân" style={{ width: '100%' }} allowClear value={filterPhapNhan}
            onChange={v => { setFilterPhapNhan(v); setFilterXuong(undefined); setFilterKho(undefined) }}
            options={phapNhanOptions}
          />
        </Col>
        <Col xs={12} sm={5}>
          <Select
            placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={filterXuong}
            onChange={v => { setFilterXuong(v); setFilterKho(undefined) }}
            options={xuongOptions}
          />
        </Col>
        <Col xs={12} sm={4}>
          <Select
            placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={filterKho}
            onChange={setFilterKho} options={warehouseOptions}
          />
        </Col>
        <Col xs={12} sm={4}>
          <DatePicker
            placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
            value={tuNgay ? dayjs(tuNgay) : null}
            onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)}
          />
        </Col>
        <Col xs={12} sm={4}>
          <DatePicker
            placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
            value={denNgay ? dayjs(denNgay) : null}
            onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)}
          />
        </Col>
        <Col xs={24}>
          <Segmented
            options={[
              { label: 'Tất cả', value: '' },
              { label: 'Chờ xuất', value: 'nhap' },
              { label: 'Đã xuất', value: 'da_xuat' },
            ]}
            value={filterTrangThai}
            onChange={v => setFilterTrangThai(v as string)}
          />
        </Col>
      </Row>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Statistic
            title="Tổng xuất"
            value={tongTien}
            precision={0}
            formatter={v => fmtVND(Number(v)) + 'đ'}
            valueStyle={{ fontSize: 15, color: '#fa8c16' }}
          />
        </Col>
        <Col>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              style={{ color: '#217346', borderColor: '#217346' }}
              onClick={handleExportExcel}
            >
              Xuất Excel
            </Button>
            <Button
              type="primary" icon={<PlusOutlined />}
              disabled={!hasPermission('inventory.export')}
              onClick={() => { form.resetFields(); form.setFieldsValue({ production_order_ids: [], ngay_xuat: dayjs() }); setFormPxId(null); setSelectMode('lsx'); setSelectedPlanIds([]); setPlanLsxList([]); setOpen(true) }}
            >
              Tạo phiếu xuất
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        dataSource={filterTrangThai ? issueList.filter((r: MaterialIssue) => r.trang_thai === filterTrangThai) : issueList} columns={columns} rowKey="id" loading={isLoading} size="small"
        expandable={{ expandedRowRender }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 900 }}
      />

      <Drawer
        open={open}
        onClose={() => { setOpen(false); form.resetFields(); setSelectMode('lsx'); setSelectedPlanIds([]); setPlanLsxList([]); setFormPxId(null) }}
        title="Tạo phiếu xuất NVL" width={820}
        extra={
          <Space>
            <Button onClick={() => { setOpen(false); form.resetFields(); setSelectMode('lsx'); setSelectedPlanIds([]); setPlanLsxList([]); setFormPxId(null) }}>Huỷ</Button>
            <Button
              type="primary" loading={isSubmitting}
              disabled={!hasPermission('inventory.export')} onClick={handleSubmit}
            >
              Lưu phiếu xuất
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_xuat: dayjs() }}>
          <Form.Item label="Chọn theo" style={{ marginBottom: 8 }}>
            <Radio.Group
              value={selectMode}
              onChange={e => {
                const m = e.target.value as 'lsx' | 'khsx'
                setSelectMode(m)
                setSelectedPlanIds([])
                setPlanLsxList([])
                form.setFieldValue('production_order_ids', [])
                setFormPxId(null)
              }}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={[
                { label: 'Lệnh sản xuất (LSX)', value: 'lsx' },
                { label: 'Kế hoạch sản xuất (KHSX)', value: 'khsx' },
              ]}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              {selectMode === 'khsx' ? (
                <Form.Item label="Kế hoạch sản xuất">
                  <Select
                    mode="multiple"
                    maxTagCount="responsive"
                    placeholder="Chọn KHSX (có thể chọn nhiều)..."
                    showSearch
                    optionFilterProp="label"
                    loading={loadingKhsx || loadingPlanLsx}
                    value={selectedPlanIds}
                    onChange={handleKhsxChange}
                    options={khsxList.map(p => ({
                      value: p.id,
                      label: p.so_ke_hoach,
                    }))}
                    style={{ width: '100%' }}
                  />
                  {selectedPlanIds.length > 0 && planLsxList.length === 0 && !loadingPlanLsx && (
                    <Text type="warning" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                      Không tìm thấy LSX trong KHSX đã chọn
                    </Text>
                  )}
                  {planLsxList.length > 0 && (
                    <>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 6, marginBottom: 4, display: 'block' }}>
                        Lệnh SX (bỏ chọn để loại trừ):
                      </Text>
                      <Form.Item name="production_order_ids" noStyle>
                        <Select
                          mode="multiple"
                          maxTagCount="responsive"
                          placeholder="Chọn LSX..."
                          options={planLsxList.map(l => ({ value: l.id, label: l.so_lenh }))}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </>
                  )}
                </Form.Item>
              ) : (
                <Form.Item
                  name="production_order_ids" label="Lệnh sản xuất"
                  rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất 1 LSX' }]}
                >
                  <Select
                    mode="multiple"
                    maxTagCount="responsive"
                    placeholder="Chọn LSX (có thể chọn nhiều)..." showSearch
                    optionFilterProp="label"
                    options={lsxList.map(o => ({
                      value: o.id,
                      label: `${o.so_lenh}${o.ten_khach_hang ? ' — ' + o.ten_khach_hang : ''}`,
                    }))}
                    onChange={(ids: number[]) => {
                      if (!ids.length) { setFormPxId(null); return }
                      const pxId = lsxList.find(o => o.id === ids[0])?.phan_xuong_id ?? null
                      setFormPxId(pxId)
                      const gcWh = warehouses.find(w => w.loai_kho === 'GIAY_CUON' && w.trang_thai && w.phan_xuong_id === pxId)
                      const nlWh = warehouses.find(w => w.loai_kho === 'NVL_PHU' && w.trang_thai && w.phan_xuong_id === pxId)
                      form.setFieldValue('warehouse_id', (gcWh ?? nlWh)?.id ?? undefined)
                    }}
                  />
                </Form.Item>
              )}
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_xuat" label="Ngày xuất" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho xuất" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select
                  placeholder="Chọn kho"
                  options={warehouses
                    .filter(w => w.trang_thai &&
                      ['GIAY_CUON', 'NVL_PHU', 'nguyen_lieu', 'khac'].includes(w.loai_kho ?? '') &&
                      (!formPxId || w.phan_xuong_id === formPxId))
                    .map(w => ({ value: w.id, label: w.ten_kho }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách NVL xuất</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]}>
                      <Col span={5}>
                        <Form.Item name={[name, 'loai_vat_tu']} label="Loại" style={{ marginBottom: 4 }}>
                          <Select
                            size="small"
                            onChange={(val: string) => {
                              const items = form.getFieldValue('items') || []
                              const updated = [...items]
                              const defaultDvt = ['dich_vu', 'ban_in', 'khuon_be'].includes(val) ? 'Lần' : 'Kg'
                              updated[name] = { ...updated[name], mat_id: undefined, ten_hang: '', dvt: defaultDvt, don_gia: 0 }
                              form.setFieldValue('items', updated)
                            }}
                            options={[
                              { value: 'giay', label: 'Giấy cuộn' },
                              { value: 'khac', label: 'NVL khác' },
                              { value: 'tu_do', label: 'Tự do' },
                              { value: 'ban_in', label: 'Bản in' },
                              { value: 'khuon_be', label: 'Khuôn bế' },
                              { value: 'muc_in', label: 'Mực in' },
                              { value: 'dich_vu', label: 'Dịch vụ' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={14}>
                        <Form.Item noStyle dependencies={[['items', name, 'loai_vat_tu']]}>
                          {({ getFieldValue }) => {
                            const loai = getFieldValue(['items', name, 'loai_vat_tu'])
                            if (loai === 'giay') return (
                              <Form.Item name={[name, 'mat_id']} label="Giấy cuộn" style={{ marginBottom: 4 }}>
                                <Select
                                  size="small" showSearch allowClear
                                  optionFilterProp="label"
                                  placeholder="Chọn giấy cuộn..."
                                  options={paperMats.filter(m => m.su_dung).map(m => ({ value: m.id, label: `${m.ma_chinh} - ${m.ten}` }))}
                                  onChange={id => id ? handleMatSelect(name, 'giay', id) : clearMatSelect(name)}
                                  onClear={() => clearMatSelect(name)}
                                />
                              </Form.Item>
                            )
                            if (loai === 'khac') return (
                              <Form.Item name={[name, 'mat_id']} label="NVL khác" style={{ marginBottom: 4 }}>
                                <Select
                                  size="small" showSearch allowClear
                                  optionFilterProp="label"
                                  placeholder="Chọn NVL khác..."
                                  options={otherMats.filter(m => m.trang_thai).map(m => ({ value: m.id, label: `${m.ma_chinh} - ${m.ten}` }))}
                                  onChange={id => id ? handleMatSelect(name, 'khac', id) : clearMatSelect(name)}
                                  onClear={() => clearMatSelect(name)}
                                />
                              </Form.Item>
                            )
                            if (loai === 'muc_in') return (
                              <Form.Item name={[name, 'mat_id']} label="Mực in (NVL)" style={{ marginBottom: 4 }}>
                                <Select
                                  size="small" showSearch allowClear
                                  optionFilterProp="label"
                                  placeholder="Chọn mực từ danh mục NVL..."
                                  options={otherMats.filter(m => m.trang_thai).map(m => ({ value: m.id, label: `${m.ma_chinh} - ${m.ten}` }))}
                                  onChange={id => id ? handleMatSelect(name, 'khac', id) : clearMatSelect(name)}
                                  onClear={() => clearMatSelect(name)}
                                />
                              </Form.Item>
                            )
                            if (loai === 'dich_vu') return (
                              <Form.Item name={[name, 'ten_hang']} label="Tên dịch vụ" rules={[{ required: true, message: 'Nhập tên dịch vụ' }]} style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="VD: Vận chuyển, gia công ngoài..." />
                              </Form.Item>
                            )
                            // ban_in, khuon_be, tu_do: free text
                            const labelMap: Record<string, string> = { ban_in: 'Bản in', khuon_be: 'Khuôn bế', tu_do: 'Tên hàng' }
                            return (
                              <Form.Item name={[name, 'ten_hang']} label={labelMap[loai] ?? 'Tên hàng'} rules={[{ required: true, message: 'Nhập tên hàng' }]} style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="Mô tả hàng cần xuất..." />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={DVT_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined
                          style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }}
                          onClick={() => remove(name)}
                        />
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong_ke_hoach']} label="SL kế hoạch" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={[name, 'so_luong_thuc_xuat']} label="SL thực xuất"
                          rules={[{ required: true, message: 'Nhập SL' }]}
                          style={{ marginBottom: 4 }}
                        >
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá (đ)" style={{ marginBottom: 4 }}>
                          <InputNumber
                            size="small" min={0} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="Ghi chú dòng..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', so_luong_ke_hoach: 0, don_gia: 0 })}
                >
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </>
  )
}

// ── Tab 2: Tồn kho NVL ───────────────────────────────────────────────────────

function TabTonKhoNVL() {
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [search, setSearch] = useState('')

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ton-kho-nvl', filterXuong, search],
    queryFn: () => warehouseApi.getTonKhoNVL({
      phan_xuong_id: filterXuong,
      search: search || undefined,
    }).then(r => r.data),
    staleTime: 60_000,
  })

  const tongGt = rows.reduce((s: number, r: TonKhoNVLRow) => s + r.gia_tri_ton, 0)

  const pxMap = new Map(phanXuongList.map((px: PhanXuong) => [px.id, px.ten_xuong]))

  const columns = [
    {
      title: 'Tên vật tư', dataIndex: 'ten_hang', ellipsis: true,
    },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 70 },
    {
      title: 'Xưởng', dataIndex: 'phan_xuong_id', width: 140,
      render: (v: number | null) => v ? (pxMap.get(v) || `#${v}`) : <Text type="secondary">—</Text>,
    },
    { title: 'Kho', dataIndex: 'ten_kho', width: 170, ellipsis: true },
    {
      title: 'Tồn', dataIndex: 'ton_luong', width: 110, align: 'right' as const,
      render: (v: number, r: TonKhoNVLRow) => (
        <Text strong style={{ color: v < r.ton_toi_thieu ? '#f5222d' : undefined }}>
          {fmtVND(v)}
        </Text>
      ),
    },
    {
      title: 'Tối thiểu', dataIndex: 'ton_toi_thieu', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? fmtVND(v) : '—',
    },
    {
      title: 'Đơn giá BQ', dataIndex: 'don_gia_binh_quan', width: 120, align: 'right' as const,
      render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—',
    },
    {
      title: 'Giá trị tồn', dataIndex: 'gia_tri_ton', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text>,
    },
  ]

  return (
    <>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Input.Search
            placeholder="Tìm tên vật tư..."
            allowClear
            style={{ width: 220 }}
            onSearch={v => setSearch(v)}
            onChange={e => { if (!e.target.value) setSearch('') }}
          />
        </Col>
        <Col>
          <Select
            placeholder="Tất cả xưởng" allowClear style={{ width: 200 }}
            value={filterXuong} onChange={setFilterXuong}
            options={phanXuongList.map((px: PhanXuong) => ({ value: px.id, label: px.ten_xuong }))}
          />
        </Col>
        <Col flex="auto">
          <Statistic
            title="Tổng giá trị tồn" value={tongGt} precision={0}
            formatter={v => fmtVND(Number(v)) + 'đ'}
            valueStyle={{ fontSize: 16, color: '#1677ff' }}
          />
        </Col>
      </Row>
      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        dataSource={rows} columns={columns}
        rowKey={(r: TonKhoNVLRow) => `${r.warehouse_id}-${r.other_material_id}`}
        loading={isLoading} size="small"
        rowClassName={(r: TonKhoNVLRow) => r.ton_luong < r.ton_toi_thieu ? 'ant-table-row-warning' : ''}
        pagination={{ pageSize: 30, showSizeChanger: true }}
        scroll={{ x: 950 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={7}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right">
              <Text strong>{fmtVND(tongGt)}đ</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </>
  )
}

// ── Tab 3: Lịch sử xuất NVL ──────────────────────────────────────────────────

function TabLichSuXuatNVL() {
  const [filterLSX, setFilterLSX] = useState<string | undefined>()
  const [filterMatName, setFilterMatName] = useState<string | undefined>()

  const { data: allIssues = [], isLoading } = useQuery({
    queryKey: ['material-issues-all'],
    queryFn: () => warehouseApi.listMaterialIssues().then(r => r.data),
    staleTime: 120_000,
  })

  const lsxOptions = Array.from(new Set(allIssues.map((i: MaterialIssue) => i.so_lenh)))
    .filter(Boolean).map(v => ({ value: v, label: v }))

  const matOptions = Array.from(
    new Set(allIssues.flatMap((i: MaterialIssue) => i.items.map((it: MaterialIssueItem) => it.ten_hang)))
  ).filter(Boolean).map(v => ({ value: v, label: v }))

  const historyRows = allIssues
    .flatMap((issue: MaterialIssue) =>
      issue.items.map((it: MaterialIssueItem, i: number) => ({
        key: `${issue.id}-${i}`,
        ngay_xuat: issue.ngay_xuat,
        so_phieu: issue.so_phieu,
        so_lenh: issue.so_lenh,
        ten_kho: issue.ten_kho,
        ten_xuong: issue.ten_xuong || '',
        trang_thai: issue.trang_thai,
        ten_hang: it.ten_hang,
        dvt: it.dvt,
        so_luong_thuc_xuat: it.so_luong_thuc_xuat,
        don_gia: it.don_gia,
        thanh_tien: it.so_luong_thuc_xuat * it.don_gia,
        ghi_chu: it.ghi_chu,
      }))
    )
    .filter(r => {
      if (filterLSX && r.so_lenh !== filterLSX) return false
      if (filterMatName && r.ten_hang !== filterMatName) return false
      return true
    })
    .sort((a, b) => b.ngay_xuat.localeCompare(a.ngay_xuat))

  const tongXuat = historyRows.reduce((s, r) => s + r.thanh_tien, 0)

  return (
    <>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col>
          <Select
            placeholder="Tất cả LSX" allowClear showSearch style={{ width: 200 }}
            value={filterLSX} onChange={setFilterLSX}
            options={lsxOptions}
          />
        </Col>
        <Col>
          <Select
            placeholder="Tất cả vật tư" allowClear showSearch style={{ width: 240 }}
            value={filterMatName} onChange={setFilterMatName}
            options={matOptions}
          />
        </Col>
        <Col flex="auto">
          <Statistic
            title="Tổng xuất (lọc)" value={tongXuat} precision={0}
            formatter={v => fmtVND(Number(v)) + 'đ'}
            valueStyle={{ fontSize: 14, color: '#fa8c16' }}
          />
        </Col>
      </Row>
      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        dataSource={historyRows} rowKey="key" loading={isLoading} size="small"
        pagination={{ pageSize: 30, showSizeChanger: true }}
        scroll={{ x: 1050 }}
        columns={[
          { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 105 },
          {
            title: 'Số phiếu', dataIndex: 'so_phieu', width: 155,
            render: (v: string) => <Text style={{ color: '#fa8c16' }}>{v}</Text>,
          },
          {
            title: 'Lệnh SX', dataIndex: 'so_lenh', width: 140,
            render: (v: string) => <Tag color="blue">{v}</Tag>,
          },
          {
            title: 'Xưởng', dataIndex: 'ten_xuong', width: 130, ellipsis: true,
            render: (v: string) => v || <Text type="secondary">—</Text>,
          },
          { title: 'Kho xuất', dataIndex: 'ten_kho', width: 140, ellipsis: true },
          { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
          { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
          {
            title: 'SL xuất', dataIndex: 'so_luong_thuc_xuat', width: 100, align: 'right' as const,
            render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
          },
          {
            title: 'Đơn giá', dataIndex: 'don_gia', width: 115, align: 'right' as const,
            render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—',
          },
          {
            title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
            render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text>,
          },
        ]}
      />
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IssuesPage() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <ExportOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
            <Title level={4} style={{ margin: 0 }}>Xuất NVL cho sản xuất</Title>
          </Space>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
        <Tabs
          defaultActiveKey="phieu-xuat"
          items={[
            { key: 'phieu-xuat', label: 'Phiếu xuất NVL', children: <TabDanhSachXuatNVL /> },
            { key: 'ton-kho', label: 'Tồn kho NVL', children: <TabTonKhoNVL /> },
            { key: 'lich-su', label: 'Lịch sử xuất', children: <TabLichSuXuatNVL /> },
          ]}
        />
      </Card>
    </div>
  )
}
