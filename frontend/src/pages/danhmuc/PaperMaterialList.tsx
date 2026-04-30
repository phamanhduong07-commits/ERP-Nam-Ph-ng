import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Typography, Row, Col, Switch, Tabs,
} from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { paperMaterialsFullApi, type PaperMaterial, type PaperMaterialCreate } from '../../api/paperMaterials'
import { materialGroupsApi } from '../../api/materialGroups'
import { suppliersApi } from '../../api/suppliers'

const { Title } = Typography

export default function PaperMaterialList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PaperMaterial | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterNhom, setFilterNhom] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['paper-materials', search, filterNhom, page],
    queryFn: () =>
      paperMaterialsFullApi.list({
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

  const { data: nsxList = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: PaperMaterialCreate) => paperMaterialsFullApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-materials'] })
      closeModal()
      message.success('Đã thêm nguyên liệu giấy')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm nguyên liệu giấy'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaperMaterialCreate> }) =>
      paperMaterialsFullApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-materials'] })
      closeModal()
      message.success('Đã cập nhật nguyên liệu giấy')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true, la_cuon: false, su_dung: true, dvt: 'Kg', gia_mua: 0, gia_ban: 0, ton_toi_thieu: 0 })
    setModalOpen(true)
  }

  const openEdit = (row: PaperMaterial) => {
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
    const payload: PaperMaterialCreate = {
      ma_chinh: vals.ma_chinh,
      ma_amis: vals.ma_amis || null,
      ma_nhom_id: vals.ma_nhom_id,
      ten: vals.ten,
      ten_viet_tat: vals.ten_viet_tat || null,
      dvt: vals.dvt || 'Kg',
      kho: vals.kho ?? null,
      ma_ky_hieu: vals.ma_ky_hieu || null,
      dinh_luong: vals.dinh_luong ?? null,
      ma_nsx_id: vals.ma_nsx_id ?? null,
      gia_mua: vals.gia_mua ?? 0,
      gia_ban: vals.gia_ban ?? 0,
      ton_toi_thieu: vals.ton_toi_thieu ?? 0,
      ton_toi_da: vals.ton_toi_da ?? null,
      la_cuon: vals.la_cuon ?? false,
      su_dung: vals.su_dung ?? true,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  const nhomOptions = nhomList.map(n => ({ value: n.id, label: `${n.ma_nhom} - ${n.ten_nhom}` }))
  const nsxOptions = nsxList.map(s => ({ value: s.id, label: `${s.ma_ncc} - ${s.ten_viet_tat}` }))

  const columns: ColumnsType<PaperMaterial> = [
    { title: 'Mã chính', dataIndex: 'ma_chinh', width: 110 },
    { title: 'Tên', dataIndex: 'ten', ellipsis: true },
    { title: 'Mã KH', dataIndex: 'ma_ky_hieu', width: 90, render: (v: string | null) => v ?? '—' },
    {
      title: 'ĐL (g/m²)',
      dataIndex: 'dinh_luong',
      width: 90,
      align: 'right',
      render: (v: number | null) => v ?? '—',
    },
    {
      title: 'Khổ (cm)',
      dataIndex: 'kho',
      width: 80,
      align: 'right',
      render: (v: number | null) => v ?? '—',
    },
    { title: 'Nhóm', dataIndex: 'ten_nhom', width: 130, render: (v: string) => v ?? '—' },
    { title: 'NSX', dataIndex: 'ten_nsx', width: 130, render: (v: string) => v ?? '—' },
    {
      title: 'Giá mua',
      dataIndex: 'gia_mua',
      width: 110,
      align: 'right',
      render: (v: number) => v?.toLocaleString('vi-VN'),
    },
    {
      title: 'Sử dụng',
      dataIndex: 'su_dung',
      width: 90,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 60,
      render: (_: unknown, r: PaperMaterial) => (
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
            <Title level={4} style={{ margin: 0 }}>Nguyên liệu giấy</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm mã, tên..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => { setSearch(v); setPage(1) }}
                allowClear
                style={{ width: 200 }}
              />
              <Select
                placeholder="Lọc theo nhóm"
                allowClear
                style={{ width: 200 }}
                value={filterNhom}
                onChange={v => { setFilterNhom(v); setPage(1) }}
                options={nhomOptions}
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm nguyên liệu
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
            showTotal: (t) => `Tổng ${t} nguyên liệu`,
            onChange: (p) => setPage(p),
          }}
          onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa nguyên liệu giấy' : 'Thêm nguyên liệu giấy mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={780}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: '1',
                label: 'Thông tin chung',
                children: (
                  <>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item label="Mã chính" name="ma_chinh" rules={[{ required: true, message: 'Nhập mã chính' }]}>
                          <Input disabled={!!editing} placeholder="VD: GIAY001" />
                        </Form.Item>
                      </Col>
                      <Col span={16}>
                        <Form.Item label="Tên" name="ten" rules={[{ required: true, message: 'Nhập tên' }]}>
                          <Input placeholder="Tên nguyên liệu giấy" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item label="Tên viết tắt" name="ten_viet_tat">
                          <Input placeholder="Tên viết tắt" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Mã AMIS" name="ma_amis">
                          <Input placeholder="Mã trên hệ thống AMIS" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={12}>
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
                      <Col span={12}>
                        <Form.Item label="NSX / Nhà cung cấp" name="ma_nsx_id">
                          <Select
                            showSearch
                            allowClear
                            placeholder="Chọn NSX"
                            options={nsxOptions}
                            filterOption={(input, opt) =>
                              (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={12}>
                      <Col span={6}>
                        <Form.Item label="DVT" name="dvt">
                          <Input placeholder="Kg" />
                        </Form.Item>
                      </Col>
                      <Col span={9}>
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
                      <Col span={9}>
                        <Form.Item label="Giá bán (VND)" name="gia_ban">
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            step={1000}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            placeholder="0"
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={12}>
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
                      <Col span={4}>
                        <Form.Item label="Là cuộn" name="la_cuon" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Sử dụng" name="su_dung" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: '2',
                label: 'Kỹ thuật',
                children: (
                  <>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item label="Mã ký hiệu" name="ma_ky_hieu">
                          <Input placeholder="Mã ký hiệu giấy" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Định lượng (g/m²)" name="dinh_luong">
                          <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 112" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Khổ (cm)" name="kho">
                          <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 120" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item label="TC định lượng" name="tc_dinh_luong">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Độ bục TC" name="do_buc_tc">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Độ nén vòng TC" name="do_nen_vong_tc">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item label="Độ cobb TC" name="do_cobb_tc">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Độ dày TC (mm)" name="do_day_tc">
                          <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  )
}
