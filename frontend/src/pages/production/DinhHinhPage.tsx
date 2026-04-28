import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, DatePicker, Empty,
  Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space,
  Statistic, Tag, Typography, message,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, SauInPayload } from '../../api/cd2'

const { Title, Text } = Typography

const CA_OPTIONS = [
  { value: 'Ca 1', label: 'Ca 1' },
  { value: 'Ca 2', label: 'Ca 2' },
  { value: 'Ca 3', label: 'Ca 3' },
]

// ── Modal định hình ───────────────────────────────────────────────────────────

function DinhHinhModal({
  phieu,
  open,
  onClose,
  onDone,
}: {
  phieu: PhieuIn
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const payload: SauInPayload = {
        ngay_sau_in: v.ngay_sau_in ? v.ngay_sau_in.format('YYYY-MM-DD') : undefined,
        ca_sau_in: v.ca_sau_in,
        so_luong_sau_in_ok: v.so_luong_sau_in_ok,
        so_luong_sau_in_loi: v.so_luong_sau_in_loi ?? 0,
        ghi_chu_sau_in: v.ghi_chu_sau_in,
      }
      await cd2Api.startSauIn(phieu.id, payload)
      message.success('Đã chuyển sang Sau in')
      form.resetFields()
      onDone()
    } catch {
      message.error('Lỗi, thử lại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ToolOutlined style={{ color: '#722ed1' }} />
          Xác nhận định hình — {phieu.so_phieu}
        </Space>
      }
      onCancel={onClose}
      onOk={handleOk}
      okText="Xác nhận định hình"
      cancelText="Huỷ"
      okButtonProps={{ loading: saving, type: 'primary' }}
      width={480}
    >
      {/* Thông tin phiếu */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: '#f9f0ff', borderColor: '#d3adf7' }}
      >
        <div style={{ fontWeight: 700, fontSize: 15 }}>{phieu.ten_hang}</div>
        <Space size={12} style={{ marginTop: 6 }} wrap>
          {phieu.ten_khach_hang && <Text style={{ fontSize: 12 }}>{phieu.ten_khach_hang}</Text>}
          {phieu.quy_cach && <Tag>{phieu.quy_cach}</Tag>}
          {phieu.ths && <Tag color="geekblue">{phieu.ths}</Tag>}
          {phieu.so_luong_in_ok != null && (
            <Text style={{ fontSize: 12 }}>
              SL in OK: <strong style={{ color: '#52c41a' }}>
                {phieu.so_luong_in_ok.toLocaleString('vi-VN')}
              </strong>
            </Text>
          )}
        </Space>
      </Card>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ngay_sau_in: dayjs(),
          so_luong_sau_in_ok: phieu.so_luong_in_ok ?? undefined,
          so_luong_sau_in_loi: 0,
        }}
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="ngay_sau_in" label="Ngày định hình">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ca_sau_in" label="Ca">
              <Select options={CA_OPTIONS} placeholder="Chọn ca" allowClear />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="so_luong_sau_in_ok" label="SL đạt">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="so_luong_sau_in_loi" label="SL lỗi">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="ghi_chu_sau_in" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ── Phiếu card ────────────────────────────────────────────────────────────────

