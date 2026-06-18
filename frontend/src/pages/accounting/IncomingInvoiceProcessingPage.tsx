import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Space, Card, Input, Row, Col, DatePicker, Select,
  Modal, Form, Switch, Typography, message, notification, Tooltip, Empty, Upload, Badge, Divider, List, Spin, Statistic, Popconfirm
} from 'antd'
import {
  SyncOutlined, UploadOutlined, FileTextOutlined,
  SearchOutlined, InfoCircleOutlined,
  CheckOutlined, ArrowRightOutlined, DownloadOutlined, RollbackOutlined,
  StarFilled, WarningOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageLayout from '../../components/PageLayout'
import {
  incomingInvoiceApi,
  IncomingInvoice,
  IncomingInvoiceItem,
  IncomingInvoiceItemMapping
} from '../../api/accounting'
import { usePhapNhan } from '../../hooks/useMasterData'
import { warehousesApi } from '../../api/warehouses'
import { suppliersApi } from '../../api/suppliers'
import { fmtVND } from '../../utils/exportUtils'

const { Text, Paragraph } = Typography
const { RangePicker } = DatePicker

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  cho_xu_ly: { label: 'Chờ xử lý', color: 'orange' },
  da_xu_ly: { label: 'Đã xử lý', color: 'green' },
  bo_qua: { label: 'Đã bỏ qua', color: 'default' }
}

