import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Row, Select, Space, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { internalTransferApi, InternalTransferCreate, HINH_THUC_TT } from '../../api/accounting'
import { phapNhanApi, PhapNhan } from '../../api/phap_nhan'
import type { ApiError } from '../../api/types'

const { Title } = Typography

export default function InternalTransferForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form] = Form.useForm()

  const { data: phapNhanList = [] } = useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const createMut = useMutation({
    mutationFn: (data: InternalTransferCreate) => internalTransferApi.create(data),
    onSuccess: r => {
      message.success('Tạo phiếu chuyển tiền thành công')
      qc.invalidateQueries({ queryKey: ['internal-transfers'] })
      navigate(`/accounting/internal-transfers/${r.id}`)
    },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo phiếu'),
  })

  const onFinish = (values: InternalTransferCreate & { ngay_phieu: import('dayjs').Dayjs }) => {
    createMut.mutate({
      ...values,
      ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
    })
  }

  const phapNhanOptions = phapNhanList.map(p => ({
    value: p.id,
    label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}`,
  }))

  const htttOptions = [
    { value: 'chuyen_khoan', label: HINH_THUC_TT['chuyen_khoan'] },
    { value: 'tien_mat', label: HINH_THUC_TT['tien_mat'] },
    { value: 'khac', label: HINH_THUC_TT['khac'] },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/internal-transfers')} />
        <Title level={4} style={{ margin: 0 }}>Tạo phiếu chuyển tiền nội bộ</Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ ngay_phieu: dayjs(), hinh_thuc_tt: 'chuyen_khoan', tk_no: '112', tk_co: '112' }}
        onFinish={onFinish}
      >
        <Card size="small" title="Thông tin chuyển tiền" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ngay_phieu" label="Ngày phiếu" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hinh_thuc_tt" label="Hình thức TT" rules={[{ required: true }]}>
                <Select options={htttOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tu_phap_nhan_id" label="Từ pháp nhân">
                <Select
                  allowClear
                  placeholder="Pháp nhân nguồn"
                  options={phapNhanOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="den_phap_nhan_id" label="Đến pháp nhân">
                <Select
                  allowClear
                  placeholder="Pháp nhân đích"
                  options={phapNhanOptions}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tu_tai_khoan" label="Số TK nguồn">
                <Input placeholder="Số tài khoản ngân hàng nguồn" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="den_tai_khoan" label="Số TK đích">
                <Input placeholder="Số tài khoản ngân hàng đích" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="so_tien"
            label="Số tiền chuyển"
            rules={[{ required: true, message: 'Nhập số tiền' }]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
              parser={v => Number((v ?? '').replace(/\D/g, ''))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="so_tham_chieu" label="Số tham chiếu">
                <Input placeholder="Số chứng từ chuyển khoản" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tk_no" label="TK Nợ">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dien_giai" label="Diễn giải">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tk_co" label="TK Có">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate('/accounting/internal-transfers')}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={createMut.isPending}
            >
              Tạo phiếu
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}
