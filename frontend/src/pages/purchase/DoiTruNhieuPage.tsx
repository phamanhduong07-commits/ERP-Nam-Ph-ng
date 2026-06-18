import { useState, useEffect, useMemo } from 'react'
import {
  Button, Card, Checkbox, DatePicker, Input, InputNumber, message, Select, Space,
  Steps, Table, Tag, Typography,
} from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import client from '../../api/client'
import dayjs from 'dayjs'

const { Text } = Typography
const API = ''

type SupplierRow = {
  id: number; ma_ncc: string; ten_ncc: string
  ma_so_thue: string | null; dia_chi: string | null
  so_thanh_toan_chua_doi_tru: number
}
type PreviewItem = {
  purchase_invoice_id: number; so_hoa_don: string
  cash_payment_id: number; so_phieu_chi: string; so_tien_doi_tru: number
}
type PreviewRow = {
  supplier_id: number; ten_ncc: string
  so_items: number; tong_tien_doi_tru: number; items: PreviewItem[]
}

const fmt = (v: number) => v.toLocaleString('vi-VN')

export default function DoiTruNhieuPage() {
  const [step, setStep] = useState(0)
  const [ngayDoiTru, setNgayDoiTru] = useState(dayjs())
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phapNhanList, setPhapNhanList] = useState<{ id: number; ten_viet_tat: string; ten_phap_nhan: string }[]>([])
  const [allowEdit, setAllowEdit] = useState(false)
  const [ghiChu, setGhiChu] = useState('')
  const [search, setSearch] = useState('')
  const [supplierList, setSupplierList] = useState<SupplierRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({})

  async function fetchSuppliers() {
    setLoadingList(true)
    try {
      const params: Record<string, unknown> = {}
      if (phapNhanId) params.phap_nhan_id = phapNhanId
      const { data } = await client.get(`${API}/doi-tru/suppliers-pending`, { params })
      setSupplierList(data)
    } catch (e: any) {
      message.error(e.response?.data?.detail ?? 'Lỗi tải danh sách NCC')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    client.get(`${API}/phap-nhan`).then(r => setPhapNhanList(r.data)).catch(() => {})
    fetchSuppliers()
  }, [])

  const previewMut = useMutation({
    mutationFn: (body: object) => client.post(`${API}/doi-tru/nhieu-doi-tuong/preview`, body),
    onSuccess: res => {
      const rows: PreviewRow[] = res.data
      setPreview(rows)
      const amounts: Record<string, number> = {}
      rows.forEach(row => {
        row.items.forEach((item, idx) => {
          amounts[`${row.supplier_id}_${idx}`] = item.so_tien_doi_tru
        })
      })
      setEditAmounts(amounts)
      setStep(1)
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi tải preview'),
  })

  const confirmMut = useMutation({
    mutationFn: (body: object) => client.post(`${API}/doi-tru/nhieu-doi-tuong/confirm-with-items`, body),
    onSuccess: res => {
      const done = (res.data as any[]).filter(r => !r.skipped).length
      const skip = (res.data as any[]).filter(r => r.skipped).length
      message.success(`Hoàn thành: ${done} NCC đối trừ${skip > 0 ? `, ${skip} NCC bỏ qua` : ''}`)
      setStep(0)
      setSelectedIds([])
      setPreview([])
      fetchSuppliers()
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi xác nhận'),
  })

  function handleNext() {
    if (!selectedIds.length) { message.warning('Chọn ít nhất 1 NCC'); return }
    previewMut.mutate({ supplier_ids: selectedIds, ngay_doi_tru: ngayDoiTru.format('YYYY-MM-DD'), phap_nhan_id: phapNhanId })
  }

  function handleConfirm() {
    const suppliers = preview
      .filter(row => row.so_items > 0)
      .map(row => ({
        supplier_id: row.supplier_id,
        items: row.items
          .map((item, idx) => ({
            purchase_invoice_id: item.purchase_invoice_id,
            cash_payment_id: item.cash_payment_id,
            so_tien_doi_tru: editAmounts[`${row.supplier_id}_${idx}`] ?? item.so_tien_doi_tru,
          }))
          .filter(i => i.so_tien_doi_tru > 0),
      }))
      .filter(s => s.items.length > 0)

    if (!suppliers.length) { message.warning('Không có cặp đối trừ hợp lệ'); return }
    confirmMut.mutate({ ngay_doi_tru: ngayDoiTru.format('YYYY-MM-DD'), ghi_chu: ghiChu, phap_nhan_id: phapNhanId, suppliers })
  }

  const filteredList = useMemo(
    () => !search
      ? supplierList
      : supplierList.filter(s =>
          s.ten_ncc.toLowerCase().includes(search.toLowerCase()) ||
          s.ma_ncc.toLowerCase().includes(search.toLowerCase()),
        ),
    [supplierList, search],
  )

  const totalSelected = useMemo(
    () => supplierList.filter(s => selectedIds.includes(s.id)).reduce((sum, s) => sum + s.so_thanh_toan_chua_doi_tru, 0),
    [supplierList, selectedIds],
  )

  const step2Total = useMemo(
    () => preview.reduce((s, row) =>
      s + row.items.reduce((rs, _item, idx) => rs + (editAmounts[`${row.supplier_id}_${idx}`] ?? 0), 0), 0),
    [preview, editAmounts],
  )

  const step1Cols = [
    { title: 'Mã nhà cung cấp', dataIndex: 'ma_ncc', width: 160 },
    { title: 'Tên nhà cung cấp', dataIndex: 'ten_ncc', width: 280 },
    { title: 'Mã số thuế', dataIndex: 'ma_so_thue', width: 140, render: (v: string | null) => v ?? '—' },
    { title: 'Địa chỉ', dataIndex: 'dia_chi', ellipsis: true },
    {
      title: 'Số thanh toán chưa đối trừ', dataIndex: 'so_thanh_toan_chua_doi_tru',
      width: 210, align: 'right' as const,
      render: (v: number) => <Text type="warning">{fmt(v)}</Text>,
    },
  ]

  const step1Summary = () => {
    const tot = filteredList.reduce((s, r) => s + r.so_thanh_toan_chua_doi_tru, 0)
    return (
      <Table.Summary.Row style={{ background: '#f0f5ff' }}>
        <Table.Summary.Cell index={0} colSpan={4}><Text strong>Tổng</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right"><Text strong>{fmt(tot)}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    )
  }

  function pairCols(supplierId: number) {
    return [
      { title: 'Hóa đơn mua', dataIndex: 'so_hoa_don', width: 180 },
      { title: 'Phiếu chi', dataIndex: 'so_phieu_chi', width: 180 },
      {
        title: 'Số tiền đối trừ', dataIndex: 'so_tien_doi_tru', width: 200, align: 'right' as const,
        render: (v: number, _: PreviewItem, idx: number) =>
          allowEdit ? (
            <InputNumber<number>
              size="small"
              style={{ width: 170 }}
              value={editAmounts[`${supplierId}_${idx}`] ?? v}
              min={0}
              formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={val => { const c = val ? val.replace(/,/g, '') : ''; return c ? parseFloat(c) : 0 }}
              onChange={val => setEditAmounts(prev => ({ ...prev, [`${supplierId}_${idx}`]: val ?? 0 }))}
            />
          ) : (
            <Text>{fmt(v)}</Text>
          ),
      },
    ]
  }

  const filterBar = (
    <Card
      styles={{ body: { padding: '12px 16px' } }}
      style={{ marginBottom: 12, background: '#e8f5f5', borderColor: '#b2dfdb' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong>Pháp nhân</Text>
          <Select placeholder="Tất cả" allowClear style={{ width: 150 }}
            options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            onChange={v => setPhapNhanId(v ?? null)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong>Tài khoản phải trả</Text>
          <Select defaultValue="3311" style={{ width: 90 }}
            options={[{ value: '3311', label: '3311' }, { value: '3312', label: '3312' }]} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong>Ngày đối trừ</Text>
          <DatePicker value={ngayDoiTru} format="DD/MM/YYYY"
            onChange={v => v && setNgayDoiTru(v)} style={{ width: 130 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong>Loại tiền</Text>
          <Select defaultValue="VND" style={{ width: 80 }} options={[{ value: 'VND', label: 'VND' }]} />
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchSuppliers} loading={loadingList}
          style={{ background: '#00695c', color: '#fff', border: 'none' }}>
          Lấy dữ liệu
        </Button>
        <Checkbox checked={allowEdit} onChange={e => setAllowEdit(e.target.checked)}>
          Cho phép sửa chi tiết đối trừ
        </Checkbox>
        <Input
          placeholder="Nhập từ khóa tìm kiếm"
          style={{ width: 220, marginLeft: 'auto' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
      </div>
    </Card>
  )

  return (
    <div style={{ padding: 24 }}>
      <Steps
        current={step}
        style={{ marginBottom: 20, maxWidth: 400 }}
        items={[{ title: 'Chọn nhà cung cấp' }, { title: 'Chi tiết đối trừ' }]}
      />

      {filterBar}

      {/* ── Step 1: Bảng NCC ── */}
      {step === 0 && (
        <>
          <Card size="small">
            <Table<SupplierRow>
              dataSource={filteredList}
              columns={step1Cols}
              rowKey="id"
              size="small"
              loading={loadingList}
              pagination={false}
              scroll={{ x: 900, y: 480 }}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedIds,
                onChange: keys => setSelectedIds(keys as number[]),
              }}
              summary={step1Summary}
              locale={{ emptyText: 'Không có NCC nào có chứng từ thanh toán chưa đối trừ' }}
            />
          </Card>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              Đã chọn <Text strong>{selectedIds.length}</Text> NCC
              {selectedIds.length > 0 && ` — Tổng chưa đối trừ: ${fmt(totalSelected)} đ`}
            </Text>
            <Button
              type="primary"
              onClick={handleNext}
              loading={previewMut.isPending}
              disabled={!selectedIds.length}
              style={{ background: '#00695c', borderColor: '#00695c' }}
            >
              Tiếp theo <ArrowRightOutlined />
            </Button>
          </div>
        </>
      )}

      {/* ── Step 2: Preview + xác nhận ── */}
      {step === 1 && (
        <>
          {preview.map(row => (
            <Card
              key={row.supplier_id}
              size="small"
              style={{ marginBottom: 8 }}
              styles={{ header: { background: '#f5f5f5' } }}
              title={
                <Space>
                  <Text strong>{row.ten_ncc}</Text>
                  {row.so_items > 0
                    ? <Tag color="green">{row.so_items} cặp — {fmt(row.tong_tien_doi_tru)} đ</Tag>
                    : <Tag color="default">Không có cặp phù hợp</Tag>}
                </Space>
              }
            >
              {row.so_items > 0 ? (
                <Table<PreviewItem>
                  dataSource={row.items}
                  columns={pairCols(row.supplier_id)}
                  rowKey={(_, i) => String(i)}
                  size="small"
                  pagination={false}
                />
              ) : (
                <Text type="secondary">Không có phiếu chi và hóa đơn phù hợp để ghép</Text>
              )}
            </Card>
          ))}

          <Card size="small" styles={{ body: { padding: '10px 16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Text strong style={{ whiteSpace: 'nowrap' }}>Ghi chú:</Text>
              <Input placeholder="Ghi chú đối trừ..." value={ghiChu}
                onChange={e => setGhiChu(e.target.value)} style={{ flex: 1 }} />
              <Space>
                <Text type="secondary">Tổng: {fmt(step2Total)} đ</Text>
                <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>Quay lại</Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleConfirm}
                  loading={confirmMut.isPending}
                  disabled={!preview.some(r => r.so_items > 0)}
                  style={{ background: '#00695c', borderColor: '#00695c' }}
                >
                  Xác nhận đối trừ
                </Button>
              </Space>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
