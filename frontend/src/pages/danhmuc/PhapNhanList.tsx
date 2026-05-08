import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Drawer, Form, Input, Popconfirm, Select, Space, Switch, Table, Typography, message, Row, Col,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { phapNhanApi, PhapNhan, CreatePhapNhanPayload } from '../../api/phap_nhan'
import { theoDoiApi, PhanXuongItem } from '../../api/theoDoi'
import ImportExcelButton from '../../components/ImportExcelButton'
import MSTLookupButton from '../../components/MSTLookupButton'

const { Title, Text } = Typography

export default function PhapNhanList() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PhapNhan | null>(null)
  const [form] = Form.useForm()
  const [search, setSearch] = useState('')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['phap-nhan', search],
    queryFn: () => phapNhanApi.list({ search: search || undefined }).then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery<PhanXuongItem[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => theoDoiApi.listPhanXuong().then((r: any) => r.data),
    staleTime: 300_000,
  })

  const createMut = useMutation({
    mutationFn: (data: CreatePhapNhanPayload) => phapNhanApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phap-nhan'] })
      message.success('Đã thêm pháp nhân')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePhapNhanPayload }) =>
      phapNhanApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phap-nhan'] })
      message.success('Đã cập nhật pháp nhân')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => phapNhanApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phap-nhan'] })
      message.success('Đã xoá pháp nhân')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setOpen(true)
  }

  const openEdit = (r: PhapNhan) => {
    setEditing(r)
    form.setFieldsValue({
      ma_phap_nhan: r.ma_phap_nhan,
      ten_phap_nhan: r.ten_phap_nhan,
      ten_viet_tat: r.ten_viet_tat,
      ma_so_thue: r.ma_so_thue,
      dia_chi: r.dia_chi,
      so_dien_thoai: r.so_dien_thoai,
      tai_khoan: r.tai_khoan,
      ngan_hang: r.ngan_hang,
      ky_hieu_hd: r.ky_hieu_hd,
      trang_thai: r.trang_thai,
      phoi_phan_xuong_id: r.phoi_phan_xuong_id ?? null,
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const payload: CreatePhapNhanPayload = {
        ma_phap_nhan: v.ma_phap_nhan,
        ten_phap_nhan: v.ten_phap_nhan,
        ten_viet_tat: v.ten_viet_tat || null,
        ma_so_thue: v.ma_so_thue || null,
        dia_chi: v.dia_chi || null,
        so_dien_thoai: v.so_dien_thoai || null,
        tai_khoan: v.tai_khoan || null,
        ngan_hang: v.ngan_hang || null,
        ky_hieu_hd: v.ky_hieu_hd || null,
        trang_thai: v.trang_thai ?? true,
        phoi_phan_xuong_id: v.phoi_phan_xuong_id ?? null,
      }
      if (editing) {
        updateMut.mutate({ id: editing.id, data: payload })
      } else {
        createMut.mutate(payload)
      }
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Mã pháp nhân', dataIndex: 'ma_phap_nhan', width: 140,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Tên pháp nhân', dataIndex: 'ten_phap_nhan', ellipsis: true },
    { title: 'Tên viết tắt', dataIndex: 'ten_viet_tat', width: 140 },
    { title: 'Mã số thuế', dataIndex: 'ma_so_thue', width: 140 },
    { title: 'KH hoá đơn', dataIndex: 'ky_hieu_hd', width: 120 },
    { title: 'SĐT', dataIndex: 'so_dien_thoai', width: 130 },
    { title: 'Hoạt động', dataIndex: 'trang_thai', width: 100, align: 'center' as const,
      render: (v: boolean) => <Switch checked={v} size="small" disabled /> },
    {
      title: '', width: 80,
      render: (_: unknown, r: PhapNhan) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá pháp nhân này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Danh mục pháp nhân</Title>
        </Col>
        <Col>
          <Space>
            <Input.Search
              placeholder="Tìm mã, tên, MST..."
              allowClear
              style={{ width: 220 }}
              onSearch={v => setSearch(v)}
              onChange={e => { if (!e.target.value) setSearch('') }}
            />
            <ImportExcelButton
              endpoint="/api/phap-nhan"
              templateFilename="mau_import_phap_nhan.xlsx"
              buttonText="Import Excel"
              onImported={() => qc.invalidateQueries({ queryKey: ['phap-nhan'] })}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm pháp nhân
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={list} columns={columns} rowKey="id" loading={isLoading} size="small"
          pagination={{ pageSize: 20 }} scroll={{ x: 950 }} />
      </Card>

      <Drawer
        open={open}
        onClose={() => { setOpen(false); setEditing(null); form.resetFields() }}
        title={editing ? 'Chỉnh sửa pháp nhân' : 'Thêm pháp nhân'}
        width={560}
        footer={
          <Space>
            <Button onClick={() => { setOpen(false); setEditing(null) }}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending || updateMut.isPending} onClick={handleSubmit}>
              {editing ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ trang_thai: true }}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="ma_phap_nhan" label="Mã pháp nhân" rules={[{ required: true, message: 'Nhập mã' }]}>
                <Input placeholder="VD: NP01" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="ten_viet_tat" label="Tên viết tắt">
                <Input placeholder="VD: TNHH Nam Phương" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ten_phap_nhan" label="Tên đầy đủ" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="Công ty TNHH Nam Phương..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="ma_so_thue"
                label={
                  <Space size={8}>
                    Mã số thuế
                    <MSTLookupButton
                      getMST={() => form.getFieldValue('ma_so_thue') ?? ''}
                      onFound={info => form.setFieldsValue({
                        ten_phap_nhan: info.name || form.getFieldValue('ten_phap_nhan'),
                        ten_viet_tat: info.shortName || form.getFieldValue('ten_viet_tat'),
                        dia_chi: info.address || form.getFieldValue('dia_chi'),
                      })}
                    />
                  </Space>
                }
              >
                <Input placeholder="VD: 0312345678" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ky_hieu_hd" label="Ký hiệu hoá đơn">
                <Input placeholder="VD: 1C25TAA" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dia_chi" label="Địa chỉ">
            <Input placeholder="Địa chỉ trụ sở..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_dien_thoai" label="Số điện thoại">
                <Input placeholder="0909..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tai_khoan" label="Tài khoản ngân hàng">
                <Input placeholder="Số tài khoản..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ngan_hang" label="Ngân hàng">
            <Input placeholder="VCB, TCB, BIDV..." />
          </Form.Item>
          <Form.Item name="phoi_phan_xuong_id" label="Xưởng phôi mặc định"
            extra="Kho phôi mặc định khi nhập phôi sóng cho pháp nhân này">
            <Select
              allowClear
              placeholder="Chọn xưởng chứa kho phôi..."
              options={phanXuongList.map(px => ({
                value: px.id,
                label: `${px.ten_xuong} (${px.ma_xuong})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="trang_thai" label="Hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
