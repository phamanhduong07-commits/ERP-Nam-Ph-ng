import { useEffect, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Row, Select, Space, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import { paymentApi, CashPaymentCreate, CashPaymentUpdate, PurchaseInvoice, purchaseInvoiceApi } from '../../api/accounting'
import { suppliersApi, Supplier } from '../../api/suppliers'
import { phapNhanApi, PhapNhan } from '../../api/phap_nhan'
import QuickAddSelect from '../../components/QuickAddSelect'
import { QUICK_ADD_CONFIGS } from '../../config/quickAddConfigs'

const { Title, Text } = Typography

const HINH_THUC_TT_LABEL: Record<string, string> = {
  tien_mat: 'Tiền mặt',
  chuyen_khoan: 'Chuyển khoản',
  bu_tru_cong_no: 'Bù trừ công nợ',
  khac: 'Khác',
}

const TYPE_CONFIG: Record<string, { title: string; tkNo: string; diGiai: string }> = {
  tax:       { title: 'Tạo phiếu nộp thuế',       tkNo: '3331', diGiai: 'Nộp thuế kỳ ' },
  insurance: { title: 'Tạo phiếu nộp bảo hiểm',   tkNo: '3383', diGiai: 'Nộp BHXH/BHYT kỳ ' },
  salary:    { title: 'Tạo phiếu trả lương',       tkNo: '334',  diGiai: 'Thanh toán lương tháng ' },
}

const EDITABLE_STATUSES = new Set(['cho_chot', 'da_chot'])

export default function CashPaymentForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id?: string }>()
  const editId = id ? Number(id) : undefined
  const isEdit = editId != null && !isNaN(editId)

  const [searchParams] = useSearchParams()
  const invoiceIdParam = Number(searchParams.get('invoice_id') || 0)
  const typeParam = searchParams.get('type') ?? ''
  const modeParam = searchParams.get('mode') ?? ''
  const typeConfig = TYPE_CONFIG[typeParam]
  const formTitle = isEdit
    ? 'Sửa phiếu chi'
    : (typeConfig?.title ?? (modeParam === 'by_invoice' ? 'Trả tiền theo hóa đơn mua' : 'Tạo phiếu chi'))

  const [form] = Form.useForm()
  const [selectedSupplier, setSelectedSupplier] = useState<number | undefined>()
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | undefined>()

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ['payment', editId],
    queryFn: () => paymentApi.get(editId!),
    enabled: isEdit,
  })

  const { data: initialInvoice } = useQuery<PurchaseInvoice>({
    queryKey: ['purchase-invoice-for-payment', invoiceIdParam],
    queryFn: () => purchaseInvoiceApi.get(invoiceIdParam),
    enabled: !isEdit && invoiceIdParam > 0,
  })

  const { data: invoiceData } = useQuery({
    queryKey: ['purchase-invoices-unpaid', selectedSupplier],
    queryFn: () => purchaseInvoiceApi.list({ supplier_id: selectedSupplier, page_size: 100 }),
    enabled: !!selectedSupplier,
    select: (d: { items?: PurchaseInvoice[] } | PurchaseInvoice[]) =>
      (Array.isArray(d) ? d : (d?.items ?? [])).filter((i: PurchaseInvoice) =>
        ['nhap', 'da_tt_mot_phan', 'qua_han'].includes(i.trang_thai)
      ),
  })
  const unpaidInvoices: PurchaseInvoice[] = invoiceData ?? []

  // Pre-populate form when editing
  useEffect(() => {
    if (!existing) return
    setSelectedSupplier(existing.supplier_id)
    form.setFieldsValue({
      supplier_id: existing.supplier_id,
      purchase_invoice_id: existing.purchase_invoice_id ?? undefined,
      phap_nhan_id: existing.phap_nhan_id ?? undefined,
      phan_xuong_id: existing.phan_xuong_id ?? undefined,
      ngay_phieu: dayjs(existing.ngay_phieu),
      hinh_thuc_tt: existing.hinh_thuc_tt,
      so_tai_khoan: existing.so_tai_khoan ?? undefined,
      so_tham_chieu: existing.so_tham_chieu ?? undefined,
      dien_giai: existing.dien_giai ?? undefined,
      so_tien: Number(existing.so_tien),
      tk_no: existing.tk_no,
      tk_co: existing.tk_co,
    })
  }, [existing, form])

  // Pre-populate from URL invoice param (create mode)
  useEffect(() => {
    if (isEdit || !initialInvoice) return
    setSelectedSupplier(initialInvoice.supplier_id)
    setSelectedInvoice(initialInvoice)
    form.setFieldsValue({
      supplier_id: initialInvoice.supplier_id,
      purchase_invoice_id: initialInvoice.id,
      phap_nhan_id: initialInvoice.phap_nhan_id ?? undefined,
      phan_xuong_id: initialInvoice.phan_xuong_id ?? undefined,
      so_tien: initialInvoice.con_lai,
      dien_giai: `Thanh toán hóa đơn mua ${initialInvoice.so_hoa_don ?? `#${initialInvoice.id}`}`,
    })
  }, [form, isEdit, initialInvoice])

  const createMut = useMutation({
    mutationFn: (data: CashPaymentCreate) => paymentApi.create(data),
    onSuccess: r => {
      message.success('Tạo phiếu chi thành công')
      navigate(`/accounting/payments/${r.id}`)
    },
    onError: (e: Error) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi tạo phiếu chi'),
  })

  const updateMut = useMutation({
    mutationFn: (data: CashPaymentUpdate) => paymentApi.update(editId!, data),
    onSuccess: r => {
      message.success('Cập nhật phiếu chi thành công')
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['payment', editId] })
      navigate(`/accounting/payments/${r.id}`)
    },
    onError: (e: Error) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi cập nhật phiếu chi'),
  })

  const handleSupplierChange = (id: number) => {
    setSelectedSupplier(id)
    setSelectedInvoice(undefined)
    form.setFieldsValue({ purchase_invoice_id: undefined, so_tien: undefined, dien_giai: undefined })
  }

  const handleInvoiceChange = (invId?: number) => {
    const inv = unpaidInvoices.find(i => i.id === invId)
    setSelectedInvoice(inv)
    if (inv) {
      form.setFieldsValue({
        so_tien: inv.con_lai,
        phap_nhan_id: inv.phap_nhan_id ?? form.getFieldValue('phap_nhan_id'),
        phan_xuong_id: inv.phan_xuong_id ?? form.getFieldValue('phan_xuong_id'),
        dien_giai: `Thanh toán hóa đơn mua ${inv.so_hoa_don ?? `#${inv.id}`}`,
      })
    }
  }

  const onFinish = (values: CashPaymentCreate & { ngay_phieu: import('dayjs').Dayjs }) => {
    const payload = {
      supplier_id: values.supplier_id,
      purchase_invoice_id: values.purchase_invoice_id || undefined,
      phap_nhan_id: values.phap_nhan_id ?? null,
      phan_xuong_id: values.phan_xuong_id ?? null,
      ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
      hinh_thuc_tt: values.hinh_thuc_tt,
      so_tai_khoan: values.so_tai_khoan || undefined,
      so_tham_chieu: values.so_tham_chieu || undefined,
      dien_giai: values.dien_giai || undefined,
      so_tien: values.so_tien,
      tk_no: values.tk_no || undefined,
      tk_co: values.tk_co || undefined,
    }
    if (isEdit) {
      updateMut.mutate(payload)
    } else {
      createMut.mutate(payload)
    }
  }

  const isNotEditable = isEdit && existing != null && !EDITABLE_STATUSES.has(existing.trang_thai)
  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/accounting/payments/${editId}` : '/accounting/payments')} />
        <Title level={4} style={{ margin: 0 }}>{formTitle}</Title>
        {isEdit && existing && <span style={{ color: '#888', fontSize: 13 }}>{existing.so_phieu}</span>}
      </div>

      {isNotEditable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Phiếu chi này không thể sửa"
          description={`Trạng thái hiện tại: ${existing?.trang_thai}. Chỉ có thể sửa phiếu ở trạng thái Chờ chốt hoặc Đã chốt.`}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ngay_phieu: dayjs(),
          hinh_thuc_tt: 'chuyen_khoan',
          tk_no: typeConfig?.tkNo ?? '331',
          tk_co: '112',
          dien_giai: typeConfig?.diGiai,
        }}
        onFinish={onFinish}
      >
        <Card size="small" title="Thông tin chi tiền" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ngay_phieu" label="Ngày phiếu" rules={[{ required: true, message: 'Chọn ngày phiếu' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={isNotEditable} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hinh_thuc_tt" label="Hình thức thanh toán" rules={[{ required: true, message: 'Chọn hình thức thanh toán' }]}>
                <Select
                  disabled={isNotEditable}
                  options={Object.entries(HINH_THUC_TT_LABEL).map(([k, v]) => ({ value: k, label: v }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="phap_nhan_id" label="Pháp nhân chi tiền" rules={[{ required: true, message: 'Chọn pháp nhân' }]}>
            <Select
              disabled={isNotEditable || existingLoading}
              placeholder="Chọn pháp nhân"
              options={phapNhanList.map(p => ({
                value: p.id,
                label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="phan_xuong_id" hidden>
            <Input />
          </Form.Item>

          <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}>
            <QuickAddSelect
              disabled={isNotEditable}
              config={QUICK_ADD_CONFIGS.supplier}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map(s => ({
                value: s.id,
                label: `${s.ma_ncc ? `[${s.ma_ncc}] ` : ''}${s.ten_don_vi ?? ''}`,
              }))}
              onChange={handleSupplierChange}
              onCreated={() => qc.invalidateQueries({ queryKey: ['suppliers-all'] })}
              placeholder="Chọn nhà cung cấp"
            />
          </Form.Item>

          {selectedSupplier && (
            <Form.Item name="purchase_invoice_id" label="Hóa đơn mua cần thanh toán">
              <Select
                disabled={isNotEditable}
                allowClear
                placeholder={unpaidInvoices.length === 0 ? 'Không có hóa đơn còn nợ' : 'Chọn hóa đơn mua'}
                onChange={handleInvoiceChange}
                options={unpaidInvoices.map(i => ({
                  value: i.id,
                  label: `${i.so_hoa_don ?? `HĐ #${i.id}`} - còn lại ${fmtVND(i.con_lai)}`,
                }))}
              />
            </Form.Item>
          )}

          {selectedInvoice && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591' }}>
              <Text style={{ fontSize: 13 }}>
                Tổng hóa đơn: <strong>{fmtVND(selectedInvoice.tong_thanh_toan)}</strong>
                {' | '}Đã thanh toán: <strong>{fmtVND(selectedInvoice.da_thanh_toan)}</strong>
                {' | '}Còn lại: <strong style={{ color: '#f5222d' }}>{fmtVND(selectedInvoice.con_lai)}</strong>
              </Text>
            </div>
          )}

          <Form.Item
            name="so_tien"
            label="Số tiền chi"
            rules={[
              { required: true, message: 'Nhập số tiền chi' },
              {
                validator: (_, val) => {
                  if (selectedInvoice && Number(val || 0) > selectedInvoice.con_lai) {
                    return Promise.reject(`Vượt quá số tiền còn lại (${fmtVND(selectedInvoice.con_lai)})`)
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              disabled={isNotEditable}
              formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
              parser={v => Number((v ?? '').replace(/\D/g, ''))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="so_tai_khoan" label="Số tài khoản">
                <Input disabled={isNotEditable} placeholder="Số tài khoản ngân hàng" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_tham_chieu" label="Số tham chiếu">
                <Input disabled={isNotEditable} placeholder="Số chứng từ chuyển khoản" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dien_giai" label="Lý do chi">
            <Input.TextArea rows={2} disabled={isNotEditable} />
          </Form.Item>
          <Form.Item name="tk_no" hidden><Input /></Form.Item>
          <Form.Item name="tk_co" hidden><Input /></Form.Item>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate(isEdit ? `/accounting/payments/${editId}` : '/accounting/payments')}>Hủy</Button>
            {!isNotEditable && (
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isPending}>
                {isEdit ? 'Cập nhật' : 'Tạo phiếu chi'}
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </div>
  )
}
