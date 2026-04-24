import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, InputNumber, message, Popconfirm,
  Row, Space, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  EditOutlined, ReloadOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { indirectCostsApi, IndirectCostMasterItem } from '../../api/bom'

const { Text, Title } = Typography

const LAY_COUNT_LABEL: Record<number, { color: string; label: string }> = {
  3: { color: 'default', label: '3 lớp' },
  5: { color: 'blue',    label: '5 lớp' },
  7: { color: 'purple',  label: '7 lớp' },
}

export default function IndirectCostList() {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<number | null>(null)
  const [editVal, setEditVal] = useState<number>(0)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['indirect-costs'],
    queryFn: () => indirectCostsApi.list().then(r => r.data),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, val }: { id: number; val: number }) =>
      indirectCostsApi.update(id, { don_gia_m2: val }),
    onSuccess: () => {
      message.success('Đã cập nhật đơn giá')
      setEditId(null)
      qc.invalidateQueries({ queryKey: ['indirect-costs'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const seedMut = useMutation({
    mutationFn: () => indirectCostsApi.seed(),
    onSuccess: () => {
      message.success('Đã reset về mặc định')
      qc.invalidateQueries({ queryKey: ['indirect-costs'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi reset'),
  })

  // Group by so_lop
  const grouped = [3, 5, 7].map(lop => ({
    lop,
    items: items.filter(i => i.so_lop === lop),
    total: items.filter(i => i.so_lop === lop).reduce((s, i) => s + Number(i.don_gia_m2), 0),
  }))

  const cols: ColumnsType<IndirectCostMasterItem> = [
    {
      title: 'STT',
      dataIndex: 'thu_tu',
      width: 55,
      align: 'center',
      render: (v: number) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Khoản mục chi phí',
      dataIndex: 'ten',
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Đơn giá (đ/m²)',
      dataIndex: 'don_gia_m2',
      width: 180,
      align: 'right',
      render: (v: number, r: IndirectCostMasterItem) => {
        if (editId === r.id) {
          return (
            <InputNumber
              size="small"
              style={{ width: 120 }}
              value={editVal}
              min={0}
              step={1}
              autoFocus
              formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              onChange={val => setEditVal(val ?? 0)}
            />
          )
        }
        return (
          <Text strong style={{ fontSize: 13 }}>
            {new Intl.NumberFormat('vi-VN').format(Number(v))} đ/m²
          </Text>
        )
      },
    },
    {
      title: '',
      width: 100,
      render: (_: unknown, r: IndirectCostMasterItem) => {
        if (editId === r.id) {
          return (
            <Space size={4}>
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                loading={updateMut.isPending}
                onClick={() => updateMut.mutate({ id: r.id, val: editVal })}
              >
                Lưu
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setEditId(null)}
              />
            </Space>
          )
        }
        return (
          <Tooltip title="Sửa đơn giá">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditId(r.id)
                setEditVal(Number(r.don_gia_m2))
              }}
            />
          </Tooltip>
        )
      },
    },
  ]

  if (items.length === 0 && !isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Title level={5} type="secondary">Chưa có dữ liệu chi phí gián tiếp</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Bấm "Khởi tạo mặc định" để seed dữ liệu từ hệ thống.
            </Text>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={seedMut.isPending}
              onClick={() => seedMut.mutate()}
            >
              Khởi tạo mặc định
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Chi phí gián tiếp sản xuất</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Đơn giá tính trên m² giấy carton — ảnh hưởng trực tiếp đến giá thành sản phẩm
          </Text>
        </Col>
        <Col>
          <Popconfirm
            title="Reset toàn bộ về giá trị mặc định?"
            description="Mọi thay đổi trước đó sẽ bị mất."
            onConfirm={() => seedMut.mutate()}
            okText="Reset"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<ReloadOutlined />} loading={seedMut.isPending}>
              Reset mặc định
            </Button>
          </Popconfirm>
        </Col>
      </Row>

      <Row gutter={16}>
        {grouped.map(({ lop, items: lopItems, total }) => {
          const info = LAY_COUNT_LABEL[lop]
          return (
            <Col xs={24} lg={8} key={lop} style={{ marginBottom: 16 }}>
              <Card
                size="small"
                title={
                  <Space>
                    <Tag color={info.color} style={{ fontWeight: 700, fontSize: 13 }}>
                      {info.label}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tổng: {new Intl.NumberFormat('vi-VN').format(Math.round(total))} đ/m²
                    </Text>
                  </Space>
                }
              >
                <Table<IndirectCostMasterItem>
                  rowKey="id"
                  dataSource={lopItems}
                  columns={cols}
                  loading={isLoading}
                  size="small"
                  pagination={false}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong>Tổng cộng</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ color: '#1677ff' }}>
                          {new Intl.NumberFormat('vi-VN').format(Math.round(total))} đ/m²
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} />
                    </Table.Summary.Row>
                  )}
                />
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card size="small" style={{ marginTop: 8, background: '#f6ffed', borderColor: '#b7eb8f' }}>
        <Text style={{ fontSize: 12 }}>
          <strong>Lưu ý:</strong> Chi phí gián tiếp = đơn giá × diện tích (m²/thùng).
          Thay đổi đơn giá sẽ áp dụng ngay cho các tính toán BOM mới.
          Dữ liệu BOM đã lưu trước đó không bị ảnh hưởng.
        </Text>
      </Card>
    </div>
  )
}
