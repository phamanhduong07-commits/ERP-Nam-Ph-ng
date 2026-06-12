import { useEffect, useRef, useState } from 'react'
import {
  Button, Card, Col, ColorPicker, Form, Input, InputNumber, Modal, Popconfirm,
  Row, Space, Switch, Table, Tag, Typography, message,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { hrApi, type CheckInLocation } from '../../api/hr'

const { Text, Title } = Typography

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]

export default function CheckInLocationsPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CheckInLocation | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['checkin-locations', showInactive],
    queryFn: () => hrApi.listCheckinLocations({ include_inactive: showInactive }).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteCheckinLocation(id),
    onSuccess: () => {
      message.success('Đã xóa địa điểm')
      qc.invalidateQueries({ queryKey: ['checkin-locations'] })
    },
  })

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (loc: CheckInLocation) => { setEditing(loc); setModalOpen(true) }

  const columns = [
    {
      title: 'Tên địa điểm', dataIndex: 'ten',
      render: (v: string, r: CheckInLocation) => (
        <Space>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.mau_sac || '#1677ff', display: 'inline-block' }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    { title: 'Địa chỉ', dataIndex: 'dia_chi', ellipsis: true },
    { title: 'Lat / Lng', width: 200,
      render: (_: unknown, r: CheckInLocation) => (
        <Text style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
          {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
        </Text>
      ),
    },
    { title: 'Bán kính', dataIndex: 'ban_kinh_m', width: 100,
      render: (v: number) => <Tag color="blue">{v} m</Tag> },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v: boolean) => v
        ? <Tag color="green">Đang dùng</Tag>
        : <Tag color="default">Tạm dừng</Tag>,
    },
    {
      title: 'Thao tác', width: 120, fixed: 'right' as const,
      render: (_: unknown, r: CheckInLocation) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa địa điểm này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <EnvironmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Địa điểm chấm công
        </Title>
        <Space>
          <span>
            <Switch size="small" checked={showInactive} onChange={setShowInactive} />
            <Text style={{ marginLeft: 6, fontSize: 12 }}>Hiển thị cả tạm dừng</Text>
          </span>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['checkin-locations'] })}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm địa điểm
          </Button>
        </Space>
      </div>

      <Card size="small">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={locations}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <CheckInLocationFormModal
        open={modalOpen}
        initial={editing}
        onCancel={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          qc.invalidateQueries({ queryKey: ['checkin-locations'] })
        }}
      />
    </div>
  )
}

interface FormModalProps {
  open: boolean
  initial: CheckInLocation | null
  onCancel: () => void
  onSaved: () => void
}

function CheckInLocationFormModal({ open, initial, onCancel, onSaved }: FormModalProps) {
  const [form] = Form.useForm()
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [banKinh, setBanKinh] = useState(100)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  // Reset form khi mở modal
  useEffect(() => {
    if (!open) return
    if (initial) {
      form.setFieldsValue(initial)
      setCoords({ lat: initial.lat, lng: initial.lng })
      setBanKinh(initial.ban_kinh_m)
    } else {
      form.resetFields()
      form.setFieldsValue({ ban_kinh_m: 100, is_active: true, mau_sac: '#1677ff' })
      setCoords(null)
      setBanKinh(100)
    }
  }, [open, initial, form])

  // Khởi tạo map sau khi modal mở (DOM sẵn sàng)
  useEffect(() => {
    if (!open) return
    // Đợi DOM render xong
    const t = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return
      const center: [number, number] = initial
        ? [initial.lat, initial.lng]
        : DEFAULT_CENTER
      const map = L.map(mapContainerRef.current, { center, zoom: initial ? 16 : 11 })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        subdomains: 'abcd', maxZoom: 20,
      }).addTo(map)
      mapRef.current = map

      // Click trên map → set vị trí
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        setCoords({ lat, lng })
        form.setFieldsValue({ lat, lng })
      })

      if (initial) {
        setCoords({ lat: initial.lat, lng: initial.lng })
      }
      map.invalidateSize()
    }, 150)
    return () => {
      clearTimeout(t)
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
  }, [open, initial, form])

  // Cập nhật marker + circle khi coords/banKinh đổi
  useEffect(() => {
    if (!mapRef.current || !coords) return
    if (markerRef.current) markerRef.current.remove()
    if (circleRef.current) circleRef.current.remove()
    markerRef.current = L.marker([coords.lat, coords.lng]).addTo(mapRef.current)
    circleRef.current = L.circle([coords.lat, coords.lng], {
      radius: banKinh,
      color: '#1677ff', fillColor: '#1677ff', fillOpacity: 0.15, weight: 2,
    }).addTo(mapRef.current)
  }, [coords, banKinh])

  // Tìm tôi đang ở đâu
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      message.warning('Trình duyệt không hỗ trợ GPS')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        form.setFieldsValue({ lat, lng })
        mapRef.current?.setView([lat, lng], 17)
      },
      (err) => message.error('Không lấy được GPS: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    try {
      if (initial) {
        await hrApi.updateCheckinLocation(initial.id, vals)
        message.success('Đã cập nhật')
      } else {
        await hrApi.createCheckinLocation(vals)
        message.success('Đã thêm địa điểm')
      }
      onSaved()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi lưu')
    }
  }

  return (
    <Modal
      open={open}
      title={initial ? 'Sửa địa điểm chấm công' : 'Thêm địa điểm chấm công'}
      onCancel={onCancel}
      onOk={handleSave}
      width={900}
      destroyOnClose
      okText="Lưu"
    >
      <Form form={form} layout="vertical" requiredMark={false} size="small">
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item label="Tên địa điểm" name="ten" rules={[{ required: true, message: 'Bắt buộc' }]}>
              <Input placeholder="VD: Văn phòng Nam Phương Q1" />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="dia_chi">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Row gutter={6}>
              <Col span={12}>
                <Form.Item label="Lat" name="lat" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} step={0.000001} min={-90} max={90} disabled />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Lng" name="lng" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} step={0.000001} min={-180} max={180} disabled />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Bán kính cho phép (m)" name="ban_kinh_m" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%' }}
                min={10} max={10000} step={10}
                onChange={(v) => setBanKinh(Number(v) || 100)}
              />
            </Form.Item>
            <Form.Item label="Ghi chú" name="ghi_chu">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Row gutter={6}>
              <Col span={12}>
                <Form.Item
                  label="Màu hiển thị" name="mau_sac"
                  getValueFromEvent={(c) => typeof c === 'string' ? c : c?.toHexString?.() ?? c}
                >
                  <ColorPicker showText format="hex" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
                  <Switch checkedChildren="Đang dùng" unCheckedChildren="Tạm dừng" />
                </Form.Item>
              </Col>
            </Row>
            <Button block icon={<EnvironmentOutlined />} onClick={useMyLocation}>
              Dùng vị trí hiện tại của tôi
            </Button>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
              💡 Hoặc click vào bản đồ để chọn vị trí
            </Text>
          </Col>
          <Col span={14}>
            <div
              ref={mapContainerRef}
              style={{ width: '100%', height: 460, borderRadius: 6, overflow: 'hidden', border: '1px solid #f0f0f0' }}
            />
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
