import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { AuditOutlined, DeleteOutlined, FileExcelOutlined, PrinterOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  CreateStockAdjustmentPayload, StockAdjustment, TonKho, warehouseApi,
} from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { exportToExcel, printDocument, buildHtmlTable } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography

function fmtNum(v: number) {
  return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function diffColor(v: number) {
  if (v > 0) return '#52c41a'
  if (v < 0) return '#ff4d4f'
  return '#666'
}

export default function StockAdjustmentsPage() {
  const companyInfo = usePhapNhanForPrint()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedKho, setSelectedKho] = useState<number | undefined>()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phieuList = [], isLoading } = useQuery({
    queryKey: ['stock-adjustments', filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listStockAdjustments({
      warehouse_id: filterKho, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const { data: tonKho = [] } = useQuery({
    queryKey: ['ton-kho-kiem-ke', selectedKho],
    queryFn: () => selectedKho
      ? warehouseApi.getTonKho({ warehouse_id: selectedKho }).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!selectedKho,
  })

  const createMut = useMutation({
    mutationFn: (data: CreateStockAdjustmentPayload) => warehouseApi.createStockAdjustment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-kiem-ke'] })
      message.success('Đã tạo phiếu kiểm kê')
      setOpen(false)
      form.resetFields()
      setSelectedKho(undefined)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu kiểm kê'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteStockAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-kiem-ke'] })
      message.success('Đã xoá phiếu kiểm kê')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá phiếu'),
  })

  const activeWarehouses = warehouses.filter(w => w.trang_thai)

  const handleTonKhoSelect = (rowIndex: number, balanceId: number) => {
    const t = tonKho.find(x => x.id === balanceId)
    if (!t) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[rowIndex] = {
      ...updated[rowIndex],
      inventory_balance_id: balanceId,
      ten_hang: t.ten_hang,
      don_vi: t.don_vi,
      so_luong_so_sach: t.ton_luong,
      so_luong_thuc_te: t.ton_luong,
      don_gia: t.don_gia_binh_quan,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || [])
        .filter((it: any) => it.inventory_balance_id)
        .map((it: any) => ({
          inventory_balance_id: it.inventory_balance_id,
          so_luong_thuc_te: Number(it.so_luong_thuc_te || 0),
          ghi_chu: it.ghi_chu || null,
        }))
      if (items.length === 0) {
        message.warning('Thêm ít nhất 1 dòng hàng')
        return
      }
      if (items.every((it: any) => {
        const ton = tonKho.find(t => t.id === it.inventory_balance_id)
        return ton && Number(it.so_luong_thuc_te) === Number(ton.ton_luong)
      })) {
        message.warning('Chưa có chênh lệch tồn kho')
        return
      }
      createMut.mutate({
        warehouse_id: v.warehouse_id,
        ngay: v.ngay.format('YYYY-MM-DD'),
        ly_do: v.ly_do || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch {
      // Form validation is displayed inline.
    }
  }

  const handlePrintAdjustment = (r: StockAdjustment) => {
    const cols = [
      { header: 'Tên hàng' },
      { header: 'ĐVT', align: 'center' as const },
      { header: 'Sổ sách', align: 'right' as const },
      { header: 'Thực tế', align: 'right' as const },
      { header: 'Chênh lệch', align: 'right' as const },
    ]
    const rowData = r.items.map((it: any) => [
      it.ten_hang,
      it.don_vi,
      fmtNum(it.so_luong_so_sach),
      fmtNum(it.so_luong_thuc_te),
      fmtNum(it.chenhlech),
    ])
    printDocument({
      title: `Biên bản kiểm kê ${r.so_phieu}`,
      subtitle: 'BIÊN BẢN KIỂM KÊ TỒN KHO',
      companyInfo,
      documentNumber: r.so_phieu,
      documentDate: r.ngay ?? '',
      fields: [
        { label: 'Kho kiểm kê', value: r.ten_kho ?? '—' },
        { label: 'Lý do', value: r.ly_do ?? '—' },
        { label: 'Ghi chú', value: r.ghi_chu ?? '—' },
      ],
      bodyHtml: buildHtmlTable(cols, rowData),
    })
  }

  const handleExportExcel = () => {
    const allRows: any[] = []
    phieuList.forEach((r: StockAdjustment) => {
      r.items.forEach((it: any) => {
        allRows.push([r.so_phieu, r.ngay, r.ten_kho ?? '', it.ten_hang, it.don_vi, it.so_luong_so_sach, it.so_luong_thuc_te, it.chenhlech, r.ly_do ?? ''])
      })
    })
    exportToExcel(`KiemKe_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Kiểm kê',
      headers: ['Số phiếu', 'Ngày', 'Kho', 'Tên hàng', 'ĐVT', 'Sổ sách', 'Thực tế', 'Chênh lệch', 'Lý do'],
      rows: allRows,
      colWidths: [18, 12, 18, 28, 8, 12, 12, 12, 20],
    }])
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 150, render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay', width: 110 },
    { title: 'Kho', dataIndex: 'ten_kho', width: 180 },
    { title: 'Lý do', dataIndex: 'ly_do', render: (v: string | null) => v || '—' },
    {
      title: 'Chênh lệch', width: 130, align: 'right' as const,
      render: (_: unknown, r: StockAdjustment) => {
        const total = r.items.reduce((s, it) => s + it.chenhlech, 0)
        return <Text strong style={{ color: diffColor(total) }}>{fmtNum(total)}</Text>
      },
    },
    { title: 'TT', dataIndex: 'trang_thai', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '', width: 80,
      render: (_: unknown, r: StockAdjustment) => (
        <Space size={4}>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintAdjustment(r)} />
          <Popconfirm title="Xoa phieu kiem ke nay?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: StockAdjustment) => (
    <Table dataSource={r.items} rowKey="id" size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'don_vi', width: 70 },
        { title: 'Sổ sách', dataIndex: 'so_luong_so_sach', width: 110, align: 'right' as const, render: fmtNum },
        { title: 'Thực tế', dataIndex: 'so_luong_thuc_te', width: 110, align: 'right' as const, render: fmtNum },
        { title: 'Chênh lệch', dataIndex: 'chenhlech', width: 110, align: 'right' as const, render: (v: number) => <Text style={{ color: diffColor(v) }}>{fmtNum(v)}</Text> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><AuditOutlined style={{ fontSize: 20, color: '#1677ff' }} /><Title level={4} style={{ margin: 0 }}>Kiểm kê / điều chỉnh tồn</Title></Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setSelectedKho(undefined); setOpen(true) }}>
              Tạo phiếu kiểm kê
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={8}>
            <Select placeholder="Kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={warehouses.map(w => ({ value: w.id, label: w.ten_kho }))} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Tu ngay" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Den ngay" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={phieuList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 850 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu kiểm kê / điều chỉnh tồn" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay: dayjs(), items: [] }}>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Nhập số lượng thực tế sau kiểm kê. Hệ thống sẽ tự động tăng/giảm tồn và lưu lịch sử giao dịch điều chỉnh." />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho kiểm kê" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chon kho"
                  options={activeWarehouses.map(w => ({ value: w.id, label: w.ten_kho }))}
                  onChange={(v: number) => { setSelectedKho(v); form.setFieldValue('items', []) }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay" label="Ngày kiểm kê" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ly_do" label="Lý do">
                <Input placeholder="Kiểm kê định kỳ, lệch kho..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          {!selectedKho && (
            <div style={{ color: '#faad14', marginBottom: 12, fontSize: 13 }}>
              Chọn kho trước để lấy danh sách tồn kho.
            </div>
          )}

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Text strong>Danh sách mặt hàng kiểm kê</Text>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    disabled={!selectedKho}
                    onClick={() => add({})}>
                    Thêm dòng
                  </Button>
                </Row>

                {fields.map(({ key, name }) => {
                  const items = form.getFieldValue('items') || []
                  const item = items[name] || {}
                  const selected: TonKho | undefined = tonKho.find(t => t.id === item.inventory_balance_id)
                  const soSach = Number(item.so_luong_so_sach ?? selected?.ton_luong ?? 0)
                  const thucTe = Number(item.so_luong_thuc_te ?? soSach)
                  const chenhLech = thucTe - soSach

                  return (
                    <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                      <Row gutter={[8, 4]}>
                        <Col span={15}>
                          <Form.Item name={[name, 'inventory_balance_id']} label="Mặt hàng"
                            rules={[{ required: true, message: 'Chọn mặt hàng' }]} style={{ marginBottom: 4 }}>
                            <Select size="small" showSearch placeholder="Chọn từ tồn kho..."
                              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                              options={tonKho.map(t => ({
                                value: t.id,
                                label: `${t.ten_hang} - ton: ${fmtNum(t.ton_luong)} ${t.don_vi}`,
                              }))}
                              onChange={id => handleTonKhoSelect(name, id)}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item name={[name, 'don_vi']} label="DVT" style={{ marginBottom: 4 }}>
                            <Input size="small" readOnly style={{ background: '#f5f5f5' }} />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="Chenh lech" style={{ marginBottom: 4 }}>
                            <Text strong style={{ color: diffColor(chenhLech) }}>{fmtNum(chenhLech)}</Text>
                          </Form.Item>
                        </Col>
                        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                          <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                        </Col>

                        <Col span={8}>
                          <Form.Item name={[name, 'so_luong_so_sach']} label="Sổ sách" style={{ marginBottom: 4 }}>
                            <InputNumber size="small" readOnly style={{ width: '100%', background: '#f5f5f5' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'so_luong_thuc_te']} label="Thực tế"
                            rules={[{ required: true, message: 'Nhập số lượng' }]} style={{ marginBottom: 4 }}>
                            <InputNumber size="small" min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                            <Input size="small" placeholder="..." />
                          </Form.Item>
                        </Col>
                        <Form.Item name={[name, 'ten_hang']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'don_gia']} hidden><Input /></Form.Item>
                      </Row>
                    </Card>
                  )
                })}

                {fields.length === 0 && selectedKho && tonKho.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#bbb', padding: 24 }}>Kho này chưa có tồn kho</div>
                )}
                {fields.length === 0 && selectedKho && tonKho.length > 0 && (
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>
                    Thêm dòng kiểm kê
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  )
}
