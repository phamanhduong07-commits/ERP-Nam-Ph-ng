import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, DatePicker, Descriptions, Drawer, Form,
  Input, InputNumber, Popconfirm, Row, Select, Space, Statistic, Table,
  Tag, Typography, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { qualityApi, QCSheet, CreateQCSheetPayload, UpdateKetQuaPayload } from '../../api/quality'

const { Title } = Typography
const { RangePicker } = DatePicker

const LOAI_OPTIONS = [
  { value: 'nhan_hang', label: 'Nhận hàng' },
  { value: 'san_xuat', label: 'Sản xuất' },
  { value: 'xuat_hang', label: 'Xuất hàng' },
]

const KET_QUA_OPTIONS = [
  { value: 'dat', label: 'Đạt' },
  { value: 'khong_dat', label: 'Không đạt' },
  { value: 'tam_chap_nhan', label: 'Tạm chấp nhận' },
]

const KET_QUA_COLOR: Record<string, string> = {
  dat: 'green',
  khong_dat: 'red',
  tam_chap_nhan: 'orange',
}

function KetQuaTag({ value }: { value: string | null }) {
  if (!value) return <Tag color="default">Chưa có</Tag>
  const label = KET_QUA_OPTIONS.find(o => o.value === value)?.label ?? value
  return <Tag color={KET_QUA_COLOR[value] ?? 'default'}>{label}</Tag>
}

