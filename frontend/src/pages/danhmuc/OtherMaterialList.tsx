import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { otherMaterialsApi, type OtherMaterial, type OtherMaterialCreate } from '../../api/otherMaterials'
import { materialGroupsApi } from '../../api/materialGroups'
import { suppliersApi } from '../../api/suppliers'

const { Title } = Typography

export default function OtherMaterialList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OtherMaterial | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterNhom, setFilterNhom] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['other-materials', search, filterNhom, page],
    queryFn: () =>
      otherMaterialsApi.list({
        search: search || undefined,
        ma_nhom_id: filterNhom,
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  const { data: nhomList = [] } = useQuery({
    queryKey: ['material-groups-all'],
    queryFn: () => materialGroupsApi.all().then(r => r.data),
  })

  const { data: nccList = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: OtherMaterialCreate) => otherMaterialsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-materials'] })
      closeModal()
      message.success('Đã thêm vật tư')
    },
    onError: () => message.error('Lỗi khi thêm vật tư'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OtherMaterialCreate> }) =>
      otherMaterialsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['other-materials'] })
      closeModal()
      message.success('Đã cập nhật vật tư')
    },
    onError: () => message.error('Lỗi khi cập nhật'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true, gia_mua: 0, ton_toi_thieu: 0 })
    setModalOpen(true)
  }

  const openEdit = (row: OtherMaterial) => {
    setEditing(row)
    form.setFieldsValue({ ...row })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: OtherMaterialCreate = {
      ma_chinh: vals.ma_chinh,
      ma_amis: vals.ma_amis || null,
      ten: vals.ten,
      dvt: vals.dvt || '',
      ma_nhom_id: vals.ma_nhom_id,
      gia_mua: vals.gia_mua ?? 0,
      ton_toi_thieu: vals.ton_toi_thieu ?? 0,
      ton_toi_da: vals.ton_toi_da ?? null,
      phan_xuong: vals.phan_xuong || null,
      ma_ncc_id: vals.ma_ncc_id ?? null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  const nhomOptions = nhomList.map(n => ({ value: n.id, label: `${n.ma_nhom} - ${n.ten_nhom}` }))
  const nccOptions = nccList.map(s => ({ value: s.id, label: `${s.ma_ncc} - ${s.ten_viet_tat}` }))

  const columns: ColumnsType<OtherMaterial> = [
    { title: 'Mã chính', dataIndex: 'ma_chinh', width: 110 },
    { title: 'Tên', dataIndex: 'ten', ellipsis: true },
    { title: 'Nhóm', dataIndex: 'ten_nhom', width: 130, render: (v: string) => v ?? '—' },
    { title: 'NCC', dataIndex: 'ten_ncc', width: 130, render: (v: string) => v ?? '—' },
    { title: 'DVT', dataIndex: 'dvt', width: 70 },
    {
      title: 'Giá mua',
      dataIndex: 'gia_mua',
      width: 110,
      align: 'right',
      render: (v: number) => v?.toLocaleString('vi-VN'),
    },
    { title: 'Phân xưởng', dataIndex: 'phan_xuong', width: 120, render: (v: string | null) => v ?? '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 60,
      render: (_: unknown, r: OtherMaterial) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      ),
    },
  ]

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Vật tư khác</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm mã, tên vật tư..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => { setSearch(v); setPage(1) }}
                allowClear
                style={{ width: 210 }}
              />
              <Select
                placeholder="Lọc theo nhóm"
                allowClear
                style={{ width: 190 }}
                value={filterNhom}
                onChange={v => { setFilterNhom(v); setPage(1) }}
                options={nhomOptions}
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm vật tư
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={items}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showTotal: (t) => `Tổng ${t} vật tư`,
            onChange: (p) => setPage(p),
          }}
          onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa vật tư' : 'Thêm vật tư mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={680}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Mã chính" name="ma_chinh" rules={[{ required: true, message: 'Nhập mã chính' }]}>
                <Input disabled={!!editing} placeholder="VD: VT001" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="Tên" name="ten" rules={[{ required: true, message: 'Nhập tên vật tư' }]}>
                <Input placeholder="Tên vật tư" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Mã AMIS" name="ma_amis">
                <Input placeholder="Mã trên hệ thống AMIS" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nhóm" name="ma_nhom_id" rules={[{ required: true, message: 'Chọn nhóm' }]}>
                <Select
                  showSearch
                  placeholder="Chọn nhóm vật tư"
                  options={nhomOptions}
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="NCC" name="ma_ncc_id">
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn nhà cung cấp"
                  options={nccOptions}
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="DVT" name="dvt">
                <Input placeholder="Đơn vị tính (VD: Cái, Kg, Lít...)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Giá mua (VND)" name="gia_mua">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1000}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Tồn tối thiểu" name="ton_toi_thieu">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Tồn tối đa" name="ton_toi_da">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="Không giới hạn" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Phân xưởng" name="phan_xuong">
                <Input placeholder="Phân xưởng sử dụng" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ghi chú" name="ghi_chu">
                <Input placeholder="Ghi chú thêm" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Trạng thái" name="trang_thai" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
