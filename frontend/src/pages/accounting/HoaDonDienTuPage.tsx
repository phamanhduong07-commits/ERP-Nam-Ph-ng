import React, { useState } from 'react'
import type { ApiError } from '../../api/types'
import {
  Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row,
  Select, Space, Table, Tag, Typography, message, Popconfirm, Tooltip, Alert,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined,
  LinkOutlined, MinusCircleOutlined, PrinterOutlined, PlusOutlined, StopOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  hdtApi, HoaDonDienTu, HoaDonItem,
  TRANG_THAI_HDT, TRANG_THAI_HDT_COLOR,
} from '../../api/hoaDonDienTu'
import { useAuthStore } from '../../store/auth'
import { usePhapNhanList, usePhapNhanForPrint } from '../../hooks/usePhapNhan'
import { fmtVND } from '../../utils/exportUtils'
import { printHoaDonDienTu } from '../../utils/printHoaDonDienTu'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const HDT_ACTION_ROLES = ['KE_TOAN', 'KE_TOAN_CONG_NO', 'KE_TOAN_TRUONG', 'GIAM_DOC', 'ADMIN']

const DEFAULT_ITEM = (): HoaDonItem => ({
  ten_hang: '',
  ma_hang: '',
  don_vi: 'Thùng',
  so_luong: 1,
  don_gia: 0,
  thanh_tien: 0,
  thue_suat: '10%',
})

