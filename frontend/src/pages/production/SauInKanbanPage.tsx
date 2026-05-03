import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, Divider, Empty,
  Form, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Space, Statistic, Tag, Tabs, Typography, message,
} from 'antd'
import {
  AppstoreOutlined, CheckCircleOutlined, DeleteOutlined,
  PlayCircleOutlined, PlusOutlined, ReloadOutlined,
  RollbackOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, MaySauIn, SauInKanbanData } from '../../api/cd2'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'

const { Title, Text } = Typography

// ── Phiếu card ────────────────────────────────────────────────────────────────

function PhieuCard({ phieu, actions }: { phieu: PhieuIn; actions: React.ReactNode }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderLeft: `4px solid ${phieu.trang_thai === 'dang_sau_in' ? '#fa8c16' : '#13c2c2'}` }}
    >
      <Row justify="space-between" align="top" wrap={false}>
        <Col flex="auto">
          <Space size={4} wrap style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: '#888' }}>{phieu.so_phieu}</Text>
            {phieu.trang_thai === 'dang_sau_in' && (
              <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>Đang làm</Tag>
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
            {phieu.so_luong_sau_in_ok != null && (
              <Col>
                <Text style={{ fontSize: 11, color: '#888' }}>Sau in OK </Text>
                <Text strong style={{ color: '#13c2c2', fontSize: 12 }}>
                  {phieu.so_luong_sau_in_ok.toLocaleString('vi-VN')}
                </Text>
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
                  ĐH: <strong>{dayjs(phieu.ngay_sau_in).format('DD/MM/YY')}</strong>
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

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({
  phieu,
  maySauIns,
  open,
  onClose,
  onDone,
}: {
  phieu: PhieuIn
  maySauIns: { id: number; ten_may: string }[]
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    if (!selectedId) { message.warning('Chọn máy sau in'); return }
    setSaving(true)
    try {
      await cd2Api.assignSauIn(phieu.id, selectedId)
      message.success('Đã gán máy')
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
      title={`Gán máy sau in — ${phieu.so_phieu}`}
      onCancel={onClose}
      onOk={handleOk}
      okText="Gán máy"
      cancelText="Huỷ"
      okButtonProps={{ loading: saving, type: 'primary' }}
      width={360}
    >
      <Card size="small" style={{ marginBottom: 12, background: '#e6fffb', borderColor: '#87e8de' }}>
        <Text strong>{phieu.ten_hang}</Text>
        {phieu.so_luong_in_ok != null && (
          <Text style={{ fontSize: 12, marginLeft: 8 }}>
            SL in OK: <strong style={{ color: '#52c41a' }}>{phieu.so_luong_in_ok.toLocaleString('vi-VN')}</strong>
          </Text>
        )}
      </Card>
      <Select
        style={{ width: '100%' }}
        placeholder="Chọn máy sau in"
        options={maySauIns.map(m => ({ value: m.id, label: m.ten_may }))}
        value={selectedId}
        onChange={setSelectedId}
        size="large"
      />
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
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo máy'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deleteMaySauIn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cd2-may-sau-in'] }),
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá máy'),
  })

  return (
    <Modal open={open} title="Quản lý máy sau in" onCancel={onClose} footer={null} width={480}>
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={v => createMut.mutate({ ten_may: v.ten_may, sort_order: v.sort_order ?? 0 })}
      >
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên' }]}>
          <Input placeholder="Tên máy sau in" />
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
}: {
  items: PhieuIn[]
  onStart: (p: PhieuIn) => void
  onComplete: (p: PhieuIn) => void
  onReturn: (p: PhieuIn) => void
  onDelete: (p: PhieuIn) => void
  deletingId: number | null
}) {
  const active = items.filter(p => p.trang_thai === 'dang_sau_in')
  const queue = items.filter(p => p.trang_thai === 'sau_in')

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
            {active.map(p => (
              <PhieuCard
                key={p.id}
                phieu={p}
                actions={
                  <>
                    <Popconfirm
                      title="Xác nhận hoàn thành?"
                      onConfirm={() => onComplete(p)}
                      okText="Hoàn thành"
                      cancelText="Huỷ"
                    >
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        size="small"
                        style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
                      >
                        Hoàn thành
                      </Button>
                    </Popconfirm>
                    <Button
                      size="small"
                      icon={<RollbackOutlined />}
                      onClick={() => onReturn(p)}
                      block
                    >
                      Trả về
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
                    <Button
                      size="small"
                      icon={<RollbackOutlined />}
                      onClick={() => onReturn(p)}
                      block
                    >
                      Trả về
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
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SauInKanbanPage() {
  const qc = useQueryClient()
  const [assignPhieu, setAssignPhieu] = useState<PhieuIn | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cd2-sauin-kanban', phanXuongId],
    queryFn: () => cd2Api.getSauInKanban(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
    refetchInterval: 15_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cd2-sauin-kanban'] })
    qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
  }

  const startMut = useMutation({
    mutationFn: (id: number) => cd2Api.batDauSauIn(id),
    onSuccess: invalidate,
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi bắt đầu'),
  })

  const completeMut = useMutation({
    mutationFn: (id: number) => cd2Api.hoanThanh(id),
    onSuccess: () => { invalidate(); message.success('Hoàn thành!') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi hoàn thành'),
  })

  const returnMut = useMutation({
    mutationFn: (id: number) => cd2Api.traVeSauIn(id),
    onSuccess: invalidate,
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi trả về'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deletePhieuIn(id),
    onSuccess: () => { invalidate(); message.success('Đã xoá') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
    onSettled: () => setDeletingId(null),
  })

  const maySauIns = data?.may_sau_ins ?? []
  const choGanMay = data?.cho_gang_may ?? []
  const machines = data?.machines ?? {}

  const totalSauIn = choGanMay.length +
    Object.values(machines).reduce((s, arr) => s + arr.length, 0)
  const totalDang = Object.values(machines)
    .flat()
    .filter(p => p.trang_thai === 'dang_sau_in').length

  const tabItems = [
    {
      key: 'cho',
      label: (
        <Space size={4}>
          <span>⏳ Chờ gán máy</span>
          {choGanMay.length > 0 && (
            <Badge count={choGanMay.length} size="small" style={{ background: '#13c2c2' }} />
          )}
        </Space>
      ),
      children: (
        <div>
          {choGanMay.length === 0 ? (
            <Empty
              description="Không có phiếu chờ gán máy"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: 32 }}
            />
          ) : (
            choGanMay.map(p => (
              <PhieuCard
                key={p.id}
                phieu={p}
                actions={
                  <>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => setAssignPhieu(p)}
                      style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
                    >
                      Gán máy
                    </Button>
                    <Popconfirm
                      title="Xoá phiếu?"
                      onConfirm={() => { setDeletingId(p.id); deleteMut.mutate(p.id) }}
                      okText="Xoá"
                      cancelText="Không"
                    >
                      <Button danger size="small" icon={<DeleteOutlined />} loading={deletingId === p.id} block />
                    </Popconfirm>
                  </>
                }
              />
            ))
          )}
        </div>
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
            onComplete={p => completeMut.mutate(p.id)}
            onReturn={p => returnMut.mutate(p.id)}
            onDelete={p => { setDeletingId(p.id); deleteMut.mutate(p.id) }}
            deletingId={deletingId}
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
            <Title level={4} style={{ margin: 0 }}>Kanban Sau In</Title>
            <Badge count={totalSauIn} style={{ background: '#13c2c2' }} showZero />
            <CD2WorkshopSelector value={phanXuongId} onChange={setPhanXuongId} phanXuongList={phanXuongList} />
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
              Máy sau in
            </Button>
            <Text type="secondary" style={{ fontSize: 11 }}>Tự cập nhật 15 giây</Text>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      {/* Stats */}
      {totalSauIn > 0 && (
        <Row gutter={12} style={{ marginBottom: 14 }}>
          <Col xs={8} sm={6}>
            <Card size="small" style={{ background: '#e6fffb', borderColor: '#87e8de' }}>
              <Statistic
                title="Đang chờ"
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
          <Col xs={8} sm={6}>
            <Card size="small">
              <Statistic
                title="Chờ gán máy"
                value={choGanMay.length}
                valueStyle={{ fontSize: 22 }}
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

      {/* Assign modal */}
      {assignPhieu && (
        <AssignModal
          phieu={assignPhieu}
          maySauIns={maySauIns}
          open
          onClose={() => setAssignPhieu(null)}
          onDone={() => { setAssignPhieu(null); invalidate() }}
        />
      )}

      <MaySauInSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