function PhieuCard({
  phieu,
  onDinhHinh,
  onDelete,
  deleting,
}: {
  phieu: PhieuIn
  onDinhHinh: () => void
  onDelete: () => void
  deleting: boolean
}) {
  // Tính tỉ lệ lỗi
  const tyLeLoi =
    phieu.so_luong_in_ok != null && phieu.so_luong_phoi != null && phieu.so_luong_phoi > 0
      ? (((phieu.so_luong_phoi - phieu.so_luong_in_ok) / phieu.so_luong_phoi) * 100).toFixed(1)
      : null

  return (
    <Card
      size="small"
      style={{ marginBottom: 10, borderLeft: '4px solid #722ed1' }}
    >
      <Row justify="space-between" align="top" wrap={false}>
        <Col flex="auto">
          {/* Header row */}
          <Space size={6} wrap style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: '#888' }}>{phieu.so_phieu}</Text>
            {phieu.loai && <Tag style={{ margin: 0, fontSize: 10 }}>{phieu.loai}</Tag>}
            {phieu.ths && <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>{phieu.ths}</Tag>}
            {phieu.pp_ghep && <Tag style={{ margin: 0, fontSize: 10 }}>{phieu.pp_ghep}</Tag>}
          </Space>

          {/* Tên hàng */}
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
            {phieu.ten_hang || '—'}
          </div>
          {phieu.ten_khach_hang && (
            <Text style={{ fontSize: 12, color: '#595959' }}>{phieu.ten_khach_hang}</Text>
          )}

          {/* Số liệu */}
          <Row gutter={[16, 4]} style={{ marginTop: 8 }}>
            {phieu.so_luong_phoi != null && (
              <Col>
                <Text style={{ fontSize: 12, color: '#888' }}>SL phôi </Text>
                <Text strong style={{ fontSize: 13 }}>
                  {phieu.so_luong_phoi.toLocaleString('vi-VN')}
                </Text>
              </Col>
            )}
            {phieu.so_luong_in_ok != null && (
              <Col>
                <Text style={{ fontSize: 12, color: '#888' }}>SL in OK </Text>
                <Text strong style={{ fontSize: 13, color: '#52c41a' }}>
                  {phieu.so_luong_in_ok.toLocaleString('vi-VN')}
                </Text>
              </Col>
            )}
            {phieu.so_luong_loi != null && phieu.so_luong_loi > 0 && (
              <Col>
                <Text style={{ fontSize: 12, color: '#888' }}>Lỗi </Text>
                <Text strong style={{ fontSize: 13, color: '#ff4d4f' }}>
                  {phieu.so_luong_loi.toLocaleString('vi-VN')}
                </Text>
                {tyLeLoi && (
                  <Text style={{ fontSize: 11, color: '#ff7875' }}> ({tyLeLoi}%)</Text>
                )}
              </Col>
            )}
            {phieu.quy_cach && (
              <Col>
                <Tag style={{ fontSize: 11 }}>{phieu.quy_cach}</Tag>
              </Col>
            )}
          </Row>

          {/* Ngày in + ca */}
          {(phieu.ngay_in || phieu.ca) && (
            <Space size={8} style={{ marginTop: 6 }}>
              {phieu.ngay_in && (
                <Text style={{ fontSize: 11, color: '#888' }}>
                  In: <strong>{dayjs(phieu.ngay_in).format('DD/MM/YY')}</strong>
                </Text>
              )}
              {phieu.ca && (
                <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{phieu.ca}</Tag>
              )}
            </Space>
          )}

          {/* Ghi chú */}
          {phieu.ghi_chu_printer && (
            <div style={{ fontSize: 11, color: '#d46b08', marginTop: 4 }}>
              📝 {phieu.ghi_chu_printer}
            </div>
          )}
          {phieu.ngay_giao_hang && (
            <Text style={{ fontSize: 11, color: '#cf1322', display: 'block', marginTop: 2 }}>
              Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM/YY')}
            </Text>
          )}
        </Col>

        {/* Actions */}
        <Col style={{ marginLeft: 16, flexShrink: 0 }}>
          <Space direction="vertical" size={6}>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={onDinhHinh}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
            >
              Định hình
            </Button>
            <Popconfirm
              title="Xoá phiếu này?"
              onConfirm={onDelete}
              okText="Xoá"
              cancelText="Không"
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={deleting}
                block
              >
                Xoá
              </Button>
            </Popconfirm>
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DinhHinhPage() {
  const qc = useQueryClient()
  const [dinhHinhPhieu, setDinhHinhPhieu] = useState<PhieuIn | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: phieus = [], isLoading, refetch } = useQuery({
    queryKey: ['cd2-cho-dinh-hinh'],
    queryFn: () =>
      cd2Api.listPhieuIn({ trang_thai: 'cho_dinh_hinh' }).then(r => r.data),
    refetchInterval: 20_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cd2Api.deletePhieuIn(id),
    onSuccess: () => {
      message.success('Đã xoá')
      qc.invalidateQueries({ queryKey: ['cd2-cho-dinh-hinh'] })
      qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
    },
    onError: () => message.error('Lỗi xoá'),
    onSettled: () => setDeletingId(null),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cd2-cho-dinh-hinh'] })
    qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
  }

  // Tổng số liệu
  const totalPhoi = phieus.reduce((s: number, p: PhieuIn) => s + (p.so_luong_phoi ?? 0), 0)
  const totalOk = phieus.reduce((s: number, p: PhieuIn) => s + (p.so_luong_in_ok ?? 0), 0)

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
        <Col>
          <Space>
            <ToolOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            <Title level={4} style={{ margin: 0 }}>Chờ Định Hình</Title>
            <Badge
              count={phieus.length}
              style={{ backgroundColor: '#722ed1' }}
              showZero
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Text type="secondary" style={{ fontSize: 11 }}>Tự cập nhật 20 giây</Text>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      {/* Tổng kết */}
      {phieus.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 14 }}>
          <Col xs={8} sm={6}>
            <Card size="small" style={{ background: '#f9f0ff', borderColor: '#d3adf7' }}>
              <Statistic
                title="Đang chờ"
                value={phieus.length}
                valueStyle={{ color: '#722ed1', fontSize: 22 }}
                suffix="phiếu"
              />
            </Card>
          </Col>
          <Col xs={8} sm={6}>
            <Card size="small">
              <Statistic
                title="Tổng SL phôi"
                value={totalPhoi}
                formatter={v => Number(v).toLocaleString('vi-VN')}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={8} sm={6}>
            <Card size="small">
              <Statistic
                title="Tổng SL in OK"
                value={totalOk}
                formatter={v => Number(v).toLocaleString('vi-VN')}
                valueStyle={{ color: '#52c41a', fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Danh sách */}
      {isLoading ? (
        <Card loading />
      ) : phieus.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có phiếu nào đang chờ định hình"
          />
        </Card>
      ) : (
        <div>
          {phieus.map((p: PhieuIn) => (
            <PhieuCard
              key={p.id}
              phieu={p}
              onDinhHinh={() => setDinhHinhPhieu(p)}
              onDelete={() => { setDeletingId(p.id); deleteMutation.mutate(p.id) }}
              deleting={deletingId === p.id}
            />
          ))}
        </div>
      )}

      {dinhHinhPhieu && (
        <DinhHinhModal
          phieu={dinhHinhPhieu}
          open
          onClose={() => setDinhHinhPhieu(null)}
          onDone={() => { setDinhHinhPhieu(null); invalidate() }}
        />
      )}
    </div>
  )
}