export default function HoaDonDienTuPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canAct = HDT_ACTION_ROLES.includes(user?.role ?? '')

  const [filterForm] = Form.useForm()
  const [huyForm] = Form.useForm()
  const [createForm] = Form.useForm()

  const [huyModal, setHuyModal] = useState<HoaDonDienTu | null>(null)
  const [viewModal, setViewModal] = useState<HoaDonDienTu | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [items, setItems] = useState<HoaDonItem[]>([DEFAULT_ITEM()])

  const { data: phapNhanList = [] } = usePhapNhanList()
  const printCompany = usePhapNhanForPrint(viewModal?.phap_nhan_id)

  const [filters, setFilters] = useState<{
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
    phap_nhan_id?: number
  }>({})

  const { data = [], isLoading } = useQuery({
    queryKey: ['hoa-don-dien-tu', filters],
    queryFn: () => hdtApi.list(filters).then(r => r.data),
  })

  // ── mutations ──────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (vals: Record<string, unknown> & { ngay_lap: dayjs.Dayjs }) => {
      const vat_pct = Number(vals.vat_pct ?? 10)
      const tong_tien_hang = items.reduce((s, it) => s + it.thanh_tien, 0)
      const tien_thue = Math.round(tong_tien_hang * vat_pct / 100)
      return hdtApi.create({
        ngay_lap: vals.ngay_lap.format('YYYY-MM-DD'),
        loai_hd: vals.loai_hd as string,
        ten_khach_hang: vals.ten_khach_hang as string,
        ma_so_thue_kh: (vals.ma_so_thue_kh as string) || undefined,
        dia_chi_kh: (vals.dia_chi_kh as string) || undefined,
        tong_tien_hang,
        tien_thue_gtgt: tien_thue,
        tong_cong: tong_tien_hang + tien_thue,
        items,
        phap_nhan_id: vals.phap_nhan_id as number || undefined,
        ghi_chu: (vals.ghi_chu as string) || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] })
      message.success('Đã tạo HĐDT nháp')
      setShowCreate(false)
      createForm.resetFields()
      setItems([DEFAULT_ITEM()])
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạo HĐDT'),
  })

  const phatHanhMut = useMutation({
    mutationFn: (id: number) => hdtApi.phatHanh(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] }); message.success('Phát hành thành công') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi phát hành'),
  })

  const huyMut = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) => hdtApi.huy(id, ly_do),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] })
      message.success('Đã hủy hóa đơn')
      setHuyModal(null)
      huyForm.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi hủy HĐ'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => hdtApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] }); message.success('Đã xóa') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xóa'),
  })

  const syncMut = useMutation({
    mutationFn: (id: number) => hdtApi.syncStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hoa-don-dien-tu'] }); message.success('Đã đồng bộ') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi sync'),
  })

  // ── helpers ────────────────────────────────────────────────────
  const updateItem = (idx: number, field: keyof HoaDonItem, val: unknown) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: val }
      if (field === 'so_luong' || field === 'don_gia') {
        updated.thanh_tien = Number(updated.so_luong) * Number(updated.don_gia)
      }
      return updated
    }))
  }

  const tongTienHang = items.reduce((s, it) => s + it.thanh_tien, 0)
  const vatPct = Form.useWatch('vat_pct', createForm) ?? 10
  const tienThue = Math.round(tongTienHang * Number(vatPct) / 100)
  const tongCong = tongTienHang + tienThue

  // ── columns ────────────────────────────────────────────────────
  const columns: ColumnsType<HoaDonDienTu> = [
    {
      title: 'Số HĐ',
      dataIndex: 'so_hoa_don',
      width: 140,
      render: (v) => v || <span style={{ color: '#aaa' }}>Chưa phát hành</span>,
    },
    { title: 'Ký hiệu', dataIndex: 'ky_hieu', width: 90 },
    {
      title: 'Ngày lập',
      dataIndex: 'ngay_lap',
      width: 110,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '',
    },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    { title: 'MST', dataIndex: 'ma_so_thue_kh', width: 130 },
    {
      title: 'Pháp nhân',
      dataIndex: 'phap_nhan_id',
      width: 140,
      render: (v) => phapNhanList.find(p => p.id === v)?.ten_phap_nhan ?? '—',
    },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      width: 140,
      align: 'right',
      render: v => fmtVND(v),
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
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setViewModal(r)} />
          </Tooltip>
          {r.pdf_url && (
            <Tooltip title="Xem PDF">
              <Button size="small" icon={<FileTextOutlined />} onClick={() => window.open(r.pdf_url!, '_blank')} />
            </Tooltip>
          )}
          {r.sales_invoice_id && (
            <Tooltip title="Xem hóa đơn bán">
              <Button size="small" icon={<LinkOutlined />}
                onClick={() => navigate(`/billing/invoices/${r.sales_invoice_id}`)} />
            </Tooltip>
          )}
          {canAct && r.trang_thai === 'nhap' && (
            <Tooltip title="Phát hành">
              <Popconfirm title="Phát hành lên MISA?" onConfirm={() => phatHanhMut.mutate(r.id)}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={phatHanhMut.isPending} />
              </Popconfirm>
            </Tooltip>
          )}
          {canAct && r.misa_id && r.trang_thai !== 'nhap' && (
            <Tooltip title="Sync trạng thái">
              <Button size="small" icon={<SyncOutlined />} loading={syncMut.isPending}
                onClick={() => syncMut.mutate(r.id)} />
            </Tooltip>
          )}
          {canAct && r.trang_thai === 'da_phat_hanh' && (
            <Tooltip title="Hủy HĐ">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => setHuyModal(r)} />
            </Tooltip>
          )}
          {canAct && r.trang_thai === 'nhap' && (
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

  const { displayColumns, settingsButton } = useColumnPrefs('accounting-hoa-don-dien-tu', columns)

  // ── item columns (editable) ────────────────────────────────────
  const itemColumns: ColumnsType<HoaDonItem> = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      render: (v, _, idx) => (
        <Input size="small" value={v} onChange={e => updateItem(idx, 'ten_hang', e.target.value)}
          placeholder="Tên hàng hóa" />
      ),
    },
    {
      title: 'Mã hàng',
      dataIndex: 'ma_hang',
      width: 100,
      render: (v, _, idx) => (
        <Input size="small" value={v} onChange={e => updateItem(idx, 'ma_hang', e.target.value)} />
      ),
    },
    {
      title: 'ĐVT',
      dataIndex: 'don_vi',
      width: 70,
      render: (v, _, idx) => (
        <Input size="small" value={v} onChange={e => updateItem(idx, 'don_vi', e.target.value)} />
      ),
    },
    {
      title: 'SL',
      dataIndex: 'so_luong',
      width: 80,
      render: (v, _, idx) => (
        <InputNumber size="small" value={v} min={0} style={{ width: '100%' }}
          onChange={val => updateItem(idx, 'so_luong', val ?? 0)} />
      ),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 130,
      render: (v, _, idx) => (
        <InputNumber size="small" value={v} min={0} style={{ width: '100%' }}
          formatter={val => val ? Number(val).toLocaleString('vi-VN') : ''}
          parser={val => Number((val ?? '').replace(/\D/g, '')) as number}
          onChange={val => updateItem(idx, 'don_gia', val ?? 0)} />
      ),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'thanh_tien',
      width: 120,
      align: 'right',
      render: (v) => <Text strong>{fmtVND(v)}</Text>,
    },
    {
      title: 'Thuế suất',
      dataIndex: 'thue_suat',
      width: 90,
      render: (v, _, idx) => (
        <Select size="small" value={v} style={{ width: '100%' }}
          onChange={val => updateItem(idx, 'thue_suat', val)}>
          {['10%', '8%', '5%', '0%', 'KCT'].map(s => (
            <Select.Option key={s} value={s}>{s}</Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '',
      width: 36,
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
          disabled={items.length === 1}
          onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} />
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Hóa đơn điện tử</Title>
        <Space>
          {settingsButton}
          {canAct && (
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => {
                createForm.setFieldsValue({ ngay_lap: dayjs(), loai_hd: '1', vat_pct: 10 })
                setItems([DEFAULT_ITEM()])
                setShowCreate(true)
              }}>
              Tạo HĐDT nháp
            </Button>
          )}
        </Space>
      </div>

      <Form form={filterForm} layout="inline" style={{ marginBottom: 16 }} onValuesChange={(_, all) => {
        const [t1, t2] = all.date_range || []
        setFilters({
          trang_thai: all.trang_thai || undefined,
          tu_ngay: t1 ? t1.format('YYYY-MM-DD') : undefined,
          den_ngay: t2 ? t2.format('YYYY-MM-DD') : undefined,
          phap_nhan_id: all.phap_nhan_id || undefined,
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
        <Form.Item name="phap_nhan_id">
          <Select placeholder="Pháp nhân" allowClear style={{ width: 180 }}>
            {phapNhanList.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.ten_phap_nhan}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>

      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        columns={displayColumns}
        dataSource={data}
        loading={isLoading}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, showTotal: total => `${total} hóa đơn` }}
      />

      {/* ── Modal tạo HĐDT nháp ── */}
      <Modal
        title="Tạo hóa đơn điện tử (Nháp)"
        open={showCreate}
        onCancel={() => { setShowCreate(false); createForm.resetFields(); setItems([DEFAULT_ITEM()]) }}
        onOk={() => createForm.validateFields().then(vals => createMut.mutate(vals as Parameters<typeof createMut.mutate>[0]))}
        okText="Lưu nháp"
        confirmLoading={createMut.isPending}
        width={900}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="ngay_lap" label="Ngày lập" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="loai_hd" label="Loại HĐ" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="1">01 — HĐ GTGT</Select.Option>
                  <Select.Option value="2">02 — HĐ bán hàng</Select.Option>
                  <Select.Option value="7">07 — Phiếu xuất kho</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="vat_pct" label="Thuế suất VAT (%)">
                <Select>
                  {[0, 5, 8, 10].map(v => (
                    <Select.Option key={v} value={v}>{v}%</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="phap_nhan_id" label="Pháp nhân">
                <Select placeholder="Chọn pháp nhân" allowClear>
                  {phapNhanList.map(p => (
                    <Select.Option key={p.id} value={p.id}>{p.ten_phap_nhan}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ten_khach_hang" label="Tên khách hàng" rules={[{ required: true }]}>
                <Input placeholder="Tên đơn vị mua hàng" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ma_so_thue_kh" label="Mã số thuế KH">
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="dia_chi_kh" label="Địa chỉ KH">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          {/* Bảng items */}
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Hàng hóa, dịch vụ</div>
          <Table
            size="small"
            dataSource={items}
            columns={itemColumns}
            rowKey={(_, i) => i ?? 0}
            pagination={false}
            style={{ marginBottom: 8 }}
          />
          <Button size="small" icon={<PlusOutlined />}
            onClick={() => setItems(prev => [...prev, DEFAULT_ITEM()])}
            style={{ marginBottom: 16 }}>
            Thêm dòng
          </Button>

          {/* Tổng tiền */}
          <div style={{
            background: '#f6f8ff', borderRadius: 6, padding: '10px 14px',
            border: '1px solid #e6eaff', fontSize: 13, marginBottom: 12,
          }}>
            <Row gutter={24}>
              <Col span={8}><span style={{ color: '#888' }}>Tiền hàng: </span><strong>{fmtVND(tongTienHang)}</strong></Col>
              <Col span={8}><span style={{ color: '#888' }}>Thuế GTGT: </span><strong>{fmtVND(tienThue)}</strong></Col>
              <Col span={8}><span style={{ color: '#888' }}>Tổng cộng: </span><strong style={{ color: '#1677ff', fontSize: 14 }}>{fmtVND(tongCong)}</strong></Col>
            </Row>
          </div>

          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal xem chi tiết ── */}
      <Modal
        title={`Chi tiết HĐDT${viewModal?.so_hoa_don ? ` — ${viewModal.so_hoa_don}` : ' (Nháp)'}`}
        open={!!viewModal}
        onCancel={() => setViewModal(null)}
        footer={
          <Space>
            <Button icon={<PrinterOutlined />}
              onClick={() => viewModal && printHoaDonDienTu(viewModal, printCompany)}>
              In hóa đơn
            </Button>
            {viewModal?.pdf_url && (
              <Button icon={<FileTextOutlined />} onClick={() => window.open(viewModal.pdf_url!, '_blank')}>Xem PDF</Button>
            )}
          </Space>
        }
        width={700}
        destroyOnClose
      >
        {viewModal && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>Ngày lập: </span><strong>{dayjs(viewModal.ngay_lap).format('DD/MM/YYYY')}</strong></div>
              <div><span style={{ color: '#888' }}>Loại HĐ: </span><strong>{{ '1': '01 — HĐ GTGT', '2': '02 — HĐ bán hàng', '7': '07 — Phiếu xuất kho' }[viewModal.loai_hd] ?? viewModal.loai_hd}</strong></div>
              <div><span style={{ color: '#888' }}>Trạng thái: </span><Tag color={TRANG_THAI_HDT_COLOR[viewModal.trang_thai]}>{TRANG_THAI_HDT[viewModal.trang_thai]}</Tag></div>
              {viewModal.ky_hieu && <div><span style={{ color: '#888' }}>Ký hiệu: </span><strong>{viewModal.ky_hieu}</strong></div>}
            </div>
            <div style={{ fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>Khách hàng: </span><strong>{viewModal.ten_khach_hang}</strong></div>
              {viewModal.ma_so_thue_kh && <div><span style={{ color: '#888' }}>MST: </span>{viewModal.ma_so_thue_kh}</div>}
              {viewModal.dia_chi_kh && <div><span style={{ color: '#888' }}>Địa chỉ: </span>{viewModal.dia_chi_kh}</div>}
            </div>
            {(viewModal.items ?? []).length > 0 && (
              <Table
                size="small"
                dataSource={viewModal.items ?? []}
                rowKey={(_, i) => i ?? 0}
                pagination={false}
                columns={[
                  { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                  { title: 'ĐVT', dataIndex: 'don_vi', width: 60 },
                  { title: 'SL', dataIndex: 'so_luong', width: 70, align: 'right' as const },
                  { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const, render: (v: number) => fmtVND(v) },
                  { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, align: 'right' as const, render: (v: number) => fmtVND(v) },
                  { title: 'Thuế suất', dataIndex: 'thue_suat', width: 80, align: 'center' as const },
                ]}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, paddingTop: 8, borderTop: '1px solid #f0f0f0', fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>Tiền hàng: </span><strong>{fmtVND(viewModal.tong_tien_hang)}</strong></div>
              <div><span style={{ color: '#888' }}>Thuế GTGT: </span><strong>{fmtVND(viewModal.tien_thue_gtgt)}</strong></div>
              <div><span style={{ color: '#888' }}>Tổng cộng: </span><strong style={{ color: '#1677ff', fontSize: 14 }}>{fmtVND(viewModal.tong_cong)}</strong></div>
            </div>
            {viewModal.ghi_chu && <div style={{ fontSize: 12, color: '#888' }}>Ghi chú: {viewModal.ghi_chu}</div>}
            {viewModal.ly_do_huy && <div style={{ fontSize: 12, color: '#f5222d' }}>Lý do hủy: {viewModal.ly_do_huy}</div>}
          </Space>
        )}
      </Modal>

      {/* ── Modal hủy ── */}
      <Modal
        title="Hủy hóa đơn"
        open={!!huyModal}
        onCancel={() => { setHuyModal(null); huyForm.resetFields() }}
        onOk={() => huyForm.validateFields().then(vals => {
          if (huyModal) huyMut.mutate({ id: huyModal.id, ly_do: vals.ly_do })
        })}
        confirmLoading={huyMut.isPending}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={huyForm} layout="vertical">
          <Form.Item name="ly_do" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
            <Input.TextArea rows={3} placeholder="Mô tả lý do hủy hóa đơn điện tử..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
