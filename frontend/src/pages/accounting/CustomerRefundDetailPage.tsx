import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Descriptions, Form, Modal, Radio, Select, Space, Spin, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useState } from 'react'
import { fmtVND, printDocument } from '../../utils/exportUtils'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'
import { customerRefundApi, CustomerRefundVoucher, TRANG_THAI_HOAN_TIEN } from '../../api/accounting'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography

const HINH_THUC_LABELS: Record<string, string> = {
  bu_tru:    'Bù trừ công nợ (giảm AR)',
  hoan_tien: 'Hoàn tiền mặt / Chuyển khoản',
}

const TK_LABELS: Record<string, string> = {
  '111': '111 – Tiền mặt',
  '112': '112 – Tiền gửi ngân hàng',
}

export default function CustomerRefundDetailPage() {
  const { id } = useParams<{ id: string }>()
  const voucherId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const { data: voucher, isLoading } = useQuery<CustomerRefundVoucher>({
    queryKey: ['customer-refund', voucherId],
    queryFn: () => customerRefundApi.get(voucherId),
    enabled: !!voucherId,
  })

  const approveMut = useMutation({
    mutationFn: () => customerRefundApi.approve(voucherId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu hoàn tiền')
      qc.invalidateQueries({ queryKey: ['customer-refund', voucherId] })
      qc.invalidateQueries({ queryKey: ['customer-refunds'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger-entries'] })
      qc.invalidateQueries({ queryKey: ['ar-aging'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi duyệt'),
  })

  const cancelMut = useMutation({
    mutationFn: () => customerRefundApi.cancel(voucherId),
    onSuccess: () => {
      message.success('Đã hủy phiếu hoàn tiền')
      qc.invalidateQueries({ queryKey: ['customer-refund', voucherId] })
      qc.invalidateQueries({ queryKey: ['customer-refunds'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  const handleSaveAndApprove = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await customerRefundApi.update(voucherId, values)
      await approveMut.mutateAsync()
    } catch {
      // validation error — form shows inline errors
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!voucher) return <div style={{ padding: 24 }}>Không tìm thấy phiếu</div>

  const ts = TRANG_THAI_HOAN_TIEN[voucher.trang_thai] ?? { label: voucher.trang_thai, color: 'default' }
  const isDraft = voucher.trang_thai === 'nhap'
  const hinh_thuc = Form.useWatch('hinh_thuc', form)

  const handlePrint = () => {
    const isBuTru = voucher.hinh_thuc === 'bu_tru'
    const subtitle = isBuTru ? 'BIÊN BẢN CẤN TRỪ CÔNG NỢ' : 'CREDIT NOTE – PHIẾU HOÀN TIỀN KHÁCH HÀNG'
    const tkNo = isBuTru ? '5213' : `131`
    const tkCo = isBuTru ? '131' : (voucher.tk_hoan_tien ?? '111')
    printDocument({
      title: `${isBuTru ? 'Biên bản cấn trừ' : 'Credit note'} ${voucher.so_phieu}`,
      subtitle,
      logoUrl: namPhuongLogo,
      documentNumber: voucher.so_phieu,
      documentDate: dayjs(voucher.ngay).format('DD/MM/YYYY'),
      status: ts.label,
      fields: [
        { label: 'Khách hàng', value: voucher.ten_khach_hang ?? '—' },
        { label: 'Phiếu trả hàng', value: voucher.so_phieu_tra ?? '—' },
        { label: 'Số tiền', value: fmtVND(voucher.so_tien) },
        { label: 'Hình thức', value: HINH_THUC_LABELS[voucher.hinh_thuc ?? ''] ?? '—' },
        { label: 'TK Nợ', value: tkNo },
        { label: 'TK Có', value: tkCo },
      ],
      bodyHtml: `<div style="padding: 12px 0; font-size: 12px;">${voucher.dien_giai ? voucher.dien_giai.replace(/\n/g, '<br/>') : '&nbsp;'}</div>`,
      footerHtml: voucher.ngay_duyet
        ? `<div>Ngày duyệt: ${dayjs(voucher.ngay_duyet).format('DD/MM/YYYY')}</div>`
        : '',
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/customer-refunds')} />
          <Title level={4} style={{ margin: 0 }}>Phiếu hoàn tiền {voucher.so_phieu}</Title>
          <Tag color={ts.color}>{ts.label}</Tag>
        </Space>
        {isDraft && (
          <Space>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={saving || approveMut.isPending}
              onClick={handleSaveAndApprove}
            >Duyệt</Button>
            <Button
              danger
              icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Hủy phiếu hoàn tiền?',
                onOk: () => cancelMut.mutate(),
              })}
            >Hủy phiếu</Button>
          </Space>
        )}
        {!isDraft && voucher.trang_thai === 'da_duyet' && (
          <Space>
            <Button
              danger
              icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Hủy phiếu hoàn tiền đã duyệt? Bút toán kế toán sẽ bị đảo ngược.',
                okText: 'Hủy phiếu',
                okButtonProps: { danger: true },
                onOk: () => cancelMut.mutate(),
              })}
            >Hủy phiếu</Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              {voucher.hinh_thuc === 'bu_tru' ? 'In biên bản cấn trừ' : 'In credit note'}
            </Button>
          </Space>
        )}
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Số phiếu">{voucher.so_phieu}</Descriptions.Item>
          <Descriptions.Item label="Ngày">{dayjs(voucher.ngay).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Khách hàng">
            <Text strong>{voucher.ten_khach_hang}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Phiếu trả hàng">
            {voucher.so_phieu_tra
              ? <a onClick={() => navigate(`/sales/returns/${voucher.sales_return_id}`)}>{voucher.so_phieu_tra}</a>
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Số tiền hoàn">
            <Text strong style={{ color: '#1b168e', fontSize: 16 }}>{fmtVND(voucher.so_tien)}</Text>
          </Descriptions.Item>
          {!isDraft && (
            <>
              <Descriptions.Item label="Hình thức">
                {HINH_THUC_LABELS[voucher.hinh_thuc ?? ''] ?? voucher.hinh_thuc ?? '—'}
              </Descriptions.Item>
              {voucher.hinh_thuc === 'hoan_tien' && (
                <Descriptions.Item label="TK hoàn tiền">
                  {TK_LABELS[voucher.tk_hoan_tien ?? ''] ?? voucher.tk_hoan_tien}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Diễn giải">{voucher.dien_giai ?? '—'}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {isDraft && (
        <Card size="small" title="Chọn hình thức hoàn tiền">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              hinh_thuc: voucher.hinh_thuc ?? undefined,
              tk_hoan_tien: voucher.tk_hoan_tien ?? undefined,
              dien_giai: voucher.dien_giai ?? undefined,
            }}
          >
            <Form.Item
              name="hinh_thuc"
              label="Hình thức"
              rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
            >
              <Radio.Group>
                <Radio value="bu_tru">Bù trừ công nợ (giảm số tiền phải thu)</Radio>
                <Radio value="hoan_tien">Hoàn tiền thực (trả tiền mặt hoặc chuyển khoản)</Radio>
              </Radio.Group>
            </Form.Item>

            {hinh_thuc === 'hoan_tien' && (
              <Form.Item
                name="tk_hoan_tien"
                label="Tài khoản hoàn tiền"
                rules={[{ required: true, message: 'Chọn tài khoản' }]}
              >
                <Select style={{ width: 300 }} options={[
                  { value: '111', label: '111 – Tiền mặt' },
                  { value: '112', label: '112 – Tiền gửi ngân hàng' },
                ]} />
              </Form.Item>
            )}

            <Form.Item name="dien_giai" label="Diễn giải">
              <input
                style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 11px' }}
                placeholder="Nội dung ghi chú..."
              />
            </Form.Item>
          </Form>

          <div style={{ marginTop: 8, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>Bù trừ:</strong> Ghi Nợ TK 5213 / Có TK 131 → giảm doanh thu, giảm phải thu KH<br />
              <strong>Hoàn tiền:</strong> Ghi thêm Nợ TK 131 / Có TK 111 hoặc 112 → hoàn tiền thực
            </Text>
          </div>
        </Card>
      )}
    </div>
  )
}
