import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, Popconfirm, message, Typography, Row, Col, Switch, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { cauTrucApi, type CauTruc, type CauTrucCreate } from '../../api/cauTruc'
import { paperMaterialsApi, TO_HOP_SONG_OPTIONS, getSongType } from '../../api/quotes'

const { Title, Text } = Typography

const SO_LOP_OPTIONS = [3, 5, 7]

// ─── Hook: load distinct ma_ky_hieu options từ backend ───────────────────────
function usePaperOptions() {
  const [mkList, setMkList] = useState<string[]>([])
  const [byMk, setByMk] = useState<Record<string, number[]>>({})
  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    paperMaterialsApi.options().then(res => {
      setMkList(res.data.ma_ky_hieu)
      setByMk(res.data.by_mk)
    }).catch(() => {})
  }, [])
  return { mkList, byMk }
}

// ─── LayerFormRow: dòng lớp giấy trong form (Mã KH + Định lượng) ─────────────
function LayerFormRow({
  label, mkName, dlName, mkList, byMk, form,
}: {
  label: string
  mkName: string
  dlName: string
  mkList: string[]
  byMk: Record<string, number[]>
  form: ReturnType<typeof Form.useForm>[0]
}) {
  const mkVal = Form.useWatch(mkName, form) as string | undefined
  const dlOptions = mkVal && byMk[mkVal]
    ? byMk[mkVal].map(n => ({ value: n, label: `${n} g/m²` }))
    : Object.values(byMk).flat().filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
      .map(n => ({ value: n, label: `${n} g/m²` }))

  return (
    <Row gutter={8} style={{ marginBottom: 6 }} align="middle">
      <Col span={4}>
        <Text style={{ fontSize: 12 }}>{label}</Text>
      </Col>
      <Col span={10}>
        <Form.Item name={mkName} noStyle>
          <Select
            size="small"
            style={{ width: '100%' }}
            showSearch
            allowClear
            placeholder="Mã KH đồng cấp"
            options={mkList.map(mk => ({ value: mk, label: mk }))}
            filterOption={(input, opt) =>
              (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={() => {
              form.setFieldValue(dlName, null)
            }}
          />
        </Form.Item>
      </Col>
      <Col span={10}>
        <Form.Item name={dlName} noStyle>
          <Select
            size="small"
            style={{ width: '100%' }}
            allowClear
            placeholder="Định lượng (g/m²)"
            options={dlOptions}
            notFoundContent="—"
          />
        </Form.Item>
      </Col>
    </Row>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CauTrucList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CauTruc | null>(null)
  const [soLopForm, setSoLopForm] = useState(3)
  const [toHopSongForm, setToHopSongForm] = useState<string | null>(null)
  const [filterLop, setFilterLop] = useState<number | undefined>(undefined)
  const { mkList, byMk } = usePaperOptions()

  const { data = [], isLoading } = useQuery({
    queryKey: ['cau-truc', filterLop],
    queryFn: () => cauTrucApi.list({ so_lop: filterLop, active_only: false }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: CauTrucCreate) => cauTrucApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cau-truc'] }); closeModal(); message.success('Đã thêm kết cấu') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CauTrucCreate }) => cauTrucApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cau-truc'] }); closeModal(); message.success('Đã cập nhật') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cauTrucApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cau-truc'] }); message.success('Đã xoá') },
  })

  const openCreate = () => {
    setEditing(null)
    setSoLopForm(3)
    setToHopSongForm(null)
    form.resetFields()
    form.setFieldsValue({ so_lop: 3, thu_tu: 0, trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: CauTruc) => {
    setEditing(row)
    setSoLopForm(row.so_lop)
    setToHopSongForm(row.to_hop_song)
    form.setFieldsValue({ ...row })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: CauTrucCreate = {
      ten_cau_truc: vals.ten_cau_truc,
      so_lop: vals.so_lop,
      to_hop_song: vals.to_hop_song || null,
      mat:     vals.mat     || null,
      mat_dl:  vals.mat_dl  ?? null,
      song_1:    vals.song_1    || null,
      song_1_dl: vals.song_1_dl ?? null,
      mat_1:     vals.mat_1     || null,
      mat_1_dl:  vals.mat_1_dl  ?? null,
      song_2:    vals.so_lop >= 5 ? (vals.song_2    || null) : null,
      song_2_dl: vals.so_lop >= 5 ? (vals.song_2_dl ?? null) : null,
      mat_2:     vals.so_lop >= 5 ? (vals.mat_2     || null) : null,
      mat_2_dl:  vals.so_lop >= 5 ? (vals.mat_2_dl  ?? null) : null,
      song_3:    vals.so_lop >= 7 ? (vals.song_3    || null) : null,
      song_3_dl: vals.so_lop >= 7 ? (vals.song_3_dl ?? null) : null,
      mat_3:     vals.so_lop >= 7 ? (vals.mat_3     || null) : null,
      mat_3_dl:  vals.so_lop >= 7 ? (vals.mat_3_dl  ?? null) : null,
      ghi_chu: vals.ghi_chu || null,
      thu_tu: vals.thu_tu ?? 0,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  // Layer rows displayed in form based on so_lop
  const layerRows: { label: string; mkName: string; dlName: string }[] = [
    { label: 'Mặt', mkName: 'mat', dlName: 'mat_dl' },
    { label: `Sóng ${getSongType(toHopSongForm, 0)}`, mkName: 'song_1', dlName: 'song_1_dl' },
    { label: 'Mặt 1', mkName: 'mat_1', dlName: 'mat_1_dl' },
    ...(soLopForm >= 5 ? [
      { label: `Sóng ${getSongType(toHopSongForm, 1)}`, mkName: 'song_2', dlName: 'song_2_dl' },
      { label: 'Mặt 2', mkName: 'mat_2', dlName: 'mat_2_dl' },
    ] : []),
    ...(soLopForm >= 7 ? [
      { label: `Sóng ${getSongType(toHopSongForm, 2)}`, mkName: 'song_3', dlName: 'song_3_dl' },
      { label: 'Mặt 3', mkName: 'mat_3', dlName: 'mat_3_dl' },
    ] : []),
  ]

  const columns: ColumnsType<CauTruc> = [
    { title: 'TT', dataIndex: 'thu_tu', width: 45, align: 'center' },
    {
      title: 'Tên kết cấu',
      dataIndex: 'ten_cau_truc',
      render: (v: string, r: CauTruc) => (
        <div>
          <Text strong>{v}</Text>
          {r.ghi_chu && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.ghi_chu}</Text>}
        </div>
      ),
    },
    {
      title: 'Lớp',
      dataIndex: 'so_lop',
      width: 60,
      align: 'center',
      render: (v: number) => <Tag color="blue">{v} lớp</Tag>,
    },
    {
      title: 'Tổ hợp sóng',
      dataIndex: 'to_hop_song',
      width: 90,
      align: 'center',
      render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '—',
    },
    {
      title: 'Cấu trúc lớp giấy',
      width: 420,
      render: (_: unknown, r: CauTruc) => {
        const layers = [
          { label: 'Mặt',    code: r.mat,    dl: r.mat_dl,    isSong: false },
          { label: 'Sóng 1', code: r.song_1, dl: r.song_1_dl, isSong: true  },
          { label: 'Mặt 1',  code: r.mat_1,  dl: r.mat_1_dl,  isSong: false },
          ...(r.so_lop >= 5 ? [
            { label: 'Sóng 2', code: r.song_2, dl: r.song_2_dl, isSong: true  },
            { label: 'Mặt 2',  code: r.mat_2,  dl: r.mat_2_dl,  isSong: false },
          ] : []),
          ...(r.so_lop >= 7 ? [
            { label: 'Sóng 3', code: r.song_3, dl: r.song_3_dl, isSong: true  },
            { label: 'Mặt 3',  code: r.mat_3,  dl: r.mat_3_dl,  isSong: false },
          ] : []),
        ]
        const hasAny = layers.some(l => l.code)
        if (!hasAny) {
          const songs = r.to_hop_song ? r.to_hop_song.split('') : []
          const numMat = r.so_lop === 3 ? 2 : r.so_lop === 5 ? 3 : 4
          return (
            <Space size={2} wrap>
              {Array.from({ length: numMat }).map((_, i) => (
                <span key={i}>
                  <Tag style={{ fontSize: 11, background: '#f0f0f0', margin: '1px 2px' }}>Mặt</Tag>
                  {i < songs.length && (
                    <Tag color="blue" style={{ fontSize: 11, margin: '1px 2px' }}>
                      Sóng {songs[i]}
                    </Tag>
                  )}
                </span>
              ))}
              <Text type="secondary" style={{ fontSize: 10 }}>(chưa chọn giấy)</Text>
            </Space>
          )
        }
        return (
          <Space wrap size={[4, 2]}>
            {layers.map((l, i) => (
              <Tooltip key={i} title={l.label}>
                <Tag
                  color={l.isSong ? 'blue' : undefined}
                  style={{ fontSize: 11, margin: '1px', lineHeight: '18px' }}
                >
                  {l.code
                    ? <>{l.code}{l.dl != null ? <Text style={{ fontSize: 10, color: l.isSong ? '#91caff' : '#8c8c8c' }}> {l.dl}</Text> : null}</>
                    : <Text type="secondary" style={{ fontSize: 10 }}>—</Text>
                  }
                </Tag>
              </Tooltip>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 90,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ẩn'}</Tag>,
    },
    {
      title: '',
      key: 'act',
      width: 90,
      render: (_: unknown, r: CauTruc) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá kết cấu này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>Kết cấu giấy thông dụng</Title>
              <Tooltip title="Danh sách kết cấu hay dùng, chọn nhanh khi lập báo giá">
                <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
              </Tooltip>
            </Space>
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="Lọc theo lớp"
                allowClear
                style={{ width: 130 }}
                value={filterLop}
                onChange={setFilterLop}
                options={SO_LOP_OPTIONS.map(n => ({ value: n, label: `${n} lớp` }))}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm kết cấu
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>

      {/* ─── Create/Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        title={editing ? 'Sửa kết cấu' : 'Thêm kết cấu mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={600}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          {/* Thông tin cơ bản */}
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Tên kết cấu" name="ten_cau_truc" rules={[{ required: true, message: 'Nhập tên' }]}>
                <Input placeholder="VD: 3L BC Standard, 5L AB cao cấp..." />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item label="Số lớp" name="so_lop" rules={[{ required: true }]}>
                <Select
                  options={SO_LOP_OPTIONS.map(n => ({ value: n, label: `${n} lớp` }))}
                  onChange={(v) => {
                    setSoLopForm(v)
                    form.setFieldValue('to_hop_song', null)
                    setToHopSongForm(null)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item label="Tổ hợp sóng" name="to_hop_song">
                <Select
                  allowClear
                  placeholder="Chọn..."
                  options={(TO_HOP_SONG_OPTIONS[soLopForm] ?? []).map(s => ({ value: s, label: s }))}
                  onChange={(v) => setToHopSongForm(v ?? null)}
                  notFoundContent="Chọn số lớp trước"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Header cột giấy */}
          <Row gutter={8} style={{ marginBottom: 4 }}>
            <Col span={4} />
            <Col span={10}>
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Mã KH đồng cấp</Text>
            </Col>
            <Col span={10}>
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Định lượng (g/m²)</Text>
            </Col>
          </Row>

          {/* Các lớp giấy */}
          {layerRows.map(lr => (
            <LayerFormRow
              key={lr.mkName}
              label={lr.label}
              mkName={lr.mkName}
              dlName={lr.dlName}
              mkList={mkList}
              byMk={byMk}
              form={form}
            />
          ))}

          {/* Ghi chú, thứ tự, trạng thái */}
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={14}>
              <Form.Item label="Ghi chú" name="ghi_chu">
                <Input placeholder="Ghi chú thêm (không bắt buộc)" />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item label="Thứ tự" name="thu_tu">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
