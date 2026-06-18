import { useEffect, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Row, Select, Space, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, BankOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import { receiptApi, CashReceiptCreate, CashReceiptUpdate, HINH_THUC_TT } from '../../api/accounting'
import { bankAccountsApi, BankAccount } from '../../api/banking'
import { customersApi, Customer } from '../../api/customers'
import client from '../../api/client'
import QuickAddSelect from '../../components/QuickAddSelect'
import { QUICK_ADD_CONFIGS } from '../../config/quickAddConfigs'
import { billingApi, SalesInvoiceListItem } from '../../api/billing'
import { phapNhanApi, PhapNhan } from '../../api/phap_nhan'
import { usePhanXuong } from '../../hooks/useMasterData'

const { Title } = Typography

interface TaiKhoanNgamDinh { id: number; ma_loai: string; so_tk: string | null }

export default function CashReceiptForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id?: string }>()
  const editId = id ? Number(id) : undefined
  const isEdit = editId != null && !isNaN(editId)

  const [searchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [selectedCustomer, setSelectedCustomer] = useState<number | undefined>()
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceListItem | undefined>()
  const queryCustomerId = Number(searchParams.get('customer_id'))
  const queryInvoiceId = Number(searchParams.get('invoice_id'))
  const queryAmount = Number(searchParams.get('amount'))
  const hinhThucParam = searchParams.get('hinh_thuc') ?? 'chuyen_khoan'

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { phanXuongList } = usePhanXuong()

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts-active'],
    queryFn: () => bankAccountsApi.list({ trang_thai: true }).then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const { data: tkNgamDinhList = [] } = useQuery<TaiKhoanNgamDinh[]>({
    queryKey: ['tai-khoan-ngam-dinh'],
    queryFn: () => client.get<TaiKhoanNgamDinh[]>('/tai-khoan-ngam-dinh').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  })
  const tkNgamDinhMap = Object.fromEntries(tkNgamDinhList.map(t => [t.ma_loai, t.so_tk]))

  const selectedPhapNhan = Form.useWatch('phap_nhan_id', form)
  const filteredBankAccounts = selectedPhapNhan
    ? bankAccounts.filter(b => b.phap_nhan_id === selectedPhapNhan || b.phap_nhan_id == null)
    : bankAccounts

  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ['receipt', editId],
    queryFn: () => receiptApi.get(editId!),
    enabled: isEdit,
  })

  const { data: invoiceData } = useQuery({
    queryKey: ['billing-invoices-unpaid', selectedCustomer],
    queryFn: () =>
      billingApi.listInvoices({ customer_id: selectedCustomer, page_size: 100 }),
    enabled: !!selectedCustomer,
    select: (d) =>
      (d?.items ?? []).filter((i: SalesInvoiceListItem) =>
        ['da_phat_hanh', 'da_tt_mot_phan', 'qua_han'].includes(i.trang_thai)
      ),
  })
  const unpaidInvoices: SalesInvoiceListItem[] = invoiceData ?? []

  // Auto-fill TK Nợ từ tai_khoan_ngam_dinh khi tạo mới
  useEffect(() => {
    if (isEdit || !tkNgamDinhList.length) return
    const maLoai = (hinhThucParam === 'tien_mat' || hinhThucParam === 'TM') ? 'tien_mat' : 'tien_gui_ngan_hang'
    const soTk = tkNgamDinhMap[maLoai]
    if (soTk) form.setFieldValue('tk_no', soTk)
  }, [tkNgamDinhList]) // eslint-disable-line

  // Pre-populate form when editing
  useEffect(() => {
    if (!existing) return
    setSelectedCustomer(existing.customer_id)
    form.setFieldsValue({
      customer_id: existing.customer_id,
      sales_invoice_id: existing.sales_invoice_id ?? undefined,
      ngay_phieu: dayjs(existing.ngay_phieu),
      hinh_thuc_tt: existing.hinh_thuc_tt,
      so_tai_khoan: existing.so_tai_khoan ?? undefined,
      so_tham_chieu: existing.so_tham_chieu ?? undefined,
      dien_giai: existing.dien_giai ?? undefined,
      so_tien: Number(existing.so_tien),
      phap_nhan_id: existing.phap_nhan_id ?? undefined,
      phan_xuong_id: existing.phan_xuong_id ?? undefined,
    })
  }, [existing, form])

  // Pre-populate from URL params (create mode)
  useEffect(() => {
    if (isEdit) return
    if (Number.isInteger(queryCustomerId) && queryCustomerId > 0) {
      setSelectedCustomer(queryCustomerId)
      form.setFieldsValue({ customer_id: queryCustomerId })
    }
  }, [form, isEdit, queryCustomerId])

  useEffect(() => {
    if (isEdit) return
    if (Number.isInteger(queryInvoiceId) && queryInvoiceId > 0 && unpaidInvoices.length > 0) {
      const inv = unpaidInvoices.find(i => i.id === queryInvoiceId)
      if (inv) {
        setSelectedInvoice(inv)
        form.setFieldsValue({
          sales_invoice_id: inv.id,
          so_tien: Number.isFinite(queryAmount) && queryAmount > 0 ? queryAmount : inv.con_lai,
        })
      }
    } else if (!isEdit && Number.isFinite(queryAmount) && queryAmount > 0) {
      form.setFieldsValue({ so_tien: queryAmount })
    }
  }, [form, isEdit, queryAmount, queryInvoiceId, unpaidInvoices])

  const createMut = useMutation({
    mutationFn: (data: CashReceiptCreate) => receiptApi.create(data),
    onSuccess: r => {
      message.success('Tạo phiếu thu thành công')
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger-entries'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger'] })
      navigate(`/accounting/receipts/${r.id}`)
    },
    onError: (e: Error) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi tạo phiếu thu'),
  })

  const updateMut = useMutation({
    mutationFn: (data: CashReceiptUpdate) => receiptApi.update(editId!, data),
    onSuccess: r => {
      message.success('Cập nhật phiếu thu thành công')
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['receipt', editId] })
      navigate(`/accounting/receipts/${r.id}`)
    },
    onError: (e: Error) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi cập nhật phiếu thu'),
  })

  const handleCustomerChange = (id: number) => {
    setSelectedCustomer(id)
    setSelectedInvoice(undefined)
    form.setFieldsValue({ sales_invoice_id: undefined, so_tien: undefined })
  }

  const handleInvoiceChange = (invId: number) => {
    const inv = unpaidInvoices.find(i => i.id === invId)
    setSelectedInvoice(inv)
    if (inv) {
      form.setFieldsValue({
        so_tien: inv.con_lai,
        ...(inv.phap_nhan_id ? { phap_nhan_id: inv.phap_nhan_id } : {}),
      })
    }
  }

  const onFinish = (values: CashReceiptCreate & { ngay_phieu: import('dayjs').Dayjs }) => {
    const payload = {
      customer_id: values.customer_id,
      sales_invoice_id: values.sales_invoice_id,
      phap_nhan_id: values.phap_nhan_id ?? null,
      phan_xuong_id: values.phan_xuong_id ?? null,
      ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
      hinh_thuc_tt: values.hinh_thuc_tt,
      so_tai_khoan: values.so_tai_khoan || undefined,
      so_tham_chieu: values.so_tham_chieu || undefined,
      dien_giai: values.dien_giai || undefined,
      so_tien: values.so_tien,
      tk_no: values.tk_no,
      tk_co: values.tk_co,
    }
    if (isEdit) {
      updateMut.mutate(payload)
    } else {
      createMut.mutate(payload)
    }
  }

  const isNotEditable = isEdit && existing?.trang_thai !== 'cho_duyet'
  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/accounting/receipts/${editId}` : '/accounting/receipts')} />
        <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Sửa phiếu thu' : 'Tạo phiếu thu'}</Title>
        {isEdit && existing && <span style={{ color: '#888', fontSize: 13 }}>{existing.so_phieu}</span>}
      </div>

      {isNotEditable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Phiếu thu này không thể sửa"
          description={`Trạng thái hiện tại: ${existing?.trang_thai}. Chỉ có thể sửa phiếu ở trạng thái Chờ duyệt.`}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{ ngay_phieu: dayjs(), hinh_thuc_tt: hinhThucParam, tk_no: '112', tk_co: '131' }}
        onFinish={onFinish}
      >
        <Card size="small" title="Thông tin" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ngay_phieu" label="Ngày phiếu" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={isNotEditable} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hinh_thuc_tt" label="Hình thức TT" rules={[{ required: true }]}>
                <Select
                  disabled={isNotEditable}
                  options={Object.entries(HINH_THUC_TT)
                    .filter(([k]) => !['TM', 'CK'].includes(k))
                    .map(([k, v]) => ({ value: k, label: v }))}
                  onChange={(val: string) => {
                    const maLoai = (val === 'tien_mat' || val === 'TM') ? 'tien_mat' : 'tien_gui_ngan_hang'
                    const soTk = tkNgamDinhMap[maLoai]
                    if (soTk) form.setFieldValue('tk_no', soTk)
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true, message: 'Chọn pháp nhân' }]}>
                <Select
                  disabled={isNotEditable}
                  loading={existingLoading}
                  placeholder="Chọn pháp nhân phát hành phiếu"
                  onChange={() => form.setFieldValue('so_tai_khoan', undefined)}
                  options={phapNhanList.map(p => ({
                    value: p.id,
                    label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phan_xuong_id" label="Xưởng">
                <Select
                  disabled={isNotEditable}
                  allowClear
                  placeholder="Chọn xưởng (tùy chọn)"
                  options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
            <QuickAddSelect
              disabled={isNotEditable}
              config={QUICK_ADD_CONFIGS.customer}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({
                value: c.id,
                label: `${c.ma_kh ? `[${c.ma_kh}] ` : ''}${c.ten_don_vi ?? ''}`,
              }))}
              onChange={handleCustomerChange}
              onCreated={() => qc.invalidateQueries({ queryKey: ['customers-all'] })}
              placeholder="Chọn khách hàng"
            />
          </Form.Item>

          {selectedCustomer && (
            <Form.Item name="sales_invoice_id" label="Hóa đơn thu tiền">
              <Select
                disabled={isNotEditable}
                allowClear
                placeholder={unpaidInvoices.length === 0 ? 'Không có hóa đơn còn nợ' : 'Chọn hóa đơn (tùy chọn)'}
                onChange={handleInvoiceChange}
                options={unpaidInvoices.map(i => ({
                  value: i.id,
                  label: `${i.so_hoa_don ?? `HĐ#${i.id}`} — Còn lại: ${fmtVND(i.con_lai)}`,
                }))}
              />
            </Form.Item>
          )}

          {selectedInvoice && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
              <span style={{ fontSize: 13 }}>
                Tổng HĐ: <strong>{fmtVND(selectedInvoice.tong_cong)}</strong>
                {'  ·  '}Đã TT: <strong>{fmtVND(selectedInvoice.da_thanh_toan)}</strong>
                {'  ·  '}Còn lại: <strong style={{ color: '#fa8c16' }}>{fmtVND(selectedInvoice.con_lai)}</strong>
              </span>
            </div>
          )}

          <Form.Item
            name="so_tien"
            label="Số tiền thu"
            rules={[
              { required: true },
              {
                validator: (_, val) => {
                  if (selectedInvoice && val > selectedInvoice.con_lai) {
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
              <Form.Item
                name="so_tai_khoan"
                label={<span>Số tài khoản&nbsp;<a onClick={() => navigate('/master/bank-accounts')} title="Danh mục tài khoản NH"><BankOutlined /></a></span>}
              >
                <Select
                  disabled={isNotEditable}
                  allowClear
                  showSearch
                  placeholder="Chọn tài khoản ngân hàng"
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={filteredBankAccounts.map(b => ({
                    value: b.so_tai_khoan,
                    label: `${b.so_tai_khoan} — ${b.ten_ngan_hang}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_tham_chieu" label="Số tham chiếu">
                <Input disabled={isNotEditable} placeholder="Số chứng từ CK" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dien_giai" label="Diễn giải">
            <Input.TextArea rows={2} disabled={isNotEditable} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tk_no" label="TK Nợ" rules={[{ required: true, message: 'Nhập TK Nợ' }]}>
                <Input disabled={isNotEditable} placeholder="VD: 112, 111" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tk_co" label="TK Có" rules={[{ required: true, message: 'Nhập TK Có' }]}>
                <Input disabled={isNotEditable} placeholder="VD: 131, 511" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate(isEdit ? `/accounting/receipts/${editId}` : '/accounting/receipts')}>Hủy</Button>
            {!isNotEditable && (
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isPending}>
                {isEdit ? 'Cập nhật' : 'Tạo phiếu thu'}
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </div>
  )
}
