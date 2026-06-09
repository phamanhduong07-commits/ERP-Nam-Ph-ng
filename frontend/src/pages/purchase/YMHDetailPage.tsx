import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Spin, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, FileAddOutlined,
  PrinterOutlined, SendOutlined, StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  PurchaseRequisition, TaoPoPayload, TRANG_THAI_YMH, TRANG_THAI_YMH_COLOR, ymhApi,
} from '../../api/purchase_requisitions'
import { suppliersApi } from '../../api/suppliers'
import type { ApiError } from '../../api/types'
import { fmtVND } from '../../utils/exportUtils'

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

// One editable row inside the "Tạo PO" price-override table.
type PoLine = {
  ymh_item_id: number | null   // YMH item id; null only for legacy rows missing an id (cannot override)
  ten_hang: string
  so_luong: number
  dvt: string
  ngay_can: string | null
  don_gia: number              // editable, pre-filled from don_gia_du_kien
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
  const [poLines, setPoLines] = useState<PoLine[]>([])
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
    mutationFn: (payload: TaoPoPayload) => ymhApi.taoPO(id, payload),
    onSuccess: res => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success(`Đã tạo PO ${res.data.so_po}`)
      setPoOpen(false)
      poForm.resetFields()
      navigate(ROUTE_ORDERS)
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

  // ── Open Tạo PO modal: seed editable lines from the current YMH items ──
  function openPoModal() {
    if (!ymh) return
    setPoLines(ymh.items.map(it => ({
      ymh_item_id: it.id ?? null,
      ten_hang: it.ten_hang,
      so_luong: Number(it.so_luong || 0),
      dvt: it.dvt,
      ngay_can: it.ngay_can ?? null,
      don_gia: Number(it.don_gia_du_kien || 0),
    })))
    setPoNgayNhan(null)
    poForm.resetFields()
    poForm.setFieldsValue({ ngay_po: dayjs() })
    setPoOpen(true)
  }

  function setLinePrice(index: number, value: number) {
    setPoLines(prev => prev.map((l, i) => (i === index ? { ...l, don_gia: value } : l)))
  }

  const poTotal = useMemo(
    () => poLines.reduce((sum, l) => sum + l.so_luong * (l.don_gia || 0), 0),
    [poLines],
  )

  // Lines whose required date is earlier than the planned receive date — surfaced as a warning.
  const earlyLines = useMemo(() => {
    if (!poNgayNhan) return [] as PoLine[]
    const recv = poNgayNhan.startOf('day')
    return poLines.filter(l => l.ngay_can && dayjs(l.ngay_can).startOf('day').isBefore(recv))
  }, [poLines, poNgayNhan])

  async function handleCreatePO() {
    // Capture nullable state into a const before the await (avoids TS narrowing loss in async).
    const current = ymh
    if (!current) return
    const values = await poForm.validateFields()
    const itemsOverride = poLines
      .filter((l): l is PoLine & { ymh_item_id: number } => l.ymh_item_id != null)
      .map(l => ({ ymh_item_id: l.ymh_item_id, don_gia: Number(l.don_gia || 0) }))

    const payload: TaoPoPayload = {
      supplier_id: values.supplier_id,
      ngay_po: dayjs(values.ngay_po).format('YYYY-MM-DD'),
      ngay_du_kien_nhan: values.ngay_du_kien_nhan
        ? dayjs(values.ngay_du_kien_nhan).format('YYYY-MM-DD')
        : null,
      dieu_khoan_tt: values.dieu_khoan_tt ?? null,
      ghi_chu: values.ghi_chu ?? null,
      items_override: itemsOverride,
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

  const itemColumns: ColumnsType<PurchaseRequisition['items'][number]> = [
    { title: 'STT', width: 56, align: 'center', render: (_v, _r, i) => i + 1 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, render: v => v || '-' },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right', render: (v: number) => fmtVND(v) },
    { title: 'Đơn giá DK', dataIndex: 'don_gia_du_kien', width: 130, align: 'right', render: (v: number) => fmtVND(v) },
    {
      title: 'Thành tiền',
      width: 140,
      align: 'right',
      render: (_v, r) => <Text strong>{fmtVND((r.so_luong || 0) * (r.don_gia_du_kien || 0))}</Text>,
    },
    {
      title: 'Ngày cần',
      dataIndex: 'ngay_can',
      width: 110,
      render: (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', width: 160, render: (v: string | null | undefined) => v || '-' },
  ]

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
          columns={itemColumns}
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

      {/* ── Tạo PO modal (enhanced: editable prices + early-deadline warning) ── */}
      <Modal
        title={`Tạo PO từ ${ymh.so_ymh}`}
        open={poOpen}
        onCancel={() => { setPoOpen(false); poForm.resetFields() }}
        onOk={handleCreatePO}
        confirmLoading={taoPOMutation.isPending}
        okText="Tạo PO"
        cancelText="Đóng"
        width={860}
        destroyOnClose
      >
        <Form form={poForm} layout="vertical" initialValues={{ ngay_po: dayjs() }}>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn nhà cung cấp"
                  options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true, message: 'Chọn ngày PO' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="ngay_du_kien_nhan" label="Ngày dự kiến nhận">
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  onChange={v => setPoNgayNhan(v)}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="dieu_khoan_tt" label="Điều khoản thanh toán">
                <Select allowClear placeholder="Chọn điều khoản" options={DIEU_KHOAN_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input.TextArea rows={1} placeholder={`Tạo từ ${ymh.so_ymh}`} autoSize={{ minRows: 1, maxRows: 3 }} />
              </Form.Item>
            </Col>
          </Row>

          {earlyLines.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Có ${earlyLines.length} dòng hàng cần sớm hơn ngày giao dự kiến:`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {earlyLines.map((l, i) => (
                    <li key={l.ymh_item_id ?? `early-${i}`}>
                      {l.ten_hang} — cần ngày {l.ngay_can ? dayjs(l.ngay_can).format('DD/MM/YYYY') : '-'}
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          <Table<PoLine>
            rowKey={(_r, i) => String(i)}
            dataSource={poLines}
            pagination={false}
            size="small"
            scroll={{ x: 620 }}
            locale={{ emptyText: 'Không có dòng hàng' }}
            columns={[
              { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, render: v => v || '-' },
              { title: 'SL', dataIndex: 'so_luong', width: 90, align: 'right', render: (v: number) => fmtVND(v) },
              { title: 'ĐVT', dataIndex: 'dvt', width: 64 },
              {
                title: 'Đơn giá',
                width: 150,
                align: 'right',
                render: (_v, r, index) => (
                  <InputNumber
                    min={0}
                    value={r.don_gia}
                    onChange={val => setLinePrice(index, Number(val ?? 0))}
                    style={{ width: '100%' }}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={v => Number((v ?? '').replace(/,/g, '')) as unknown as 0}
                    disabled={r.ymh_item_id == null}
                  />
                ),
              },
              {
                title: 'Thành tiền',
                width: 140,
                align: 'right',
                render: (_v, r) => <Text strong>{fmtVND(r.so_luong * (r.don_gia || 0))}</Text>,
              },
            ]}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4} align="right">
                    <Text strong>Tổng cộng</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: ACCENT }}>{fmtVND(poTotal)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
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
