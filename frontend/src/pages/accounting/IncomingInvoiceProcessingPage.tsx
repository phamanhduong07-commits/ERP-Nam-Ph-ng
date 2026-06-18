import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Space, Card, Input, Row, Col, DatePicker, Select,
  Modal, Form, Switch, Typography, message, notification, Tooltip, Empty, Upload, Badge, Divider, List, Spin
} from 'antd'
import {
  SyncOutlined, UploadOutlined, FileTextOutlined,
  SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined,
  CheckOutlined, ArrowRightOutlined, DownloadOutlined
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

const { Text, Title, Paragraph } = Typography
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
  const [page, setPage] = useState(1)

  // Drawer/Modal state
  const [processId, setProcessId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Fetch incoming invoices
  const { data, isLoading } = useQuery({
    queryKey: ['incoming-invoices', tuNgay, denNgay, filterTrangThai, filterMST, page],
    queryFn: () =>
      incomingInvoiceApi.list({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        trang_thai: filterTrangThai,
        supplier_tax_code: filterMST || undefined,
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
          // Auto open the uploaded invoice for processing
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
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi khi cập nhật hóa đơn.')
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
      width: 120,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-'
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
      width: 150,
      align: 'right',
      render: (_, r) => (
        <Space>
          {r.trang_thai === 'cho_xu_ly' ? (
            <>
              <Button type="primary" size="small" onClick={() => handleOpenProcess(r.id)}>
                Xử lý
              </Button>
              <Button size="small" danger onClick={() => ignoreMutation.mutate(r.id)}>
                Bỏ qua
              </Button>
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
              style={{ width: 180 }}
              placeholder="MST nhà cung cấp"
              prefix={<SearchOutlined />}
              allowClear
              onChange={e => { setFilterMST(e.target.value || undefined); setPage(1) }}
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
          showSizeChanger: false
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
          }}
        />
      )}
    </PageLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS WORKSPACE MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface ProcessWorkspaceModalProps {
  invoiceId: number
  visible: boolean
  onClose: () => void
  warehouseList: any[]
  supplierList: any[]
  phapNhanList: any[]
  onSuccess: () => void
}

function ProcessWorkspaceModal({
  invoiceId,
  visible,
  onClose,
  warehouseList,
  supplierList,
  phapNhanList,
  onSuccess
}: ProcessWorkspaceModalProps) {
  const [form] = Form.useForm()
  const [mappings, setMappings] = useState<Record<number, { material_type: 'paper' | 'other'; id: number; label: string }>>({})
  const [suggestionsMap, setSuggestionsMap] = useState<Record<number, any[]>>({})
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<number, boolean>>({})
  
  // Custom dropdown options loaded via async search
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
      // 1. Initial form values
      form.setFieldsValue({
        phap_nhan_id: inv.internal_phap_nhan_id || undefined,
        supplier_id: inv.internal_supplier_id || undefined,
        warehouse_id: warehouseList.find(w => w.trang_thai)?.id || undefined,
      })

      // 2. Load existing mappings
      const initialMappings: typeof mappings = {}
      inv.items?.forEach((item) => {
        if (item.mapped_material) {
          initialMappings[item.stt] = {
            material_type: item.mapped_material.material_type,
            id: item.mapped_material.id,
            label: `[${item.mapped_material.ma_chinh}] ${item.mapped_material.ten}`
          }
        }
      })
      setMappings(initialMappings)

      // 3. Fetch fuzzy suggestions for items that don't have mapping yet
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

  // Handle searching materials in Select dropdown
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
    setMappings(prev => ({
      ...prev,
      [stt]: {
        material_type: material_type as 'paper' | 'other',
        id,
        label: option.label
      }
    }))
  }

  const handleSelectSuggestion = (stt: number, sug: any) => {
    setMappings(prev => ({
      ...prev,
      [stt]: {
        material_type: sug.material_type,
        id: sug.id,
        label: `[${sug.ma_chinh}] ${sug.ten}`
      }
    }))
  }

  const handleClearMapping = (stt: number) => {
    setMappings(prev => {
      const copy = { ...prev }
      delete copy[stt]
      return copy
    })
  }

  // Process and generate document mutation
  const processMutation = useMutation({
    mutationFn: (payload: any) => incomingInvoiceApi.process(invoiceId, payload),
    onSuccess: (res) => {
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

  const handleConfirmProcess = () => {
    form.validateFields()
      .then((values) => {
        // Verify all items have mappings
        const unmappedItems = inv?.items?.filter(item => !mappings[item.stt]) || []
        if (unmappedItems.length > 0) {
          message.error(`Còn ${unmappedItems.length} mặt hàng chưa liên kết với mã vật tư nội bộ. Hãy liên kết tất cả trước khi xác nhận.`)
          return
        }

        const items_mapping: IncomingInvoiceItemMapping[] = Object.entries(mappings).map(([sttStr, mapData]) => ({
          stt: parseInt(sttStr),
          material_type: mapData.material_type,
          material_id: mapData.id
        }))

        const payload = {
          phap_nhan_id: values.phap_nhan_id,
          supplier_id: values.supplier_id,
          warehouse_id: createGoodsReceipt ? values.warehouse_id : null,
          create_goods_receipt: createGoodsReceipt,
          items_mapping
        }

        processMutation.mutate(payload)
      })
      .catch((err) => {
        console.error(err)
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
        isEditable && (
          <Button key="submit" type="primary" onClick={handleConfirmProcess} loading={processMutation.isPending}>
            Xác nhận & Sinh chứng từ
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
                  <Text strong color="orange">{fmtVND(inv.tien_thue)}</Text>
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
                    options={phapNhanList.map(pn => ({
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
                    options={supplierList.map(s => ({
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
                      options={warehouseList.map(w => ({
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
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#8c8c8c' }}>
                  Khớp MST và Tên NCC để lưu luật tự động cho lần sau
                </span>
              </div>
            }
            size="small"
            bordered
            style={{ borderRadius: '8px', minHeight: '500px' }}
          >
            <List
              dataSource={inv.items || []}
              renderItem={(item: IncomingInvoiceItem) => {
                const mapped = mappings[item.stt]
                const suggestions = suggestionsMap[item.stt] || []
                const isSugLoading = suggestionsLoading[item.stt]
                
                return (
                  <div
                    key={item.stt}
                    style={{
                      padding: '12px 8px',
                      borderBottom: '1px solid #f0f0f0',
                      background: mapped ? '#f6ffed' : '#fff',
                      transition: 'background 0.3s'
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
                        {mapped ? (
                          <Tag color="success" icon={<CheckOutlined />} style={{ padding: '4px 8px', fontSize: '12px' }}>
                            Đã liên kết
                          </Tag>
                        ) : (
                          <Tag color="warning" icon={<InfoCircleOutlined />} style={{ padding: '4px 8px', fontSize: '12px' }}>
                            Chờ liên kết
                          </Tag>
                        )}
                      </Col>
                    </Row>

                    {/* Mapping action panel */}
                    <div style={{ marginTop: 10, paddingLeft: 14 }}>
                      {mapped ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 12px', borderRadius: '4px', border: '1px dashed #b7eb8f' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#389e0d' }}>
                            {mapped.label}
                          </span>
                          {isEditable && (
                            <Button size="small" type="link" danger onClick={() => handleClearMapping(item.stt)}>
                              Thay đổi
                            </Button>
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
                                <span style={{ fontSize: '11px', color: '#bfbfbf', fontStyle: 'italic' }}>Không có gợi ý trùng khớp cao. Hãy tìm kiếm thủ công.</span>
                              )}
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
