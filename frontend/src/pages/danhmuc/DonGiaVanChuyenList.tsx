import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { donGiaVanChuyenApi, type DonGiaVanChuyen } from '../../api/simpleApis'
import ImportExcelButton from '../../components/ImportExcelButton'

const { Title } = Typography

const formatVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)

export default function DonGiaVanChuyenList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DonGiaVanChuyen | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['don-gia-van-chuyen'],
    queryFn: () => donGiaVanChuyenApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<DonGiaVanChuyen, 'id'>) => donGiaVanChuyenApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] })
      closeModal()
      message.success('Đã thêm đơn giá vận chuyển')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DonGiaVanChuyen, 'id'>> }) =>
      donGiaVanChuyenApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => donGiaVanChuyenApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] })
      message.success('Đã xoá')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true, dvt: 'chuyến' })
    setModalOpen(true)
  }

  const openEdit = (row: DonGiaVanChuyen) => {
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
    const payload: Omit<DonGiaVanChuyen, 'id'> = {
      ten_tuyen: vals.ten_tuyen,
      khu_vuc_tu: vals.khu_vuc_tu || null,
      khu_vuc_den: vals.khu_vuc_den || null,
      don_gia: vals.don_gia ?? 0,
      dvt: vals.dvt || 'chuyến',
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<DonGiaVanChuyen> = [
    { title: 'Tên tuyến', dataIndex: 'ten_tuyen' },
    { title: 'Khu vực từ', dataIndex: 'khu_vuc_tu', width: 140, render: (v: string | null) => v ?? '—' },
    { title: 'Khu vực đến', dataIndex: 'khu_vuc_den', width: 140, render: (v: string | null) => v ?? '—' },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 140,
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    { title: 'DVT', dataIndex: 'dvt', width: 90 },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag>,
    },
    {
      title: '',
      key: 'act',
      width: 90,
      render: (_: unknown, r: DonGiaVanChuyen) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá đơn giá này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Đơn giá vận chuyển</Title>
          </Col>
          <Col>
            <Space>
              <ImportExcelButton
                endpoint="/api/don-gia-van-chuyen"
                templateFilename="mau_import_don_gia_van_chuyen.xlsx"
                buttonText="Import Excel"
                onImported={() => queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] })}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm mới
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? 'Sửa đơn giá vận chuyển' : 'Thêm đơn giá vận chuyển'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Tên tuyến" name="ten_tuyen" rules={[{ required: true, message: 'Nhập tên tuyến' }]}>
            <Input placeholder="VD: HCM - Bình Dương" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Khu vực từ" name="khu_vuc_tu">
                <Input placeholder="VD: TP. HCM" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Khu vực đến" name="khu_vuc_den">
                <Input placeholder="VD: Bình Dương" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Đơn giá (VNĐ)" name="don_gia" rules={[{ required: true, message: 'Nhập đơn giá' }]}>
                <InputNumber
                  min={0}
                  step={1000}
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => (Number(v?.replace(/,/g, '') ?? 0)) as 0}
                  placeholder="VD: 500000"
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="ĐVT" name="dvt">
                <Input placeholder="VD: chuyến, tấn..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
