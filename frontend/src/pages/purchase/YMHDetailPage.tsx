import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Spin, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, FileAddOutlined,
  PrinterOutlined, SendOutlined, StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  PurchaseRequisition, TaoPOTheoNCCPayload, TRANG_THAI_YMH, TRANG_THAI_YMH_COLOR, ymhApi,
} from '../../api/purchase_requisitions'
import { suppliersApi } from '../../api/suppliers'
import type { ApiError } from '../../api/types'
import { fmtVND } from '../../utils/exportUtils'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography

// ── Design system: YMH is an internal request/legal-style form → purple accent + serif ──
const ACCENT = '#4A148C'
const SERIF = "'Times New Roman', serif"

// Mirror DIEU_KHOAN_OPTIONS from YMHListPage so PO terms stay consistent across the module.
const DIEU_KHOAN_OPTIONS = ['COD', 'NET15', 'NET30', 'NET45', 'NET60', 'TT trước']
  .map(v => ({ value: v, label: v }))

const ROUTE_LIST = '/purchasing/ymh'
const ROUTE_ORDERS = '/purchasing/orders'

// Project-wide error idiom (matches YMHListPage): FastAPI surfaces messages in response.data.detail.
function errMsg(e: unknown, fallback: string): string {
  return (e as ApiError)?.response?.data?.detail ?? fallback
}

// One editable row inside the "Tạo PO" group.
type PoItem = {
  ymh_item_id: number | null
  ten_hang: string
  loai_item: string | undefined
  so_luong: number
  dvt: string
  ngay_can: string | null
  don_gia: number
}

// One NCC group in the new multi-PO modal.
type PoGroup = {
  key: string
  supplier_id: number | null
  items: PoItem[]
}

