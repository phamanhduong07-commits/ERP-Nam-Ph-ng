import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { EyeOutlined, FileExcelOutlined, PrinterOutlined, PlusOutlined, DeleteOutlined, SwapOutlined, ArrowRightOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { systemApi } from '../../api/system'
import dayjs from 'dayjs'
import {
  warehouseApi, PhieuChuyenKho, CreatePhieuChuyenPayload, TonKho,
} from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { exportToExcel, renderTemplateAndPrint } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography

export default function TransfersPage() {
  const companyInfo = usePhapNhanForPrint()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterXuongNguon, setFilterXuongNguon] = useState<number | undefined>()
  const [filterXuongDich, setFilterXuongDich] = useState<number | undefined>()
  const [filterKhoXuat, setFilterKhoXuat] = useState<number | undefined>()
  const [filterKhoNhap, setFilterKhoNhap] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedKhoXuat, setSelectedKhoXuat] = useState<number | undefined>()
  const [selectedKhoNhap, setSelectedKhoNhap] = useState<number | undefined>()
  const [detailPhieu, setDetailPhieu] = useState<PhieuChuyenKho | null>(null)

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phieuList = [], isLoading } = useQuery({
    queryKey: ['phieu-chuyen', filterKhoXuat, filterKhoNhap, tuNgay, denNgay],
    queryFn: () => warehouseApi.listPhieuChuyen({
      warehouse_xuat_id: filterKhoXuat, warehouse_nhap_id: filterKhoNhap, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const phapNhanIdForPrint = detailPhieu?.phap_nhan_id_for_print ?? undefined
  const { data: printTemplate } = useQuery({
    queryKey: ['print-template', 'WAREHOUSE_TRANSFER', phapNhanIdForPrint],
    queryFn: () => systemApi.getTemplate('WAREHOUSE_TRANSFER', phapNhanIdForPrint),
    staleTime: 5 * 60 * 1000,
    enabled: !!detailPhieu,
  })

  const { data: tonKhoXuat = [] } = useQuery({
    queryKey: ['ton-kho-chuyen', selectedKhoXuat],
    queryFn: () => selectedKhoXuat
      ? warehouseApi.getTonKho({ warehouse_id: selectedKhoXuat }).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!selectedKhoXuat,
  })

  const createMut = useMutation({
    mutationFn: (data: CreatePhieuChuyenPayload) => warehouseApi.createPhieuChuyen(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phieu-chuyen'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã tạo phiếu chuyển kho')
      setOpen(false)
      form.resetFields()
      setSelectedKhoXuat(undefined)
      setSelectedKhoNhap(undefined)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deletePhieuChuyen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phieu-chuyen'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu chuyển')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá phiếu'),
  })

  const activeWarehouses = warehouses.filter(w => w.trang_thai)
  const khoXuatOptions = activeWarehouses
    .filter(w => !filterXuongNguon || w.phan_xuong_id === filterXuongNguon)
    .map(w => {
      const px = phanXuongs.find((x: any) => x.id === w.phan_xuong_id)
      return { value: w.id, label: px ? `${w.ten_kho} (${px.ten_xuong})` : w.ten_kho }
    })
  const khoNhapOptions = activeWarehouses
    .filter(w => !filterXuongDich || w.phan_xuong_id === filterXuongDich)
    .map(w => {
      const px = phanXuongs.find((x: any) => x.id === w.phan_xuong_id)
      return { value: w.id, label: px ? `${w.ten_kho} (${px.ten_xuong})` : w.ten_kho }
    })

  const getPhanXuongName = (wid: number) => {
    const w = warehouses.find(x => x.id === wid)
    if (!w?.phan_xuong_id) return null
    return phanXuongs.find((x: any) => x.id === w.phan_xuong_id)?.ten_xuong ?? null
  }

  const handleTonKhoSelect = (itemName: number, tonKhoId: number) => {
    const t = tonKhoXuat.find(x => x.id === tonKhoId)
    if (!t) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      ton_kho_id: tonKhoId,
      paper_material_id: t.paper_material_id,
      other_material_id: t.other_material_id,
      ten_hang: t.ten_hang,
      don_vi: t.don_vi,
      don_gia: t.don_gia_binh_quan,
      _ton_luong: t.ton_luong,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      if (v.warehouse_xuat_id === v.warehouse_nhap_id) {
        message.error('Kho xuất và kho nhận không được trùng nhau')
        return
      }
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: it.paper_material_id || null,
        other_material_id: it.other_material_id || null,
        ten_hang: it.ten_hang,
        don_vi: it.don_vi || 'Kg',
        so_luong: it.so_luong,
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (items.length === 0) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        warehouse_xuat_id: v.warehouse_xuat_id,
        warehouse_nhap_id: v.warehouse_nhap_id,
        ngay: v.ngay.format('YYYY-MM-DD'),
        ghi_chu: v.ghi_chu || undefined,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const handlePrintDetail = () => {
    if (!detailPhieu) return
    if (!printTemplate?.html_content) {
      message.error('Chưa có mẫu in phiếu chuyển kho. Vào Cài đặt → Mẫu in để tạo mẫu WAREHOUSE_TRANSFER.')
      return
    }
    // Đọc selectedColumns từ metadata template (giống TabGiaoHang)
    const metaAny = printTemplate.variables_meta as any
    let tplCols: { key: string; label: string }[] = metaAny?.columns || []
    if (!tplCols.length && metaAny?.easy_config) {
      try { const cfg = JSON.parse(metaAny.easy_config); if (cfg?.selectedColumns?.length) tplCols = cfg.selectedColumns } catch { /* ignore */ }
    }

    const vi = new Intl.NumberFormat('vi-VN')
    const viDec = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
    const numKeys = ['so_luong', 'don_gia', 'don_vi']

    const itemsHtml = (detailPhieu.items || []).map((it: any, i: number) => {
      if (tplCols.length) {
        const cells = tplCols.map((col: any) => {
          let val = ''
          switch (col.key) {
            case 'stt':          val = String(i + 1); break
            case 'ten_hang':     val = it.ten_hang ?? ''; break
            case 'don_vi': case 'dvt': val = it.don_vi ?? ''; break
            case 'so_luong':     val = viDec.format(Number(it.so_luong)); break
            case 'don_gia': case 'gia_ban': val = it.don_gia > 0 ? vi.format(Number(it.don_gia)) : '—'; break
            case 'ghi_chu':      val = it.ghi_chu ?? ''; break
            // LSX-enriched columns (phôi)
            case 'so_lsx':       val = it.so_lsx ?? ''; break
            case 'ma_sp': case 'ma_amis': val = it.ma_sp ?? ''; break
            case 'so_lop':       val = it.so_lop != null ? String(it.so_lop) : ''; break
            case 'to_hop_song':  val = it.to_hop_song ?? ''; break
            case 'quy_cach': case 'kich_thuoc': val = it.quy_cach ?? ''; break
            case 'kho_cat':      val = it.kho_cat ?? ''; break
            default:             val = ''
          }
          const isNum = ['so_luong', 'don_gia'].includes(col.key)
          return `<td${isNum ? ' style="text-align:right"' : ''}>${val}</td>`
        }).join('')
        return `<tr>${cells}</tr>`
      }
      // fallback nếu template không có selectedColumns
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${it.ten_hang ?? ''}</td>
        <td style="text-align:center">${it.don_vi ?? ''}</td>
        <td style="text-align:right">${viDec.format(Number(it.so_luong))}</td>
        <td style="text-align:right">${it.don_gia > 0 ? vi.format(Number(it.don_gia)) + 'đ' : '—'}</td>
        <td>${it.ghi_chu ?? ''}</td>
      </tr>`
    }).join('')

    const ngay = detailPhieu.ngay ?? ''
    const [yyyy, mm, dd] = ngay.split('-')
    renderTemplateAndPrint(
      `Phiếu chuyển kho ${detailPhieu.so_phieu}`,
      printTemplate.html_content,
      {
        // biến chuẩn easy-mode template
        subtitle: 'PHIẾU CHUYỂN KHO',
        document_number: detailPhieu.so_phieu,
        document_date: ngay ? `${dd}/${mm}/${yyyy}` : '—',
        document_day: dd ?? '', document_month: mm ?? '', document_year: yyyy ?? '',
        customer_name: `${detailPhieu.ten_kho_xuat ?? '—'}${detailPhieu.ten_phan_xuong_xuat ? ` (${detailPhieu.ten_phan_xuong_xuat})` : ''}`,
        delivery_address: `${detailPhieu.ten_kho_nhap ?? '—'}${detailPhieu.ten_phan_xuong_nhap ? ` (${detailPhieu.ten_phan_xuong_nhap})` : ''}`,
        warehouse_name: detailPhieu.ten_phap_nhan_xuat ?? '',
        body_html: itemsHtml,
        footer_html: detailPhieu.ghi_chu ?? '',
        // biến tường minh cho template tự viết
        so_phieu: detailPhieu.so_phieu,
        ngay: ngay ? `${dd}/${mm}/${yyyy}` : '—',
        kho_xuat: detailPhieu.ten_kho_xuat ?? '—',
        ten_phan_xuong_xuat: detailPhieu.ten_phan_xuong_xuat ?? '',
        phap_nhan_xuat: detailPhieu.ten_phap_nhan_xuat ?? '',
        kho_nhap: detailPhieu.ten_kho_nhap ?? '—',
        ten_phan_xuong_nhap: detailPhieu.ten_phan_xuong_nhap ?? '',
        phap_nhan_nhap: detailPhieu.ten_phap_nhan_nhap ?? '',
        ghi_chu: detailPhieu.ghi_chu ?? '',
        items_html: itemsHtml,
        // biến giao hàng — không dùng trong phiếu chuyển kho, xóa khỏi output
        driver_name: '', assistant_1: '', assistant_2: '',
        total_m2: '', total_so_luong: '', trong_luong: '', the_tich: '',
        customer_name_2: '', delivery_address_2: '',
      },
      companyInfo,
    )
  }

  const handleExportExcel = () => {
    exportToExcel(`ChuyenKho_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Chuyển kho',
      headers: ['Số phiếu', 'Ngày', 'Kho xuất', 'Kho nhận', 'Trạng thái', 'Ghi chú'],
      rows: phieuList.map((r: PhieuChuyenKho) => [
        r.so_phieu,
        r.ngay,
        r.ten_kho_xuat ?? '',
        r.ten_kho_nhap ?? '',
        r.trang_thai === 'da_duyet' ? 'Đã duyệt' : 'Nhập',
        r.ghi_chu ?? '',
      ]),
      colWidths: [18, 12, 20, 20, 12, 25],
    }])
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160, render: (v: string) => <Text strong style={{ color: '#722ed1' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay', width: 110 },
    {
      title: 'Chiều chuyển', width: 300,
      render: (_: unknown, r: PhieuChuyenKho) => (
        <Space>
          <Tag color="blue">{r.ten_kho_xuat}</Tag>
          <ArrowRightOutlined style={{ color: '#722ed1' }} />
          <Tag color="purple">{r.ten_kho_nhap}</Tag>
        </Space>
      ),
    },
    { title: 'TT', dataIndex: 'trang_thai', width: 100, render: (v: string) => <Tag color={v === 'da_duyet' ? 'green' : 'default'}>{v === 'da_duyet' ? 'Đã duyệt' : 'Nhập'}</Tag> },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
    {
      title: '', width: 80,
      render: (_: unknown, r: PhieuChuyenKho) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailPhieu(r)} />
          <Popconfirm title="Xoá phiếu chuyển này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }} disabled={r.trang_thai !== 'nhap'}>
            <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai !== 'nhap'} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: PhieuChuyenKho) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'don_vi', width: 60 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 100, align: 'right' as const, render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const, render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ' : '—' },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><SwapOutlined style={{ fontSize: 20, color: '#722ed1' }} /><Title level={4} style={{ margin: 0 }}>Chuyển kho liên xưởng</Title></Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
            <Button icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setSelectedKhoXuat(undefined); setSelectedKhoNhap(undefined); setOpen(true) }}
              style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}>
              Tạo phiếu chuyển
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={6}>
            <Select placeholder="Xưởng nguồn" style={{ width: '100%' }} allowClear value={filterXuongNguon}
              onChange={v => { setFilterXuongNguon(v); setFilterKhoXuat(undefined) }}
              options={(phanXuongs as any[]).map(x => ({ value: x.id, label: x.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Xưởng đích" style={{ width: '100%' }} allowClear value={filterXuongDich}
              onChange={v => { setFilterXuongDich(v); setFilterKhoNhap(undefined) }}
              options={(phanXuongs as any[]).map(x => ({ value: x.id, label: x.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Kho xuất" style={{ width: '100%' }} allowClear value={filterKhoXuat} onChange={setFilterKhoXuat}
              options={khoXuatOptions} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Kho nhận" style={{ width: '100%' }} allowClear value={filterKhoNhap} onChange={setFilterKhoNhap}
              options={khoNhapOptions} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={phieuList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu chuyển kho" width={760}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button loading={createMut.isPending} onClick={handleSubmit}
              style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}>
              Lưu phiếu chuyển
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay: dayjs() }}>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Phiếu chuyển kho tự động giảm tồn kho nguồn và tăng tồn kho đích trong cùng một giao dịch." />

          <Row gutter={12} align="bottom">
            <Col span={11}>
              <Form.Item name="warehouse_xuat_id" label="Kho xuất (nguồn)" rules={[{ required: true, message: 'Chọn kho xuất' }]}>
                <Select placeholder="Chọn kho xuất"
                  options={activeWarehouses.filter(w => w.id !== selectedKhoNhap).map(w => ({ value: w.id, label: w.ten_kho }))}
                  onChange={v => { setSelectedKhoXuat(v); form.setFieldValue('items', []) }}
                />
              </Form.Item>
              {selectedKhoXuat && getPhanXuongName(selectedKhoXuat) && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -10, marginBottom: 8 }}>
                  {getPhanXuongName(selectedKhoXuat)}
                </Text>
              )}
            </Col>
            <Col span={2} style={{ textAlign: 'center', paddingBottom: 24 }}>
              <ArrowRightOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            </Col>
            <Col span={11}>
              <Form.Item name="warehouse_nhap_id" label="Kho nhận (đích)" rules={[{ required: true, message: 'Chọn kho nhận' }]}>
                <Select placeholder="Chọn kho nhận"
                  options={activeWarehouses.filter(w => w.id !== selectedKhoXuat).map(w => ({ value: w.id, label: w.ten_kho }))}
                  onChange={v => setSelectedKhoNhap(v)}
                />
              </Form.Item>
              {selectedKhoNhap && getPhanXuongName(selectedKhoNhap) && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -10, marginBottom: 8 }}>
                  {getPhanXuongName(selectedKhoNhap)}
                </Text>
              )}
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay" label="Ngày chuyển" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          {!selectedKhoXuat && (
            <div style={{ color: '#faad14', marginBottom: 12, fontSize: 13 }}>
              ← Chọn kho xuất trước để thấy danh sách tồn kho
            </div>
          )}

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Text strong>Danh sách hàng chuyển</Text>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    disabled={!selectedKhoXuat}
                    onClick={() => add({ don_vi: 'Kg', don_gia: 0 })}>
                    Thêm dòng
                  </Button>
                </Row>

                {fields.map(({ key, name }) => {
                  const items = form.getFieldValue('items') || []
                  const item = items[name] || {}
                  const tonHienTai: TonKho | undefined = tonKhoXuat.find(t => t.id === item.ton_kho_id)

                  return (
                    <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                      <Row gutter={[8, 4]}>
                        <Col span={16}>
                          <Form.Item name={[name, 'ton_kho_id']} label="Chọn hàng chuyển"
                            rules={[{ required: true, message: 'Chọn mặt hàng' }]} style={{ marginBottom: 4 }}>
                            <Select size="small" showSearch placeholder="Chọn từ tồn kho xuất..."
                              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                              options={tonKhoXuat.map(t => ({
                                value: t.id,
                                label: `${t.ten_hang} — tồn: ${t.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${t.don_vi}`,
                              }))}
                              onChange={id => handleTonKhoSelect(name, id)}
                            />
                          </Form.Item>
                          {tonHienTai && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: -8, marginBottom: 4 }}>
                              Tồn kho xuất: <Text strong style={{ color: '#722ed1' }}>
                                {tonHienTai.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} {tonHienTai.don_vi}
                              </Text>
                            </div>
                          )}
                        </Col>
                        <Col span={7}>
                          <Form.Item name={[name, 'don_vi']} label="ĐVT" style={{ marginBottom: 4 }}>
                            <Input size="small" readOnly style={{ background: '#f5f5f5' }} />
                          </Form.Item>
                        </Col>
                        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                          <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                        </Col>

                        <Col span={8}>
                          <Form.Item name={[name, 'so_luong']} label="Số lượng chuyển"
                            rules={[
                              { required: true, message: 'Nhập SL' },
                              {
                                validator: (_, val) => {
                                  if (!val || !tonHienTai) return Promise.resolve()
                                  if (val > tonHienTai.ton_luong)
                                    return Promise.reject(`Vượt tồn (${tonHienTai.ton_luong.toFixed(3)})`)
                                  return Promise.resolve()
                                },
                              },
                            ]}
                            style={{ marginBottom: 4 }}>
                            <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'don_gia']} label="Đơn giá (BQ)" style={{ marginBottom: 4 }}>
                            <InputNumber size="small" min={0} readOnly style={{ width: '100%', background: '#f5f5f5' }}
                              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                            <Input size="small" placeholder="..." />
                          </Form.Item>
                        </Col>

                        {/* Hidden fields */}
                        <Form.Item name={[name, 'paper_material_id']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'other_material_id']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'ten_hang']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, '_ton_luong']} hidden><Input /></Form.Item>
                      </Row>
                    </Card>
                  )
                })}

                {fields.length === 0 && selectedKhoXuat && tonKhoXuat.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#bbb', padding: 24 }}>Kho xuất chưa có tồn kho</div>
                )}
                {fields.length === 0 && selectedKhoXuat && tonKhoXuat.length > 0 && (
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ don_vi: 'Kg', don_gia: 0 })}>
                    Thêm dòng hàng
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      {/* ── Chi tiết phiếu chuyển ── */}
      <Drawer
        open={!!detailPhieu}
        onClose={() => setDetailPhieu(null)}
        title={detailPhieu ? <Space><SwapOutlined style={{ color: '#722ed1' }} /><Text strong>{detailPhieu.so_phieu}</Text></Space> : ''}
        width={620}
        footer={
          <Space>
            <Button onClick={() => setDetailPhieu(null)}>Đóng</Button>
            <Button icon={<PrinterOutlined />} type="primary" onClick={handlePrintDetail}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}>
              In phiếu
            </Button>
          </Space>
        }
      >
        {detailPhieu && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Ngày">{detailPhieu.ngay}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={detailPhieu.trang_thai === 'da_duyet' ? 'green' : 'default'}>
                  {detailPhieu.trang_thai === 'da_duyet' ? 'Đã duyệt' : 'Nhập'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Pháp nhân xuất" span={2}>
                <Text strong style={{ color: '#1677ff' }}>{detailPhieu.ten_phap_nhan_xuat || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Kho xuất" span={2}>
                <Tag color="blue">{detailPhieu.ten_kho_xuat}</Tag>
                {detailPhieu.ten_phan_xuong_xuat && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>({detailPhieu.ten_phan_xuong_xuat})</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Pháp nhân nhận" span={2}>
                <Text strong style={{ color: '#722ed1' }}>{detailPhieu.ten_phap_nhan_nhap || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Kho nhận" span={2}>
                <Tag color="purple">{detailPhieu.ten_kho_nhap}</Tag>
                {detailPhieu.ten_phan_xuong_nhap && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>({detailPhieu.ten_phan_xuong_nhap})</Text>
                )}
              </Descriptions.Item>
              {detailPhieu.ghi_chu && (
                <Descriptions.Item label="Ghi chú" span={2}>{detailPhieu.ghi_chu}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" style={{ margin: '16px 0 10px', fontSize: 13 }}>
              Danh sách hàng chuyển
            </Divider>

            {(() => {
              const hasLsx = detailPhieu.items.some((it: any) => it.so_lsx)
              return (
                <Table
                  dataSource={detailPhieu.items}
                  rowKey={(_, i) => `detail-item-${i}`}
                  size="small"
                  pagination={false}
                  scroll={{ x: hasLsx ? 700 : undefined }}
                  columns={[
                    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, width: hasLsx ? 160 : undefined },
                    ...(hasLsx ? [
                      { title: 'Số LSX', dataIndex: 'so_lsx', width: 130, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v || '—'}</Text> },
                      { title: 'Mã SP', dataIndex: 'ma_sp', width: 90, render: (v: string) => v || '—' },
                      { title: 'Quy cách', dataIndex: 'quy_cach', width: 100, render: (v: string) => v || '—' },
                      { title: 'Khổ×Cắt', dataIndex: 'kho_cat', width: 90, render: (v: string) => v || '—' },
                      { title: 'Lớp', dataIndex: 'so_lop', width: 50, align: 'center' as const },
                    ] : []),
                    { title: 'ĐVT', dataIndex: 'don_vi', width: 55 },
                    { title: 'Số lượng', dataIndex: 'so_luong', width: 90, align: 'right' as const,
                      render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
                    { title: 'Đơn giá', dataIndex: 'don_gia', width: 100, align: 'right' as const,
                      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
                    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
                  ]}
                />
              )
            })()}
          </>
        )}
      </Drawer>
    </div>
  )
}
