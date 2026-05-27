import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, Select, Space, Table, Typography, message, Row, Col, TreeSelect
} from 'antd'
import { PlusOutlined, EditOutlined, ApartmentOutlined } from '@ant-design/icons'
import { hrApi, Department } from '../../api/hr'
import { phapNhanApi } from '../../api/phap_nhan'
import { theoDoiApi } from '../../api/theoDoi'

const { Title, Text } = Typography

export default function DepartmentPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Department | null>(null)
  const [form] = Form.useForm()

  // Queries
  const { data: depts = [], isLoading } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => theoDoiApi.listPhanXuong().then((r: unknown) => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: Partial<Department>) => 
      editing?.id ? hrApi.updateDepartment(editing.id, data) : hrApi.createDepartment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-depts'] })
      message.success('Đã lưu phòng ban')
      setEditing(null)
      form.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi lưu dữ liệu'),
  })

  // Convert flat list to tree for TreeSelect
  const buildTree = (list: Department[], parentId: number | null = null): unknown[] => {
    return list
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        value: item.id,
        title: item.ten_bo_phan,
        children: buildTree(list, item.id)
      }))
  }

  const deptTree = buildTree(depts)

  const columns = [
    {
      title: 'Mã bộ phận',
      dataIndex: 'ma_bo_phan',
      width: 150,
      render: (v: string) => <Text strong>{v}</Text>
    },
    {
      title: 'Tên bộ phận / Tổ nhóm',
      dataIndex: 'ten_bo_phan',
      render: (v: string, r: Department) => {
        const isChild = !!r.parent_id
        return <span style={{ paddingLeft: isChild ? 20 : 0 }}>{isChild ? '↳ ' : ''}{v}</span>
      }
    },
    {
      title: 'Xưởng',
      dataIndex: 'phan_xuong_id',
      render: (v: number) => phanXuongList.find((px: { id: number; ten_xuong?: string; [k: string]: unknown }) => px.id === v)?.ten_xuong
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'phap_nhan_id',
      render: (v: number) => phapNhanList.find(pn => pn.id === v)?.ten_viet_tat || phapNhanList.find(pn => pn.id === v)?.ten_phap_nhan
    },
    {
      title: '',
      width: 60,
      render: (_: unknown, r: Department) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setEditing(r)
          form.setFieldsValue(r)
        }} />
      )
    }
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Quản lý Cơ cấu Tổ chức</Title>
          <Text type="secondary">Thiết lập Khối, Phòng ban, Bộ phận và Tổ nhóm sản xuất</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing({} as Parameters<typeof setEditing>[0])
            form.resetFields()
          }}>
            Thêm bộ phận mới
          </Button>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={15}>
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={depts}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={9}>
          <Card title={editing ? (editing.id ? "Chỉnh sửa" : "Thêm mới") : "Sơ đồ tổ chức"} size="small">
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={v => saveMut.mutate(v)}
                initialValues={{ trang_thai: true }}
              >
                <Form.Item name="ma_bo_phan" label="Mã bộ phận" rules={[{ required: true }]}>
                  <Input placeholder="VD: KHOI_SX, TO_IN_HM..." />
                </Form.Item>
                <Form.Item name="ten_bo_phan" label="Tên bộ phận" rules={[{ required: true }]}>
                  <Input placeholder="VD: Khối Sản Xuất, Tổ In Hóc Môn..." />
                </Form.Item>
                <Form.Item name="parent_id" label="Thuộc cấp trên">
                  <TreeSelect
                    showSearch
                    style={{ width: '100%' }}
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    placeholder="Chọn bộ phận cấp trên (nếu có)"
                    allowClear
                    treeDefaultExpandAll
                    treeData={deptTree}
                  />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="phan_xuong_id" label="Gắn với xưởng">
                      <Select 
                        allowClear
                        options={phanXuongList.map((p: unknown) => ({ value: p.id, label: p.ten_xuong }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phap_nhan_id" label="Pháp nhân">
                      <Select 
                        allowClear
                        options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))} 
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="mo_ta" label="Ghi chú">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEditing(null)}>Huỷ</Button>
                  <Button type="primary" onClick={() => form.submit()} loading={saveMut.isPending}>
                    Lưu dữ liệu
                  </Button>
                </Space>
              </Form>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <ApartmentOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                <br />
                <Text type="secondary">Chọn một bộ phận để xem hoặc thêm mới cơ cấu tổ chức theo sơ đồ đã phê duyệt.</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