export default function YMHDetailPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [poForm] = Form.useForm()

  // idParam comes from the URL and may be undefined or non-numeric; resolve to a number once.
  const id = Number(idParam)
  const idValid = Number.isInteger(id) && id > 0

  // ── Local UI state ──
  const [poOpen, setPoOpen] = useState(false)
  const [poGroups, setPoGroups] = useState<PoGroup[]>([])
  const [poNgayNhan, setPoNgayNhan] = useState<dayjs.Dayjs | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // ── Detail query ──
  const detailQuery = useQuery({
    queryKey: ['ymh-detail', id],
    queryFn: () => ymhApi.get(id).then(r => r.data),
    enabled: idValid,
  })
  const ymh = detailQuery.data

  // ── Supplier list for the Tạo PO modal ──
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  // ── Mutations: every onSuccess invalidates both detail and list caches ──
  function invalidate() {
    qc.invalidateQueries({ queryKey: ['ymh-detail', id] })
    qc.invalidateQueries({ queryKey: ['ymh-list'] })
  }

  const submitMutation = useMutation({
    mutationFn: () => ymhApi.submit(id),
    onSuccess: () => { invalidate(); message.success('Đã gửi yêu cầu đi duyệt') },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi gửi duyệt')),
  })

  const duyetPBMutation = useMutation({
    mutationFn: () => ymhApi.duyetPB(id),
    onSuccess: () => { invalidate(); message.success('Phòng ban đã duyệt') },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi duyệt PB')),
  })

  const duyetGDMutation = useMutation({
    mutationFn: () => ymhApi.duyetGD(id),
    onSuccess: () => { invalidate(); message.success('Giám đốc đã duyệt') },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi duyệt GĐ')),
  })

  const huyMutation = useMutation({
    mutationFn: () => ymhApi.huy(id),
    onSuccess: () => { invalidate(); message.success('Đã hủy YMH') },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi hủy YMH')),
  })

  const rejectMutation = useMutation({
    mutationFn: (ly_do: string) => ymhApi.reject(id, { ly_do }),
    onSuccess: () => {
      invalidate()
      message.success('Đã từ chối YMH')
      setRejectOpen(false)
      setRejectReason('')
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi từ chối')),
  })

  const taoPOMutation = useMutation({
    mutationFn: (payload: TaoPOTheoNCCPayload) => ymhApi.taoPOTheoNCC(id, payload),
    onSuccess: res => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      const soPos = res.data.pos.map(p => p.so_po).join(', ')
      message.success(`Đã tạo ${res.data.pos.length} PO: ${soPos}`)
      setPoOpen(false)
      poForm.resetFields()
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi tạo PO')),
  })

  // ── Print: fetch server-rendered HTML and open it (same idiom as POListPage.handlePrintPO) ──
  const [printing, setPrinting] = useState(false)
  async function handlePrint() {
    if (!idValid) return
    setPrinting(true)
    try {
      const res = await ymhApi.print(id)
      const w = window.open('', '_blank')
      if (!w) {
        // Popup blocked → fail loudly instead of silently doing nothing.
        message.error('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up rồi thử lại.')
        return
      }
      w.document.write(res.data)
      w.document.close()
    } catch (e) {
      message.error(errMsg(e, 'Không thể in phiếu YMH'))
    } finally {
      setPrinting(false)
    }
  }

  // ── Open Tạo PO modal: auto-group items by their suggested NCC ──
  function openPoModal() {
    if (!ymh) return
    const grouped = new Map<string, PoGroup>()
    ymh.items.forEach(it => {
      const sid = it.supplier_id_goi_y ?? null
      const key = sid != null ? `ncc-${sid}` : `unassigned`
      if (!grouped.has(key)) {
        grouped.set(key, { key, supplier_id: sid, items: [] })
      }
      grouped.get(key)!.items.push({
        ymh_item_id: it.id ?? null,
        ten_hang: it.ten_hang,
        loai_item: it.loai_item,
        so_luong: Number(it.so_luong || 0),
        dvt: it.dvt,
        ngay_can: it.ngay_can ?? null,
        don_gia: Number(it.don_gia_du_kien || 0),
      })
    })
    setPoGroups(Array.from(grouped.values()))
    setPoNgayNhan(null)
    poForm.resetFields()
    poForm.setFieldsValue({ ngay_po: dayjs() })
    setPoOpen(true)
  }

  function setGroupSupplier(key: string, sid: number | null) {
    setPoGroups(prev => prev.map(g => g.key === key ? { ...g, supplier_id: sid } : g))
  }

  function setGroupItemPrice(groupKey: string, itemId: number | null, value: number) {
    setPoGroups(prev => prev.map(g =>
      g.key !== groupKey ? g : {
        ...g,
        items: g.items.map(it => it.ymh_item_id === itemId ? { ...it, don_gia: value } : it),
      }
    ))
  }

  const poGrandTotal = useMemo(
    () => poGroups.reduce((sum, g) => sum + g.items.reduce((s, it) => s + it.so_luong * (it.don_gia || 0), 0), 0),
    [poGroups],
  )

  // Items whose required date is earlier than the planned receive date.
  const earlyItems = useMemo(() => {
    if (!poNgayNhan) return [] as PoItem[]
    const recv = poNgayNhan.startOf('day')
    return poGroups.flatMap(g => g.items).filter(it => it.ngay_can && dayjs(it.ngay_can).startOf('day').isBefore(recv))
  }, [poGroups, poNgayNhan])

  async function handleCreatePO() {
    if (!ymh) return
    const values = await poForm.validateFields()
    const missingNCC = poGroups.filter(g => !g.supplier_id)
    if (missingNCC.length > 0) {
      message.error(`Còn ${missingNCC.length} nhóm chưa chọn nhà cung cấp`)
      return
    }
    const payload: TaoPOTheoNCCPayload = {
      ngay_po: dayjs(values.ngay_po).format('YYYY-MM-DD'),
      ngay_du_kien_nhan: values.ngay_du_kien_nhan
        ? dayjs(values.ngay_du_kien_nhan).format('YYYY-MM-DD')
        : null,
      dieu_khoan_tt: values.dieu_khoan_tt ?? null,
      ghi_chu: values.ghi_chu ?? null,
      groups: poGroups.map(g => ({
        supplier_id: g.supplier_id!,
        item_ids: g.items.filter(it => it.ymh_item_id != null).map(it => it.ymh_item_id!),
        don_gia_overrides: g.items
          .filter(it => it.ymh_item_id != null)
          .map(it => ({ ymh_item_id: it.ymh_item_id!, don_gia: it.don_gia })),
      })),
    }
    taoPOMutation.mutate(payload)
  }

  function submitReject() {
    rejectMutation.mutate(rejectReason.trim())
  }

  // Any action mutation in flight → disable the whole action bar to prevent double-submits.
  const actionBusy =
    submitMutation.isPending || duyetPBMutation.isPending || duyetGDMutation.isPending ||
    huyMutation.isPending || rejectMutation.isPending

  // itemColumns has no dependency on ymh data — defined here so useColumnPrefs is called
  // before the render guards (hooks must not follow conditional early returns, React rule).
  const itemColumns: ColumnsType<PurchaseRequisition['items'][number]> = useMemo(() => [
    { title: 'STT', width: 56, align: 'center', render: (_v: unknown, _r: unknown, i: number) => i + 1 },
    {
      title: 'Loại',
      dataIndex: 'loai_item',
      width: 90,
      render: (v: string | null | undefined) => {
        if (v === 'ban_in') return <Tag color="orange">Bản In</Tag>
        if (v === 'khuon_be') return <Tag color="purple">Khuôn Bế</Tag>
        if (v === 'muc_in') return <Tag color="magenta">Mực In</Tag>
        if (v === 'dich_vu') return <Tag color="cyan">Dịch Vụ</Tag>
        return <Tag>NVL</Tag>
      },
    },
    {
      title: 'NCC',
      dataIndex: 'ten_ncc_goi_y',
      width: 130,
      ellipsis: true,
      render: (v: string | null | undefined) =>
        v ? <Tag color="geekblue" style={{ fontSize: 11 }}>{v}</Tag> : null,
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'ten_san_pham',
      width: 140,
      ellipsis: true,
      render: (v: string | null | undefined, r: PurchaseRequisition['items'][number]) =>
        (r.loai_item === 'ban_in' || r.loai_item === 'khuon_be' || r.loai_item === 'muc_in') ? (v || '-') : null,
    },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, render: (v: string | null | undefined) => v || '-' },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right', render: (v: number) => fmtVND(v) },
    { title: 'Đơn giá DK', dataIndex: 'don_gia_du_kien', width: 130, align: 'right', render: (v: number) => fmtVND(v) },
    {
      title: 'Thành tiền',
      width: 140,
      align: 'right',
      render: (_v: unknown, r: PurchaseRequisition['items'][number]) => <Text strong>{fmtVND((r.so_luong || 0) * (r.don_gia_du_kien || 0))}</Text>,
    },
    {
      title: 'Ngày cần',
      dataIndex: 'ngay_can',
      width: 110,
      render: (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', width: 160, render: (v: string | null | undefined) => v || '-' },
  ], [])
  const { displayColumns: displayItemColumns, settingsButton } = useColumnPrefs('purchase-ymh-detail', itemColumns)

  // ── Render guards ──
  if (!idValid) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTE_LIST)} style={{ marginBottom: 16 }}>
          Quay lại
        </Button>
        <Alert type="error" showIcon message="Mã YMH không hợp lệ" description={`Tham số id: "${idParam ?? ''}"`} />
      </div>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" tip="Đang tải yêu cầu mua hàng..." />
      </div>
    )
  }

  if (detailQuery.isError || !ymh) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          Quay lại
        </Button>
        <Alert
          type="error"
          showIcon
          message="Không tải được yêu cầu mua hàng"
          description={errMsg(detailQuery.error, 'Yêu cầu có thể đã bị xóa hoặc bạn không có quyền truy cập.')}
          action={<Button size="small" onClick={() => detailQuery.refetch()}>Thử lại</Button>}
        />
      </div>
    )
  }

  // From here, `ymh` is a defined PurchaseRequisition.
  const st = ymh.trang_thai

  const hasApprovalInfo =
    !!ymh.ten_nguoi_duyet_pb || !!ymh.ngay_duyet_pb ||
    !!ymh.ten_nguoi_duyet_gd || !!ymh.ngay_duyet_gd ||
    (st === 'tu_choi' && !!ymh.ly_do_tu_choi)

  return (
    <div style={{ paddingBottom: 32, fontFamily: SERIF }}>
      {/* Back */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 12, fontFamily: SERIF }}
      >
        Quay lại
      </Button>

      {/* Header */}
      <Card
        style={{ marginBottom: 16, borderTop: `3px solid ${ACCENT}` }}
        styles={{ body: { paddingTop: 16, paddingBottom: 16 } }}
      >
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col>
            <Space size="middle" align="center" wrap>
              <Title level={3} style={{ margin: 0, color: ACCENT, fontFamily: SERIF }}>
                {ymh.so_ymh}
              </Title>
              <Tag color={TRANG_THAI_YMH_COLOR[st] ?? 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                {TRANG_THAI_YMH[st] ?? st}
              </Tag>
              {ymh.po_id && (
                <Tag
                  color="cyan"
                  icon={<FileAddOutlined />}
                  style={{ cursor: 'pointer', fontSize: 13, padding: '2px 10px' }}
                  onClick={() => navigate(ROUTE_ORDERS)}
                >
                  PO: {ymh.so_po_linked ?? `#${ymh.po_id}`}
                </Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Button icon={<PrinterOutlined />} onClick={handlePrint} loading={printing} style={{ fontFamily: SERIF }}>
              In phiếu
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Info */}
      <Card title="Thông tin yêu cầu" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
          <Descriptions.Item label="Pháp nhân">{ymh.ten_phap_nhan ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Đơn vị / Xưởng">{ymh.ten_phan_xuong ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Người yêu cầu">{ymh.ten_nguoi_yeu_cau ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Ngày yêu cầu">
            {ymh.ngay_yeu_cau ? dayjs(ymh.ngay_yeu_cau).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Số dòng hàng">{ymh.so_dong}</Descriptions.Item>
          <Descriptions.Item label="Tổng dự kiến">
            <Text strong style={{ color: ACCENT }}>{fmtVND(ymh.tong_du_kien)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ghi chú" span={2}>{ymh.ghi_chu || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Items */}
      <Card title="Chi tiết hàng hóa" size="small" style={{ marginBottom: 16 }}>
        <Table
          rowKey={(r, i) => (r.id != null ? String(r.id) : `${r.ten_hang}-${i}`)}
          title={() => <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>{settingsButton}</div>}
          columns={displayItemColumns}
          dataSource={ymh.items}
          pagination={false}
          size="small"
          scroll={{ x: 880 }}
          locale={{ emptyText: 'Chưa có dòng hàng nào' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <Text strong>Tổng dự kiến</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: ACCENT }}>{fmtVND(ymh.tong_du_kien)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={2} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* POs created from this YCMH */}
      {(ymh.pos?.length ?? 0) > 0 && (
        <Card title="Đơn mua hàng đã tạo" size="small" style={{ marginBottom: 16 }}>
          <Table
            rowKey="po_id"
            dataSource={ymh.pos}
            size="small"
            pagination={false}
            columns={[
              {
                title: 'Số PO',
                dataIndex: 'so_po',
                render: (v: string) => (
                  <Button type="link" style={{ padding: 0 }} onClick={() => navigate(ROUTE_ORDERS)}>
                    {v}
                  </Button>
                ),
              },
              { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
              { title: 'Tổng tiền', dataIndex: 'tong_tien', align: 'right', width: 140, render: (v: number) => fmtVND(v) },
              {
                title: 'Trạng thái',
                dataIndex: 'trang_thai',
                width: 120,
                render: (v: string) => <Tag>{v}</Tag>,
              },
            ]}
          />
        </Card>
      )}

      {/* Approval history */}
      {hasApprovalInfo && (
        <Card title="Lịch sử phê duyệt" size="small" style={{ marginBottom: 16 }}>
          {st === 'tu_choi' && ymh.ly_do_tu_choi && (
            <Alert
              type="error"
              showIcon
              message="Yêu cầu đã bị từ chối"
              description={ymh.ly_do_tu_choi}
              style={{ marginBottom: 12 }}
            />
          )}
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            {(ymh.ten_nguoi_duyet_pb || ymh.ngay_duyet_pb) && (
              <>
                <Descriptions.Item label="Người duyệt PB">{ymh.ten_nguoi_duyet_pb ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Ngày duyệt PB">
                  {ymh.ngay_duyet_pb ? dayjs(ymh.ngay_duyet_pb).format('DD/MM/YYYY HH:mm') : '-'}
                </Descriptions.Item>
              </>
            )}
            {(ymh.ten_nguoi_duyet_gd || ymh.ngay_duyet_gd) && (
              <>
                <Descriptions.Item label="Người duyệt GĐ">{ymh.ten_nguoi_duyet_gd ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Ngày duyệt GĐ">
                  {ymh.ngay_duyet_gd ? dayjs(ymh.ngay_duyet_gd).format('DD/MM/YYYY HH:mm') : '-'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Action bar — conditional by trang_thai */}
      {['nhap', 'cho_duyet', 'duyet_pb', 'duyet_gd'].includes(st) && (
        <Card size="small">
          <Space wrap>
            {st === 'nhap' && (
              <Popconfirm title="Gửi yêu cầu đi duyệt?" onConfirm={() => submitMutation.mutate()}>
                <Button type="primary" icon={<SendOutlined />} loading={submitMutation.isPending} disabled={actionBusy}>
                  Gửi duyệt
                </Button>
              </Popconfirm>
            )}

            {st === 'cho_duyet' && (
              <Popconfirm title="Phòng ban duyệt yêu cầu này?" onConfirm={() => duyetPBMutation.mutate()}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={duyetPBMutation.isPending}
                  disabled={actionBusy}
                >
                  Duyệt PB
                </Button>
              </Popconfirm>
            )}

            {st === 'duyet_pb' && (
              <Popconfirm title="Giám đốc duyệt yêu cầu này?" onConfirm={() => duyetGDMutation.mutate()}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={duyetGDMutation.isPending}
                  disabled={actionBusy}
                  style={{ background: '#1B5E20', borderColor: '#1B5E20' }}
                >
                  Duyệt GĐ
                </Button>
              </Popconfirm>
            )}

            {st === 'duyet_gd' && (
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={openPoModal}
                disabled={actionBusy}
                style={{ background: ACCENT, borderColor: ACCENT }}
              >
                Tạo PO
              </Button>
            )}

            {/* Từ chối: available while the request is still in an approval stage */}
            {['cho_duyet', 'duyet_pb'].includes(st) && (
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => { setRejectReason(''); setRejectOpen(true) }}
                disabled={actionBusy}
              >
                Từ chối
              </Button>
            )}

            {/* Hủy: available in every actionable state */}
            <Popconfirm title="Hủy yêu cầu mua hàng này?" okButtonProps={{ danger: true }} onConfirm={() => huyMutation.mutate()}>
              <Button danger icon={<StopOutlined />} loading={huyMutation.isPending} disabled={actionBusy}>
                Hủy
              </Button>
            </Popconfirm>
          </Space>
        </Card>
      )}

      {/* ── Tạo PO modal — mỗi nhóm NCC tạo 1 PO riêng ── */}
      <Modal
        title={`Tạo PO từ ${ymh.so_ymh}`}
        open={poOpen}
        onCancel={() => { setPoOpen(false); poForm.resetFields() }}
        onOk={handleCreatePO}
        confirmLoading={taoPOMutation.isPending}
        okText={`Tạo ${poGroups.length} PO`}
        cancelText="Đóng"
        width={900}
        destroyOnClose
      >
        <Form form={poForm} layout="vertical" initialValues={{ ngay_po: dayjs() }}>
          {/* Shared date/terms fields */}
          <Row gutter={12}>
            <Col xs={12} md={6}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true, message: 'Chọn ngày PO' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="ngay_du_kien_nhan" label="Ngày dự kiến nhận">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={v => setPoNgayNhan(v)} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="dieu_khoan_tt" label="Điều khoản TT">
                <Select allowClear placeholder="Chọn điều khoản" options={DIEU_KHOAN_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder={`Tạo từ ${ymh.so_ymh}`} />
              </Form.Item>
            </Col>
          </Row>

          {earlyItems.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Có ${earlyItems.length} dòng cần sớm hơn ngày giao dự kiến`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {earlyItems.map((it, i) => (
                    <li key={it.ymh_item_id ?? `early-${i}`}>
                      {it.ten_hang} — cần {it.ngay_can ? dayjs(it.ngay_can).format('DD/MM/YYYY') : '-'}
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          {/* One group per NCC */}
          {poGroups.map((grp, gi) => {
            const grpTotal = grp.items.reduce((s, it) => s + it.so_luong * (it.don_gia || 0), 0)
            return (
              <div key={grp.key}>
                {gi > 0 && <Divider style={{ margin: '12px 0' }} />}
                <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
                  <Col flex="auto">
                    <Text strong>Nhóm {gi + 1} — Nhà cung cấp:</Text>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Chọn nhà cung cấp"
                      value={grp.supplier_id}
                      onChange={v => setGroupSupplier(grp.key, v)}
                      style={{ width: 280, marginLeft: 8 }}
                      options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
                      status={grp.supplier_id ? undefined : 'error'}
                    />
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tổng nhóm: <Text strong style={{ color: ACCENT }}>{fmtVND(grpTotal)}</Text>
                    </Text>
                  </Col>
                </Row>
                <Table<PoItem>
                  rowKey={(_r, i) => `${grp.key}-${i}`}
                  dataSource={grp.items}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'Không có dòng hàng' }}
                  columns={[
                    {
                      title: 'Loại',
                      dataIndex: 'loai_item',
                      width: 90,
                      render: (v: string) => {
                        if (v === 'ban_in') return <Tag color="orange">Bản In</Tag>
                        if (v === 'khuon_be') return <Tag color="purple">Khuôn Bế</Tag>
                        if (v === 'muc_in') return <Tag color="magenta">Mực In</Tag>
                        return <Tag>NVL</Tag>
                      },
                    },
                    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                    { title: 'SL', dataIndex: 'so_luong', width: 80, align: 'right', render: (v: number) => fmtVND(v) },
                    { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
                    {
                      title: 'Đơn giá',
                      width: 150,
                      align: 'right',
                      render: (_v, r) => (
                        <InputNumber
                          min={0}
                          value={r.don_gia}
                          onChange={val => setGroupItemPrice(grp.key, r.ymh_item_id, Number(val ?? 0))}
                          style={{ width: '100%' }}
                          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={v => Number((v ?? '').replace(/,/g, '')) as unknown as 0}
                          disabled={r.ymh_item_id == null}
                        />
                      ),
                    },
                    {
                      title: 'Thành tiền',
                      width: 130,
                      align: 'right',
                      render: (_v, r) => <Text strong>{fmtVND(r.so_luong * (r.don_gia || 0))}</Text>,
                    },
                  ]}
                />
              </div>
            )
          })}

          {/* Grand total */}
          <div style={{ textAlign: 'right', marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <Text>Tổng cộng tất cả PO: </Text>
            <Text strong style={{ color: ACCENT, fontSize: 15 }}>{fmtVND(poGrandTotal)}</Text>
          </div>
        </Form>
      </Modal>

      {/* ── Từ chối modal ── */}
      <Modal
        title={`Từ chối YMH - ${ymh.so_ymh}`}
        open={rejectOpen}
        onCancel={() => { setRejectOpen(false); setRejectReason('') }}
        onOk={submitReject}
        confirmLoading={rejectMutation.isPending}
        okText="Xác nhận từ chối"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <p>Nhập lý do từ chối (tùy chọn):</p>
        <Input.TextArea
          rows={3}
          placeholder="VD: Chưa đủ thông tin, vượt ngân sách, sai nhà cung cấp..."
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  )
}
