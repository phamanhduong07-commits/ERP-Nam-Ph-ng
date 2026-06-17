import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Tag, Popconfirm, message, Typography, Row, Col, Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import type { ApiError } from '../../api/types'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

interface BacThue {
  id: number
  bieu_id: number
  bac: number
  thu_nhap_tu: number
  thu_nhap_den: number | null
  ty_le_thue: number
  so_tien_giam_tru: number
}

interface BieuThueThuNhap {
  id: number
  ten_bieu: string
  nam_ap_dung: number
  loai: string
  ghi_chu: string | null
  trang_thai: boolean
  bac_thue: BacThue[]
}

const bieuThueApi = {
  list: () => client.get<BieuThueThuNhap[]>('/bieu-thue-thu-nhap'),
  create: (d: Omit<BieuThueThuNhap, 'id'>) => client.post<BieuThueThuNhap>('/bieu-thue-thu-nhap', d),
  update: (id: number, d: Partial<Omit<BieuThueThuNhap, 'id'>>) =>
    client.put<BieuThueThuNhap>(`/bieu-thue-thu-nhap/${id}`, d),
  delete: (id: number) => client.delete(`/bieu-thue-thu-nhap/${id}`),
}

const LOAI_OPTIONS = [
  { value: 'ca_nhan_cu_tru', label: 'Cá nhân cư trú' },
  { value: 'ca_nhan_khong_cu_tru', label: 'Không cư trú' },
]

const LOAI_MAP: Record<string, { label: string; color: string }> = {
  ca_nhan_cu_tru: { label: 'Cá nhân cư trú', color: 'blue' },
  ca_nhan_khong_cu_tru: { label: 'Không cư trú', color: 'orange' },
}

// 7 bậc thuế TNCN lũy tiến từng phần chuẩn Việt Nam (cá nhân cư trú).
// thu_nhap_den của bậc cuối = null (không giới hạn).
const VN_PIT_BRACKETS: Array<{
  bac: number
  thu_nhap_tu: number
  thu_nhap_den: number | null
  ty_le_thue: number
  so_tien_giam_tru: number
}> = [
  { bac: 1, thu_nhap_tu: 0, thu_nhap_den: 5_000_000, ty_le_thue: 5, so_tien_giam_tru: 0 },
  { bac: 2, thu_nhap_tu: 5_000_000, thu_nhap_den: 10_000_000, ty_le_thue: 10, so_tien_giam_tru: 250_000 },
  { bac: 3, thu_nhap_tu: 10_000_000, thu_nhap_den: 18_000_000, ty_le_thue: 15, so_tien_giam_tru: 750_000 },
  { bac: 4, thu_nhap_tu: 18_000_000, thu_nhap_den: 32_000_000, ty_le_thue: 20, so_tien_giam_tru: 1_650_000 },
  { bac: 5, thu_nhap_tu: 32_000_000, thu_nhap_den: 52_000_000, ty_le_thue: 25, so_tien_giam_tru: 3_250_000 },
  { bac: 6, thu_nhap_tu: 52_000_000, thu_nhap_den: 80_000_000, ty_le_thue: 30, so_tien_giam_tru: 5_850_000 },
  { bac: 7, thu_nhap_tu: 80_000_000, thu_nhap_den: null, ty_le_thue: 35, so_tien_giam_tru: 9_850_000 },
]

const emptyBracketRows = () =>
  Array.from({ length: 7 }, (_, i) => ({
    bac: i + 1,
    thu_nhap_tu: 0,
    thu_nhap_den: i === 6 ? null : 0,
    ty_le_thue: 0,
    so_tien_giam_tru: 0,
  }))

const fmtVnd = (v: number | null | undefined): string =>
  v == null ? '—' : new Intl.NumberFormat('vi-VN').format(v)

function errMsg(e: unknown, fallback: string): string {
  return (e as ApiError)?.response?.data?.detail || fallback
}

