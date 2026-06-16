import { Row, Col, Card, Form, Input, Select, DatePicker, Spin } from 'antd'
import type { FormInstance } from 'antd'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { PhapNhan } from '../../../api/phap_nhan'
import type { PhanXuong } from '../../../api/warehouse'
import type { NhanVien } from '../../../api/usersApi'
import QuickAddSelect from '../../../components/QuickAddSelect'
import { QUICK_ADD_CONFIGS } from '../../../config/quickAddConfigs'

interface QuoteHeaderFormProps {
  form: FormInstance
  isEdit: boolean
  isReadonly: boolean
  triggerAutosave: () => void
  customerOptions: { value: number; label: string; ma_kh: string }[]
  customerSearching: boolean
  onCustomerSearch: (q: string) => void
  onCustomerChange: () => void
  onCustomerCreated?: (rec: Record<string, unknown>) => void
  phapNhanList: PhapNhan[]
  phanXuongList: PhanXuong[]
  nhanVienList: NhanVien[]
}

export default function QuoteHeaderForm({
  form, isEdit, isReadonly, triggerAutosave,
  customerOptions, customerSearching, onCustomerSearch, onCustomerChange, onCustomerCreated,
  phapNhanList, phanXuongList, nhanVienList,
}: QuoteHeaderFormProps) {
  const selectedCustomerId = Form.useWatch('customer_id', form)
  const [maKhSearch, setMaKhSearch] = useState('')

  useEffect(() => { setMaKhSearch('') }, [selectedCustomerId])

  const maKhOptions = maKhSearch
    ? customerOptions.filter(o => o.ma_kh.toLowerCase().includes(maKhSearch.toLowerCase()))
        .map(o => ({ value: o.value, label: o.ma_kh }))
    : customerOptions.map(o => ({ value: o.value, label: o.ma_kh }))

  return (
    <Card style={{ marginBottom: 12 }}>
      <Form form={form} layout="vertical" disabled={isReadonly} onValuesChange={triggerAutosave}>
        <Row gutter={12}>
          <Col span={4}>
            <Form.Item label="Số BG copy" name="so_bg_copy">
              <Input placeholder="Sao chép từ..." />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="Ngày" name="ngay_bao_gia" initialValue={dayjs()} rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label="Mã KH">
              <Select
                showSearch filterOption={false}
                value={selectedCustomerId ?? undefined}
                placeholder="Mã KH..."
                notFoundContent={customerSearching ? <Spin size="small" /> : 'Gõ để tìm...'}
                options={maKhOptions}
                onSearch={q => { setMaKhSearch(q); onCustomerSearch(q) }}
                onSelect={v => { form.setFieldValue('customer_id', v); onCustomerChange() }}
                onClear={() => { form.setFieldValue('customer_id', null); onCustomerChange() }}
                allowClear
                disabled={isReadonly}
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item
              label="*Tên khách hàng" name="customer_id"
              rules={[{ required: true, message: 'Chọn khách hàng' }]}
            >
              <QuickAddSelect
                config={QUICK_ADD_CONFIGS.customer}
                showSearch filterOption={false}
                onSearch={onCustomerSearch}
                options={customerOptions}
                placeholder="Tìm theo tên..."
                notFoundContent={customerSearching ? <Spin size="small" /> : 'Gõ để tìm...'}
                onChange={onCustomerChange}
                onCreated={onCustomerCreated}
                disabled={isReadonly}
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item
              label="Ngày hết hạn" name="ngay_het_han"
              initialValue={!isEdit ? dayjs().add(30, 'day') : undefined}
            >
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={6}>
            <Form.Item label="Pháp nhân" name="phap_nhan_id">
              <Select
                allowClear showSearch optionFilterProp="label"
                placeholder="Chọn pháp nhân..."
                options={phapNhanList
                  .filter(p => p.trang_thai)
                  .map(p => ({ value: p.id, label: `[${p.ma_phap_nhan}] ${p.ten_viet_tat || p.ten_phap_nhan}` }))}
                notFoundContent={
                  <div style={{ padding: '8px 4px', color: '#888', fontSize: 12 }}>
                    Chưa có pháp nhân.{' '}
                    <a href="/danhmuc/phap-nhan" target="_blank" rel="noreferrer">
                      Thêm tại Danh mục → Pháp nhân
                    </a>
                  </div>
                }
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Nơi sản xuất" name="phan_xuong_id">
              <Select
                allowClear placeholder="Chọn phân xưởng..."
                options={phanXuongList
                  .filter(p => p.trang_thai)
                  .map(p => ({ value: p.id, label: p.ten_xuong }))}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="NV phụ trách" name="nv_phu_trach_id">
              <Select
                allowClear showSearch optionFilterProp="label"
                placeholder="Chọn nhân viên..."
                options={nhanVienList.map(nv => ({ value: nv.id, label: nv.ho_ten }))}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="NV theo dõi đơn hàng" name="nv_theo_doi_id">
              <Select
                allowClear showSearch optionFilterProp="label"
                placeholder="Chọn nhân viên..."
                options={nhanVienList.map(nv => ({ value: nv.id, label: nv.ho_ten }))}
              />
            </Form.Item>
          </Col>
        </Row>

      </Form>
    </Card>
  )
}