export default function IncomingInvoiceProcessingPage() {
  const queryClient = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>('cho_xu_ly')
  const [filterMST, setFilterMST] = useState<string | undefined>()
  const [filterSupplierName, setFilterSupplierName] = useState<string | undefined>()
  const [filterPhapNhanId, setFilterPhapNhanId] = useState<number | undefined>()
  const [filterSoHoaDon, setFilterSoHoaDon] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  // Drawer/Modal state
  const [processId, setProcessId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Fetch stats — filter theo phap_nhan_id hiện tại
  const { data: stats } = useQuery({
    queryKey: ['incoming-invoices-stats', filterPhapNhanId],
    queryFn: () => incomingInvoiceApi.stats(filterPhapNhanId),
    refetchInterval: 30000,
  })

  // Fetch incoming invoices
  const { data, isLoading } = useQuery({
    queryKey: ['incoming-invoices', tuNgay, denNgay, filterTrangThai, filterMST, filterSupplierName, filterPhapNhanId, filterSoHoaDon, page],
    queryFn: () =>
      incomingInvoiceApi.list({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        trang_thai: filterTrangThai,
        supplier_tax_code: filterMST || undefined,
        supplier_name: filterSupplierName || undefined,
        phap_nhan_id: filterPhapNhanId || undefined,
        so_hoa_don: filterSoHoaDon || undefined,
        page,
        page_size: 20,
      }),
  })

  // Fetch active warehouses
  const { data: warehouseRes } = useQuery({
    queryKey: ['warehouses-active'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })
  const warehouseList = warehouseRes || []

  // Fetch active suppliers
  const { data: supplierRes } = useQuery({
    queryKey: ['suppliers-active-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })
  const supplierList = supplierRes || []

  // Sync emails mutation
  const syncMutation = useMutation({
    mutationFn: () => incomingInvoiceApi.syncEmail(),
    onSuccess: (res) => {
      message.success(res.detail || `Đã đồng bộ thành công ${res.count} hóa đơn mới.`)
      queryClient.invalidateQueries({ queryKey: ['incoming-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['incoming-invoices-stats'], exact: false })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi khi đồng bộ email.')
    }
  })

  // Upload XML mutation
  const uploadXMLProps = {
    name: 'file',
    accept: '.xml',
    multiple: false,
    showUploadList: false,
    beforeUpload(file: File) {
      const isXml = file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml')
      if (!isXml) {
        message.error('Chỉ chấp nhận file định dạng XML!')
        return false
      }

      incomingInvoiceApi.uploadXML(file)
        .then((res) => {
          message.success(res.detail || 'Tải lên hóa đơn XML thành công!')
          queryClient.invalidateQueries({ queryKey: ['incoming-invoices'] })
          queryClient.invalidateQueries({ queryKey: ['incoming-invoices-stats'], exact: false })
          if (res.id) {
            setProcessId(res.id)
            setIsModalOpen(true)
          }
        })
        .catch((err) => {
          message.error(err?.response?.data?.detail || 'Tải lên file XML thất bại.')
        })
      return false
    }
  }

  // Ignore invoice mutation
  const ignoreMutation = useMutation({
    mutationFn: (id: number) => incomingInvoiceApi.ignore(id),
    onSuccess: (res) => {
      message.success(res.detail || 'Đã bỏ qua hóa đơn thành công.')
      setIsModalOpen(false)
      setProcessId(null)
      queryClient.invalidateQueries({ queryKey: ['incoming-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['incoming-invoices-stats'], exact: false })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi khi cập nhật hóa đơn.')
    }
  })

  // Revert (undo ignore) mutation
  const revertMutation = useMutation({
    mutationFn: (id: number) => incomingInvoiceApi.revert(id),
    onSuccess: (res) => {
      message.success(res.detail || 'Đã mở lại hóa đơn thành công.')
      queryClient.invalidateQueries({ queryKey: ['incoming-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['incoming-invoices-stats'], exact: false })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi khi hoàn tác.')
    }
  })

  const handleOpenProcess = (id: number) => {
    setProcessId(id)
    setIsModalOpen(true)
  }

  const columns: ColumnsType<IncomingInvoice> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      key: 'so_hoa_don',
      width: 130,
      render: (v, r) => (
        <a onClick={() => handleOpenProcess(r.id)} style={{ fontWeight: 'bold' }}>
          {v || `HĐ #${r.id}`}
        </a>
      )
    },
    {
      title: 'Ký hiệu',
      dataIndex: 'ky_hieu',
      key: 'ky_hieu',
      width: 100,
    },
    {
      title: 'Ngày hóa đơn',
      dataIndex: 'ngay_hoa_don',
      key: 'ngay_hoa_don',
      width: 115,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Ngày nhận',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 115,
      render: v => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-'
    },
    {
      title: 'Đơn vị bán',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      ellipsis: true,
      render: (v, r) => (
        <div>
          <Text strong>{v}</Text>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>MST: {r.supplier_tax_code}</div>
        </div>
      )
    },
    {
      title: 'Pháp nhân mua',
      key: 'phap_nhan',
      width: 140,
      ellipsis: true,
      render: (_: any, r: IncomingInvoice) => r.internal_phap_nhan_name
        ? <Tag color="purple" style={{ fontSize: 11 }}>{r.internal_phap_nhan_name}</Tag>
        : <span style={{ color: '#bfbfbf', fontSize: 11 }}>{r.buyer_name || '-'}</span>
    },
    {
      title: 'Tổng thanh toán',
      dataIndex: 'tong_thanh_toan',
      key: 'tong_thanh_toan',
      align: 'right',
      width: 140,
      render: v => fmtVND(v)
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: v => {
        const s = STATUS_LABELS[v] || { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      }
    },
    {
      title: 'Liên kết',
      key: 'linked_docs',
      width: 200,
      render: (_, r) => (
        <Space direction="vertical" size={1} style={{ fontSize: '12px' }}>
          {r.purchase_invoice_id && (
            <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => window.open(`/accounting/purchase-invoices/${r.purchase_invoice_id}`, '_blank')}>
              HĐ Mua hàng #{r.purchase_invoice_id}
            </Tag>
          )}
          {r.goods_receipt_id && (
            <Tag color="cyan" style={{ cursor: 'pointer' }} onClick={() => window.open(`/purchasing/goods-receipts/${r.goods_receipt_id}`, '_blank')}>
              Phiếu nhập kho #{r.goods_receipt_id}
            </Tag>
          )}
          {!r.purchase_invoice_id && !r.goods_receipt_id && <span style={{ color: '#bfbfbf' }}>Chưa sinh chứng từ</span>}
        </Space>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <Space>
          {r.trang_thai === 'cho_xu_ly' ? (
            <>
              <Button type="primary" size="small" onClick={() => handleOpenProcess(r.id)}>
                Xử lý
              </Button>
              <Button size="small" danger onClick={() => ignoreMutation.mutate(r.id)} loading={ignoreMutation.isPending}>
                Bỏ qua
              </Button>
            </>
          ) : r.trang_thai === 'bo_qua' ? (
            <>
              <Button size="small" icon={<FileTextOutlined />} onClick={() => handleOpenProcess(r.id)}>
                Xem
              </Button>
              <Popconfirm
                title="Mở lại hóa đơn?"
                description="Hóa đơn sẽ được đưa về trạng thái Chờ xử lý."
                onConfirm={() => revertMutation.mutate(r.id)}
                okText="Mở lại"
                cancelText="Hủy"
              >
                <Button size="small" icon={<RollbackOutlined />} loading={revertMutation.isPending}>
                  Mở lại
                </Button>
              </Popconfirm>
            </>
          ) : (
            <Button size="small" icon={<FileTextOutlined />} onClick={() => handleOpenProcess(r.id)}>
              Xem chi tiết
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <PageLayout
      title="Xử lý hóa đơn đầu vào tự động"
      actions={
        <Space>
          <Upload {...uploadXMLProps}>
            <Button icon={<UploadOutlined />} type="dashed">
              Tải XML lên
            </Button>
          </Upload>
          <Button
            type="primary"
            icon={<SyncOutlined spin={syncMutation.isPending} />}
            loading={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            Đồng bộ Email nhận HĐ
          </Button>
        </Space>
      }
    >
      {/* Stats Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderLeft: '4px solid #fa8c16', cursor: 'pointer' }}
            onClick={() => { setFilterTrangThai('cho_xu_ly'); setPage(1) }}
          >
            <Statistic
              title="Chờ xử lý"
              value={stats?.cho_xu_ly?.count ?? 0}
              suffix={<span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 'normal' }}>hóa đơn</span>}
              valueStyle={{ color: '#fa8c16', fontSize: 22 }}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              Tổng: {fmtVND(stats?.cho_xu_ly?.tong_gia_tri ?? 0)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderLeft: '4px solid #52c41a', cursor: 'pointer' }}
            onClick={() => { setFilterTrangThai('da_xu_ly'); setPage(1) }}
          >
            <Statistic
              title="Đã xử lý"
              value={stats?.da_xu_ly?.count ?? 0}
              suffix={<span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 'normal' }}>hóa đơn</span>}
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              Tổng: {fmtVND(stats?.da_xu_ly?.tong_gia_tri ?? 0)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderLeft: '4px solid #d9d9d9', cursor: 'pointer' }}
            onClick={() => { setFilterTrangThai('bo_qua'); setPage(1) }}
          >
            <Statistic
              title="Đã bỏ qua"
              value={stats?.bo_qua?.count ?? 0}
              suffix={<span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 'normal' }}>hóa đơn</span>}
              valueStyle={{ color: '#8c8c8c', fontSize: 22 }}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              Click để xem danh sách
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 12, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày hóa đơn', 'Đến ngày hóa đơn']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
                setPage(1)
              }}
            />
          </Col>
          <Col>
            <Input
              style={{ width: 150 }}
              placeholder="Số hóa đơn"
              prefix={<SearchOutlined />}
              allowClear
              onChange={e => { setFilterSoHoaDon(e.target.value || undefined); setPage(1) }}
            />
          </Col>
          <Col>
            <Input
              style={{ width: 200 }}
              placeholder="Tên nhà cung cấp"
              prefix={<SearchOutlined />}
              allowClear
              onChange={e => { setFilterSupplierName(e.target.value || undefined); setPage(1) }}
            />
          </Col>
          <Col>
            <Input
              style={{ width: 160 }}
              placeholder="MST nhà cung cấp"
              allowClear
              onChange={e => { setFilterMST(e.target.value || undefined); setPage(1) }}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }}
              placeholder="Pháp nhân mua hàng"
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={(v: number | undefined) => { setFilterPhapNhanId(v); setPage(1) }}
              options={phapNhanList.map(pn => ({ value: pn.id, label: pn.ten_phap_nhan }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 150 }}
              value={filterTrangThai}
              allowClear
              placeholder="Trạng thái"
              onChange={v => { setFilterTrangThai(v); setPage(1) }}
              options={[
                { value: 'cho_xu_ly', label: 'Chờ xử lý' },
                { value: 'da_xu_ly', label: 'Đã xử lý' },
                { value: 'bo_qua', label: 'Đã bỏ qua' }
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.items || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${total} hóa đơn`
        }}
        style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      />

      {/* Workspace Modal */}
      {processId && (
        <ProcessWorkspaceModal
          invoiceId={processId}
          visible={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setProcessId(null)
          }}
          warehouseList={warehouseList}
          supplierList={supplierList}
          phapNhanList={phapNhanList}
          onSuccess={() => {
            setIsModalOpen(false)
            setProcessId(null)
            queryClient.invalidateQueries({ queryKey: ['incoming-invoices'] })
            queryClient.invalidateQueries({ queryKey: ['incoming-invoices-stats'], exact: false })
          }}
        />
      )}
    </PageLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS WORKSPACE MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface WarehouseOption { id: number; ma_kho: string; ten_kho: string; loai_kho: string; trang_thai: boolean; phan_xuong_id?: number | null }
interface SupplierOption { id: number; ma_ncc: string; ten_don_vi?: string | null; ten_viet_tat?: string | null; ma_so_thue?: string | null }
interface PhapNhanOption { id: number; ten_phap_nhan: string; ma_so_thue?: string | null }

interface ProcessWorkspaceModalProps {
  invoiceId: number
  visible: boolean
  onClose: () => void
  warehouseList: WarehouseOption[]
  supplierList: SupplierOption[]
  phapNhanList: PhapNhanOption[]
  onSuccess: () => void
}

// Track item disposition: mapped to a material, or explicitly skipped
type ItemDisposition =
  | { type: 'mapped'; material_type: 'paper' | 'other'; id: number; label: string }
  | { type: 'skipped' }

function ProcessWorkspaceModal({
  invoiceId,
  visible,
  onClose,
  warehouseList,
  supplierList,
  phapNhanList,
  onSuccess
}: ProcessWorkspaceModalProps) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [dispositions, setDispositions] = useState<Record<number, ItemDisposition>>({})
  const [suggestionsMap, setSuggestionsMap] = useState<Record<number, any[]>>({})
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<number, boolean>>({})

  const [searchOptions, setSearchOptions] = useState<Record<number, any[]>>({})
  const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({})

  const [createGoodsReceipt, setCreateGoodsReceipt] = useState(true)

  // Fetch single invoice detail
  const { data: inv, isLoading } = useQuery({
    queryKey: ['incoming-invoice-detail', invoiceId],
    queryFn: () => incomingInvoiceApi.get(invoiceId),
    enabled: !!invoiceId,
  })

  // Initialize form and mappings when invoice details load
  useEffect(() => {
    if (inv) {
      form.setFieldsValue({
        phap_nhan_id: inv.phap_nhan_id || inv.internal_phap_nhan_id || undefined,
        supplier_id: inv.internal_supplier_id || undefined,
        warehouse_id: warehouseList.find(w => w.trang_thai)?.id || undefined,
      })

      const initialDispositions: Record<number, ItemDisposition> = {}
      inv.items?.forEach((item) => {
        if (item.mapped_material) {
          initialDispositions[item.stt] = {
            type: 'mapped',
            material_type: item.mapped_material.material_type,
            id: item.mapped_material.id,
            label: `[${item.mapped_material.ma_chinh}] ${item.mapped_material.ten}`
          }
        }
      })
      setDispositions(initialDispositions)

      inv.items?.forEach((item) => {
        if (!item.mapped_material) {
          fetchFuzzySuggestions(item.stt, item.ten_hang)
        }
      })
    }
  }, [inv])

  const fetchFuzzySuggestions = async (stt: number, tenHang: string) => {
    setSuggestionsLoading(prev => ({ ...prev, [stt]: true }))
    try {
      const sug = await incomingInvoiceApi.getSuggestions(tenHang, 3)
      setSuggestionsMap(prev => ({ ...prev, [stt]: sug }))
    } catch (err) {
      console.error(`Error loading suggestions for item stt ${stt}:`, err)
    } finally {
      setSuggestionsLoading(prev => ({ ...prev, [stt]: false }))
    }
  }

  const handleMaterialSearch = async (stt: number, value: string) => {
    if (!value || value.trim().length < 2) return
    setSearchLoading(prev => ({ ...prev, [stt]: true }))
    try {
      const results = await incomingInvoiceApi.getSuggestions(value, 15)
      setSearchOptions(prev => ({
        ...prev,
        [stt]: results.map(r => ({
          value: `${r.material_type}:${r.id}`,
          label: `[${r.ma_chinh}] ${r.ten} (${r.dvt})`,
          raw: r
        }))
      }))
    } catch (err) {
      console.error(err)
    } finally {
      setSearchLoading(prev => ({ ...prev, [stt]: false }))
    }
  }

  const handleSelectMaterial = (stt: number, selectedVal: string, option: any) => {
    const [material_type, idStr] = selectedVal.split(':')
    const id = parseInt(idStr)
    setDispositions(prev => ({
      ...prev,
      [stt]: { type: 'mapped', material_type: material_type as 'paper' | 'other', id, label: option.label }
    }))
  }

  const handleSelectSuggestion = (stt: number, sug: any) => {
    setDispositions(prev => ({
      ...prev,
      [stt]: {
        type: 'mapped',
        material_type: sug.material_type,
        id: sug.id,
        label: `[${sug.ma_chinh}] ${sug.ten}`
      }
    }))
  }

  const handleClearDisposition = (stt: number) => {
    setDispositions(prev => {
      const copy = { ...prev }
      delete copy[stt]
      return copy
    })
  }

  const handleSkipItem = (stt: number) => {
    setDispositions(prev => ({ ...prev, [stt]: { type: 'skipped' } }))
  }

  // Process and generate document mutation
  const processMutation = useMutation({
    mutationFn: (payload: any) => incomingInvoiceApi.process(invoiceId, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'], exact: false })
      notification.success({
        message: 'Xử lý thành công!',
        description: (
          <div>
            <Paragraph>Hóa đơn đầu vào đã được đưa vào hệ thống.</Paragraph>
            <Space direction="vertical" size={2}>
              {res.purchase_invoice_id && (
                <a href={`/accounting/purchase-invoices/${res.purchase_invoice_id}`} target="_blank" rel="noreferrer">
                  Xem Hóa đơn mua hàng nháp #{res.purchase_invoice_id} <ArrowRightOutlined />
                </a>
              )}
              {res.goods_receipt_id && (
                <a href={`/purchasing/goods-receipts/${res.goods_receipt_id}`} target="_blank" rel="noreferrer">
                  Xem Phiếu nhập kho nháp #{res.goods_receipt_id} <ArrowRightOutlined />
                </a>
              )}
            </Space>
          </div>
        ),
        duration: 8
      })
      onSuccess()
    },
    onError: (err: any) => {
      notification.error({
        message: 'Lỗi xử lý hóa đơn',
        description: err?.response?.data?.detail || 'Có lỗi xảy ra trong quá trình sinh chứng từ.'
      })
    }
  })

  // Ignore invoice mutation
  const ignoreMutation = useMutation({
    mutationFn: (id: number) => incomingInvoiceApi.ignore(id),
    onSuccess: (res) => {
      message.success(res.detail || 'Đã bỏ qua hóa đơn thành công.')
      onSuccess()
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi khi cập nhật hóa đơn.')
    }
  })

  // Unprocess mutation (hoàn tác xử lý)
  const unprocessMutation = useMutation({
    mutationFn: (id: number) => incomingInvoiceApi.unprocess(id),
    onSuccess: (res) => {
      message.success(res.detail || 'Đã hoàn tác xử lý — hóa đơn trở về Chờ xử lý.')
      onSuccess()
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Không thể hoàn tác — GR hoặc PI đã được duyệt.')
    }
  })

  const handleConfirmProcess = () => {
    form.validateFields()
      .then((values) => {
        const skippedItems = inv?.items?.filter(item => dispositions[item.stt]?.type === 'skipped') || []
        const unmappedItems = inv?.items?.filter(item => !dispositions[item.stt]) || []

        // Block if any item has no disposition at all (neither mapped nor skipped)
        if (unmappedItems.length > 0) {
          message.warning(
            `Còn ${unmappedItems.length} mặt hàng chưa xử lý. Hãy liên kết vật tư hoặc nhấn "Bỏ qua dòng" cho từng mặt hàng.`
          )
          return
        }

        // Warn (not block) if some items are skipped
        const doProcess = () => {
          const items_mapping: IncomingInvoiceItemMapping[] = Object.entries(dispositions)
            .filter(([, d]) => d.type === 'mapped')
            .map(([sttStr, d]) => {
              const mapped = d as Extract<ItemDisposition, { type: 'mapped' }>
              return { stt: parseInt(sttStr), material_type: mapped.material_type, material_id: mapped.id }
            })

          const payload = {
            phap_nhan_id: values.phap_nhan_id,
            supplier_id: values.supplier_id,
            warehouse_id: createGoodsReceipt ? values.warehouse_id : null,
            create_goods_receipt: createGoodsReceipt,
            items_mapping
          }
          processMutation.mutate(payload)
        }

        if (skippedItems.length > 0) {
          Modal.confirm({
            title: `${skippedItems.length} dòng sẽ bị bỏ qua`,
            content: `${skippedItems.map(i => `"${i.ten_hang}"`).join(', ')} sẽ không được đưa vào Phiếu nhập kho. Tiếp tục?`,
            okText: 'Xác nhận xử lý',
            cancelText: 'Quay lại kiểm tra',
            onOk: doProcess,
          })
        } else {
          doProcess()
        }
      })
      .catch(() => {
        message.error('Vui lòng điền đầy đủ thông tin pháp nhân và nhà cung cấp nội bộ.')
      })
  }

  const handleDownloadXML = () => {
    if (!inv?.xml_content) return
    const blob = new Blob([inv.xml_content], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `HoaDon_${inv.so_hoa_don || invoiceId}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isEditable = inv?.trang_thai === 'cho_xu_ly'

  // Compute progress summary
  const mappedCount = Object.values(dispositions).filter(d => d.type === 'mapped').length
  const skippedCount = Object.values(dispositions).filter(d => d.type === 'skipped').length
  const pendingCount = (inv?.items?.length ?? 0) - mappedCount - skippedCount

  if (isLoading) {
    return (
      <Modal open={visible} footer={null} onCancel={onClose} width={1200}>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="Đang tải dữ liệu XML hóa đơn..." />
        </div>
      </Modal>
    )
  }

  if (!inv) {
    return (
      <Modal open={visible} footer={null} onCancel={onClose} width={1200}>
        <Empty description="Không tìm thấy thông tin hóa đơn." />
      </Modal>
    )
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <Space>
            <FileTextOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
              Xử lý hóa đơn đầu vào {inv.so_hoa_don ? `Số ${inv.so_hoa_don}` : ''}
            </span>
            <Tag color={STATUS_LABELS[inv.trang_thai]?.color}>{STATUS_LABELS[inv.trang_thai]?.label}</Tag>
          </Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadXML}>
            Tải XML gốc
          </Button>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1400}
      style={{ top: 30 }}
      footer={[
        <Button key="back" onClick={onClose}>
          Đóng
        </Button>,
        isEditable && (
          <Button key="ignore" danger onClick={() => ignoreMutation.mutate(inv.id)} loading={ignoreMutation.isPending}>
            Bỏ qua hóa đơn
          </Button>
        ),
        !isEditable && inv.trang_thai === 'da_xu_ly' && (
          <Popconfirm
            key="unprocess"
            title="Hoàn tác xử lý?"
            description="Phiếu nhập kho và hóa đơn mua hàng nháp sẽ bị xóa. Chỉ thực hiện được khi chứng từ chưa được duyệt."
            onConfirm={() => unprocessMutation.mutate(inv.id)}
            okText="Hoàn tác"
            okButtonProps={{ danger: true }}
            cancelText="Hủy"
          >
            <Button key="unprocess-btn" loading={unprocessMutation.isPending} style={{ color: '#fa8c16', borderColor: '#fa8c16' }}>
              Hoàn tác xử lý
            </Button>
          </Popconfirm>
        ),
        isEditable && (
          <Button
            key="submit"
            type="primary"
            onClick={handleConfirmProcess}
            loading={processMutation.isPending}
            disabled={pendingCount > 0}
          >
            Xác nhận & Sinh chứng từ
            {pendingCount > 0 && ` (còn ${pendingCount} dòng)`}
          </Button>
        )
      ]}
    >
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* LEFT COLUMN: ORIGINAL INVOICE AND FORM */}
        <Col span={10}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* Invoice Info Card */}
            <Card
              title="Thông tin hóa đơn gốc (XML)"
              size="small"
              bordered
              style={{ borderRadius: '8px', background: '#fafafa' }}
            >
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Text type="secondary">Số hóa đơn:</Text> <Text strong>{inv.so_hoa_don || '-'}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Ký hiệu:</Text> <Text strong>{inv.ky_hieu || '-'}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Mẫu số:</Text> <Text strong>{inv.mau_so || '-'}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Ngày hóa đơn:</Text>{' '}
                  <Text strong>{inv.ngay_hoa_don ? dayjs(inv.ngay_hoa_don).format('DD/MM/YYYY') : '-'}</Text>
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Đơn vị bán:</Text> <Text strong>{inv.supplier_name}</Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">MST bán:</Text> <Tag color="blue">{inv.supplier_tax_code}</Tag>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Đơn vị mua:</Text> <Text>{inv.buyer_name}</Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">MST mua:</Text> <Tag>{inv.buyer_tax_code}</Tag>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Cộng tiền hàng</div>
                  <Text strong>{fmtVND(inv.tong_tien_hang)}</Text>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Tiền thuế VAT</div>
                  <Text strong>{fmtVND(inv.tien_thue)}</Text>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Tổng thanh toán</div>
                  <Text strong style={{ color: '#52c41a', fontSize: '15px' }}>{fmtVND(inv.tong_thanh_toan)}</Text>
                </Col>
              </Row>
            </Card>

            {/* ERP Generation settings form */}
            <Card title="Cấu hình sinh chứng từ ERP" size="small" bordered style={{ borderRadius: '8px' }}>
              <Form form={form} layout="vertical" disabled={!isEditable}>
                <Form.Item
                  label="Pháp nhân mua hàng nội bộ"
                  name="phap_nhan_id"
                  rules={[{ required: true, message: 'Vui lòng chọn Pháp nhân' }]}
                >
                  <Select
                    placeholder="Chọn pháp nhân..."
                    showSearch
                    optionFilterProp="label"
                    options={phapNhanList.map((pn: PhapNhanOption) => ({
                      value: pn.id,
                      label: pn.ten_phap_nhan,
                      mst: pn.ma_so_thue
                    }))}
                    optionRender={(option: any) => (
                      <div>
                        <div>{option.label}</div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c' }}>MST: {option.mst}</div>
                      </div>
                    )}
                  />
                </Form.Item>

                <Form.Item
                  label="Nhà cung cấp nội bộ"
                  name="supplier_id"
                  rules={[{ required: true, message: 'Vui lòng chọn Nhà cung cấp' }]}
                >
                  <Select
                    placeholder="Chọn nhà cung cấp nội bộ..."
                    showSearch
                    optionFilterProp="label"
                    onChange={(val: number) => {
                      const chosen = supplierList.find((s: SupplierOption) => s.id === val)
                      if (chosen && chosen.ma_so_thue && inv.supplier_tax_code &&
                          chosen.ma_so_thue !== inv.supplier_tax_code) {
                        message.warning(
                          `MST không khớp: NCC nội bộ (${chosen.ma_so_thue}) ≠ hóa đơn (${inv.supplier_tax_code}). Kiểm tra lại trước khi xác nhận.`,
                          6
                        )
                      }
                    }}
                    options={supplierList.map((s: SupplierOption) => ({
                      value: s.id,
                      label: s.ten_viet_tat ? `${s.ten_viet_tat} (${s.ma_ncc})` : s.ten_don_vi || s.ma_ncc,
                      mst: s.ma_so_thue
                    }))}
                    optionRender={(option: any) => (
                      <div>
                        <div>{option.label}</div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c' }}>MST: {option.mst}</div>
                      </div>
                    )}
                  />
                </Form.Item>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <Switch
                    checked={createGoodsReceipt}
                    onChange={setCreateGoodsReceipt}
                    disabled={!isEditable}
                  />
                  <span style={{ marginLeft: 8, fontWeight: 'bold' }}>Tự động tạo Phiếu nhập kho (Goods Receipt) nháp</span>
                </div>

                {createGoodsReceipt && (
                  <Form.Item
                    label="Kho nhập hàng"
                    name="warehouse_id"
                    rules={[{ required: true, message: 'Vui lòng chọn Kho nhập hàng' }]}
                  >
                    <Select
                      placeholder="Chọn kho nhập..."
                      showSearch
                      optionFilterProp="label"
                      options={warehouseList.map((w: WarehouseOption) => ({
                        value: w.id,
                        label: `[${w.ma_kho}] ${w.ten_kho} - ${w.loai_kho}`
                      }))}
                    />
                  </Form.Item>
                )}
              </Form>
            </Card>
          </Space>
        </Col>

        {/* RIGHT COLUMN: ITEMS MATCH WORKSPACE */}
        <Col span={14}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Không gian liên kết vật tư nội bộ</span>
                <Space size={4}>
                  {mappedCount > 0 && <Tag color="success">{mappedCount} đã liên kết</Tag>}
                  {skippedCount > 0 && <Tag color="warning">{skippedCount} bỏ qua</Tag>}
                  {pendingCount > 0 && <Tag color="error">{pendingCount} chờ xử lý</Tag>}
                </Space>
              </div>
            }
            size="small"
            bordered
            style={{ borderRadius: '8px', minHeight: '500px' }}
          >
            <List
              dataSource={inv.items || []}
              style={{ maxHeight: '60vh', overflowY: 'auto' }}
              renderItem={(item: IncomingInvoiceItem) => {
                const disp = dispositions[item.stt]
                const suggestions = suggestionsMap[item.stt] || []
                const isSugLoading = suggestionsLoading[item.stt]
                const isSkipped = disp?.type === 'skipped'
                const isMapped = disp?.type === 'mapped'

                return (
                  <div
                    key={item.stt}
                    style={{
                      padding: '12px 8px',
                      borderBottom: '1px solid #f0f0f0',
                      background: isSkipped ? '#fffbe6' : isMapped ? '#f6ffed' : '#fff',
                      transition: 'background 0.3s',
                      opacity: isSkipped ? 0.75 : 1,
                    }}
                  >
                    {/* Item original info */}
                    <Row gutter={8} justify="space-between" align="top">
                      <Col span={14}>
                        <Text strong style={{ fontSize: '13px' }}>
                          {item.stt}. {item.ten_hang}
                        </Text>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 2 }}>
                          ĐVT: <Text code>{item.dvt}</Text> | SL: <Text strong>{item.so_luong}</Text> | Đơn giá: <Text strong>{fmtVND(item.don_gia)}</Text> | Thành tiền: <Text strong>{fmtVND(item.thanh_tien)}</Text> | Thuế: <Text code>{item.thue_suat}</Text>
                        </div>
                      </Col>

                      <Col span={10} style={{ textAlign: 'right' }}>
                        {isSkipped ? (
                          <Tag color="warning" icon={<WarningOutlined />} style={{ padding: '4px 8px', fontSize: '12px' }}>
                            Bỏ qua dòng này
                          </Tag>
                        ) : isMapped ? (
                          <Tag
                            color={item.from_saved_rule ? 'cyan' : 'success'}
                            icon={item.from_saved_rule ? <StarFilled /> : <CheckOutlined />}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            {item.from_saved_rule ? 'Khớp từ luật cũ' : 'Đã liên kết'}
                          </Tag>
                        ) : (
                          <Tag color="orange" icon={<InfoCircleOutlined />} style={{ padding: '4px 8px', fontSize: '12px' }}>
                            Chờ liên kết
                          </Tag>
                        )}
                      </Col>
                    </Row>

                    {/* Mapping action panel */}
                    <div style={{ marginTop: 10, paddingLeft: 14 }}>
                      {isSkipped ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbe6', padding: '6px 12px', borderRadius: '4px', border: '1px dashed #ffe58f' }}>
                          <span style={{ fontSize: '12px', color: '#ad8b00', fontStyle: 'italic' }}>
                            Dòng này sẽ không được đưa vào Phiếu nhập kho
                          </span>
                          {isEditable && (
                            <Button size="small" type="link" onClick={() => handleClearDisposition(item.stt)}>
                              Hoàn tác
                            </Button>
                          )}
                        </div>
                      ) : isMapped ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 12px', borderRadius: '4px', border: '1px dashed #b7eb8f' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#389e0d' }}>
                            {(disp as Extract<ItemDisposition, { type: 'mapped' }>).label}
                          </span>
                          {isEditable && (
                            <Space size={4}>
                              <Button size="small" type="link" danger onClick={() => handleClearDisposition(item.stt)}>
                                Thay đổi
                              </Button>
                              <Button size="small" type="link" style={{ color: '#fa8c16' }} onClick={() => handleSkipItem(item.stt)}>
                                Bỏ qua dòng
                              </Button>
                            </Space>
                          )}
                        </div>
                      ) : (
                        isEditable && (
                          <div style={{ width: '100%' }}>
                            {/* Search box for selecting materials */}
                            <Select
                              showSearch
                              style={{ width: '100%', marginBottom: 6 }}
                              placeholder="Tìm kiếm mã hoặc tên vật tư nội bộ..."
                              filterOption={false}
                              onSearch={(val) => handleMaterialSearch(item.stt, val)}
                              onChange={(val, opt) => handleSelectMaterial(item.stt, val, opt)}
                              loading={searchLoading[item.stt]}
                              options={searchOptions[item.stt] || []}
                              notFoundContent={searchLoading[item.stt] ? <Spin size="small" /> : 'Nhập từ khóa tìm kiếm (mã hoặc tên vật tư)...'}
                            />

                            {/* Fuzzy suggestion tags */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#bfbfbf' }}>Gợi ý:</span>
                              {isSugLoading ? (
                                <Spin size="small" />
                              ) : suggestions.length > 0 ? (
                                suggestions.map((sug) => (
                                  <Tooltip key={`${sug.material_type}:${sug.id}`} title={`Độ tương đồng: ${Math.round(sug.score * 100)}%`}>
                                    <Tag
                                      color="blue"
                                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                      onClick={() => handleSelectSuggestion(item.stt, sug)}
                                    >
                                      <span>[{sug.ma_chinh}] {sug.ten.length > 25 ? `${sug.ten.substring(0, 25)}...` : sug.ten}</span>
                                      <Badge status="processing" text={`${Math.round(sug.score * 100)}%`} style={{ fontSize: '9px' }} />
                                    </Tag>
                                  </Tooltip>
                                ))
                              ) : (
                                <span style={{ fontSize: '11px', color: '#bfbfbf', fontStyle: 'italic' }}>Không có gợi ý khớp. Tìm kiếm thủ công hoặc bỏ qua dòng.</span>
                              )}
                              <Button
                                size="small"
                                type="text"
                                style={{ color: '#fa8c16', fontSize: '11px', padding: '0 4px' }}
                                onClick={() => handleSkipItem(item.stt)}
                              >
                                Bỏ qua dòng này
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              }}
            />
          </Card>
        </Col>
      </Row>
    </Modal>
  )
}
