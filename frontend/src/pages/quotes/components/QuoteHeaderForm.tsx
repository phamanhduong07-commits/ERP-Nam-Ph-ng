import { Row, Col, Card, Form, Input, Select, DatePicker, Spin } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import type { PhapNhan } from '../../../api/phap_nhan'
import type { PhanXuong } from '../../../api/warehouse'
import type { NhanVien } from '../../../api/usersApi'

interface QuoteHeaderFormProps {
  form: FormInstance
  isEdit: boolean
  isReadonly: boolean
  triggerAutosave: () => void
  customerOptions: { value: number; label: string }[]
  customerSearching: boolean
  onCustomerSearch: (q: string) => void
  onCustomerChange: () => void
  phapNhanList: PhapNhan[]
  phanXuongList: PhanXuong[]
  nhanVienList: NhanVien[]
}

export default function QuoteHeaderForm({
  form, isEdit, isReadonly, triggerAutosave,
  customerOptions, customerSearching, onCustomerSearch, onCustomerChange,
  phapNhanList, phanXuongList, nhanVienList,
}: QuoteHeaderFormProps) {
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
          <Col span={8}>
            <Form.Item
              label="*Khách hàng" name="customer_id"
              rules={[{ required: true, message: 'Chọn khách hàng' }]}
            >
              <Select
                showSearch filterOption={false}
                onSearch={onCustomerSearch}
                options={customerOptions}
                placeholder="Tìm khách hàng..."
                notFoundContent={customerSearching ? <Spin size="small" /> : 'Gõ để tìm...'}
                onChange={onCustomerChange}
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
