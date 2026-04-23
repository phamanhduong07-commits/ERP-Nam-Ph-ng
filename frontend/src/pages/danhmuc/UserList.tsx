import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Table, Input, Select, Tag, Typography, Row, Col, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { usersApi, type NhanVien } from '../../api/usersApi'

const { Title } = Typography

const PHAN_XUONG_OPTIONS = [
  { value: 'in', label: 'In' },
  { value: 'boi_va_cat', label: 'Bồi và cắt' },
  { value: 'song', label: 'Sóng' },
  { value: 'thanh_pham', label: 'Thành phẩm' },
  { value: 'kinh_doanh', label: 'Kinh doanh' },
  { value: 'ke_toan', label: 'Kế toán' },
  { value: 'quan_ly', label: 'Quản lý' },
]

export default function UserList() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterPhanXuong, setFilterPhanXuong] = useState<string | undefined>(undefined)

  const { data = [], isLoading } = useQuery({
    queryKey: ['users', search, filterPhanXuong],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        phan_xuong: filterPhanXuong,
      }).then(r => r.data),
  })

  const columns: ColumnsType<NhanVien> = [
    { title: 'Họ tên', dataIndex: 'ho_ten', width: 180 },
    { title: 'Username', dataIndex: 'username', width: 130 },
    {
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'SĐT',
      dataIndex: 'so_dien_thoai',
      width: 120,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role_name',
      width: 130,
      render: (v: string) => <Tag color="geekblue">{v}</Tag>,
    },
    {
      title: 'Phân xưởng',
      dataIndex: 'phan_xuong',
      width: 130,
      render: (v: string | null) => {
        if (!v) return '—'
        return PHAN_XUONG_OPTIONS.find(o => o.value === v)?.label ?? v
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Danh sách nhân viên</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm tên, username..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => setSearch(v)}
                allowClear
                style={{ width: 220 }}
              />
              <Select
                placeholder="Lọc theo phân xưởng"
                allowClear
                style={{ width: 180 }}
                value={filterPhanXuong}
                onChange={v => setFilterPhanXuong(v)}
                options={PHAN_XUONG_OPTIONS}
              />
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
