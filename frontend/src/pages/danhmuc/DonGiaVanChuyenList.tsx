import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Tag, Popconfirm, message, Typography, Row, Col, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { donGiaVanChuyenApi, type DonGiaVanChuyen } from '../../api/simpleApis'
import ImportExcelButton from '../../components/ImportExcelButton'
import EmptyState from "../../components/EmptyState"

const { Title } = Typography
const formatVND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0)

export default function DonGiaVanChuyenList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DonGiaVanChuyen | null>(null)
  const { data = [], isLoading } = useQuery({ queryKey: ['don-gia-van-chuyen'], queryFn: () => donGiaVanChuyenApi.list().then(r => r.data) })

  const createMut = useMutation({
    mutationFn: (d: Omit<DonGiaVanChuyen, 'id'>) => donGiaVanChuyenApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] }); closeModal(); message.success('Da them don gia van chuyen') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi them'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DonGiaVanChuyen, 'id'>> }) => donGiaVanChuyenApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] }); closeModal(); message.success('Da cap nhat') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi cap nhat'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => donGiaVanChuyenApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] }); message.success('Da xoa') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi xoa'),
  })

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ trang_thai: true, dvt: 'chuyen', don_gia: 0, don_gia_m2: 0 }); setModalOpen(true) }
  const openEdit = (row: DonGiaVanChuyen) => { setEditing(row); form.setFieldsValue({ ...row }); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: Omit<DonGiaVanChuyen, 'id'> = {
      ten_tuyen: vals.ten_tuyen,
      khu_vuc_tu: vals.khu_vuc_tu || null,
      khu_vuc_den: vals.khu_vuc_den || null,
      don_gia: vals.don_gia ?? 0,
      don_gia_m2: vals.don_gia_m2 ?? 0,
      dvt: vals.dvt || 'chuyen',
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload)
  }

  const columns: ColumnsType<DonGiaVanChuyen> = [
    { title: 'Ten tuyen', dataIndex: 'ten_tuyen' },
    { title: 'Khu vuc tu', dataIndex: 'khu_vuc_tu', width: 140, render: (v: string | null) => v ?? '-' },
    { title: 'Khu vuc den', dataIndex: 'khu_vuc_den', width: 140, render: (v: string | null) => v ?? '-' },
    { title: 'Don gia/chuyen', dataIndex: 'don_gia', width: 140, align: 'right', render: (v: number) => formatVND(v) },
    { title: 'Don gia m2', dataIndex: 'don_gia_m2', width: 140, align: 'right', render: (v: number) => formatVND(v) },
    { title: 'DVT', dataIndex: 'dvt', width: 90 },
    { title: 'Trang thai', dataIndex: 'trang_thai', width: 110, align: 'center', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Dang dung' : 'Ngung'}</Tag> },
    {
      title: '', key: 'act', width: 90,
      render: (_: unknown, r: DonGiaVanChuyen) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoa don gia nay?" onConfirm={() => deleteMut.mutate(r.id)}>
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
          <Col><Title level={4} style={{ margin: 0 }}>Don gia van chuyen</Title></Col>
          <Col>
            <Space>
              <ImportExcelButton endpoint="/api/don-gia-van-chuyen" templateFilename="mau_import_don_gia_van_chuyen.xlsx" buttonText="Import Excel" onImported={() => queryClient.invalidateQueries({ queryKey: ['don-gia-van-chuyen'] })} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Them moi</Button>
            </Space>
          </Col>
        </Row>
        <Table rowKey="id" dataSource={data} columns={columns} loading={isLoading} pagination={{ pageSize: 20 }} size="small" />
      </Card>

      <Modal title={editing ? 'Sua don gia van chuyen' : 'Them don gia van chuyen'} open={modalOpen} onCancel={closeModal} onOk={handleSave} confirmLoading={createMut.isPending || updateMut.isPending} okText="Luu" cancelText="Huy" destroyOnClose width={620}>
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Ten tuyen" name="ten_tuyen" rules={[{ required: true, message: 'Nhap ten tuyen' }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item label="Khu vuc tu" name="khu_vuc_tu"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item label="Khu vuc den" name="khu_vuc_den"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item label="Don gia/chuyen" name="don_gia" rules={[{ required: true }]}><InputNumber min={0} step={1000} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => (Number(v?.replace(/,/g, '') ?? 0)) as 0} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Don gia m2" name="don_gia_m2"><InputNumber min={0} step={100} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => (Number(v?.replace(/,/g, '') ?? 0)) as 0} /></Form.Item></Col>
            <Col span={8}><Form.Item label="DVT" name="dvt"><Input /></Form.Item></Col>
          </Row>
          <Form.Item label="Ghi chu" name="ghi_chu"><Input /></Form.Item>
          <Form.Item label="Dang dung" name="trang_thai" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
