import { useState } from 'react'
import {
  Table, Button, Space, Tag, Drawer, Form, Input, InputNumber, DatePicker,
  Select, message, Typography, Row, Col, Card, Statistic, Descriptions, Modal,
} from 'antd'
import { PlusOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import axios from 'axios'

const { Title } = Typography

interface FixedAsset {
  id: number
  ma_ts: string
  ten_ts: string
  ngay_mua: string
  nguyen_gia: number
  so_thang_khau_hao: number
  da_khau_hao_thang: number
  gia_tri_da_khau_hao: number
  trang_thai: string
  tk_nguyen_gia: string
  tk_khau_hao: string
  tk_chi_phi: string
}

interface DepEntry {
  id: number
  ky: string
  so_tien_kh: number
  gia_tri_da_kh_sau: number
}

const API = '/api/fixed-assets'
const fmt = (n: number) => Number(n).toLocaleString('vi-VN')

const trangThaiTag = (v: string) => {
  if (v === 'dang_su_dung') return <Tag color="green">Đang sử dụng</Tag>
  if (v === 'da_kh_het') return <Tag color="blue">Đã KH hết</Tag>
  return <Tag color="red">Thanh lý</Tag>
}

export default function FixedAssetPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<FixedAsset | null>(null)
  const [depModal, setDepModal] = useState(false)
  const [form] = Form.useForm()
  const [depForm] = Form.useForm()

  const { data: assets = [], isLoading } = useQuery<FixedAsset[]>({
    queryKey: ['fixed-assets'],
    queryFn: () => axios.get(API).then(r => r.data),
  })

  const { data: depEntries = [] } = useQuery<DepEntry[]>({
    queryKey: ['depreciation', detail?.id],
    queryFn: () => axios.get(`${API}/${detail!.id}/depreciation`).then(r => r.data),
    enabled: !!detail,
  })

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => axios.post(API, v),
    onSuccess: () => {
      message.success('Đã thêm TSCĐ')
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
      setCreateOpen(false)
      form.resetFields()
    },
  })

  const runDepMut = useMutation({
    mutationFn: (v: { ky: string }) => axios.post(`${API}/run-depreciation`, v),
    onSuccess: (res) => {
      const d = res.data
      message.success(`Khấu hao ${d.ky}: ${d.so_tscd_da_kh} tài sản — ${fmt(d.tong_so_tien_kh)} đ`)
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
      setDepModal(false)
    },
  })

  const totalNguyenGia = assets.reduce((s, a) => s + Number(a.nguyen_gia), 0)
  const totalDaKH = assets.reduce((s, a) => s + Number(a.gia_tri_da_khau_hao), 0)
  const dangDungCount = assets.filter(a => a.trang_thai === 'dang_su_dung').length

  const columns = [
    { title: 'Mã TSCĐ', dataIndex: 'ma_ts', width: 110 },
    { title: 'Tên tài sản', dataIndex: 'ten_ts', ellipsis: true },
    { title: 'Ngày mua', dataIndex: 'ngay_mua', width: 110 },
    {
      title: 'Nguyên giá',
      dataIndex: 'nguyen_gia',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Đã KH',
      dataIndex: 'gia_tri_da_khau_hao',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Còn lại',
      key: 'con_lai',
      align: 'right' as const,
      render: (_: unknown, r: FixedAsset) => (
        <b>{fmt(Number(r.nguyen_gia) - Number(r.gia_tri_da_khau_hao))}</b>
      ),
    },
    {
      title: 'T.gian KH',
      key: 'thang',
      align: 'center' as const,
      render: (_: unknown, r: FixedAsset) => `${r.da_khau_hao_thang}/${r.so_thang_khau_hao}`,
    },
    { title: 'Trạng thái', dataIndex: 'trang_thai', render: trangThaiTag },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: FixedAsset) => (
        <Button size="small" onClick={() => setDetail(r)}>Lịch sử KH</Button>
      ),
    },
  ]

  const onCreateSubmit = (values: Record<string, unknown>) => {
    createMut.mutate({
      ...values,
      ngay_mua: dayjs(values.ngay_mua as dayjs.Dayjs).format('YYYY-MM-DD'),
    })
  }

  const onRunDep = (values: { ky: dayjs.Dayjs }) => {
    runDepMut.mutate({ ky: values.ky.format('YYYY-MM') })
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col><Title level={4} style={{ margin: 0 }}>Tài sản cố định (TSCĐ)</Title></Col>
        <Col flex={1} />
        <Col>
          <Space>
            <Button icon={<PlayCircleOutlined />} onClick={() => setDepModal(true)}>
              Chạy khấu hao tháng
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Thêm TSCĐ
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="Tổng nguyên giá" value={totalNguyenGia}
          formatter={v => fmt(Number(v))} suffix="đ" /></Card></Col>
        <Col span={6}><Card><Statistic title="Đã khấu hao" value={totalDaKH}
          formatter={v => fmt(Number(v))} suffix="đ" /></Card></Col>
        <Col span={6}><Card><Statistic title="Còn lại" value={totalNguyenGia - totalDaKH}
          formatter={v => fmt(Number(v))} suffix="đ" /></Card></Col>
        <Col span={6}><Card><Statistic title="Đang sử dụng" value={dangDungCount} /></Card></Col>
      </Row>

      <Card>
        <Table rowKey="id" loading={isLoading} dataSource={assets}
          columns={columns} pagination={{ pageSize: 20 }} />
      </Card>

      {/* Create drawer */}
      <Drawer title="Thêm TSCĐ mới" open={createOpen} onClose={() => setCreateOpen(false)}
        width={500}
        footer={<Space>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button type="primary" loading={createMut.isPending} onClick={() => form.submit()}>Lưu</Button>
        </Space>}>
        <Form form={form} layout="vertical" onFinish={onCreateSubmit}>
          <Form.Item name="ma_ts" label="Mã TSCĐ" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ten_ts" label="Tên tài sản" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ngay_mua" label="Ngày mua" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="nguyen_gia" label="Nguyên giá (đ)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="so_thang_khau_hao" label="Thời gian KH (tháng)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tk_nguyen_gia" label="TK Nguyên giá" initialValue="211"><Input /></Form.Item>
          <Form.Item name="tk_khau_hao" label="TK Khấu hao" initialValue="214"><Input /></Form.Item>
          <Form.Item name="tk_chi_phi" label="TK Chi phí" initialValue="154"><Input /></Form.Item>
        </Form>
      </Drawer>

      {/* Depreciation history drawer */}
      <Drawer title={`Lịch sử KH — ${detail?.ma_ts}`} open={!!detail}
        onClose={() => setDetail(null)} width={460}>
        {detail && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nguyên giá">{fmt(detail.nguyen_gia)} đ</Descriptions.Item>
              <Descriptions.Item label="Đã KH">{fmt(detail.gia_tri_da_khau_hao)} đ</Descriptions.Item>
              <Descriptions.Item label="Tháng KH">{detail.da_khau_hao_thang}/{detail.so_thang_khau_hao}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{trangThaiTag(detail.trang_thai)}</Descriptions.Item>
            </Descriptions>
            <Table rowKey="id" size="small" dataSource={depEntries} pagination={false}
              columns={[
                { title: 'Kỳ', dataIndex: 'ky' },
                { title: 'Số tiền KH', dataIndex: 'so_tien_kh', align: 'right' as const,
                  render: (v: number) => fmt(v) },
                { title: 'Lũy kế KH', dataIndex: 'gia_tri_da_kh_sau', align: 'right' as const,
                  render: (v: number) => fmt(v) },
              ]} />
          </>
        )}
      </Drawer>

      {/* Run depreciation modal */}
      <Modal title="Chạy khấu hao tháng" open={depModal} onCancel={() => setDepModal(false)}
        onOk={() => depForm.submit()} confirmLoading={runDepMut.isPending} okText="Chạy khấu hao">
        <Form form={depForm} layout="vertical" onFinish={onRunDep}>
          <Form.Item name="ky" label="Kỳ khấu hao" rules={[{ required: true }]}
            initialValue={dayjs()}>
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
