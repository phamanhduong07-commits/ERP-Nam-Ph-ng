import React, { useState } from 'react'
import {
  Button, DatePicker, Form, Modal, Select, Space, Table, Tag, Typography,
  message, Popconfirm, Tooltip,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, FileTextOutlined,
  PlusOutlined, StopOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { hdtApi, HoaDonDienTu, TRANG_THAI_HDT, TRANG_THAI_HDT_COLOR } from '../../api/hoaDonDienTu'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function HoaDonDienTuPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [huyForm] = Form.useForm()
  const [huyModal, setHuyModal] = useState<HoaDonDienTu | null>(null)

  const [filters, setFilters] = useState<{
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
  }>({})

  const { data = [], isLoading } = useQuery({
    queryKey: ['hoa-don-dien-tu', filters],
    queryFn: () => hdtApi.list(filters).then(r => r.data),
  })

  const phatHanhMut = useMutation({
    mutationFn: (id: number) => hdtApi.phatHanh(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] }); message.success('Phát hành thành công') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi phát hành'),
  })

  const huyMut = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) => hdtApi.huy(id, ly_do),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] })
      message.success('Đã hủy hóa đơn')
      setHuyModal(null)
      huyForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi hủy HĐ'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => hdtApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] }); message.success('Đã xóa') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xóa'),
  })

  const syncMut = useMutation({
    mutationFn: (id: number) => hdtApi.syncStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] }); message.success('Đã đồng bộ') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi sync'),
  })

  const columns: ColumnsType<HoaDonDienTu> = [
    {
      title: 'Số HĐ',
      dataIndex: 'so_hoa_don',
      width: 130,
      render: (v) => v || <span style={{ color: '#aaa' }}>Chưa phát hành</span>,
    },
    { title: 'Ký hiệu', dataIndex: 'ky_hieu', width: 100 },
    {
      title: 'Ngày lập',
      dataIndex: 'ngay_lap',
      width: 110,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '',
    },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    { title: 'MST', dataIndex: 'ma_so_thue_kh', width: 130 },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      width: 130,
      align: 'right',
      render: v => v?.toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: v => <Tag color={TRANG_THAI_HDT_COLOR[v] || 'default'}>{TRANG_THAI_HDT[v] || v}</Tag>,
    },
    {
      title: 'Thao tác',
      width: 180,
      render: (_, r) => (
        <Space size="small">
          {r.pdf_url && (
            <Tooltip title="Xem PDF">
              <Button size="small" icon={<FileTextOutlined />} onClick={() => window.open(r.pdf_url!, '_blank')} />
            </Tooltip>
          )}
          {r.trang_thai === 'nhap' && (
            <Tooltip title="Phát hành">
              <Popconfirm
                title="Phát hành lên MISA?"
                onConfirm={() => phatHanhMut.mutate(r.id)}
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  loading={phatHanhMut.isPending} />
              </Popconfirm>
            </Tooltip>
          )}
          {(r.misa_id && r.trang_thai !== 'nhap') && (
            <Tooltip title="Sync trạng thái">
              <Button size="small" icon={<SyncOutlined />}
                loading={syncMut.isPending}
                onClick={() => syncMut.mutate(r.id)} />
            </Tooltip>
          )}
          {r.trang_thai === 'da_phat_hanh' && (
            <Tooltip title="Hủy HĐ">
              <Button size="small" danger icon={<StopOutlined />}
                onClick={() => setHuyModal(r)} />
            </Tooltip>
          )}
          {r.trang_thai === 'nhap' && (
            <Tooltip title="Xóa nháp">
              <Popconfirm title="Xóa hóa đơn nháp?" onConfirm={() => deleteMut.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Hóa đơn điện tử</Title>
        <Button type="primary" icon={<PlusOutlined />} href="/accounting/hoa-don-dien-tu/new">
          Tạo mới
        </Button>
      </div>

      <Form form={form} layout="inline" style={{ marginBottom: 16 }} onValuesChange={(_, all) => {
        const [t1, t2] = all.date_range || []
        setFilters({
          trang_thai: all.trang_thai || undefined,
          tu_ngay: t1 ? t1.format('YYYY-MM-DD') : undefined,
          den_ngay: t2 ? t2.format('YYYY-MM-DD') : undefined,
        })
      }}>
        <Form.Item name="date_range">
          <RangePicker format="DD/MM/YYYY" placeholder={['Từ ngày', 'Đến ngày']} />
        </Form.Item>
        <Form.Item name="trang_thai">
          <Select placeholder="Trạng thái" allowClear style={{ width: 150 }}>
            {Object.entries(TRANG_THAI_HDT).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={data}
        loading={isLoading}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Hủy hóa đơn"
        open={!!huyModal}
        onCancel={() => { setHuyModal(null); huyForm.resetFields() }}
        onOk={() => huyForm.validateFields().then(vals => {
          if (huyModal) huyMut.mutate({ id: huyModal.id, ly_do: vals.ly_do })
        })}
        confirmLoading={huyMut.isPending}
      >
        <Form form={huyForm} layout="vertical">
          <Form.Item name="ly_do" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
            <textarea style={{ width: '100%', minHeight: 80 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
