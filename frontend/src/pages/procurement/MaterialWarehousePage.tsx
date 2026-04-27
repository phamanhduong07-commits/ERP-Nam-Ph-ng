import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Table, Input, Select, Typography, Row, Col, Statistic, Space, Tag,
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { procurementApi } from '../../api/procurement'
import type { MaterialInventoryRow } from '../../api/procurement'
import { warehousesApi } from '../../api/warehouses'

const { Title } = Typography

export default function MaterialWarehousePage() {
  const [search, setSearch] = useState('')
  const [loai, setLoai] = useState<string | undefined>()
  const [warehouseId, setWarehouseId] = useState<number | undefined>()

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['material-inventory', warehouseId, loai, search],
    queryFn: () => procurementApi.getMaterialInventory({
      warehouse_id: warehouseId,
      loai,
      search,
    }).then(r => r.data),
  })

  const tongTon = inventory.reduce((s, r) => s + Number(r.ton_luong), 0)
  const tongGiaTri = inventory.reduce((s, r) => s + Number(r.gia_tri_ton), 0)

  const columns: ColumnsType<MaterialInventoryRow> = [
    {
      title: 'Mã NL',
      dataIndex: 'ma_nguyen_lieu',
      width: 120,
    },
    {
      title: 'Tên nguyên liệu',
      dataIndex: 'ten_nguyen_lieu',
      ellipsis: true,
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 110,
      render: v => v === 'giay_cuon'
        ? <Tag color="blue">Giấy cuộn</Tag>
        : <Tag color="orange">Hàng khác</Tag>,
    },
    {
      title: 'ĐVT',
      dataIndex: 'dvt',
      width: 70,
    },
    {
      title: 'Tồn lượng',
      dataIndex: 'ton_luong',
      width: 120,
      align: 'right',
      render: v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
    },
    {
      title: 'Đ.giá BQ',
      dataIndex: 'don_gia_binh_quan',
      width: 130,
      align: 'right',
      render: v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
    },
    {
      title: 'Giá trị tồn (đ)',
      dataIndex: 'gia_tri_ton',
      width: 140,
      align: 'right',
      render: v => Number(v).toLocaleString('vi-VN'),
    },
  ]

  return (
    <Card
      size="small"
      title={<Title level={5} style={{ margin: 0 }}>Kho nguyên liệu — Sổ tổng hợp</Title>}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic
            title="Số loại NL"
            value={inventory.length}
            suffix="loại"
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Tổng tồn (kg/cái)"
            value={tongTon}
            precision={3}
            formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Tổng giá trị (đ)"
            value={tongGiaTri}
            formatter={v => Number(v).toLocaleString('vi-VN')}
          />
        </Col>
      </Row>

      <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm theo mã, tên..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            size="small"
          />
        </Col>
        <Col span={5}>
          <Select
            placeholder="Loại nguyên liệu"
            allowClear
            size="small"
            style={{ width: '100%' }}
            value={loai}
            onChange={setLoai}
            options={[
              { value: 'giay_cuon', label: 'Giấy cuộn' },
              { value: 'khac', label: 'Hàng khác' },
            ]}
          />
        </Col>
        <Col span={7}>
          <Select
            placeholder="Lọc theo kho"
            allowClear
            size="small"
            style={{ width: '100%' }}
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses?.map(w => ({ value: w.id, label: w.ten_kho }))}
          />
        </Col>
      </Row>

      <Table
        size="small"
        rowKey="ma_nguyen_lieu"
        columns={columns}
        dataSource={inventory}
        loading={isLoading}
        pagination={{ pageSize: 50, showTotal: t => `${t} nguyên liệu` }}
        scroll={{ x: 750 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4} align="right">
              <strong>Tổng:</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{tongTon.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="right">
              <strong>{tongGiaTri.toLocaleString('vi-VN')}</strong>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Card>
  )
}
