import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Space, Tag, Input, Select, DatePicker,
  Popconfirm, message, Card, Row, Col, Typography, Tooltip, Badge, Modal,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckCircleOutlined, StopOutlined, FileAddOutlined,
  FileExcelOutlined, FilePdfOutlined, CopyOutlined, SendOutlined, SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { quotesApi, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../api/quotes'
import type { QuoteListItem } from '../../api/quotes'
import { phapNhanApi } from '../../api/phap_nhan'
import { exportExcelWithTemplate, exportToExcel, printToPdf, fmtVND, fmtDate, buildHtmlTable } from '../../utils/exportUtils'
import { systemApi } from '../../api/system'
import ImportExcelButton from '../../components/ImportExcelButton'
import { useAuthStore } from '../../store/auth'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

const FILTER_KEY = 'quote-list-filter'
function readFilter() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') } catch { return {} }
}

export default function QuoteList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEmbedded = !!onSelect

  const saved = isEmbedded ? {} : readFilter()
  const [inputText, setInputText] = useState<string>(saved.search || '')
  const [search, setSearch] = useState<string>(saved.search || '')
  const [trangThai, setTrangThai] = useState<string | undefined>(saved.trangThai)
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>(saved.phapNhanId)
  const [dateRange, setDateRange] = useState<[string, string] | []>(saved.dateRange || [])
  const [page, setPage] = useState<number>(saved.page || 1)
  const [myOnly, setMyOnly] = useState<boolean>(saved.myOnly || false)
  const [isExporting, setIsExporting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const role = useAuthStore(s => s.user?.role)
  const userId = useAuthStore(s => s.user?.id)
  const canApprove = role === 'ADMIN' || role === 'GIAM_DOC' || role === 'TRUONG_PHONG_SALE_ADMIN'
  const isSaleAdmin = role === 'SALE_ADMIN'

  // Debounce: cập nhật search state 400ms sau khi ngừng gõ
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!inputText) { setSearch(''); setPage(1); return }
    debounceRef.current = setTimeout(() => { setSearch(inputText); setPage(1) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [inputText])

  // Lưu filter vào sessionStorage khi thay đổi (chỉ non-embedded)
  useEffect(() => {
    if (isEmbedded) return
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ search, trangThai, phapNhanId, dateRange, page, myOnly }))
  }, [search, trangThai, dateRange, page, myOnly, isEmbedded])

  const { data: counts } = useQuery({
    queryKey: ['quotes-counts'],
    queryFn: () => quotesApi.counts().then(r => r.data),
  })

  const { data: phapNhanList } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const [giaHanTarget, setGiaHanTarget] = useState<{ id: number; so_bao_gia: string } | null>(null)
  const [giaHanDate, setGiaHanDate] = useState('')

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const itemsForTemplate = data?.items ?? []
      if (!itemsForTemplate.length) {
        message.warning('Không có báo giá để xuất Excel')
        return
      }
      const detailsForTemplate = await Promise.all(itemsForTemplate.map(r => quotesApi.get(r.id).then(res => res.data)))
      let resolvedPhapNhanId: number
      if (phapNhanId) {
        resolvedPhapNhanId = phapNhanId
      } else {
        const phapNhanIds = Array.from(new Set(detailsForTemplate.map(q => q.phap_nhan_id).filter(Boolean)))
        if (phapNhanIds.length !== 1) {
          message.error('Chỉ xuất Excel báo giá khi danh sách cùng một pháp nhân. Vui lòng lọc theo pháp nhân trước.')
          return
        }
        resolvedPhapNhanId = phapNhanIds[0] as number
      }
      const template = await systemApi.getExcelTemplate('SALES_QUOTE', resolvedPhapNhanId, true)
      const config = template.column_config || []
      if (!config.length) {
        message.error('Mẫu Excel SALES_QUOTE chưa cấu hình cột.')
        return
      }
      const rows = detailsForTemplate.flatMap(q => q.items.map((it, idx) => ({
        stt: idx + 1,
        so_bao_gia: q.so_bao_gia,
        ngay_bao_gia: fmtDate(q.ngay_bao_gia),
        ngay_het_han: fmtDate(q.ngay_het_han ?? null),
        phap_nhan: q.ten_phap_nhan || '',
        customer_name: q.customer?.ten_viet_tat || q.customer?.ten_don_vi || '',
        ma_amis: it.ma_amis || '',
        ten_hang: it.ten_hang,
        kich_thuoc: it.dai && it.rong && it.cao ? `${it.dai}x${it.rong}x${it.cao}` : '',
        so_lop: it.so_lop,
        to_hop_song: it.to_hop_song || '',
        ma_ky_hieu: it.ma_ky_hieu || '',
        so_luong: Number(it.so_luong || 0),
        dvt: it.dvt,
        gia_ban: Number(it.gia_ban || 0),
        thanh_tien: Number(it.gia_ban || 0) * Number(it.so_luong || 0),
        trang_thai: QUOTE_STATUS_LABELS[q.trang_thai] ?? q.trang_thai,
        ghi_chu: it.ghi_chu || '',
      })))
      exportExcelWithTemplate(`BaoGia_${dayjs().format('YYYYMMDD')}`, 'Bao gia', rows, config)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Xuat Excel bao gia that bai')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPdf = () => {
    const items = data?.items ?? []
    const cols = [
      { header: 'STT', align: 'center' as const },
      { header: 'Số BG' }, { header: 'Ngày BG' }, { header: 'Khách hàng' },
      { header: 'Ngày HH' }, { header: 'Số dòng', align: 'center' as const },
      { header: 'Tổng cộng (đ)', align: 'right' as const }, { header: 'Trạng thái' },
    ]
    const rows = items.map((r, i) => [
      i + 1, r.so_bao_gia, fmtDate(r.ngay_bao_gia), r.ten_khach_hang ?? '',
      fmtDate(r.ngay_het_han ?? null), r.so_dong, fmtVND(r.tong_cong), QUOTE_STATUS_LABELS[r.trang_thai] ?? r.trang_thai,
    ])
    printToPdf(
      'Danh sách báo giá',
      `<h2>DANH SÁCH BÁO GIÁ</h2>
       <p class="meta">Xuất ngày: ${dayjs().format('DD/MM/YYYY HH:mm')} — ${items.length} báo giá</p>
       ${buildHtmlTable(cols, rows)}`,
      true,
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search, trangThai, phapNhanId, dateRange, page, myOnly],
    queryFn: () =>
      quotesApi.list({
        search,
        trang_thai: trangThai,
        phap_nhan_id: phapNhanId,
        tu_ngay: dateRange[0],
        den_ngay: dateRange[1],
        page,
        page_size: 20,
        ...(myOnly && userId ? { created_by: userId } : {}),
      }).then(r => r.data),
  })

  const invalidateCounts = () => queryClient.invalidateQueries({ queryKey: ['quotes-counts'] })

  const submitMutation = useMutation({
    mutationFn: (id: number) => quotesApi.submit(id),
    onSuccess: () => {
      message.success('Đã gửi duyệt')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      invalidateCounts()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi gửi duyệt'),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => quotesApi.approve(id),
    onSuccess: () => {
      message.success('Đã duyệt báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      invalidateCounts()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => quotesApi.cancel(id),
    onSuccess: () => {
      message.success('Đã huỷ báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      invalidateCounts()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi huỷ'),
  })

  const taoDonMutation = useMutation({
    mutationFn: (id: number) => quotesApi.taoDonHang(id),
    onSuccess: (res) => {
      message.success(`Đã tạo ${res.data.so_don}`)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      navigate('/sales/orders')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo đơn'),
  })

  const copyMutation = useMutation({
    mutationFn: (id: number) => quotesApi.copy(id),
    onSuccess: (res) => {
      message.success(`Đã copy ${res.data.so_bao_gia}`)
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate(`/quotes/${res.data.id}/edit`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Copy báo giá thất bại'),
  })

  const giaHanMutation = useMutation({
    mutationFn: ({ id, ngay }: { id: number; ngay: string }) => quotesApi.giaHan(id, ngay),
    onSuccess: () => {
      message.success('Đã gia hạn báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      invalidateCounts()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Gia hạn thất bại'),
  })

  const compactColumns: ColumnsType<QuoteListItem> = [
    {
      title: 'Số BG',
      dataIndex: 'so_bao_gia',
      render: (v) => <Text style={{ color: '#1677ff', fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_bao_gia',
      width: 76,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 86,
      render: (v) => <Tag color={QUOTE_STATUS_COLORS[v] || 'default'} style={{ fontSize: 11 }}>{QUOTE_STATUS_LABELS[v] || v}</Tag>,
    },
  ]

  const fullColumns: ColumnsType<QuoteListItem> = [
    {
      title: 'Số BG',
      dataIndex: 'so_bao_gia',
      width: 140,
      render: (v, row) => (
        <Button type="link" size="small" onClick={() => navigate(`/quotes/${row.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày lập',
      dataIndex: 'created_at',
      width: 130,
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Ngày BG',
      dataIndex: 'ngay_bao_gia',
      width: 100,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'Ngày HH',
      dataIndex: 'ngay_het_han',
      width: 110,
      render: (v, row) => {
        if (!v) return '—'
        const d = dayjs(v)
        const daysLeft = d.diff(dayjs(), 'day')
        if (row.trang_thai === 'het_han' || daysLeft < 0) {
          return <span style={{ color: '#f5222d' }}>{d.format('DD/MM/YYYY')}</span>
        }
        if (daysLeft <= 3) {
          return <span style={{ color: '#f5222d' }}><WarningOutlined style={{ marginRight: 3 }} />{d.format('DD/MM/YYYY')}</span>
        }
        if (daysLeft <= 7) {
          return <span style={{ color: '#fa8c16' }}>{d.format('DD/MM/YYYY')}</span>
        }
        return d.format('DD/MM/YYYY')
      },
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 80,
      align: 'center',
    },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      width: 140,
      align: 'right',
      render: (v) => v ? v.toLocaleString('vi-VN') + ' ₫' : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v) => (
        <Tag color={QUOTE_STATUS_COLORS[v] || 'default'}>
          {QUOTE_STATUS_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Người lập',
      dataIndex: 'created_by_name',
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 130,
      ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotes/${row.id}`)} />
          </Tooltip>
          {row.trang_thai === 'moi' && !canApprove && (
            <Tooltip title="Gửi duyệt">
              <Popconfirm title="Gửi báo giá để duyệt?" onConfirm={() => submitMutation.mutate(row.id)}>
                <Button size="small" icon={<SendOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {(row.trang_thai === 'moi' || row.trang_thai === 'cho_duyet') && canApprove && (
            <Tooltip title="Duyệt">
              <Popconfirm title="Duyệt báo giá này?" onConfirm={() => approveMutation.mutate(row.id)}>
                <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost />
              </Popconfirm>
            </Tooltip>
          )}
          {row.trang_thai === 'da_duyet' && (
            <Tooltip title="Copy chỉnh sửa">
              <Button size="small" icon={<CopyOutlined />} onClick={() => copyMutation.mutate(row.id)} loading={copyMutation.isPending} />
            </Tooltip>
          )}
          {row.trang_thai === 'da_duyet' && (
            <Tooltip title="Lập đơn hàng">
              <Popconfirm title="Tạo đơn hàng từ báo giá này?" onConfirm={() => taoDonMutation.mutate(row.id)}>
                <Button size="small" icon={<FileAddOutlined />} type="primary" />
              </Popconfirm>
            </Tooltip>
          )}
          {row.trang_thai !== 'huy' && row.trang_thai !== 'het_han' && (
            <Tooltip title="Huỷ">
              <Popconfirm title="Huỷ báo giá này?" onConfirm={() => cancelMutation.mutate(row.id)}>
                <Button size="small" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}
          {row.trang_thai === 'het_han' && (
            <Tooltip title="Gia hạn">
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={() => setGiaHanTarget({ id: row.id, so_bao_gia: row.so_bao_gia })}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <style>{`.md-selected-row > td { background-color: #e6f4ff !important; }`}</style>

      <Card style={{ marginBottom: 8 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={5} style={{ margin: 0 }}>Báo giá</Title>
          </Col>
          <Col>
            <Space size={4}>
              <Tooltip title="Xuất Excel">
                <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} loading={isExporting} disabled={isExporting} />
              </Tooltip>
              <Tooltip title="Xuất PDF">
                <Button size="small" icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf} loading={isExporting} disabled={isExporting} />
              </Tooltip>
              <ImportExcelButton
                endpoint="/quotes"
                templateFilename="mau_import_bao_gia.xlsx"
                buttonText="Import"
                onImported={() => queryClient.invalidateQueries({ queryKey: ['quotes'] })}
              />
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => navigate('/quotes/new')}
              >
                Thêm mới
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Shortcut filter theo role */}
        {!isEmbedded && (canApprove || isSaleAdmin) && (
          <Row style={{ marginTop: 8 }} gutter={4}>
            {canApprove && (
              <Col>
                <Badge
                  count={counts?.cho_duyet || 0}
                  size="small"
                  offset={[-4, 0]}
                >
                  <Button
                    size="small"
                    type={trangThai === 'cho_duyet' ? 'primary' : 'default'}
                    icon={<SendOutlined />}
                    onClick={() => { setTrangThai(trangThai === 'cho_duyet' ? undefined : 'cho_duyet'); setPage(1) }}
                  >
                    Chờ duyệt
                  </Button>
                </Badge>
              </Col>
            )}
            <Col>
              <Button
                size="small"
                type={myOnly ? 'primary' : 'default'}
                onClick={() => { setMyOnly(!myOnly); setPage(1) }}
              >
                Của tôi
              </Button>
            </Col>
            {(counts?.het_han ?? 0) > 0 && (
              <Col>
                <Badge count={counts?.het_han || 0} size="small" color="orange" offset={[-4, 0]}>
                  <Button
                    size="small"
                    type={trangThai === 'het_han' ? 'primary' : 'default'}
                    icon={<WarningOutlined />}
                    onClick={() => { setTrangThai(trangThai === 'het_han' ? undefined : 'het_han'); setPage(1) }}
                  >
                    Hết hạn
                  </Button>
                </Badge>
              </Col>
            )}
          </Row>
        )}

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số BG, khách hàng..."
              prefix={<SearchOutlined />}
              size="small"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="TT"
              size="small"
              style={{ width: 115 }}
              allowClear
              value={trangThai}
              onChange={(v) => { setTrangThai(v); setPage(1) }}
              options={Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Col>
          <Col>
            <Select
              placeholder="Pháp nhân"
              size="small"
              style={{ width: 150 }}
              allowClear
              value={phapNhanId}
              onChange={(v) => { setPhapNhanId(v); setPage(1) }}
              options={(phapNhanList ?? []).map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            />
          </Col>
        </Row>

        <Row style={{ marginTop: 8 }}>
          <Col span={24}>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Ngày BG từ', 'Đến ngày']}
              value={dateRange.length === 2 ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={(_, s) => {
                setDateRange(s[0] && s[1] ? [
                  dayjs(s[0], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                  dayjs(s[1], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                ] : [])
                setPage(1)
              }}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={isEmbedded ? compactColumns : fullColumns}
        dataSource={data?.items || []}
        locale={{ emptyText: search || trangThai || dateRange.length ? 'Không tìm thấy báo giá nào' : 'Chưa có báo giá nào' }}
        rowClassName={(r) => r.id === selectedId ? 'md-selected-row' : ''}
        onRow={(r) => ({
          onClick: isEmbedded ? () => onSelect!(r.id) : undefined,
          style: isEmbedded ? { cursor: 'pointer' } : undefined,
        })}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
          showTotal: (t) => `${t} báo giá`,
          showSizeChanger: false,
          size: 'small',
        }}
        size="small"
        scroll={isEmbedded ? undefined : { x: 900 }}
      />

      <Modal
        title={`Gia hạn báo giá ${giaHanTarget?.so_bao_gia}`}
        open={!!giaHanTarget}
        onCancel={() => { setGiaHanTarget(null); setGiaHanDate('') }}
        onOk={() => {
          if (!giaHanTarget || !giaHanDate) return
          giaHanMutation.mutate(
            { id: giaHanTarget.id, ngay: giaHanDate },
            { onSuccess: () => { setGiaHanTarget(null); setGiaHanDate('') } },
          )
        }}
        okText="Gia hạn"
        okButtonProps={{ disabled: !giaHanDate }}
        confirmLoading={giaHanMutation.isPending}
        destroyOnClose
      >
        <p style={{ marginBottom: 12 }}>Chọn ngày hết hạn mới:</p>
        <DatePicker
          format="DD/MM/YYYY"
          style={{ width: '100%' }}
          disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
          onChange={(_, dateString) => {
            const s = Array.isArray(dateString) ? dateString[0] : dateString
            setGiaHanDate(s ? dayjs(s, 'DD/MM/YYYY').format('YYYY-MM-DD') : '')
          }}
        />
      </Modal>
    </div>
  )
}