export default function QCListPage() {
  const qc = useQueryClient()
  const [filterLoai, setFilterLoai] = useState<string | undefined>()
  const [filterKetQua, setFilterKetQua] = useState<string | undefined>()
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [updateId, setUpdateId] = useState<number | null>(null)
  const [createForm] = Form.useForm()
  const [updateForm] = Form.useForm()

  const params: Record<string, string | undefined> = {}
  if (filterLoai) params.loai = filterLoai
  if (filterKetQua) params.ket_qua = filterKetQua
  if (filterDateRange) {
    params.tu_ngay = filterDateRange[0].format('YYYY-MM-DD')
    params.den_ngay = filterDateRange[1].format('YYYY-MM-DD')
  }

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['qc-sheets', params],
    queryFn: () => qualityApi.list(params),
  })

  const { data: stats } = useQuery({
    queryKey: ['qc-stats', params],
    queryFn: () => qualityApi.stats(params),
  })

  const detailSheet = sheets.find(s => s.id === detailId)
  const updateSheet = sheets.find(s => s.id === updateId)

  const createMut = useMutation({
    mutationFn: (p: CreateQCSheetPayload) => qualityApi.create(p),
    onSuccess: () => {
      message.success('Tạo phiếu QC thành công')
      qc.invalidateQueries({ queryKey: ['qc-sheets'] })
      qc.invalidateQueries({ queryKey: ['qc-stats'] })
      setCreateOpen(false)
      createForm.resetFields()
    },
    onError: () => message.error('Tạo phiếu QC thất bại'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateKetQuaPayload }) =>
      qualityApi.updateKetQua(id, payload),
    onSuccess: () => {
      message.success('Cập nhật kết quả thành công')
      qc.invalidateQueries({ queryKey: ['qc-sheets'] })
      qc.invalidateQueries({ queryKey: ['qc-stats'] })
      setUpdateId(null)
      updateForm.resetFields()
    },
    onError: () => message.error('Cập nhật thất bại'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => qualityApi.delete(id),
    onSuccess: () => {
      message.success('Đã xóa phiếu QC')
      qc.invalidateQueries({ queryKey: ['qc-sheets'] })
      qc.invalidateQueries({ queryKey: ['qc-stats'] })
    },
  })

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    const payload: CreateQCSheetPayload = {
      loai: values.loai,
      ngay: values.ngay.format('YYYY-MM-DD'),
      nguoi_kiem_tra: values.nguoi_kiem_tra || null,
      ket_qua: values.ket_qua || null,
      ghi_chu: values.ghi_chu || null,
    }
    createMut.mutate(payload)
  }

  const handleUpdate = async () => {
    if (!updateId) return
    const values = await updateForm.validateFields()
    updateMut.mutate({
      id: updateId,
      payload: {
        ket_qua: values.ket_qua || null,
        nguoi_kiem_tra: values.nguoi_kiem_tra || null,
        ghi_chu: values.ghi_chu || null,
      },
    })
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', key: 'so_phieu', width: 160 },
    {
      title: 'Loại', dataIndex: 'loai', key: 'loai', width: 120,
      render: (v: string) => LOAI_OPTIONS.find(o => o.value === v)?.label ?? v,
    },
    { title: 'Ngày', dataIndex: 'ngay', key: 'ngay', width: 110 },
    { title: 'Người KT', dataIndex: 'nguoi_kiem_tra', key: 'nguoi_kiem_tra' },
    {
      title: 'Kết quả', dataIndex: 'ket_qua', key: 'ket_qua', width: 140,
      render: (v: string | null) => <KetQuaTag value={v} />,
    },
    {
      title: 'Lỗi', key: 'defects', width: 70,
      render: (_: unknown, r: QCSheet) =>
        r.defects.length > 0
          ? <Badge count={r.defects.length} color="red" />
          : <Badge count={0} showZero color="gray" />,
    },
    {
      title: '', key: 'actions', width: 120,
      render: (_: unknown, r: QCSheet) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)} />
          <Button
            size="small" icon={<CheckCircleOutlined />}
            onClick={() => {
              setUpdateId(r.id)
              updateForm.setFieldsValue({
                ket_qua: r.ket_qua,
                nguoi_kiem_tra: r.nguoi_kiem_tra,
                ghi_chu: r.ghi_chu,
              })
            }}
          />
          <Popconfirm title="Xóa phiếu QC?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Title level={4}>Kiểm tra chất lượng (QC)</Title>

      {/* Stats */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card size="small"><Statistic title="Tổng phiếu" value={stats.tong} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Đạt" value={stats.dat} valueStyle={{ color: '#3f8600' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Không đạt" value={stats.khong_dat} valueStyle={{ color: '#cf1322' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Tạm chấp nhận" value={stats.tam_chap_nhan} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Chưa có KQ" value={stats.chua_co_ket_qua} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="Tỷ lệ đạt" value={stats.ty_le_dat_pct} suffix="%" precision={1} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        </Row>
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            placeholder="Loại kiểm tra" allowClear style={{ width: 160 }}
            options={LOAI_OPTIONS}
            onChange={v => setFilterLoai(v)}
          />
          <Select
            placeholder="Kết quả" allowClear style={{ width: 160 }}
            options={KET_QUA_OPTIONS}
            onChange={v => setFilterKetQua(v)}
          />
          <RangePicker
            onChange={dates => setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Tạo phiếu QC
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        dataSource={sheets}
        columns={columns}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20 }}
      />

      {/* Create Drawer */}
      <Drawer
        title="Tạo phiếu QC mới"
        open={createOpen}
        onClose={() => { setCreateOpen(false); createForm.resetFields() }}
        width={480}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleCreate}>Lưu</Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="loai" label="Loại kiểm tra" rules={[{ required: true }]}>
            <Select options={LOAI_OPTIONS} />
          </Form.Item>
          <Form.Item name="ngay" label="Ngày" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="nguoi_kiem_tra" label="Người kiểm tra">
            <Input />
          </Form.Item>
          <Form.Item name="ket_qua" label="Kết quả ban đầu">
            <Select options={KET_QUA_OPTIONS} allowClear />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Update Drawer */}
      <Drawer
        title="Cập nhật kết quả QC"
        open={updateId !== null}
        onClose={() => { setUpdateId(null); updateForm.resetFields() }}
        width={480}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setUpdateId(null)}>Hủy</Button>
            <Button type="primary" loading={updateMut.isPending} onClick={handleUpdate}>Lưu</Button>
          </Space>
        }
      >
        <Form form={updateForm} layout="vertical">
          <Form.Item name="ket_qua" label="Kết quả" rules={[{ required: true }]}>
            <Select options={KET_QUA_OPTIONS} />
          </Form.Item>
          <Form.Item name="nguoi_kiem_tra" label="Người kiểm tra">
            <Input />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title={`Chi tiết phiếu QC — ${detailSheet?.so_phieu ?? ''}`}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        width={520}
      >
        {detailSheet && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Loại">{LOAI_OPTIONS.find(o => o.value === detailSheet.loai)?.label}</Descriptions.Item>
              <Descriptions.Item label="Ngày">{detailSheet.ngay}</Descriptions.Item>
              <Descriptions.Item label="Người KT">{detailSheet.nguoi_kiem_tra ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Kết quả"><KetQuaTag value={detailSheet.ket_qua} /></Descriptions.Item>
              <Descriptions.Item label="Ghi chú">{detailSheet.ghi_chu ?? '—'}</Descriptions.Item>
            </Descriptions>
            {detailSheet.defects.length > 0 && (
              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                size="small"
                dataSource={detailSheet.defects}
                columns={[
                  { title: 'Loại lỗi', dataIndex: 'loai_loi' },
                  { title: 'Mô tả', dataIndex: 'mo_ta' },
                  { title: 'SL lỗi', dataIndex: 'so_luong_loi', width: 80, align: 'right' as const },
                ]}
                pagination={false}
              />
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}
