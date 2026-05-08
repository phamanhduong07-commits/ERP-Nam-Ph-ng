import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Row, Select, Input, Spin, Table, Tag, Tooltip, Typography, Space, Statistic, Tabs, message,
} from 'antd'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND, fmtNum } from '../../utils/exportUtils'
import ImportExcelDialog from '../../components/ImportExcelDialog'
import { PlusOutlined, DatabaseOutlined, FileExcelOutlined, FilePdfOutlined, WarningOutlined, UploadOutlined } from '@ant-design/icons'
import { warehouseApi, PhanXuongWithWarehouses, WarehouseSlot, TonKho } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const LOAI_LABELS: Record<string, string> = {
  GIAY_CUON: 'Giấy cuộn', NVL_PHU: 'NVL phụ', PHOI: 'Phôi sóng', THANH_PHAM: 'Thành phẩm',
}
const ALL_LOAI = ['GIAY_CUON', 'NVL_PHU', 'PHOI', 'THANH_PHAM']

function fmtMoney(v: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + 'đ'
}

function getSlot(px: PhanXuongWithWarehouses, loai: string): WarehouseSlot | null | undefined {
  const slot = (px.warehouses as any)[loai]
  if (slot && 'not_applicable' in slot) return null
  return slot as WarehouseSlot | null
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('tong-hop')
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [warehouseId, setWarehouseId] = useState<number | undefined>()
  const [loai, setLoai] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [importVisible, setImportVisible] = useState(false)

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: khoTheoXuong = [], isLoading: loadingXuong } = useQuery({
    queryKey: ['kho-theo-xuong'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data),
    enabled: activeTab === 'theo-xuong',
  })

  const { data: tonKho = [], isLoading } = useQuery({
    queryKey: ['ton-kho', phanXuongId, warehouseId, loai],
    queryFn: () => warehouseApi.getTonKho({ phan_xuong_id: phanXuongId, warehouse_id: warehouseId, loai }).then(r => r.data),
    refetchInterval: 60_000,
  })

  const filteredWarehouses = phanXuongId
    ? warehouses.filter((w: any) => w.phan_xuong_id === phanXuongId)
    : warehouses

  const filtered = search
    ? tonKho.filter(r => r.ten_hang.toLowerCase().includes(search.toLowerCase()))
    : tonKho

  const thieu = filtered.filter(r => r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0)
  const tongGiaTri = filtered.reduce((s, r) => s + r.gia_tri_ton, 0)

  const handleExportExcel = () => {
    exportToExcel(`TonKho_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Tồn kho',
      headers: ['STT', 'Tên hàng', 'Kho', 'Tồn kho', 'ĐVT', 'Tồn tối thiểu', 'Đơn giá BQ', 'Giá trị tồn'],
      rows: filtered.map((r, i) => [
        i + 1, r.ten_hang, r.ten_kho,
        Number(r.ton_luong), r.don_vi,
        r.ton_toi_thieu > 0 ? Number(r.ton_toi_thieu) : '',
        r.don_gia_binh_quan > 0 ? Number(r.don_gia_binh_quan) : '',
        Number(r.gia_tri_ton),
      ]),
      colWidths: [5, 35, 18, 12, 8, 14, 14, 16],
    }])
  }

  const handleExportPdf = () => {
    const cols = [
      { header: 'STT', align: 'center' as const },
      { header: 'Tên hàng' },
      { header: 'Kho' },
      { header: 'Tồn kho', align: 'right' as const },
      { header: 'ĐVT', align: 'center' as const },
      { header: 'Đơn giá BQ', align: 'right' as const },
      { header: 'Giá trị tồn', align: 'right' as const },
    ]
    const rows = filtered.map((r, i) => [
      i + 1, r.ten_hang, r.ten_kho,
      fmtNum(r.ton_luong), r.don_vi,
      r.don_gia_binh_quan > 0 ? fmtVND(r.don_gia_binh_quan) : '—',
      fmtVND(r.gia_tri_ton),
    ])
    printToPdf(
      'Báo cáo tồn kho',
      `<h2>BÁO CÁO TỒN KHO</h2>
       <p class="meta">Xuất ngày: ${dayjs().format('DD/MM/YYYY HH:mm')} — ${filtered.length} mặt hàng | Tổng giá trị: ${fmtVND(tongGiaTri)}đ</p>
       ${buildHtmlTable(cols, rows, {
         totalRow: ['', 'TỔNG CỘNG', '', '', '', '', fmtVND(tongGiaTri) + 'đ'],
       })}`,
      true,
    )
  }

  const columns = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      render: (v: string, r: TonKho) => (
        <Space>
          <Text strong>{v}</Text>
          {r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 && (
            <WarningOutlined style={{ color: '#ff4d4f' }} />
          )}
        </Space>
      ),
    },
    { title: 'Kho', dataIndex: 'ten_kho', width: 160 },
    {
      title: 'Tồn kho',
      dataIndex: 'ton_luong',
      width: 120,
      align: 'right' as const,
      render: (v: number, r: TonKho) => (
        <Text strong style={{ color: v < r.ton_toi_thieu && r.ton_toi_thieu > 0 ? '#ff4d4f' : '#1677ff' }}>
          {v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 70 },
    {
      title: 'Tồn tối thiểu',
      dataIndex: 'ton_toi_thieu',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Đơn giá BQ',
      dataIndex: 'don_gia_binh_quan',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ' : '—',
    },
    {
      title: 'Giá trị tồn',
      dataIndex: 'gia_tri_ton',
      width: 140,
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: '#52c41a' }}>
          {v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ
        </Text>
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'cap_nhat_luc',
      width: 130,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('vi-VN') : '—',
    },
  ]

  const xuongColumns = [
    { title: 'Xưởng', dataIndex: 'ten_xuong', width: 160, render: (v: string, r: PhanXuongWithWarehouses) =>
      <Space><Tag color={r.cong_doan === 'cd1_cd2' ? 'blue' : 'green'}>{r.cong_doan === 'cd1_cd2' ? 'CD1+2' : 'CD2'}</Tag><span>{v}</span></Space>,
    },
    ...ALL_LOAI.map(loai => ({
      title: LOAI_LABELS[loai],
      key: loai,
      width: 170,
      render: (_: unknown, px: PhanXuongWithWarehouses) => {
        const slot = getSlot(px, loai)
        if (slot === null) return <Tag color="default">N/A</Tag>
        if (!slot) return <Tag color="orange">Chưa tạo</Tag>
        return (
          <div>
            <div style={{ fontSize: 12, color: '#555' }}>{slot.tong_so_luong.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} {slot.don_vi_suc_chua ?? ''}</div>
            <div style={{ color: '#52c41a', fontSize: 12 }}>{fmtMoney(slot.tong_gia_tri)}</div>
          </div>
        )
      },
    })),
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Space>
            <DatabaseOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Tồn kho</Title>
          </Space>
        </Col>
        <Col>
          <Space size={4}>
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                if (!warehouseId) {
                  return message.warning('Vui lòng chọn kho để import tồn kho đầu kỳ')
                }
                setImportVisible(true)
              }}
            >
              Import tồn đầu
            </Button>
            <Tooltip title="Xuất Excel">
              <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} />
            </Tooltip>
            <Tooltip title="Xuất PDF">
              <Button size="small" icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf} />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 0 }}
        items={[
          { key: 'tong-hop', label: 'Tổng hợp' },
          { key: 'theo-xuong', label: 'Theo xưởng' },
        ]}
      />

      {activeTab === 'theo-xuong' && (
        <Card size="small" styles={{ body: { padding: 0 } }} style={{ marginTop: 8 }}>
          <Table
            dataSource={khoTheoXuong as PhanXuongWithWarehouses[]}
            columns={xuongColumns}
            rowKey="id"
            loading={loadingXuong}
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          />
        </Card>
      )}

      {activeTab === 'tong-hop' && <>

      {/* Thống kê nhanh */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic title="Tổng mặt hàng" value={filtered.length} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="Cần nhập thêm"
              value={thieu.length}
              valueStyle={{ color: thieu.length > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={thieu.length > 0 ? <WarningOutlined /> : undefined}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={8}>
          <Card size="small">
            <Statistic
              title="Tổng giá trị tồn"
              value={tongGiaTri}
              valueStyle={{ color: '#52c41a' }}
              formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Tất cả xưởng"
              style={{ width: '100%' }}
              allowClear
              value={phanXuongId}
              onChange={v => { setPhanXuongId(v); setWarehouseId(undefined) }}
              options={phanXuongs.map((x: any) => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Tất cả kho"
              style={{ width: '100%' }}
              allowClear
              value={warehouseId}
              onChange={setWarehouseId}
              options={filteredWarehouses.filter((w: any) => w.trang_thai).map((w: any) => ({ value: w.id, label: w.ten_kho }))}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Loại vật tư"
              style={{ width: '100%' }}
              allowClear
              value={loai}
              onChange={setLoai}
              options={[
                { value: 'giay', label: 'Nguyên liệu giấy' },
                { value: 'khac', label: 'Nguyên liệu khác' },
              ]}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Input.Search
              placeholder="Tìm tên hàng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {isLoading ? (
        <Spin style={{ margin: 40, display: 'block' }} />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: true }}
            scroll={{ x: 900 }}
            rowClassName={(r: TonKho) =>
              r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 ? 'ant-table-row-danger' : ''
            }
          />
        </Card>
      )}

      {thieu.length > 0 && (
        <Card
          size="small"
          style={{ marginTop: 12, borderColor: '#ffbb96', background: '#fff2e8' }}
          title={<Space><WarningOutlined style={{ color: '#fa541c' }} /><Text strong style={{ color: '#fa541c' }}>Cần nhập thêm ({thieu.length} mặt hàng)</Text></Space>}
        >
          <Row gutter={[8, 8]}>
            {thieu.map(r => (
              <Col key={r.id} xs={24} sm={12} md={8}>
                <Tag color="red" style={{ width: '100%', padding: '4px 8px' }}>
                  {r.ten_hang} — tồn: {r.ton_luong.toFixed(2)} / min: {r.ton_toi_thieu.toFixed(2)} {r.don_vi}
                </Tag>
              </Col>
            ))}
          </Row>
        </Card>
      )}
      </>}

      <ImportExcelDialog
        title={`Import tồn kho đầu kỳ - ${warehouses.find(w => w.id === warehouseId)?.ten_kho}`}
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['ton-kho'] })}
        importFn={(file, commit) => warehouseApi.importInventory(warehouseId!, file, commit)}
        templateUrl="/api/warehouse/inventory/import-template"
      />
    </div>
  )
}
