import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  message, Row, Space, Table, Tag, Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionPlansApi, AvailableItem, PlanLineCreate,
  calcSoDao, calcKhoTT,
} from '../../api/productionPlans'

const { Text, Title } = Typography

interface SelectedLine extends AvailableItem {
  ngay_chay: string | null
  kho1_edit: number | null       // kho1 (người dùng có thể sửa)
  kho_giay: number | null        // Ch Khổ
  so_dao_calc: number | null     // tính tự động
  kho_tt_calc: number | null     // tính tự động
}

export default function ProductionPlanForm() {
  const navigate = useNavigate()
  const [ngayKeHoach, setNgayKeHoach] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [ghiChu, setGhiChu] = useState('')
  const [searchAvail, setSearchAvail] = useState('')
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([])

  const { data: availItems = [], isLoading: loadingAvail } = useQuery({
    queryKey: ['available-items', searchAvail],
    queryFn: () => productionPlansApi.getAvailableItems({ search: searchAvail }).then(r => r.data),
  })

  // Lọc bỏ những item đã được chọn
  const notYetSelected = availItems.filter(
    ai => !selectedLines.some(sl => sl.production_order_item_id === ai.production_order_item_id)
  )

  const addToSelected = (item: AvailableItem) => {
    setSelectedLines(prev => [
      ...prev,
      {
        ...item,
        ngay_chay: null,
        kho1_edit: item.kho1_tinh_toan ? Number(item.kho1_tinh_toan) : null,
        kho_giay: null,
        so_dao_calc: null,
        kho_tt_calc: null,
      },
    ])
  }

  const removeSelected = (id: number) => {
    setSelectedLines(prev => prev.filter(l => l.production_order_item_id !== id))
  }

  const updateLine = (id: number, patch: Partial<SelectedLine>) => {
    setSelectedLines(prev => prev.map(l => {
      if (l.production_order_item_id !== id) return l
      const updated = { ...l, ...patch }
      // Recalculate so_dao and kho_tt
      const soDao = calcSoDao(updated.kho_giay, updated.kho1_edit)
      const khoTT = calcKhoTT(updated.kho1_edit, soDao)
      return { ...updated, so_dao_calc: soDao, kho_tt_calc: khoTT }
    }))
  }

  const createMut = useMutation({
    mutationFn: () => {
      if (!ngayKeHoach) throw new Error('Chọn ngày kế hoạch')
      const lines: PlanLineCreate[] = selectedLines.map((l, i) => ({
        production_order_item_id: l.production_order_item_id,
        thu_tu: i + 1,
        ngay_chay: l.ngay_chay,
        kho1: l.kho1_edit,
        kho_giay: l.kho_giay,
        so_dao: l.so_dao_calc,
        so_luong_ke_hoach: l.so_luong_ke_hoach,
      }))
      return productionPlansApi.create({
        ngay_ke_hoach: ngayKeHoach,
        ghi_chu: ghiChu || undefined,
        lines,
      })
    },
    onSuccess: (res) => {
      message.success(`Đã tạo kế hoạch ${res.data.so_ke_hoach}`)
      navigate(`/production/plans?id=${res.data.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo kế hoạch'),
  })

  // Cột bảng available items
  const availCols: ColumnsType<AvailableItem> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 115,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 110,
      ellipsis: true,
      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string, r: AvailableItem) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{v}</Text>
          {r.loai_thung && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.loai_thung} {r.so_lop}L {r.to_hop_song} · {r.dai}×{r.rong}×{r.cao}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'SL',
      dataIndex: 'so_luong_ke_hoach',
      width: 75,
      align: 'right' as const,
      render: (v: number) => new Intl.NumberFormat('vi-VN').format(Number(v)),
    },
    {
      title: 'Giao',
      dataIndex: 'ngay_giao_hang',
      width: 80,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM') : '—',
    },
    {
      title: 'Kho1',
      dataIndex: 'kho1_tinh_toan',
      width: 65,
      align: 'right' as const,
      render: (v: number | null) => v ? Number(v).toFixed(1) : <Text type="secondary">—</Text>,
    },
    {
      title: '',
      width: 55,
      render: (_: unknown, r: AvailableItem) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<PlusOutlined />}
          onClick={() => addToSelected(r)}
        />
      ),
    },
  ]

  // Cột bảng selected lines
  const selectedCols: ColumnsType<SelectedLine> = [
    {
      title: '#',
      width: 36,
      render: (_: unknown, __: SelectedLine, i: number) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{i + 1}</Text>
      ),
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 115,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Tên hàng / Khách',
      ellipsis: true,
      render: (_: unknown, r: SelectedLine) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{r.ten_hang}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.ten_khach_hang || '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'SL',
      dataIndex: 'so_luong_ke_hoach',
      width: 75,
      align: 'right' as const,
      render: (v: number) => new Intl.NumberFormat('vi-VN').format(Number(v)),
    },
    {
      title: 'Ngày chạy',
      width: 120,
      render: (_: unknown, r: SelectedLine) => (
        <DatePicker
          size="small"
          style={{ width: 110 }}
          format="DD/MM/YYYY"
          value={r.ngay_chay ? dayjs(r.ngay_chay) : null}
          onChange={d => updateLine(r.production_order_item_id, {
            ngay_chay: d ? d.format('YYYY-MM-DD') : null,
          })}
        />
      ),
    },
    {
      title: 'Kho1 (cm)',
      width: 85,
      render: (_: unknown, r: SelectedLine) => (
        <InputNumber
          size="small"
          style={{ width: 78 }}
          value={r.kho1_edit ?? undefined}
          min={0}
          step={0.1}
          placeholder="cm"
          onChange={v => updateLine(r.production_order_item_id, { kho1_edit: v ?? null })}
        />
      ),
    },
    {
      title: 'Ch Khổ (cm)',
      width: 100,
      render: (_: unknown, r: SelectedLine) => (
        <InputNumber
          size="small"
          style={{ width: 88 }}
          value={r.kho_giay ?? undefined}
          min={0}
          step={10}
          placeholder="Khổ giấy"
          onChange={v => updateLine(r.production_order_item_id, { kho_giay: v ?? null })}
        />
      ),
    },
    {
      title: 'Số dao',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, r: SelectedLine) =>
        r.so_dao_calc !== null
          ? <Tag color="blue">{r.so_dao_calc}</Tag>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'KhổTT (cm)',
      width: 85,
      align: 'right' as const,
      render: (_: unknown, r: SelectedLine) =>
        r.kho_tt_calc !== null
          ? <Text>{r.kho_tt_calc.toFixed(1)}</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: '',
      width: 45,
      render: (_: unknown, r: SelectedLine) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeSelected(r.production_order_item_id)}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Tạo kế hoạch sản xuất mới</Title>
      </Space>

      {/* Thông tin chung */}
      <Card size="small" title="Thông tin kế hoạch" style={{ marginBottom: 12 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item label="Ngày kế hoạch" required style={{ marginBottom: 0 }}>
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                value={dayjs(ngayKeHoach)}
                onChange={d => setNgayKeHoach(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16}>
            <Form.Item label="Ghi chú" style={{ marginBottom: 0 }}>
              <Input
                value={ghiChu}
                onChange={e => setGhiChu(e.target.value)}
                placeholder="Ghi chú kế hoạch..."
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Row gutter={12}>
        {/* Panel trái: LSX available */}
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={`Chọn lệnh sản xuất (${notYetSelected.length})`}
            style={{ height: '100%' }}
          >
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm số LSX, tên hàng..."
              value={searchAvail}
              onChange={e => setSearchAvail(e.target.value)}
              allowClear
              style={{ marginBottom: 8 }}
            />
            <Table<AvailableItem>
              rowKey="production_order_item_id"
              dataSource={notYetSelected}
              columns={availCols}
              loading={loadingAvail}
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
              scroll={{ x: 540 }}
            />
          </Card>
        </Col>

        {/* Panel phải: Dòng đã chọn */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={
              <Space>
                <span>Kế hoạch</span>
                {selectedLines.length > 0 && (
                  <Tag color="blue">{selectedLines.length} dòng</Tag>
                )}
              </Space>
            }
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Nhập Ch Khổ → Số dao tự tính
              </Text>
            }
          >
            {selectedLines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#bbb' }}>
                Nhấn + ở bảng bên trái để thêm lệnh SX
              </div>
            ) : (
              <Table<SelectedLine>
                rowKey="production_order_item_id"
                dataSource={selectedLines}
                columns={selectedCols}
                size="small"
                pagination={false}
                scroll={{ x: 720 }}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong>Tổng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong>
                        {new Intl.NumberFormat('vi-VN').format(
                          selectedLines.reduce((s, l) => s + Number(l.so_luong_ke_hoach), 0)
                        )}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={6} />
                  </Table.Summary.Row>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Nút lưu */}
      <Card size="small" style={{ marginTop: 12, textAlign: 'center' }}>
        <Space>
          <Button onClick={() => navigate('/production/plans')}>Hủy</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={createMut.isPending}
            disabled={selectedLines.length === 0}
            onClick={() => createMut.mutate()}
          >
            Lưu kế hoạch ({selectedLines.length} dòng)
          </Button>
        </Space>
      </Card>
    </div>
  )
}
