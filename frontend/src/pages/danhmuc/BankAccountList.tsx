import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  InputNumber, Switch, message, Typography, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, BankOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { bankAccountsApi, type BankAccount, type BankAccountCreate } from '../../api/banking'
import ImportExcelButton from '../../components/ImportExcelButton'

const { Title } = Typography

export default function BankAccountList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: BankAccountCreate) => bankAccountsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      closeModal()
      message.success('Đã thêm tài khoản ngân hàng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BankAccountCreate> & { trang_thai?: boolean } }) =>
      bankAccountsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  function openEdit(rec: BankAccount) {
    setEditing(rec)
    form.setFieldsValue(rec)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
  }

  function handleSubmit(values: any) {
    if (editing) {
      updateMut.mutate({ id: editing.id, data: values })
    } else {
      createMut.mutate(values)
    }
  }

  const columns: ColumnsType<BankAccount> = [
    { title: 'Mã TK', dataIndex: 'ma_tk', width: 120, render: t => <b>{t}</b> },
    { title: 'Ngân hàng', dataIndex: 'ten_ngan_hang' },
    { title: 'Số tài khoản', dataIndex: 'so_tai_khoan', width: 200 },
    { title: 'Chủ tài khoản', dataIndex: 'chu_tai_khoan' },
    { title: 'Chi nhánh', dataIndex: 'chi_nhanh' },
    {
      title: 'Số dư đầu kỳ',
      dataIndex: 'so_du_dau',
      align: 'right',
      width: 150,
      render: v => `${Number(v).toLocaleString('vi-VN')} đ`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngưng'}</Tag>,
    },
    {
      title: '',
      width: 60,
      render: (_, rec) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
      ),
    },
  ]

  return (
    <Card
      title={<Space><BankOutlined /><Title level={4} style={{ margin: 0 }}>Tài khoản ngân hàng</Title></Space>}
      extra={
        <Space>
          <ImportExcelButton
            endpoint="/api/bank-accounts"
            templateFilename="mau_import_tai_khoan_ngan_hang.xlsx"
            buttonText="Import Excel"
            onImported={() => queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm tài khoản</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        size="small"
      />

      <Modal
        title={editing ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="ma_tk" label="Mã tài khoản" rules={[{ required: true }]}>
            <Input disabled={!!editing} placeholder="VD: BIDV_001" />
          </Form.Item>
          <Form.Item name="ten_ngan_hang" label="Tên ngân hàng" rules={[{ required: true }]}>
            <Input placeholder="VD: Ngân hàng BIDV" />
          </Form.Item>
          <Form.Item name="so_tai_khoan" label="Số tài khoản" rules={[{ required: true }]}>
            <Input placeholder="VD: 12345678901" />
          </Form.Item>
          <Form.Item name="chu_tai_khoan" label="Chủ tài khoản">
            <Input placeholder="VD: CÔNG TY TNHH NAM PHƯƠNG BAO BÌ" />
          </Form.Item>
          <Form.Item name="chi_nhanh" label="Chi nhánh">
            <Input placeholder="VD: Chi nhánh Bình Dương" />
          </Form.Item>
          <Form.Item name="swift_code" label="SWIFT Code">
            <Input placeholder="VD: BIDVVNVX" />
          </Form.Item>
          <Form.Item name="so_du_dau" label="Số dư đầu kỳ (đ)">
            <InputNumber
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v?.replace(/,/g, '') as any}
              min={0}
            />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          {editing && (
            <Form.Item name="trang_thai" label="Trạng thái" valuePropName="checked">
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngưng" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