export default function BieuThueThuNhapPage() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['bieu-thue-thu-nhap'],
    queryFn: () => bieuThueApi.list().then((r) => r.data),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bieu-thue-thu-nhap'] })

  const selected = data.find((b) => b.id === selectedId) ?? null

  const createMut = useMutation({
    mutationFn: (d: Omit<BieuThueThuNhap, 'id'>) => bieuThueApi.create(d),
    onSuccess: (res) => {
      invalidate()
      setModalOpen(false)
      setSelectedId(res.data.id)
      message.success('Đã thêm biểu thuế')
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi khi thêm')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => bieuThueApi.delete(id),
    onSuccess: (_res, id) => {
      invalidate()
      if (selectedId === id) setSelectedId(null)
      message.success('Đã xoá biểu thuế')
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi khi xoá')),
  })

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ trang_thai: true, bac_thue: emptyBracketRows() })
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  // Khi chọn Loại = cá nhân cư trú → tự điền 7 bậc chuẩn VN; loại khác giữ nguyên 7 dòng trống.
  const onLoaiChange = (value: string) => {
    if (value === 'ca_nhan_cu_tru') {
      form.setFieldsValue({ bac_thue: VN_PIT_BRACKETS.map((b) => ({ ...b })) })
    }
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const rawBac: Array<Partial<BacThue>> = vals.bac_thue ?? []
    const payload: Omit<BieuThueThuNhap, 'id'> = {
      ten_bieu: vals.ten_bieu,
      nam_ap_dung: vals.nam_ap_dung,
      loai: vals.loai,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
      bac_thue: rawBac.map((row, idx) => ({
        // id/bieu_id do backend gán; gửi placeholder cho khớp kiểu, backend bỏ qua.
        id: 0,
        bieu_id: 0,
        bac: row.bac ?? idx + 1,
        thu_nhap_tu: row.thu_nhap_tu ?? 0,
        thu_nhap_den: row.thu_nhap_den ?? null,
        ty_le_thue: row.ty_le_thue ?? 0,
        so_tien_giam_tru: row.so_tien_giam_tru ?? 0,
      })),
    }
    createMut.mutate(payload)
  }

  const bieuColumns: ColumnsType<BieuThueThuNhap> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: BieuThueThuNhap, index: number) => index + 1,
    },
    { title: 'Tên', dataIndex: 'ten_bieu' },
    { title: 'Năm', dataIndex: 'nam_ap_dung', width: 90, align: 'center' },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 150,
      render: (v: string) => {
        const info = LOAI_MAP[v]
        return <Tag color={info?.color ?? 'default'}>{info?.label ?? v}</Tag>
      },
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
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
      width: 70,
      render: (_: unknown, r: BieuThueThuNhap) => (
        <Popconfirm
          title="Xoá biểu thuế này?"
          onConfirm={() => deleteMut.mutate(r.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
        </Popconfirm>
      ),
    },
  ]
  const { displayColumns: displayBieuColumns, settingsButton } = useColumnPrefs('danhmuc-bieu-thue-thu-nhap', bieuColumns)

  const bacColumns: ColumnsType<BacThue> = [
    { title: 'Bậc', dataIndex: 'bac', width: 70, align: 'center' },
    {
      title: 'Thu nhập từ',
      dataIndex: 'thu_nhap_tu',
      align: 'right',
      render: (v: number) => fmtVnd(v),
    },
    {
      title: 'Thu nhập đến',
      dataIndex: 'thu_nhap_den',
      align: 'right',
      render: (v: number | null) => (v == null ? 'Không giới hạn' : fmtVnd(v)),
    },
    {
      title: 'Tỷ lệ thuế',
      dataIndex: 'ty_le_thue',
      width: 110,
      align: 'right',
      render: (v: number) => `${v}%`,
    },
    {
      title: 'Số tiền giảm trừ',
      dataIndex: 'so_tien_giam_tru',
      align: 'right',
      render: (v: number) => fmtVnd(v),
    },
  ]

  const sortedBac = selected
    ? [...selected.bac_thue].sort((a, b) => a.bac - b.bac)
    : []

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Biểu tính thuế thu nhập cá nhân</Title>
          </Col>
          <Col>
            <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm biểu
            </Button>
            {settingsButton}
          </Space>
          </Col>
        </Row>

        <Table
          locale={{ emptyText: <EmptyState size="small" /> }}
          rowKey="id"
          dataSource={data}
          columns={displayBieuColumns}
          loading={isLoading}
          pagination={false}
          size="small"
          rowClassName={(r) => (r.id === selectedId ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => setSelectedId(r.id), style: { cursor: 'pointer' } })}
        />
      </Card>

      {selected && (
        <Card title={`Bậc thuế — ${selected.ten_bieu}`} style={{ marginTop: 16 }}>
          <Table
            locale={{ emptyText: <EmptyState size="small" /> }}
            rowKey="id"
            dataSource={sortedBac}
            columns={bacColumns}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      <Modal
        title="Thêm biểu tính thuế thu nhập cá nhân"
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        width={820}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Tên"
                name="ten_bieu"
                rules={[{ required: true, message: 'Nhập tên biểu thuế' }]}
              >
                <Input placeholder="VD: Biểu thuế TNCN 2024" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Năm"
                name="nam_ap_dung"
                rules={[{ required: true, message: 'Nhập năm' }]}
              >
                <InputNumber min={2000} max={2100} style={{ width: '100%' }} placeholder="2024" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Loại"
                name="loai"
                rules={[{ required: true, message: 'Chọn loại' }]}
              >
                <Select placeholder="Chọn loại" options={LOAI_OPTIONS} onChange={onLoaiChange} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input.TextArea rows={2} placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>

          <Text strong>Bậc thuế</Text>
          <div style={{ marginTop: 8 }}>
            <Row gutter={8} style={{ fontWeight: 600, marginBottom: 4 }}>
              <Col span={2}>Bậc</Col>
              <Col span={6}>Thu nhập từ</Col>
              <Col span={6}>Thu nhập đến</Col>
              <Col span={5}>Tỷ lệ thuế %</Col>
              <Col span={5}>Giảm trừ</Col>
            </Row>
            <Form.List name="bac_thue">
              {(fields) => (
                <>
                  {fields.map((field, index) => {
                    const isLast = index === fields.length - 1
                    return (
                      <Row gutter={8} key={field.key} align="middle" style={{ marginBottom: 4 }}>
                        <Col span={2}>
                          <Form.Item name={[field.name, 'bac']} noStyle>
                            <InputNumber disabled style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name={[field.name, 'thu_nhap_tu']} noStyle>
                            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name={[field.name, 'thu_nhap_den']} noStyle>
                            <InputNumber
                              min={0}
                              step={1000}
                              disabled={isLast}
                              placeholder={isLast ? 'Không giới hạn' : ''}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item name={[field.name, 'ty_le_thue']} noStyle>
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item name={[field.name, 'so_tien_giam_tru']} noStyle>
                            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    )
                  })}
                </>
              )}
            </Form.List>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
