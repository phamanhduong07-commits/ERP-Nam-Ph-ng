import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm,
  Select, Space, Table, Tag, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  PlusOutlined, EyeOutlined, CheckCircleOutlined, StopOutlined, DeleteOutlined,
} from '@ant-design/icons'
import {
  ymhApi, PurchaseRequisition, TRANG_THAI_YMH, TRANG_THAI_YMH_COLOR,
} from '../../api/purchase_requisitions'
import { fmtVND } from '../../utils/exportUtils'
import { useAuthStore } from '../../store/auth'

const { RangePicker } = DatePicker

export default function YMHListPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  // Filters
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  // Drawers
  const [viewRecord, setViewRecord] = useState<PurchaseRequisition | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  // Queries
  const { data: ymhs = [], isFetching } = useQuery({
    queryKey: ['ymh-list', trangThai, dateRange],
    queryFn: () => ymhApi.list({
      trang_thai: trangThai,
      tu_ngay: dateRange?.[0]?.format('YYYY-MM-DD'),
      den_ngay: dateRange?.[1]?.format('YYYY-MM-DD'),
    }).then(r => r.data),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof ymhApi.create>[0]) => ymhApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Tạo YMH thành công')
      setCreateOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo YMH'),
  })

  const duyetPBMutation = useMutation({
    mutationFn: (id: number) => ymhApi.duyetPB(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ymh-list'] }); message.success('Phòng ban đã duyệt') },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi'),
  })

  const duyetGDMutation = useMutation({
    mutationFn: (id: number) => ymhApi.duyetGD(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ymh-list'] }); message.success('Giám đốc đã duyệt') },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi'),
  })

  const huyMutation = useMutation({
    mutationFn: (id: number) => ymhApi.huy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ymh-list'] }); message.success('Đã huỷ YMH') },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ymhApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ymh-list'] }); message.success('Đã xoá YMH') },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi'),
  })

  function handleCreate(values: any) {
    const items = (values.items ?? []).map((it: any) => ({
      ten_hang: it.ten_hang ?? '',
      so_luong: it.so_luong,
      dvt: it.dvt ?? 'Kg',
      don_gia_du_kien: it.don_gia_du_kien ?? 0,
      ngay_can: it.ngay_can ? dayjs(it.ngay_can).format('YYYY-MM-DD') : null,
      ghi_chu: it.ghi_chu ?? null,
      paper_material_id: null,
      other_material_id: null,
    }))
    createMutation.mutate({
      ngay_yeu_cau: dayjs(values.ngay_yeu_cau).format('YYYY-MM-DD'),
      ghi_chu: values.ghi_chu ?? null,
      items,
    })
  }

  const columns: ColumnsType<PurchaseRequisition> = [
    { title: 'Số YMH', dataIndex: 'so_ymh', width: 140 },
    { title: 'Ngày YC', dataIndex: 'ngay_yeu_cau', width: 100, render: v => v ?? '-' },
    { title: 'Phân xưởng', dataIndex: 'ten_phan_xuong', width: 130, render: v => v ?? '-' },
    { title: 'Người YC', dataIndex: 'ten_nguoi_yeu_cau', width: 130, render: v => v ?? '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: string) => <Tag color={TRANG_THAI_YMH_COLOR[v] ?? 'default'}>{TRANG_THAI_YMH[v] ?? v}</Tag>,
    },
    {
      title: 'Tổng dự kiến',
      dataIndex: 'tong_du_kien',
      width: 130,
      align: 'right',
      render: fmtVND,
    },
    {
      title: 'Duyệt PB', width: 80, align: 'center',
      render: (_, r) =>
        r.trang_thai === 'nhap' ? (
          <Popconfirm title="Duyệt phòng ban?" onConfirm={() => duyetPBMutation.mutate(r.id)}>
            <Button size="small" type="link" icon={<CheckCircleOutlined />}>PB</Button>
          </Popconfirm>
        ) : null,
    },
    {
      title: 'Duyệt GĐ', width: 80, align: 'center',
      render: (_, r) =>
        r.trang_thai === 'duyet_pb' ? (
          <Popconfirm title="Giám đốc duyệt?" onConfirm={() => duyetGDMutation.mutate(r.id)}>
            <Button size="small" type="link" icon={<CheckCircleOutlined />} style={{ color: 'green' }}>GĐ</Button>
          </Popconfirm>
        ) : null,
    },
    {
      title: '', width: 90, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(r)} />
          {r.trang_thai !== 'huy' && r.trang_thai !== 'tao_po' && (
            <Popconfirm title="Huỷ YMH?" onConfirm={() => huyMutation.mutate(r.id)}>
              <Button size="small" icon={<StopOutlined />} danger />
            </Popconfirm>
          )}
          {(r.trang_thai === 'nhap' || r.trang_thai === 'huy') && (
            <Popconfirm title="Xoá YMH?" onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button size="small" icon={<DeleteOutlined />} danger type="text" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Yêu cầu mua hàng (YMH)</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Tạo YMH
        </Button>
      </div>

      {/* Filters */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear placeholder="Trạng thái" style={{ width: 150 }}
          options={Object.entries(TRANG_THAI_YMH).map(([k, v]) => ({ value: k, label: v }))}
          value={trangThai}
          onChange={setTrangThai}
        />
        <RangePicker
          format="DD/MM/YYYY"
          value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
          onChange={v => setDateRange(v)}
        />
      </Space>

      <Table<PurchaseRequisition>
        rowKey="id"
        columns={columns}
        dataSource={ymhs}
        loading={isFetching}
        size="small"
        pagination={{ pageSize: 50 }}
        scroll={{ x: 900 }}
      />

      {/* View Drawer */}
      <Drawer
        title={`Chi tiết YMH — ${viewRecord?.so_ymh}`}
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={640}
      >
        {viewRecord && (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Số YMH">{viewRecord.so_ymh}</Descriptions.Item>
              <Descriptions.Item label="Ngày YC">{viewRecord.ngay_yeu_cau}</Descriptions.Item>
              <Descriptions.Item label="Phân xưởng">{viewRecord.ten_phan_xuong ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Người YC">{viewRecord.ten_nguoi_yeu_cau ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                <Tag color={TRANG_THAI_YMH_COLOR[viewRecord.trang_thai]}>{TRANG_THAI_YMH[viewRecord.trang_thai]}</Tag>
              </Descriptions.Item>
              {viewRecord.ten_nguoi_duyet_pb && (
                <Descriptions.Item label="PB duyệt">{viewRecord.ten_nguoi_duyet_pb} — {viewRecord.ngay_duyet_pb?.slice(0, 10)}</Descriptions.Item>
              )}
              {viewRecord.ten_nguoi_duyet_gd && (
                <Descriptions.Item label="GĐ duyệt">{viewRecord.ten_nguoi_duyet_gd} — {viewRecord.ngay_duyet_gd?.slice(0, 10)}</Descriptions.Item>
              )}
              <Descriptions.Item label="Tổng dự kiến" span={2}>{fmtVND(viewRecord.tong_du_kien)}</Descriptions.Item>
              {viewRecord.ghi_chu && <Descriptions.Item label="Ghi chú" span={2}>{viewRecord.ghi_chu}</Descriptions.Item>}
            </Descriptions>
            <Table
              rowKey="id"
              size="small"
              dataSource={viewRecord.items}
              pagination={false}
              columns={[
                { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                { title: 'SL', dataIndex: 'so_luong', width: 80, align: 'right' },
                { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
                { title: 'Đơn giá DK', dataIndex: 'don_gia_du_kien', width: 120, align: 'right', render: fmtVND },
                { title: 'Ngày cần', dataIndex: 'ngay_can', width: 100, render: v => v ?? '-' },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* Create Drawer */}
      <Drawer
        title="Tạo yêu cầu mua hàng"
        open={createOpen}
        onClose={() => { setCreateOpen(false); form.resetFields() }}
        width={680}
        extra={
          <Button type="primary" onClick={() => form.submit()} loading={createMutation.isPending}>
            Lưu
          </Button>
        }
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="ngay_yeu_cau" label="Ngày yêu cầu" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                    <Space wrap size={8}>
                      <Form.Item {...restField} name={[name, 'ten_hang']} label="Tên hàng" style={{ marginBottom: 4 }} rules={[{ required: true }]}>
                        <Input placeholder="Tên hàng" style={{ width: 200 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'so_luong']} label="Số lượng" style={{ marginBottom: 4 }} rules={[{ required: true }]}>
                        <InputNumber min={0.001} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }} initialValue="Kg">
                        <Input style={{ width: 70 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'don_gia_du_kien']} label="Đơn giá DK" style={{ marginBottom: 4 }}>
                        <InputNumber min={0} style={{ width: 130 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'ngay_can']} label="Ngày cần" style={{ marginBottom: 4 }}>
                        <DatePicker format="DD/MM/YYYY" />
                      </Form.Item>
                      <Button danger size="small" onClick={() => remove(name)} style={{ marginTop: 28 }}>Xoá</Button>
                    </Space>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  )
}
