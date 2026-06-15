import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AutoComplete, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  message, Modal, Row, Select, Space, Table, Tabs, Tag, Typography,
} from 'antd'
import {
  PlusOutlined, CalendarOutlined, CheckOutlined, StopOutlined, DownloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import client from '../../api/client'
import PageLayout from '../../components/PageLayout'
import ImportExcelButton from '../../components/ImportExcelButton'
import { usePhapNhan } from '../../hooks/useMasterData'
import { fmtVND } from '../../utils/exportUtils'

const { Text } = Typography

interface LichTraNo {
  id: number
  ky_so: number
  ngay_den_han: string
  so_tien_goc: number
  so_tien_lai: number
  tong_cong: number
  trang_thai: string
  ngay_tra_thuc: string | null
  so_tien_tra_thuc: number | null
}

interface KheUocVay {
  id: number
  so_khe_uoc: string
  ngay_ky: string
  ngay_hieu_luc: string
  ngay_ket_thuc: string
  to_chuc_cho_vay: string
  so_tien_vay: number
  lai_suat: number
  ky_tinh_lai: string
  phuong_thuc_tra: string
  tai_khoan_nhan: string | null
  tai_san_the_chap: string | null
  ghi_chu: string | null
  trang_thai: string
  phap_nhan_id: number | null
  lich_tra: LichTraNo[]
}

const TRANG_THAI: Record<string, { label: string; color: string }> = {
  hieu_luc: { label: 'Hiệu lực', color: 'blue' },
  da_tra:   { label: 'Đã trả',   color: 'green' },
  huy:      { label: 'Hủy',      color: 'red'   },
}

const TRANG_THAI_KY: Record<string, { label: string; color: string }> = {
  chua_tra: { label: 'Chưa trả', color: 'orange' },
  da_tra:   { label: 'Đã trả',   color: 'green'  },
  qua_han:  { label: 'Quá hạn',  color: 'red'    },
}

const PHUONG_THUC = [
  { value: 'gop_deu',  label: 'Góp đều (Annuity)' },
  { value: 'goc_deu',  label: 'Gốc đều' },
  { value: 'cuoi_ky',  label: 'Cuối kỳ (Bullet)' },
]

const KY_TINH_LAI = [
  { value: 'thang', label: 'Hàng tháng' },
  { value: 'quy',   label: 'Hàng quý' },
  { value: 'nam',   label: 'Hàng năm' },
]

export default function KheUocVayPage() {
  const qc = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [selected, setSelected] = useState<KheUocVay | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [traNoOpen, setTraNoOpen] = useState(false)
  const [traNoKy, setTraNoKy] = useState<LichTraNo | null>(null)
  const [form] = Form.useForm()
  const [formTraNo] = Form.useForm()

  const { data: list, isLoading } = useQuery({
    queryKey: ['khe-uoc-vay', filterTrangThai, filterPhapNhan],
    queryFn: () => client.get('/accounting/khe-uoc-vay', {
      params: { trang_thai: filterTrangThai, phap_nhan_id: filterPhapNhan },
    }).then(r => r.data),
  })

  const { data: nganHangList } = useQuery({
    queryKey: ['ngan-hang-active'],
    queryFn: () => client.get('/ngan-hang', { params: { trang_thai: true } }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const nganHangOptions = (nganHangList ?? []).map((b: { ten_day_du: string }) => ({
    value: b.ten_day_du,
    label: b.ten_day_du,
  }))

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['khe-uoc-vay-detail', selected?.id],
    queryFn: () =>
      selected ? client.get(`/accounting/khe-uoc-vay/${selected.id}`).then(r => r.data) : null,
    enabled: !!selected,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      client.post('/accounting/khe-uoc-vay', body).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo khế ước thành công')
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      setCreateOpen(false)
      form.resetFields()
    },
    onError: () => message.error('Tạo thất bại'),
  })

  const generateMutation = useMutation({
    mutationFn: (id: number) =>
      client.post(`/accounting/khe-uoc-vay/${id}/generate-schedule`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã sinh lịch trả nợ')
      refetchDetail()
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
    },
    onError: () => message.error('Sinh lịch thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      client.delete(`/accounting/khe-uoc-vay/${id}/schedule`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã xóa lịch trả nợ')
      refetchDetail()
    },
    onError: () => message.error('Xóa lịch thất bại'),
  })

  const traNoMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      client.patch(`/accounting/khe-uoc-vay/${id}/tra-no`, body).then(r => r.data),
    onSuccess: () => {
      message.success('Đã đánh dấu đã trả')
      setTraNoOpen(false)
      formTraNo.resetFields()
      refetchDetail()
    },
    onError: () => message.error('Thao tác thất bại'),
  })

  const ketThucMutation = useMutation({
    mutationFn: (id: number) =>
      client.patch(`/accounting/khe-uoc-vay/${id}/ket-thuc`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã kết thúc khế ước')
      qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })
      refetchDetail()
    },
    onError: () => message.error('Thao tác thất bại'),
  })

  const items: KheUocVay[] = list ?? []

  const columns: ColumnsType<KheUocVay> = [
    {
      title: 'Số KU',
      dataIndex: 'so_khe_uoc',
      width: 160,
      render: (v, r) => (
        <a onClick={() => setSelected(r)}>{v}</a>
      ),
    },
    { title: 'Tổ chức cho vay', dataIndex: 'to_chuc_cho_vay', ellipsis: true },
    {
      title: 'Số tiền vay',
      dataIndex: 'so_tien_vay',
      width: 140,
      align: 'right',
      render: v => fmtVND(v),
    },
    {
      title: 'Lãi suất',
      dataIndex: 'lai_suat',
      width: 90,
      align: 'right',
      render: v => `${v}%/năm`,
    },
    {
      title: 'Đến hạn',
      dataIndex: 'ngay_ket_thuc',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const s = TRANG_THAI[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
    {
      title: '',
      width: 80,
      render: (_, r) => (
        <Button size="small" onClick={() => setSelected(r)}>Chi tiết</Button>
      ),
    },
  ]

  const lichColumns: ColumnsType<LichTraNo> = [
    { title: 'Kỳ', dataIndex: 'ky_so', width: 50, align: 'center' },
    { title: 'Ngày đến hạn', dataIndex: 'ngay_den_han', width: 120, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Tiền gốc', dataIndex: 'so_tien_goc', align: 'right', render: v => fmtVND(v) },
    { title: 'Tiền lãi', dataIndex: 'so_tien_lai', align: 'right', render: v => fmtVND(v) },
    { title: 'Tổng cộng', dataIndex: 'tong_cong', align: 'right', render: v => <Text strong>{fmtVND(v)}</Text> },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const s = TRANG_THAI_KY[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
    {
      title: '',
      width: 90,
      render: (_, r) =>
        r.trang_thai === 'chua_tra' ? (
          <Button
            size="small"
            type="link"
            onClick={() => {
              setTraNoKy(r)
              setTraNoOpen(true)
            }}
          >
            Trả nợ
          </Button>
        ) : null,
    },
  ]

  const currentDetail: KheUocVay = detail ?? selected

  return (
    <PageLayout
      title="Khế ước đi vay"
      actions={
        <Space>
          <ImportExcelButton
            endpoint="/accounting/khe-uoc-vay"
            templateFilename="mau_import_khe_uoc_di_vay.xlsx"
            buttonText="Import Excel"
            onImported={() => qc.invalidateQueries({ queryKey: ['khe-uoc-vay'] })}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={() => {
              const params = new URLSearchParams()
              if (filterTrangThai) params.set('trang_thai', filterTrangThai)
              if (filterPhapNhan) params.set('phap_nhan_id', String(filterPhapNhan))
              window.open(`/api/accounting/khe-uoc-vay/export?${params}`, '_blank')
            }}
          >
            Export Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Tạo khế ước
          </Button>
        </Space>
      }
    >
      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12}>
          <Col>
            <Select
              style={{ width: 160 }}
              allowClear
              placeholder="Trạng thái"
              onChange={v => setFilterTrangThai(v)}
              options={Object.entries(TRANG_THAI).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 200 }}
              allowClear
              placeholder="Pháp nhân"
              onChange={v => setFilterPhapNhan(v)}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
        </Row>
      </Card>

      <Table<KheUocVay>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showTotal: t => `${t} khế ước` }}
      />

      {/* Detail Drawer */}
      <Drawer
        title={currentDetail ? `${currentDetail.so_khe_uoc} — ${currentDetail.to_chuc_cho_vay}` : ''}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={760}
        extra={
          currentDetail?.trang_thai === 'hieu_luc' && (
            <Space>
              <Button
                icon={<CalendarOutlined />}
                loading={generateMutation.isPending}
                onClick={() => generateMutation.mutate(currentDetail.id)}
              >
                Sinh lịch
              </Button>
              {(currentDetail.lich_tra?.length ?? 0) > 0 && (
                <Button
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Xóa lịch trả nợ?',
                      content: 'Toàn bộ lịch trả nợ sẽ bị xóa để tái tạo.',
                      onOk: () => deleteMutation.mutate(currentDetail.id),
                    })
                  }
                >
                  Xóa lịch
                </Button>
              )}
              <Button
                icon={<StopOutlined />}
                onClick={() =>
                  Modal.confirm({
                    title: 'Kết thúc khế ước?',
                    content: 'Trạng thái chuyển sang Đã trả. Không thể hoàn tác.',
                    onOk: () => ketThucMutation.mutate(currentDetail.id),
                  })
                }
              >
                Kết thúc
              </Button>
            </Space>
          )
        }
      >
        {currentDetail && (
          <Tabs
            items={[
              {
                key: 'info',
                label: 'Thông tin',
                children: (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Số khế ước">{currentDetail.so_khe_uoc}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">
                      <Tag color={TRANG_THAI[currentDetail.trang_thai]?.color}>
                        {TRANG_THAI[currentDetail.trang_thai]?.label}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổ chức cho vay" span={2}>{currentDetail.to_chuc_cho_vay}</Descriptions.Item>
                    <Descriptions.Item label="Số tiền vay">{fmtVND(currentDetail.so_tien_vay)}</Descriptions.Item>
                    <Descriptions.Item label="Lãi suất">{currentDetail.lai_suat}%/năm</Descriptions.Item>
                    <Descriptions.Item label="Kỳ tính lãi">
                      {KY_TINH_LAI.find(k => k.value === currentDetail.ky_tinh_lai)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phương thức trả">
                      {PHUONG_THUC.find(p => p.value === currentDetail.phuong_thuc_tra)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày ký">{dayjs(currentDetail.ngay_ky).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Ngày hiệu lực">{dayjs(currentDetail.ngay_hieu_luc).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Ngày kết thúc">{dayjs(currentDetail.ngay_ket_thuc).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="TK nhận tiền">{currentDetail.tai_khoan_nhan ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Tài sản thế chấp" span={2}>{currentDetail.tai_san_the_chap ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ghi chú" span={2}>{currentDetail.ghi_chu ?? '—'}</Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'schedule',
                label: `Lịch trả nợ (${currentDetail.lich_tra?.length ?? 0})`,
                children: (
                  <Table<LichTraNo>
                    columns={lichColumns}
                    dataSource={currentDetail.lich_tra ?? []}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    summary={rows => {
                      const totalGoc = rows.reduce((s, r) => s + Number(r.so_tien_goc), 0)
                      const totalLai = rows.reduce((s, r) => s + Number(r.so_tien_lai), 0)
                      const totalTong = rows.reduce((s, r) => s + Number(r.tong_cong), 0)
                      return (
                        <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                          <Table.Summary.Cell index={0} colSpan={2}>Tổng</Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">{fmtVND(totalGoc)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">{fmtVND(totalLai)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">{fmtVND(totalTong)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={5} colSpan={2} />
                        </Table.Summary.Row>
                      )
                    }}
                    locale={{ emptyText: 'Chưa có lịch — nhấn "Sinh lịch" để tạo' }}
                  />
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Create Modal */}
      <Modal
        title="Tạo khế ước đi vay"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() =>
          form.validateFields().then(v => {
            createMutation.mutate({
              ...v,
              ngay_ky: v.ngay_ky?.format('YYYY-MM-DD'),
              ngay_hieu_luc: v.ngay_hieu_luc?.format('YYYY-MM-DD'),
              ngay_ket_thuc: v.ngay_ket_thuc?.format('YYYY-MM-DD'),
            })
          })
        }
        confirmLoading={createMutation.isPending}
        width={620}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="to_chuc_cho_vay" label="Tổ chức cho vay" rules={[{ required: true }]}>
                <AutoComplete
                  options={nganHangOptions}
                  placeholder="Tìm hoặc nhập tên ngân hàng"
                  filterOption={(input, opt) =>
                    (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phap_nhan_id" label="Pháp nhân">
                <Select
                  allowClear
                  options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_tien_vay" label="Số tiền vay (đ)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="lai_suat" label="Lãi suất (%/năm)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ky_tinh_lai" label="Kỳ tính lãi" initialValue="thang">
                <Select options={KY_TINH_LAI} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="ngay_ky" label="Ngày ký" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ngay_hieu_luc" label="Ngày hiệu lực" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ngay_ket_thuc" label="Ngày kết thúc" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phuong_thuc_tra" label="Phương thức trả" initialValue="gop_deu">
                <Select options={PHUONG_THUC} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tai_khoan_nhan" label="TK nhận tiền">
                <Input placeholder="VD: 112.01" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tai_san_the_chap" label="Tài sản thế chấp">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tra no modal */}
      <Modal
        title={`Đánh dấu đã trả — Kỳ ${traNoKy?.ky_so}`}
        open={traNoOpen}
        onCancel={() => { setTraNoOpen(false); formTraNo.resetFields() }}
        onOk={() =>
          formTraNo.validateFields().then(v => {
            if (!selected || !traNoKy) return
            traNoMutation.mutate({
              id: selected.id,
              body: {
                ky_so: traNoKy.ky_so,
                ngay_tra_thuc: v.ngay_tra_thuc?.format('YYYY-MM-DD'),
                so_tien_tra_thuc: v.so_tien_tra_thuc,
              },
            })
          })
        }
        confirmLoading={traNoMutation.isPending}
      >
        {traNoKy && (
          <div style={{ marginBottom: 16 }}>
            <Text>Số tiền cần trả: <Text strong>{fmtVND(traNoKy.tong_cong)}</Text></Text>
          </div>
        )}
        <Form form={formTraNo} layout="vertical">
          <Form.Item name="ngay_tra_thuc" label="Ngày trả thực" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" defaultValue={dayjs()} />
          </Form.Item>
          <Form.Item name="so_tien_tra_thuc" label="Số tiền trả thực (đ)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              min={0}
              defaultValue={traNoKy?.tong_cong}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  )
}
