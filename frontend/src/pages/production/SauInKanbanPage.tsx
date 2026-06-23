import { useState, useEffect } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Badge, Button, Card, Checkbox, Col, DatePicker, Divider, Empty,
  Form, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Space, Spin, Statistic, Tag, Tabs, Typography, message,
} from 'antd'
import {
  AppstoreOutlined, CheckCircleOutlined, DeleteOutlined,
  PauseOutlined, PlayCircleOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined,
  RollbackOutlined, SendOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, MaySauIn } from '../../api/cd2'
import { warehousesApi } from '../../api/warehouses'
import { warehouseApi } from '../../api/warehouse'
import { productionOrdersApi } from '../../api/productionOrders'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import { socket } from '../../utils/socket'
import { buildHtmlTable, smartPrintPdf } from '../../utils/exportUtils'

const { Title, Text } = Typography

// ── Pause info helper ─────────────────────────────────────────────────────────
type PauseInfo = { time: string; ly_do: string }

function getPauseInfo(phieu: { tam_dung_luc?: string | null; tam_dung_ly_do?: string | null }): PauseInfo | null {
  if (!phieu.tam_dung_luc) return null
  return {
    time: new Date(phieu.tam_dung_luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    ly_do: phieu.tam_dung_ly_do || '',
  }
}

// ── Phiếu card ────────────────────────────────────────────────────────────────

function PhieuCard({ phieu, actions }: { phieu: PhieuIn; actions: React.ReactNode }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderLeft: `4px solid ${
        phieu.trang_thai === 'dang_sau_in' ? '#fa8c16' :
        phieu.trang_thai === 'cho_dinh_hinh' ? '#722ed1' : '#13c2c2'
      }` }}
    >
      <Row justify="space-between" align="top" wrap={false}>
        <Col flex="auto">
          <Space size={4} wrap style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: '#888' }}>
              {phieu.so_lsx || phieu.so_phieu}
              {phieu.so_lsx && <span style={{ color: '#bbb', marginLeft: 4 }}>({phieu.so_phieu})</span>}
            </Text>
            {phieu.phieu_goc_id && (
              <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>Phiếu bù</Tag>
            )}
            {phieu.trang_thai === 'dang_sau_in' && (
              <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>Đang làm</Tag>
            )}
            {phieu.trang_thai === 'cho_dinh_hinh' && (
              <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>Chờ TP</Tag>
            )}
            {phieu.trang_thai === 'sau_in' && (
              <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>Đang TP</Tag>
            )}
            {phieu.ths && <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>{phieu.ths}</Tag>}
            {phieu.loai && <Tag style={{ fontSize: 10, margin: 0 }}>{phieu.loai}</Tag>}
          </Space>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{phieu.ten_hang || '—'}</div>
          {phieu.ten_khach_hang && (
            <Text style={{ fontSize: 12, color: '#595959' }}>{phieu.ten_khach_hang}</Text>
          )}
          <Row gutter={[12, 2]} style={{ marginTop: 6 }}>
            {phieu.so_luong_in_ok != null && (
              <Col>
                <Text style={{ fontSize: 11, color: '#888' }}>In OK </Text>
                <Text strong style={{ color: '#52c41a', fontSize: 12 }}>
                  {phieu.so_luong_in_ok.toLocaleString('vi-VN')}
                </Text>
              </Col>
            )}
            {phieu.so_luong_in_ok == null && phieu.so_luong_phoi != null && phieu.so_luong_phoi > 0 && (
              <Col>
                <Text style={{ fontSize: 11, color: '#888' }}>SL </Text>
                <Text strong style={{ color: '#722ed1', fontSize: 12 }}>
                  {phieu.so_luong_phoi.toLocaleString('vi-VN')}
                </Text>
              </Col>
            )}
            {phieu.so_luong_sau_in_ok != null && (
              <Col>
                <Text style={{ fontSize: 11, color: '#888' }}>TP OK </Text>
                <Text strong style={{ color: '#13c2c2', fontSize: 12 }}>
                  {phieu.so_luong_sau_in_ok.toLocaleString('vi-VN')}
                </Text>
              </Col>
            )}
            {phieu.kho_tt != null && (
              <Col>
                <Text style={{ fontSize: 11, color: '#888' }}>Khổ </Text>
                <Text strong style={{ fontSize: 12 }}>{phieu.kho_tt}</Text>
              </Col>
            )}
            {phieu.dai_tt != null && (
              <Col>
                <Text style={{ fontSize: 11, color: '#888' }}>Cắt </Text>
                <Text strong style={{ fontSize: 12 }}>{phieu.dai_tt}</Text>
              </Col>
            )}
            {phieu.quy_cach && (
              <Col><Tag style={{ fontSize: 11 }}>{phieu.quy_cach}</Tag></Col>
            )}
          </Row>
          {(phieu.ngay_sau_in || phieu.ca_sau_in) && (
            <Space size={6} style={{ marginTop: 4 }}>
              {phieu.ngay_sau_in && (
                <Text style={{ fontSize: 11, color: '#888' }}>
                  TP: <strong>{dayjs(phieu.ngay_sau_in).format('DD/MM/YY')}</strong>
                </Text>
              )}
              {phieu.ca_sau_in && (
                <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{phieu.ca_sau_in}</Tag>
              )}
            </Space>
          )}
          {phieu.ngay_giao_hang && (
            <Text style={{ fontSize: 11, color: '#cf1322', display: 'block', marginTop: 2 }}>
              Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM/YY')}
            </Text>
          )}
        </Col>
        <Col style={{ marginLeft: 12, flexShrink: 0 }}>
          <Space direction="vertical" size={4}>{actions}</Space>
        </Col>
      </Row>
    </Card>
  )
}

// ── Bắt đầu định hình modal ──────────────────────────────────────────────────

const CA_OPTIONS = [
  { value: 'Ca 1', label: 'Ca 1' },
  { value: 'Ca 2', label: 'Ca 2' },
  { value: 'Ca 3', label: 'Ca 3' },
]

