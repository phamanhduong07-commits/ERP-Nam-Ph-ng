import { useState } from 'react'
import {
  Modal, Form, Input, InputNumber, DatePicker, Select, Button, Space,
  Descriptions, Tag, Divider, Popconfirm, message, Row, Col,
} from 'antd'
import {
  PlayCircleOutlined, CheckCircleOutlined, CheckOutlined, CloseOutlined, PrinterOutlined,
  ForwardOutlined, StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/cd2'

interface Props {
  phieu: PhieuIn | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const CA_OPTIONS = [
  { value: 'Ca 1', label: 'Ca 1' },
  { value: 'Ca 2', label: 'Ca 2' },
  { value: 'Ca 3', label: 'Ca 3' },
]

export default function PhieuInModal({ phieu, open, onClose, onSaved }: Props) {
  const isCreate = !phieu
  const [form] = Form.useForm()
  const [completeForm] = Form.useForm()
  const [sauInForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [showSauIn, setShowSauIn] = useState(false)

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        ngay_lenh: values.ngay_lenh ? values.ngay_lenh.format('YYYY-MM-DD') : undefined,
        ngay_giao_hang: values.ngay_giao_hang ? values.ngay_giao_hang.format('YYYY-MM-DD') : undefined,
      }
      await cd2Api.createPhieuIn(payload)
      message.success('Đã tạo phiếu in')
      onSaved()
    } catch {
      message.error('Lỗi tạo phiếu in')
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async () => {
    if (!phieu) return
    setSaving(true)
    try {
      await cd2Api.startPrinting(phieu.id)
      message.success('Bắt đầu in')
      onSaved()
    } catch {
      message.error('Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!phieu) return
    try {
      const values = await completeForm.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        ngay_in: values.ngay_in ? values.ngay_in.format('YYYY-MM-DD') : undefined,
      }
      await cd2Api.completePrinting(phieu.id, payload)
      message.success('Kết thúc in — chuyển sang Chờ định hình')
      setShowComplete(false)
      onSaved()
    } catch {
      message.error('Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const handleSauIn = async () => {
    if (!phieu) return
    try {
      const values = await sauInForm.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        ngay_sau_in: values.ngay_sau_in ? values.ngay_sau_in.format('YYYY-MM-DD') : undefined,
      }
      await cd2Api.startSauIn(phieu.id, payload)
      message.success('Chuyển sang Sau in')
      setShowSauIn(false)
      onSaved()
    } catch {
      message.error('Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const handleHoanThanh = async () => {
    if (!phieu) return
    setSaving(true)
    try {
      await cd2Api.hoanThanh(phieu.id)
      message.success('Hoàn thành')
      onSaved()
    } catch {
      message.error('Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const handleHuy = async () => {
    if (!phieu) return
    try {
      await cd2Api.huyPhieu(phieu.id)
      message.success('Đã huỷ phiếu in')
      onSaved()
    } catch {
      message.error('Lỗi huỷ phiếu')
    }
  }

  const handleDelete = async () => {
    if (!phieu) return
    try {
      await cd2Api.deletePhieuIn(phieu.id)
      message.success('Đã xoá')
      onSaved()
    } catch {
      message.error('Lỗi xoá')
    }
  }

  const renderActions = () => {
    if (!phieu) return null
    const tt = phieu.trang_thai
    return (
      <Space wrap>
        {tt === 'ke_hoach' && (
          <Button type="primary" icon={<PlayCircleOutlined />} loading={saving} onClick={handleStart}>
            Bắt đầu in
          </Button>
        )}
        {tt === 'dang_in' && (
          <Button
            icon={<CheckCircleOutlined />}
            style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            onClick={() => setShowComplete(true)}
          >
            Kết thúc in
          </Button>
        )}
        {tt === 'cho_dinh_hinh' && (
          <Button
            type="primary"
            icon={<ForwardOutlined />}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
            onClick={() => setShowSauIn(true)}
          >
            Chuyển Sau in
          </Button>
        )}
        {tt === 'sau_in' && (
          <Popconfirm title="Xác nhận hoàn thành sau in?" onConfirm={handleHoanThanh}>
            <Button type="primary" icon={<CheckOutlined />} loading={saving}>
              Hoàn thành
            </Button>
          </Popconfirm>
        )}
        {tt !== 'hoan_thanh' && tt !== 'huy' && (
          <Popconfirm title="Huỷ phiếu in này?" onConfirm={handleHuy} okButtonProps={{ danger: true }}>
            <Button icon={<StopOutlined />} style={{ color: '#fa541c', borderColor: '#fa541c' }}>Huỷ phiếu</Button>
          </Popconfirm>
        )}
        <Popconfirm title="Xoá phiếu in này?" onConfirm={handleDelete} okButtonProps={{ danger: true }}>
          <Button danger icon={<CloseOutlined />}>Xoá</Button>
        </Popconfirm>
      </Space>
    )
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={isCreate ? 'Tạo phiếu in mới' : `Phiếu in: ${phieu?.so_phieu}`}
        width={680}
        footer={
          isCreate ? (
            <Space>
              <Button onClick={onClose}>Huỷ</Button>
              <Button type="primary" loading={saving} onClick={handleCreate}>Tạo phiếu</Button>
            </Space>
          ) : null
        }
        destroyOnClose
      >
        {isCreate ? (
          <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="ten_hang" label="Tên hàng">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ma_kh" label="Mã khách">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="ten_khach_hang" label="Tên khách hàng">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="quy_cach" label="Quy cách">
                  <Input placeholder="VD: 890x1200" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="so_luong_phoi" label="Số lượng phôi">
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="loai_in" label="Loại in">
                  <Input placeholder="Offset, Flexo..." />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="loai" label="Loại hàng">
                  <Input placeholder="Thùng, Hộp, Khay..." />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="ths" label="Loại sóng (THS)">
                  <Select
                    options={[
                      { value: 'B', label: 'B' },
                      { value: 'C', label: 'C' },
                      { value: 'C-B', label: 'C-B' },
                      { value: 'E', label: 'E' },
                      { value: 'BC', label: 'BC' },
                    ]}
                    allowClear
                    placeholder="Chọn sóng"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="pp_ghep" label="Phương pháp ghép">
                  <Select
                    options={[
                      { value: 'Dán', label: 'Dán' },
                      { value: 'Đóng Ghim', label: 'Đóng Ghim' },
                    ]}
                    allowClear
                    placeholder="Chọn PP"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="so_don" label="Số đơn hàng">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="ngay_lenh" label="Ngày lệnh">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ngay_giao_hang" label="Ngày giao">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="ghi_chu_printer" label="Ghi chú máy in">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ghi_chu_prepare" label="Ghi chú chuẩn bị">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="ghi_chu" label="Ghi chú chung">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        ) : (
          phieu && (
            <>
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Tag color={TRANG_THAI_COLORS[phieu.trang_thai]}>
                    {TRANG_THAI_LABELS[phieu.trang_thai]}
                  </Tag>
                  {phieu.ten_may && <Tag icon={<PrinterOutlined />}>{phieu.ten_may}</Tag>}
                </Space>
              </div>

              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Số phiếu">{phieu.so_phieu}</Descriptions.Item>
                <Descriptions.Item label="Tên hàng">{phieu.ten_hang || '—'}</Descriptions.Item>
                <Descriptions.Item label="Khách hàng">{phieu.ten_khach_hang || '—'}</Descriptions.Item>
                <Descriptions.Item label="Mã KH">{phieu.ma_kh || '—'}</Descriptions.Item>
                <Descriptions.Item label="Quy cách">{phieu.quy_cach || '—'}</Descriptions.Item>
                <Descriptions.Item label="Loại hàng">{phieu.loai || '—'}</Descriptions.Item>
                <Descriptions.Item label="Loại sóng">{phieu.ths || '—'}</Descriptions.Item>
                <Descriptions.Item label="PP ghép">{phieu.pp_ghep || '—'}</Descriptions.Item>
                <Descriptions.Item label="Loại in">{phieu.loai_in || '—'}</Descriptions.Item>
                <Descriptions.Item label="SL phôi">
                  {phieu.so_luong_phoi != null
                    ? phieu.so_luong_phoi.toLocaleString('vi-VN')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Số đơn">{phieu.so_don || '—'}</Descriptions.Item>
                <Descriptions.Item label="Ngày lệnh">
                  {phieu.ngay_lenh ? dayjs(phieu.ngay_lenh).format('DD/MM/YYYY') : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày giao">
                  {phieu.ngay_giao_hang ? dayjs(phieu.ngay_giao_hang).format('DD/MM/YYYY') : '—'}
                </Descriptions.Item>
                {phieu.ghi_chu_printer && (
                  <Descriptions.Item label="GC máy in" span={2}>{phieu.ghi_chu_printer}</Descriptions.Item>
                )}
                {phieu.ghi_chu_prepare && (
                  <Descriptions.Item label="GC chuẩn bị" span={2}>{phieu.ghi_chu_prepare}</Descriptions.Item>
                )}
                {phieu.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>{phieu.ghi_chu}</Descriptions.Item>
                )}
              </Descriptions>

              {(phieu.so_luong_in_ok != null || phieu.ngay_in) && (
                <>
                  <Divider orientation="left" style={{ fontSize: 12 }}>Kết quả in</Divider>
                  <Descriptions column={2} size="small" bordered>
                    {phieu.ngay_in && (
                      <Descriptions.Item label="Ngày in">
                        {dayjs(phieu.ngay_in).format('DD/MM/YYYY')}
                      </Descriptions.Item>
                    )}
                    {phieu.ca && <Descriptions.Item label="Ca">{phieu.ca}</Descriptions.Item>}
                    {phieu.so_luong_in_ok != null && (
                      <Descriptions.Item label="SL OK">
                        <span style={{ color: '#389e0d', fontWeight: 600 }}>
                          {phieu.so_luong_in_ok.toLocaleString('vi-VN')}
                        </span>
                      </Descriptions.Item>
                    )}
                    {phieu.so_luong_loi != null && (
                      <Descriptions.Item label="SL lỗi">
                        <span style={{ color: '#cf1322' }}>
                          {phieu.so_luong_loi.toLocaleString('vi-VN')}
                        </span>
                      </Descriptions.Item>
                    )}
                    {phieu.so_luong_setup != null && (
                      <Descriptions.Item label="SL setup">
                        {phieu.so_luong_setup.toLocaleString('vi-VN')}
                      </Descriptions.Item>
                    )}
                    {phieu.so_lan_setup != null && (
                      <Descriptions.Item label="Số lần setup">{phieu.so_lan_setup}</Descriptions.Item>
                    )}
                    {phieu.ghi_chu_ket_qua && (
                      <Descriptions.Item label="Ghi chú" span={2}>{phieu.ghi_chu_ket_qua}</Descriptions.Item>
                    )}
                  </Descriptions>
                </>
              )}

              {(phieu.so_luong_sau_in_ok != null || phieu.ngay_sau_in) && (
                <>
                  <Divider orientation="left" style={{ fontSize: 12 }}>Kết quả sau in</Divider>
                  <Descriptions column={2} size="small" bordered>
                    {phieu.ngay_sau_in && (
                      <Descriptions.Item label="Ngày sau in">
                        {dayjs(phieu.ngay_sau_in).format('DD/MM/YYYY')}
                      </Descriptions.Item>
                    )}
                    {phieu.ca_sau_in && (
                      <Descriptions.Item label="Ca">{phieu.ca_sau_in}</Descriptions.Item>
                    )}
                    {phieu.so_luong_sau_in_ok != null && (
                      <Descriptions.Item label="SL OK">
                        <span style={{ color: '#389e0d', fontWeight: 600 }}>
                          {phieu.so_luong_sau_in_ok.toLocaleString('vi-VN')}
                        </span>
                      </Descriptions.Item>
                    )}
                    {phieu.so_luong_sau_in_loi != null && (
                      <Descriptions.Item label="SL lỗi">
                        <span style={{ color: '#cf1322' }}>
                          {phieu.so_luong_sau_in_loi.toLocaleString('vi-VN')}
                        </span>
                      </Descriptions.Item>
                    )}
                    {phieu.ghi_chu_sau_in && (
                      <Descriptions.Item label="Ghi chú" span={2}>{phieu.ghi_chu_sau_in}</Descriptions.Item>
                    )}
                  </Descriptions>
                </>
              )}

              <Divider style={{ margin: '12px 0' }} />
              {renderActions()}
            </>
          )
        )}
      </Modal>

      {/* Kết thúc in */}
      <Modal
        open={showComplete}
        title="Kết thúc in — nhập kết quả"
        onCancel={() => setShowComplete(false)}
        footer={
          <Space>
            <Button onClick={() => setShowComplete(false)}>Huỷ</Button>
            <Button type="primary" loading={saving} onClick={handleComplete}>Xác nhận</Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay_in" label="Ngày in" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ca" label="Ca">
                <Select options={CA_OPTIONS} allowClear placeholder="Chọn ca" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_luong_in_ok" label="SL in OK">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_luong_loi" label="SL lỗi" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_luong_setup" label="SL setup">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_lan_setup" label="Số lần setup">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu_ket_qua" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sau in */}
      <Modal
        open={showSauIn}
        title="Nhập kết quả sau in"
        onCancel={() => setShowSauIn(false)}
        footer={
          <Space>
            <Button onClick={() => setShowSauIn(false)}>Huỷ</Button>
            <Button type="primary" loading={saving} onClick={handleSauIn}>Xác nhận</Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={sauInForm} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay_sau_in" label="Ngày sau in" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ca_sau_in" label="Ca">
                <Select options={CA_OPTIONS} allowClear placeholder="Chọn ca" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_luong_sau_in_ok" label="SL OK">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_luong_sau_in_loi" label="SL lỗi" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu_sau_in" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
