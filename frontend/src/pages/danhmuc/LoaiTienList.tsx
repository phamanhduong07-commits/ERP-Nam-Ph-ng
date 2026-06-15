import { useState } from 'react';
import { useHotkey } from '../../hooks/useHotkey';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Space, Popconfirm, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import client from '../../api/client';

interface LoaiTien {
  id: number;
  ma_loai_tien: string;
  ten_loai_tien: string;
  ty_gia: number;
  ty_gia_mua: number | null;
  ty_gia_ban: number | null;
  la_mac_dinh: boolean;
  trang_thai: boolean;
  updated_at: string;
}

const api = {
  list: () => client.get<LoaiTien[]>('/loai-tien').then(r => r.data),
  create: (d: Omit<LoaiTien, 'id' | 'updated_at'>) => client.post('/loai-tien', d),
  update: (id: number, d: Partial<LoaiTien>) => client.put(`/loai-tien/${id}`, d),
  remove: (id: number) => client.delete(`/loai-tien/${id}`),
};

const fmt = (v: number | null) =>
  v ? v.toLocaleString('vi-VN') : '—';

export default function LoaiTienList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LoaiTien | null>(null);
  const [form] = Form.useForm();

  const { data = [], isLoading } = useQuery({ queryKey: ['loai-tien'], queryFn: api.list });

  const save = useMutation({
    mutationFn: (values: Omit<LoaiTien, 'id' | 'updated_at'>) =>
      editing ? api.update(editing.id, values) : api.create(values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loai-tien'] }); setOpen(false); form.resetFields(); setEditing(null); message.success('Đã lưu'); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi'),
  });

  const del = useMutation({
    mutationFn: api.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loai-tien'] }); message.success('Đã xóa'); },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Không thể xóa'),
  });

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ trang_thai: true, la_mac_dinh: false, ty_gia: 1 }); setOpen(true); };
  const openEdit = (r: LoaiTien) => { setEditing(r); form.setFieldsValue(r); setOpen(true); };

  useHotkey('ctrl+n', openCreate, 'Thêm loại tiền mới')
  useHotkey('ctrl+s', () => form.submit(), 'Lưu loại tiền', 'Trang hiện tại', open)

  const cols = [
    { title: 'Mã', dataIndex: 'ma_loai_tien', width: 80, render: (v: string) => <b>{v}</b> },
    { title: 'Tên loại tiền', dataIndex: 'ten_loai_tien' },
    { title: 'Tỷ giá quy đổi', dataIndex: 'ty_gia', align: 'right' as const, render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{fmt(v)}</span> },
    { title: 'Tỷ giá mua', dataIndex: 'ty_gia_mua', align: 'right' as const, render: fmt },
    { title: 'Tỷ giá bán', dataIndex: 'ty_gia_ban', align: 'right' as const, render: fmt },
    { title: 'Mặc định', dataIndex: 'la_mac_dinh', width: 90, align: 'center' as const, render: (v: boolean) => v ? <Tag color="gold">Mặc định</Tag> : null },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 130, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang sử dụng' : 'Ngừng sử dụng'}</Tag> },
    {
      title: '', width: 90,
      render: (_: unknown, r: LoaiTien) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa loại tiền này?" onConfirm={() => del.mutate(r.id)} disabled={r.la_mac_dinh}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.la_mac_dinh} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Loại tiền"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm</Button>}
    >
      <Table dataSource={data} columns={cols} rowKey="id" loading={isLoading} size="small" pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? 'Sửa loại tiền' : 'Thêm loại tiền'}
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        confirmLoading={save.isPending}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={save.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="ma_loai_tien" label="Mã loại tiền" rules={[{ required: true }]}>
            <Input placeholder="VND, USD..." style={{ textTransform: 'uppercase' }} disabled={!!editing} />
          </Form.Item>
          <Form.Item name="ten_loai_tien" label="Tên loại tiền" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ty_gia" label="Tỷ giá quy đổi (sang VND)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={100} />
          </Form.Item>
          <Form.Item name="ty_gia_mua" label="Tỷ giá mua">
            <InputNumber style={{ width: '100%' }} min={0} step={100} />
          </Form.Item>
          <Form.Item name="ty_gia_ban" label="Tỷ giá bán">
            <InputNumber style={{ width: '100%' }} min={0} step={100} />
          </Form.Item>
          <Form.Item name="la_mac_dinh" label="Loại tiền mặc định" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="trang_thai" label="Đang sử dụng" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