function StartDinhHinhModal({
  phieu, open, onClose, onDone,
}: { phieu: PhieuIn; open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      await cd2Api.startSauIn(phieu.id, {
        ngay_sau_in: v.ngay_sau_in ? v.ngay_sau_in.format('YYYY-MM-DD') : undefined,
        ca_sau_in: v.ca_sau_in,
      })
      message.success('Đã chuyển sang TP')
      form.resetFields()
      onDone()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={`Bắt đầu TP — ${phieu.so_phieu}`}
      onCancel={onClose}
      onOk={handleOk}
      okText="Bắt đầu"
      cancelText="Huỷ"
      okButtonProps={{ loading: saving, style: { background: '#722ed1', borderColor: '#722ed1' } }}
      width={360}
    >
      <Card size="small" style={{ background: '#f9f0ff', borderColor: '#d3adf7', marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{phieu.ten_hang}</div>
        {phieu.so_luong_in_ok != null && (
          <div style={{ fontSize: 12, marginTop: 4 }}>
            SL in OK: <strong style={{ color: '#52c41a' }}>{phieu.so_luong_in_ok.toLocaleString('vi-VN')}</strong>
          </div>
        )}
      </Card>
      <Form form={form} layout="vertical" initialValues={{ ngay_sau_in: dayjs() }}>
        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="ngay_sau_in" label="Ngày TP">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="ca_sau_in" label="Ca">
              <Select options={CA_OPTIONS} placeholder="Chọn ca" allowClear />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

// ── Hoàn thành / Ngưng định hình modal ───────────────────────────────────────

function HoanThanhModal({
  phieu, open, onClose, onDone,
}: { phieu: PhieuIn; open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [ngungSaving, setNgungSaving] = useState(false)

  const ref = phieu.so_luong_in_ok ?? phieu.so_luong_phoi ?? 0
  const mins = phieu.gio_bat_dau_dinh_hinh
    ? dayjs().diff(dayjs(phieu.gio_bat_dau_dinh_hinh), 'minute')
    : null
  const elapsed = mins != null
    ? (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`)
    : null

  const handleKetThuc = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      await cd2Api.hoanThanh(phieu.id, {
        so_luong_sau_in_ok: v.so_luong_sau_in_ok,
        so_luong_sau_in_loi: v.so_luong_sau_in_loi ?? 0,
        ghi_chu_sau_in: v.ghi_chu_sau_in,
      })
      message.success('Hoàn thành TP — đã nhập kho thành phẩm')
      form.resetFields()
      onDone()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi')
    } finally {
      setSaving(false)
    }
  }

  const handleNgung = async () => {
    const v = await form.validateFields()
    Modal.confirm({
      title: 'Ngưng & tạo phiếu bù?',
      content: `Hành động này không thể hoàn tác. Phiếu gốc sẽ được đóng với SL đạt: ${v.so_luong_sau_in_ok?.toLocaleString('vi-VN') ?? '?'}, một phiếu bù mới sẽ được tạo cho số còn lại.`,
      okText: 'Xác nhận Ngưng',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: async () => {
        setNgungSaving(true)
        try {
          const res = await cd2Api.ngungDinhHinh(phieu.id, {
            so_luong_sau_in_ok: v.so_luong_sau_in_ok,
            so_luong_sau_in_loi: v.so_luong_sau_in_loi ?? 0,
            ghi_chu_sau_in: v.ghi_chu_sau_in,
          })
          message.success(`Đã ngưng — phiếu bù: ${res.data.phieu_bu.so_phieu}`)
          form.resetFields()
          onDone()
        } catch (e) {
          message.error((e as ApiError)?.response?.data?.detail || 'Lỗi')
        } finally {
          setNgungSaving(false)
        }
      },
    })
  }

  return (
    <Modal
      open={open}
      title={<Space><CheckCircleOutlined style={{ color: '#13c2c2' }} />Hoàn thành TP — {phieu.so_phieu}</Space>}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={saving || ngungSaving}>Huỷ</Button>,
        <Button
          key="ngung"
          onClick={handleNgung}
          loading={ngungSaving}
          disabled={saving}
          style={{ background: '#fa8c16', borderColor: '#fa8c16', color: '#fff' }}
        >
          Ngưng & tạo phiếu bù
        </Button>,
        <Button
          key="ketthuc"
          type="primary"
          onClick={handleKetThuc}
          loading={saving}
          disabled={ngungSaving}
          style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
        >
          Kết thúc
        </Button>,
      ]}
      width={480}
    >
      <Card size="small" style={{ background: '#e6fffb', borderColor: '#87e8de', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{phieu.ten_hang}</div>
        {phieu.ten_khach_hang && <div style={{ fontSize: 12, color: '#595959' }}>{phieu.ten_khach_hang}</div>}
        <Space size={16} style={{ marginTop: 8 }}>
          {ref > 0 && (
            <span style={{ fontSize: 13 }}>
              SL in OK: <strong style={{ color: '#1890ff' }}>{ref.toLocaleString('vi-VN')}</strong>
            </span>
          )}
          {phieu.so_luong_sau_in_ok != null && (
            <span style={{ fontSize: 13 }}>
              Đã TP: <strong style={{ color: '#52c41a' }}>{phieu.so_luong_sau_in_ok.toLocaleString('vi-VN')}</strong>
            </span>
          )}
        </Space>
        {elapsed && (
          <div style={{ fontSize: 12, color: '#722ed1', marginTop: 6 }}>
            ⏱ Đang TP: <strong>{elapsed}</strong>
          </div>
        )}
      </Card>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          so_luong_sau_in_ok: phieu.so_luong_sau_in_ok ?? ref ?? undefined,
          so_luong_sau_in_loi: phieu.so_luong_sau_in_loi ?? 0,
        }}
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="so_luong_sau_in_ok"
              label="SL đạt"
              rules={[
                { required: true, message: 'Nhập SL đạt' },
                { type: 'number', min: 1, message: 'SL đạt phải > 0' },
              ]}
            >
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

      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
        <strong>Kết thúc:</strong> chấp nhận số lượng thực tế, nhập kho TP. &nbsp;
        <strong style={{ color: '#fa8c16' }}>Ngưng & tạo phiếu bù:</strong> hoàn thành một phần, tự tạo phiếu bù cho số còn lại.
      </div>
    </Modal>
  )
}


// ── Machine settings modal ────────────────────────────────────────────────────

function MaySauInSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form] = Form.useForm()

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['cd2-may-sau-in'],
    queryFn: () => cd2Api.listMaySauIn().then(r => r.data),
    enabled: open,
  })

  const createMut = useMutation({
    mutationFn: (d: { ten_may: string; sort_order: number }) => cd2Api.createMaySauIn(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-may-sau-in'] }); form.resetFields() },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạo máy'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deleteMaySauIn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cd2-may-sau-in'] }),
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xoá máy'),
  })

  return (
    <Modal open={open} title="Quản lý máy TP" onCancel={onClose} footer={null} width={480}>
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={v => createMut.mutate({ ten_may: v.ten_may, sort_order: v.sort_order ?? 0 })}
      >
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên' }]}>
          <Input placeholder="Tên máy TP" />
        </Form.Item>
        <Form.Item name="sort_order">
          <InputNumber placeholder="Thứ tự" style={{ width: 80 }} min={0} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createMut.isPending}>
            Thêm
          </Button>
        </Form.Item>
      </Form>
      {isLoading ? (
        <Card loading />
      ) : machines.length === 0 ? (
        <Empty description="Chưa có máy nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        machines.map((m: MaySauIn) => (
          <Card key={m.id} size="small" style={{ marginBottom: 6 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text strong>{m.ten_may}</Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>thứ tự {m.sort_order}</Text>
              </Col>
              <Col>
                <Popconfirm
                  title="Xoá máy này?"
                  onConfirm={() => deleteMut.mutate(m.id)}
                  okText="Xoá"
                  cancelText="Không"
                >
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Col>
            </Row>
          </Card>
        ))
      )}
    </Modal>
  )
}

// ── Machine tab ───────────────────────────────────────────────────────────────

function MachineTab({
  items,
  onStart,
  onComplete,
  onReturn,
  onDelete,
  deletingId,
  onTamDung,
  onTiepTuc,
}: {
  items: PhieuIn[]
  onStart: (p: PhieuIn) => void
  onComplete: (p: PhieuIn) => void
  onReturn: (p: PhieuIn) => void
  onDelete: (p: PhieuIn) => void
  deletingId: number | null
  onTamDung: (p: PhieuIn) => void
  onTiepTuc: (p: PhieuIn) => void
}) {
  // sau_in + tam_dung_luc = mobile paused before reaching dang_sau_in → treat as paused active
  const active = items.filter(p => p.trang_thai === 'dang_sau_in' || (p.trang_thai === 'sau_in' && !!p.tam_dung_luc))
  const queue = items.filter(p => p.trang_thai === 'sau_in' && !p.tam_dung_luc)

  if (items.length === 0) {
    return <Empty description="Không có phiếu nào" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />
  }

  return (
    <div>
      {active.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#fa8c16' }}>
            Đang làm ({active.length})
          </Text>
          <div style={{ marginTop: 8 }}>
            {active.map(p => {
              const info = getPauseInfo(p)
              return (
                <PhieuCard
                  key={p.id}
                  phieu={p}
                  actions={
                    <>
                      {info ? (
                        <>
                          <div style={{ fontSize: 10, color: '#faad14', fontWeight: 600 }}>
                            ⏸ {info.time}
                          </div>
                          <div style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic', maxWidth: 120 }}>
                            {info.ly_do}
                          </div>
                          <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            size="small"
                            style={{ background: '#52c41a', borderColor: '#52c41a' }}
                            onClick={() => onTiepTuc(p)}
                          >
                            Tiếp tục
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          icon={<PauseOutlined />}
                          onClick={() => onTamDung(p)}
                        >
                          Tạm dừng
                        </Button>
                      )}
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        size="small"
                        style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
                        onClick={() => onComplete(p)}
                      >
                        Hoàn thành
                      </Button>
                      <Popconfirm
                        title="Trả phiếu về hàng chờ?"
                        description="Tiến độ đang làm sẽ bị reset."
                        onConfirm={() => onReturn(p)}
                        okText="Trả về"
                        cancelText="Huỷ"
                      >
                        <Button size="small" icon={<RollbackOutlined />} block>Trả về</Button>
                      </Popconfirm>
                      <Popconfirm
                        title="Xoá phiếu?"
                        onConfirm={() => onDelete(p)}
                        okText="Xoá"
                        cancelText="Không"
                      >
                        <Button danger size="small" icon={<DeleteOutlined />} loading={deletingId === p.id} block />
                      </Popconfirm>
                    </>
                  }
                />
              )
            })}
          </div>
          {queue.length > 0 && <Divider style={{ margin: '12px 0' }} />}
        </>
      )}

      {queue.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
            Hàng chờ ({queue.length})
          </Text>
          <div style={{ marginTop: 8 }}>
            {queue.map(p => (
              <PhieuCard
                key={p.id}
                phieu={p}
                actions={
                  <>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      size="small"
                      style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
                      onClick={() => onStart(p)}
                    >
                      Bắt đầu
                    </Button>
                    <Popconfirm
                      title="Trả phiếu về hàng chờ?"
                      description="Tiến độ đang làm sẽ bị reset."
                      onConfirm={() => onReturn(p)}
                      okText="Trả về"
                      cancelText="Huỷ"
                    >
                      <Button
                        size="small"
                        icon={<RollbackOutlined />}
                        block
                      >
                        Trả về
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title="Xoá phiếu?"
                      onConfirm={() => onDelete(p)}
                      okText="Xoá"
                      cancelText="Không"
                    >
                      <Button danger size="small" icon={<DeleteOutlined />} loading={deletingId === p.id} block />
                    </Popconfirm>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Chờ TP tab (cho_dinh_hinh + sua_in + dang_sau_in chưa gán máy) ────────────

function ChoTPTab({
  items,
  onBatDauTP,
  onStart,
  onComplete,
  onReturn,
  onDelete,
  deletingId,
  onTamDung,
  onTiepTuc,
  onChuyenBTP,
}: {
  items: PhieuIn[]
  onBatDauTP: (p: PhieuIn) => void
  onStart: (p: PhieuIn) => void
  onComplete: (p: PhieuIn) => void
  onReturn: (p: PhieuIn) => void
  onDelete: (p: PhieuIn) => void
  deletingId: number | null
  onTamDung: (p: PhieuIn) => void
  onTiepTuc: (p: PhieuIn) => void
  onChuyenBTP: (p: PhieuIn) => void
}) {
  const waiting  = items.filter(p => p.trang_thai === 'cho_dinh_hinh')
  const active   = items.filter(p => p.trang_thai === 'dang_sau_in')
  const queue    = items.filter(p => p.trang_thai === 'sau_in')

  if (items.length === 0) {
    return <Empty description="Không có phiếu nào đang chờ TP" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />
  }

  return (
    <div>
      {/* cho_dinh_hinh — chờ bắt đầu TP */}
      {waiting.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#722ed1' }}>
            Chờ bắt đầu TP ({waiting.length})
          </Text>
          <div style={{ marginTop: 8 }}>
            {waiting.map(p => (
              <PhieuCard
                key={p.id}
                phieu={p}
                actions={
                  <>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      size="small"
                      style={{ background: '#722ed1', borderColor: '#722ed1' }}
                      onClick={() => onBatDauTP(p)}
                    >
                      Bắt đầu TP
                    </Button>
                    <Button
                      icon={<SendOutlined />}
                      size="small"
                      onClick={() => onChuyenBTP(p)}
                    >
                      Chuyển BTP
                    </Button>
                    <Popconfirm
                      title="Xoá phiếu?"
                      onConfirm={() => onDelete(p)}
                      okText="Xoá"
                      cancelText="Không"
                    >
                      <Button danger size="small" icon={<DeleteOutlined />} loading={deletingId === p.id} block />
                    </Popconfirm>
                  </>
                }
              />
            ))}
          </div>
          {(active.length > 0 || queue.length > 0) && <Divider style={{ margin: '12px 0' }} />}
        </>
      )}

      {/* dang_sau_in — đang làm */}
      {active.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#fa8c16' }}>
            Đang làm ({active.length})
          </Text>
          <div style={{ marginTop: 8 }}>
            {active.map(p => {
              const info = getPauseInfo(p)
              return (
                <PhieuCard
                  key={p.id}
                  phieu={p}
                  actions={
                    <>
                      {info ? (
                        <>
                          <div style={{ fontSize: 10, color: '#faad14', fontWeight: 600 }}>⏸ {info.time}</div>
                          <div style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic', maxWidth: 120 }}>{info.ly_do}</div>
                          <Button type="primary" icon={<PlayCircleOutlined />} size="small"
                            style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => onTiepTuc(p)}>
                            Tiếp tục
                          </Button>
                        </>
                      ) : (
                        <Button size="small" icon={<PauseOutlined />} onClick={() => onTamDung(p)}>Tạm dừng</Button>
                      )}
                      <Button type="primary" icon={<CheckCircleOutlined />} size="small"
                        style={{ background: '#13c2c2', borderColor: '#13c2c2' }} onClick={() => onComplete(p)}>
                        Hoàn thành
                      </Button>
                      <Popconfirm title="Trả phiếu về hàng chờ?" description="Tiến độ đang làm sẽ bị reset."
                        onConfirm={() => onReturn(p)} okText="Trả về" cancelText="Huỷ">
                        <Button size="small" icon={<RollbackOutlined />} block>Trả về</Button>
                      </Popconfirm>
                      <Popconfirm title="Xoá phiếu?" onConfirm={() => onDelete(p)} okText="Xoá" cancelText="Không">
                        <Button danger size="small" icon={<DeleteOutlined />} loading={deletingId === p.id} block />
                      </Popconfirm>
                    </>
                  }
                />
              )
            })}
          </div>
          {queue.length > 0 && <Divider style={{ margin: '12px 0' }} />}
        </>
      )}

      {/* sau_in — hàng chờ */}
      {queue.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
            Hàng chờ ({queue.length})
          </Text>
          <div style={{ marginTop: 8 }}>
            {queue.map(p => (
              <PhieuCard
                key={p.id}
                phieu={p}
                actions={
                  <>
                    <Button type="primary" icon={<PlayCircleOutlined />} size="small"
                      style={{ background: '#fa8c16', borderColor: '#fa8c16' }} onClick={() => onStart(p)}>
                      Bắt đầu
                    </Button>
                    <Popconfirm title="Trả phiếu về hàng chờ?" description="Tiến độ đang làm sẽ bị reset."
                      onConfirm={() => onReturn(p)} okText="Trả về" cancelText="Huỷ">
                      <Button size="small" icon={<RollbackOutlined />} block>Trả về</Button>
                    </Popconfirm>
                    <Popconfirm title="Xoá phiếu?" onConfirm={() => onDelete(p)} okText="Xoá" cancelText="Không">
                      <Button danger size="small" icon={<DeleteOutlined />} loading={deletingId === p.id} block />
                    </Popconfirm>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Addon state type ─────────────────────────────────────────────────────────

interface AddonParams {
  chong_tham: number
  in_flexo_mau: number
  in_flexo_phu_nen: boolean
  in_ky_thuat_so: boolean
  chap_xa: boolean
  boi: boolean
  be_so_con: number
  dan: boolean
  ghim: boolean
  can_mang: number
}

const ADDON_DEFAULT: AddonParams = {
  chong_tham: 0, in_flexo_mau: 0, in_flexo_phu_nen: false,
  in_ky_thuat_so: false, chap_xa: false, boi: false,
  be_so_con: 0, dan: false, ghim: false, can_mang: 0,
}

const ADDON_LABELS: Record<string, string> = {
  chong_tham: 'Chống thấm', in_flexo: 'In flexo', in_ky_thuat_so: 'In KTS',
  chap_xa: 'Chấp xà', boi: 'Bồi', be: 'Bế', dan: 'Dán', ghim: 'Ghim', can_mang: 'Cán màng',
}

// ── Chuyển BTP Modal ─────────────────────────────────────────────────────────

function ChuyenBTPModal({
  phieu, phanXuongId, open, onClose, onDone,
}: {
  phieu: PhieuIn
  phanXuongId: number | null
  open: boolean
  onClose: () => void
  onDone: (soPhieu: string, phieuChuyenId: number) => void
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [addons, setAddons] = useState<AddonParams>(ADDON_DEFAULT)

  const set = <K extends keyof AddonParams>(k: K, v: AddonParams[K]) =>
    setAddons(prev => ({ ...prev, [k]: v }))

  const { data: allWarehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    enabled: open,
  })

  const { data: lsx } = useQuery({
    queryKey: ['lsx', phieu.production_order_id],
    queryFn: () => productionOrdersApi.get(phieu.production_order_id!).then(r => r.data),
    enabled: open && !!phieu.production_order_id,
  })

  const { data: btpPrice, isFetching: priceFetching } = useQuery({
    queryKey: ['btp-price', phieu.production_order_id, addons],
    queryFn: () => warehouseApi.getBtpPrice({ production_order_id: phieu.production_order_id!, ...addons }).then(r => r.data),
    enabled: open && !!phieu.production_order_id,
  })

  const btpKhos = allWarehouses.filter(w => w.loai_kho === 'BTP' && w.trang_thai)
  const lsxPxId = lsx?.phan_xuong_id ?? phanXuongId
  const sourceKho = btpKhos.find(w => w.phan_xuong_id === lsxPxId)
  const destKhos = btpKhos.filter(w => w.phan_xuong_id !== lsxPxId)
  const productId = lsx?.items?.[0]?.product_id ?? null
  const hasQuotePrice = btpPrice != null && btpPrice.gia_phoi != null

  useEffect(() => {
    if (open) { setAddons(ADDON_DEFAULT); form.resetFields(['don_gia']) }
  }, [open])

  useEffect(() => {
    if (open && sourceKho) form.setFieldValue('kho_xuat_id', sourceKho.id)
  }, [open, sourceKho?.id, lsx?.phan_xuong_id])

  useEffect(() => {
    if (btpPrice != null) form.setFieldValue('don_gia', Math.round(btpPrice.don_gia_btp))
  }, [btpPrice?.don_gia_btp])

  const handleOk = async () => {
    const v = await form.validateFields()
    if (!phieu.production_order_id) { message.error('Phiếu chưa liên kết LSX'); return }
    if (!productId) { message.error('LSX chưa liên kết sản phẩm'); return }
    setSaving(true)
    try {
      const res = await warehouseApi.btpTransferKanban({
        production_order_id: phieu.production_order_id,
        product_id: productId,
        warehouse_xuat_id: v.kho_xuat_id,
        warehouse_nhap_id: v.kho_nhap_id,
        so_luong: v.so_luong,
        don_gia: v.don_gia ?? 0,
        ten_hang: phieu.ten_hang || '',
        ghi_chu: v.ghi_chu || undefined,
        phieu_in_id: phieu.id,
      })
      message.success(`Đã chuyển BTP — phiếu ${res.data.so_phieu_chuyen}`)
      form.resetFields()
      onDone(res.data.so_phieu_chuyen, res.data.phieu_chuyen_kho_id)
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi chuyển BTP')
    } finally {
      setSaving(false)
    }
  }

  const addonBreakdown = btpPrice?.addon_detail
    ? Object.entries(btpPrice.addon_detail).filter(([, v]) => v > 0)
    : []

  return (
    <Modal
      open={open}
      title={<Space><SendOutlined />Chuyển BTP sang xưởng khác</Space>}
      onCancel={onClose}
      onOk={handleOk}
      okText="Chuyển BTP ngay"
      cancelText="Huỷ"
      okButtonProps={{ loading: saving }}
      width={540}
      destroyOnClose
    >
      {/* Thông tin phiếu */}
      <Card size="small" style={{ background: '#f0f5ff', borderColor: '#adc6ff', marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{phieu.ten_hang}</div>
        <Space size={16} style={{ marginTop: 4 }}>
          {phieu.so_lsx && <Text style={{ fontSize: 12 }}>LSX: <strong>{phieu.so_lsx}</strong></Text>}
          {phieu.so_luong_in_ok != null && (
            <Text style={{ fontSize: 12 }}>
              In OK: <strong style={{ color: '#52c41a' }}>{phieu.so_luong_in_ok.toLocaleString('vi-VN')}</strong>
            </Text>
          )}
        </Space>
      </Card>

      {!sourceKho && btpKhos.length === 0 && (
        <div style={{ color: '#ff4d4f', marginBottom: 10, fontSize: 13 }}>
          ⚠️ Chưa có kho BTP nào — tạo kho BTP trong Danh mục &gt; Kho.
        </div>
      )}
      {!sourceKho && btpKhos.length > 0 && (
        <div style={{ color: '#fa8c16', marginBottom: 10, fontSize: 13 }}>
          ℹ️ Không tìm thấy kho BTP của xưởng này — chọn kho xuất thủ công bên dưới.
        </div>
      )}

      {/* Công đoạn đã làm → tính giá */}
      <Card
        size="small"
        title={<span style={{ fontSize: 13 }}>Công đoạn xưởng này đã làm</span>}
        style={{ marginBottom: 12, borderColor: '#d9d9d9' }}
        extra={priceFetching ? <Spin size="small" /> : null}
      >
        <Row gutter={[8, 8]} align="middle">
          {/* Chống thấm */}
          <Col span={12}>
            <Space size={6}>
              <Text style={{ fontSize: 12 }}>Chống thấm:</Text>
              <Select
                size="small"
                value={addons.chong_tham}
                onChange={v => set('chong_tham', v)}
                style={{ width: 90 }}
                options={[{ value: 0, label: 'Không' }, { value: 1, label: '1 mặt' }, { value: 2, label: '2 mặt' }]}
              />
            </Space>
          </Col>
          {/* Cán màng */}
          <Col span={12}>
            <Space size={6}>
              <Text style={{ fontSize: 12 }}>Cán màng:</Text>
              <Select
                size="small"
                value={addons.can_mang}
                onChange={v => set('can_mang', v)}
                style={{ width: 90 }}
                options={[{ value: 0, label: 'Không' }, { value: 1, label: '1 mặt' }, { value: 2, label: '2 mặt' }]}
              />
            </Space>
          </Col>
          {/* In flexo */}
          <Col span={12}>
            <Space size={6}>
              <Text style={{ fontSize: 12 }}>In flexo:</Text>
              <InputNumber
                size="small"
                min={0}
                max={10}
                value={addons.in_flexo_mau}
                onChange={v => set('in_flexo_mau', v ?? 0)}
                style={{ width: 56 }}
              />
              <Text style={{ fontSize: 12 }}>màu</Text>
            </Space>
          </Col>
          {/* In flexo phủ nền + In KTS */}
          <Col span={12}>
            <Space size={10}>
              <Checkbox
                checked={addons.in_flexo_phu_nen}
                onChange={e => set('in_flexo_phu_nen', e.target.checked)}
                disabled={addons.in_flexo_mau === 0}
              >
                <span style={{ fontSize: 12 }}>Phủ nền</span>
              </Checkbox>
              <Checkbox
                checked={addons.in_ky_thuat_so}
                onChange={e => set('in_ky_thuat_so', e.target.checked)}
              >
                <span style={{ fontSize: 12 }}>In KTS</span>
              </Checkbox>
            </Space>
          </Col>
          {/* Bế */}
          <Col span={12}>
            <Space size={6}>
              <Text style={{ fontSize: 12 }}>Bế:</Text>
              <InputNumber
                size="small"
                min={0}
                value={addons.be_so_con}
                onChange={v => set('be_so_con', v ?? 0)}
                style={{ width: 56 }}
              />
              <Text style={{ fontSize: 12 }}>con</Text>
            </Space>
          </Col>
          {/* Chấp xà, Bồi, Dán, Ghim */}
          <Col span={12}>
            <Space size={10} wrap>
              {(['chap_xa', 'boi', 'dan', 'ghim'] as const).map(k => (
                <Checkbox key={k} checked={addons[k] as boolean} onChange={e => set(k, e.target.checked)}>
                  <span style={{ fontSize: 12 }}>{ADDON_LABELS[k] ?? k}</span>
                </Checkbox>
              ))}
            </Space>
          </Col>
        </Row>

        {/* Breakdown giá */}
        {btpPrice && (
          <div style={{ marginTop: 10, borderTop: '1px dashed #e8e8e8', paddingTop: 8 }}>
            <Row gutter={8}>
              <Col span={12}>
                <Text style={{ fontSize: 11, color: '#888' }}>
                  Giấy (a+b+e): {hasQuotePrice
                    ? <strong>{Math.round(btpPrice.gia_phoi!).toLocaleString('vi-VN')}đ</strong>
                    : <span style={{ color: '#faad14' }}>chưa có BG</span>}
                </Text>
              </Col>
              {addonBreakdown.length > 0 && (
                <Col span={12}>
                  {addonBreakdown.map(([k, v]) => (
                    <div key={k} style={{ fontSize: 11, color: '#595959' }}>
                      +{ADDON_LABELS[k] ?? k}: <strong>{Math.round(v).toLocaleString('vi-VN')}đ</strong>
                    </div>
                  ))}
                </Col>
              )}
            </Row>
          </div>
        )}
      </Card>

      <Form form={form} layout="vertical" initialValues={{ so_luong: phieu.so_luong_in_ok, don_gia: 0 }}>
        <Form.Item name="kho_xuat_id" label="Kho xuất" rules={[{ required: true, message: 'Chọn kho xuất' }]}>
          <Select options={btpKhos.map(w => ({ value: w.id, label: w.ten_kho }))} placeholder="Kho BTP xưởng này" />
        </Form.Item>
        <Form.Item name="kho_nhap_id" label="Kho nhập (xưởng nhận)" rules={[{ required: true, message: 'Chọn kho đích' }]}>
          <Select options={destKhos.map(w => ({ value: w.id, label: w.ten_kho }))} placeholder="Chọn xưởng nhận BTP" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="so_luong" label="Số lượng" rules={[{ required: true, type: 'number', min: 1, message: 'Nhập SL' }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="don_gia"
              label={
                <Space size={4}>
                  <span>Đơn giá nội bộ (đ/cái)</span>
                  {priceFetching && <Spin size="small" />}
                </Space>
              }
              extra={
                <span style={{ fontSize: 11, color: hasQuotePrice ? '#52c41a' : '#faad14' }}>
                  {hasQuotePrice ? 'Tự tính từ báo giá + công đoạn' : 'Không có BG — nhập tay'}
                </span>
              }
            >
              <InputNumber style={{ width: '100%' }} min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="ghi_chu" label="Ghi chú">
          <Input.TextArea rows={2} placeholder="Ghi chú thêm..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SauInKanbanPage() {
  const qc = useQueryClient()
  const [completingPhieu, setCompletingPhieu] = useState<PhieuIn | null>(null)
  const [startDinhHinhPhieu, setStartDinhHinhPhieu] = useState<PhieuIn | null>(null)
  const [chuyenBTPPhieu, setChuyenBTPPhieu] = useState<PhieuIn | null>(null)
  const [printTransferPhieu, setPrintTransferPhieu] = useState<{ id: number; soPhieu: string } | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()
  const [pausingPhieu, setPausingPhieu] = useState<PhieuIn | null>(null)
  const [pauseReason, setPauseReason] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cd2-sauin-kanban', phanXuongId],
    queryFn: () => cd2Api.getSauInKanban(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
    // refetchInterval removed in favor of WebSockets
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cd2-sauin-kanban'] })
    qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
  }

  // Lắng nghe tín hiệu từ WebSockets
  useEffect(() => {
    const handleUpdate = () => {
      invalidate()
    }
    socket.on('machine_status_update', handleUpdate)
    return () => {
      socket.off('machine_status_update', handleUpdate)
    }
  }, [qc])

  const startMut = useMutation({
    mutationFn: (id: number) => cd2Api.batDauSauIn(id),
    onSuccess: invalidate,
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi bắt đầu'),
  })

  const handleComplete = (phieu: PhieuIn) => {
    setCompletingPhieu(phieu)
  }

  const returnMut = useMutation({
    mutationFn: (id: number) => cd2Api.traVeSauIn(id),
    onSuccess: invalidate,
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi trả về'),
  })


  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deletePhieuIn(id),
    onSuccess: () => { invalidate(); message.success('Đã xoá') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xoá'),
    onSettled: () => setDeletingId(null),
  })

  const handlePrintTransfer = async () => {
    if (!printTransferPhieu) return
    try {
      const detail = await warehouseApi.getPhieuChuyen(printTransferPhieu.id).then(r => r.data)
      const cols = [
        { header: 'LSX', key: 'so_lsx', align: 'center' as const },
        { header: 'Tên hàng', key: 'ten_hang' },
        { header: 'Quy cách', key: 'quy_cach' },
        { header: 'SL', key: 'so_luong', align: 'right' as const },
        { header: 'Đơn giá', key: 'don_gia', align: 'right' as const },
        { header: 'Ghi chú', key: 'ghi_chu' },
      ]
      type ItemRow = { so_lsx: string; ten_hang: string; quy_cach: string; so_luong: string; don_gia: string; ghi_chu: string }
      const rows: ItemRow[] = ((detail.items || []) as unknown as Record<string, unknown>[]).map(it => ({
        so_lsx: (it.so_lsx as string) ?? '—',
        ten_hang: (it.ten_hang as string) ?? '',
        quy_cach: ((it.quy_cach || it.kho_cat || '—') as string),
        so_luong: Number(it.so_luong).toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
        don_gia: Number(it.don_gia) > 0 ? Number(it.don_gia).toLocaleString('vi-VN') + 'đ' : '—',
        ghi_chu: (it.ghi_chu as string) ?? '',
      }))
      const table = buildHtmlTable(
        cols.map(c => ({ header: c.header, align: c.align })),
        rows.map(row => cols.map(c => row[c.key as keyof ItemRow]))
      )
      const [yyyy, mm, dd] = (detail.ngay ?? '').split('-')
      await smartPrintPdf('WAREHOUSE_TRANSFER', {
        subtitle: 'PHIẾU CHUYỂN BÁN THÀNH PHẨM',
        document_number: detail.so_phieu,
        document_date: detail.ngay ? `${dd}/${mm}/${yyyy}` : '—',
        customer_name: `${detail.ten_kho_xuat ?? '—'}${detail.ten_phan_xuong_xuat ? ` (${detail.ten_phan_xuong_xuat})` : ''}`,
        delivery_address: `${detail.ten_kho_nhap ?? '—'}${detail.ten_phan_xuong_nhap ? ` (${detail.ten_phan_xuong_nhap})` : ''}`,
        body_html: table,
        footer_html: detail.ghi_chu ?? '',
      }, detail.phap_nhan_id_for_print ?? undefined)
    } catch (e) {
      message.error('Không thể in phiếu — ' + ((e as Error).message || ''))
    }
  }

  const handleTamDung = (phieu: PhieuIn) => {
    setPauseReason('')
    setPausingPhieu(phieu)
  }

  const tamDungMut = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) => cd2Api.tamDungIn(id, { ly_do }),
    onSuccess: () => { invalidate(); setPausingPhieu(null); setPauseReason('') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạm dừng'),
  })

  const handleConfirmPause = () => {
    if (!pausingPhieu) return
    if (!pauseReason.trim()) { message.warning('Vui lòng nhập lý do tạm dừng'); return }
    tamDungMut.mutate({ id: pausingPhieu.id, ly_do: pauseReason.trim() })
  }

  const handleTiepTuc = async (phieu: PhieuIn) => {
    try {
      await cd2Api.tiepTucIn(phieu.id)
      // sau_in + may_sau_in_id: advance to dang_sau_in so web stays in sync
      if (phieu.trang_thai === 'sau_in' && phieu.may_sau_in_id) {
        await cd2Api.batDauSauIn(phieu.id)
      }
      invalidate()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tiếp tục')
    }
  }

  const maySauIns = data?.may_sau_ins ?? []
  const machines = data?.machines ?? {}
  const choGanMay = data?.cho_gang_may ?? []

  const totalSauIn = Object.values(machines).reduce((s, arr) => s + arr.length, 0)
  const totalDang = Object.values(machines)
    .flat()
    .filter(p => p.trang_thai === 'dang_sau_in').length

  const tabItems = [
    // Tab "Chờ TP" — đầy đủ chuyển trạng thái cho phiếu chưa gán máy
    {
      key: 'cho_tp',
      label: (
        <Space size={4}>
          <span>⏳ Chờ TP</span>
          {choGanMay.length > 0 && (
            <Badge count={choGanMay.length} size="small" style={{ background: '#722ed1' }} />
          )}
        </Space>
      ),
      children: (
        <ChoTPTab
          items={choGanMay}
          onBatDauTP={p => setStartDinhHinhPhieu(p)}
          onStart={p => startMut.mutate(p.id)}
          onComplete={handleComplete}
          onReturn={p => returnMut.mutate(p.id)}
          onDelete={p => { setDeletingId(p.id); deleteMut.mutate(p.id) }}
          deletingId={deletingId}
          onTamDung={handleTamDung}
          onTiepTuc={handleTiepTuc}
          onChuyenBTP={p => setChuyenBTPPhieu(p)}
        />
      ),
    },
    ...maySauIns.map(m => {
      const items = machines[String(m.id)] ?? []
      const activeCount = items.filter(p => p.trang_thai === 'dang_sau_in').length
      const queueCount = items.filter(p => p.trang_thai === 'sau_in').length

      return {
        key: String(m.id),
        label: (
          <Space size={4}>
            <span>{m.ten_may}</span>
            {activeCount > 0 && (
              <Badge count={activeCount} size="small" style={{ background: '#fa8c16' }} />
            )}
            {queueCount > 0 && (
              <Badge count={queueCount} size="small" style={{ background: '#13c2c2' }} />
            )}
          </Space>
        ),
        children: (
          <MachineTab
            items={items}
            onStart={p => startMut.mutate(p.id)}
            onComplete={handleComplete}
            onReturn={p => returnMut.mutate(p.id)}
            onDelete={p => { setDeletingId(p.id); deleteMut.mutate(p.id) }}
            deletingId={deletingId}
            onTamDung={handleTamDung}
            onTiepTuc={handleTiepTuc}
          />
        ),
      }
    }),
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
        <Col>
          <Space>
            <AppstoreOutlined style={{ fontSize: 20, color: '#13c2c2' }} />
            <Title level={4} style={{ margin: 0 }}>Kanban Thành Phẩm</Title>
            <Badge count={totalSauIn} style={{ background: '#13c2c2' }} showZero />
            <CD2WorkshopSelector value={phanXuongId} onChange={setPhanXuongId} phanXuongList={phanXuongList} />
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
              Máy TP
            </Button>
            <Text type="secondary" style={{ fontSize: 11 }}>Cập nhật real-time</Text>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      {/* Stats */}
      {(totalSauIn > 0 || choGanMay.length > 0) && (
        <Row gutter={12} style={{ marginBottom: 14 }}>
          {choGanMay.length > 0 && (
            <Col xs={8} sm={6}>
              <Card size="small" style={{ background: '#f9f0ff', borderColor: '#d3adf7' }}>
                <Statistic
                  title="Chờ TP"
                  value={choGanMay.length}
                  valueStyle={{ color: '#722ed1', fontSize: 22 }}
                  suffix="phiếu"
                />
              </Card>
            </Col>
          )}
          <Col xs={8} sm={6}>
            <Card size="small" style={{ background: '#e6fffb', borderColor: '#87e8de' }}>
              <Statistic
                title="Đang TP"
                value={totalSauIn}
                valueStyle={{ color: '#13c2c2', fontSize: 22 }}
                suffix="phiếu"
              />
            </Card>
          </Col>
          <Col xs={8} sm={6}>
            <Card size="small">
              <Statistic
                title="Đang làm"
                value={totalDang}
                valueStyle={{ color: '#fa8c16', fontSize: 22 }}
                suffix="phiếu"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Tabs */}
      {isLoading ? (
        <Card loading />
      ) : (
        <Tabs items={tabItems} type="card" />
      )}

      {startDinhHinhPhieu && (
        <StartDinhHinhModal
          phieu={startDinhHinhPhieu}
          open
          onClose={() => setStartDinhHinhPhieu(null)}
          onDone={() => { setStartDinhHinhPhieu(null); invalidate() }}
        />
      )}

      {completingPhieu && (
        <HoanThanhModal
          phieu={completingPhieu}
          open
          onClose={() => setCompletingPhieu(null)}
          onDone={() => { setCompletingPhieu(null); invalidate() }}
        />
      )}

      <MaySauInSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {chuyenBTPPhieu && (
        <ChuyenBTPModal
          phieu={chuyenBTPPhieu}
          phanXuongId={phanXuongId ?? null}
          open
          onClose={() => setChuyenBTPPhieu(null)}
          onDone={(soPhieu, phieuChuyenId) => {
            setChuyenBTPPhieu(null)
            invalidate()
            setPrintTransferPhieu({ id: phieuChuyenId, soPhieu })
          }}
        />
      )}

      <Modal
        open={!!printTransferPhieu}
        title={`Phiếu ${printTransferPhieu?.soPhieu ?? ''} đã tạo thành công`}
        onCancel={() => setPrintTransferPhieu(null)}
        footer={[
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintTransfer}>
            In phiếu chuyển
          </Button>,
          <Button key="close" onClick={() => setPrintTransferPhieu(null)}>
            Đóng
          </Button>,
        ]}
        width={400}
        destroyOnClose
      >
        <p>BTP đã được chuyển kho thành công. In phiếu để cả hai bên thủ kho ký xác nhận.</p>
      </Modal>

      <Modal
        open={!!pausingPhieu}
        title={`Tạm dừng định hình — ${pausingPhieu?.so_phieu ?? ''}`}
        onCancel={() => setPausingPhieu(null)}
        onOk={handleConfirmPause}
        okText="Xác nhận tạm dừng"
        cancelText="Huỷ"
        okButtonProps={{ danger: true, icon: <PauseOutlined /> }}
        width={400}
        destroyOnClose
      >
        <div style={{ marginBottom: 8, color: '#595959' }}>
          Nhập lý do tạm dừng <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <Input.TextArea
          rows={3}
          placeholder="Vd: Hết vật liệu, máy trục trặc, nghỉ giải lao..."
          value={pauseReason}
          onChange={e => setPauseReason(e.target.value)}
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleConfirmPause() } }}
          autoFocus
        />
      </Modal>
    </div>
  )
}
