import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Switch, Tag, Space, Popconfirm, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import client from '../../api/client';

interface NganHang {
  id: number;
  ma_ngan_hang: string;
  ten_day_du: string;
  trang_thai: boolean;
  updated_at: string;
}

const api = {
  list: () => client.get<NganHang[]>('/ngan-hang').then(r => r.data),
  create: (d: Omit<NganHang, 'id' | 'updated_at'>) => client.post('/ngan-hang', d),
  update: (id: number, d: Partial<NganHang>) => client.put(`/ngan-hang/${id}`, d),
  remove: (id: number) => client.delete(`/ngan-hang/${id}`),
};

export default function NganHangList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NganHang | null>(null);
  const [form] = Form.useForm();

  const { data = [], isLoading } = useQuery({ queryKey: ['ngan-hang'], queryFn: api.list });

  const save = useMutation({
    mutationFn: (values: Omit<NganHang, 'id' | 'updated_at'>) =>
      editing ? api.update(editing.id, values) : api.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ngan-hang'] });
      setOpen(false);
      form.resetFields();
      setEditing(null);
      message.success('Đã lưu');
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi'),
  });

  const del = useMutation({
    mutationFn: api.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ngan-hang'] }); message.success('Đã xóa'); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Không thể xóa'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ trang_thai: true });
    setOpen(true);
  };
  const openEdit = (r: NganHang) => { setEditing(r); form.setFieldsValue(r); setOpen(true); };

  const cols = [
    { title: 'Mã', dataIndex: 'ma_ngan_hang', width: 140, render: (v: string) => <b>{v}</b> },
    { title: 'Tên đầy đủ', dataIndex: 'ten_day_du' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 150,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang sử dụng' : 'Ngừng sử dụng'}</Tag>,
    },
    {
      title: '', width: 90,
      render: (_: unknown, r: NganHang) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa ngân hàng này?" onConfirm={() => del.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Danh mục ngân hàng"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm</Button>}
    >
      <Table
        dataSource={data}
        columns={cols}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: false }}
      />

      <Modal
        title={editing ? 'Sửa ngân hàng' : 'Thêm ngân hàng'}
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        confirmLoading={save.isPending}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={save.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="ma_ngan_hang" label="Mã viết tắt" rules={[{ required: true }]}>
            <Input placeholder="VD: Vietcombank, BIDV..." disabled={!!editing} />
          </Form.Item>
          <Form.Item name="ten_day_du" label="Tên đầy đủ" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trang_thai" label="Đang sử dụng" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
