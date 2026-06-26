import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Space, Card, Typography, message, Alert, Tabs, Select, Switch, Row, Col, Tag, Radio, Divider, InputNumber, Collapse,
} from 'antd'
import { 
  EditOutlined, EyeOutlined, CodeOutlined, LayoutOutlined, SettingOutlined, 
  DeleteOutlined, PlusOutlined, FormOutlined, AlignLeftOutlined, 
  AlignCenterOutlined, AlignRightOutlined, ThunderboltOutlined,
  FontSizeOutlined, ColumnHeightOutlined, PictureOutlined, CopyOutlined
} from '@ant-design/icons'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { systemApi, PrintTemplate, ExcelTemplate, ExcelColumnConfig, ExcelHeaderField, ExcelFooterConfig, ExcelStyleConfig } from '../../api/system'
import { phapNhanApi, PhapNhan } from '../../api/phap-nhan'
import { DragOutlined } from '@ant-design/icons'
import EmptyState from "../../components/EmptyState"
import { useAuthStore } from '../../store/auth'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

// Định nghĩa các loại chứng từ chuẩn trong hệ thống
type DocColumn = { key: string; label: string }
type DocSignature = { title: string; sub: string; align: string }
type DocTypeSchema = { label: string; defaultColumns: DocColumn[]; signatures: DocSignature[]; showTable: boolean; showTotal?: boolean; customerLabel?: string; deliveryLabel?: string; easyOverrides?: Record<string, boolean | string> }

const DOC_TYPE_SCHEMAS: Record<string, DocTypeSchema> = {
  'SALES_ORDER': {
    label: 'Đơn bán hàng (SO)',
    showTable: true,
    showTotal: true,
    customerLabel: 'Khách hàng',
    deliveryLabel: 'Địa chỉ giao hàng',
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ten_hang', label: 'Tên hàng hóa' },
      { key: 'dvt', label: 'ĐVT' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'don_gia', label: 'Đơn giá' },
      { key: 'thanh_tien', label: 'Thành tiền' },
    ],
    signatures: [
      { title: 'Giám đốc', sub: '(Ký, đóng dấu)', align: 'right' },
      { title: 'Kế toán', sub: '(Ký tên)', align: 'center' },
      { title: 'Người lập', sub: '(Ký tên)', align: 'left' },
      { title: 'Khách hàng', sub: '(Ký, họ tên)', align: 'left' },
    ]
  },
  'SALES_INVOICE': {
    label: 'Hóa đơn bán hàng',
    showTable: true,
    showTotal: true,
    customerLabel: 'Người mua hàng',
    deliveryLabel: 'Địa chỉ',
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ten_hang', label: 'Tên hàng hóa, dịch vụ' },
      { key: 'dvt', label: 'ĐVT' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'don_gia', label: 'Đơn giá' },
      { key: 'thanh_tien', label: 'Thành tiền' },
    ],
    signatures: [
      { title: 'Người mua hàng', sub: '(Ký, họ tên)', align: 'left' },
      { title: 'Người bán hàng', sub: '(Ký, họ tên)', align: 'right' },
    ]
  },
  'PURCHASE_ORDER': {
    label: 'Đơn mua hàng (PO)',
    showTable: true,
    showTotal: true,
    customerLabel: 'Nhà cung cấp',
    deliveryLabel: 'Ngày giao dự kiến',
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ten_hang', label: 'Tên hàng hóa' },
      { key: 'dvt', label: 'ĐVT' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'don_gia', label: 'Đơn giá' },
      { key: 'thanh_tien', label: 'Thành tiền' },
    ],
    signatures: [
      { title: 'Giám đốc', sub: '(Ký duyệt)', align: 'right' },
      { title: 'Người lập', sub: '(Ký tên)', align: 'left' },
    ]
  },
  'WAREHOUSE_OUT': {
    label: 'Phiếu xuất kho',
    showTable: true,
    customerLabel: 'Khách hàng',
    deliveryLabel: 'Lý do xuất',
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ma_amis', label: 'Mã hàng' },
      { key: 'ten_hang', label: 'Tên hàng hóa' },
      { key: 'so_lop', label: 'Số lớp' },
      { key: 'to_hop_song', label: 'Sóng' },
      { key: 'so_luong', label: 'SL yêu cầu' },
      { key: 'so_luong_thuc', label: 'SL thực xuất' },
    ],
    signatures: [
      { title: 'Thủ kho', sub: '(Ký, họ tên)', align: 'left' },
      { title: 'Người nhận', sub: '(Ký, họ tên)', align: 'center' },
      { title: 'Tài xế', sub: '(Ký, họ tên)', align: 'right' },
    ]
  },
  'BTP_TRANSFER': {
    label: 'Phiếu chuyển BTP',
    showTable: true,
    defaultColumns: [
      { key: 'so_lsx', label: 'LSX' },
      { key: 'ten_hang', label: 'Tên sản phẩm' },
      { key: 'quy_cach', label: 'Quy cách' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'don_gia', label: 'Đơn giá nội bộ' },
      { key: 'ghi_chu', label: 'Ghi chú' },
    ],
    customerLabel: 'Xưởng xuất',
    deliveryLabel: 'Xưởng nhận',
    easyOverrides: { showDriver: false, showAssistant1: false, showAssistant2: false, showM2: false, showCustomer: true, showDelivery: true, showWarehouse: false },
    signatures: [
      { title: 'Thủ kho xuất', sub: '(Ký, họ tên)', align: 'left' },
      { title: 'Thủ kho nhập', sub: '(Ký, họ tên)', align: 'center' },
      { title: 'Người lập', sub: '(Ký tên)', align: 'right' },
    ]
  },
  'WAREHOUSE_TRANSFER': {
    label: 'Phiếu chuyển kho',
    showTable: true,
    defaultColumns: [],
    customerLabel: 'Kho xuất',
    deliveryLabel: 'Kho nhận',
    easyOverrides: { showDriver: false, showAssistant1: false, showAssistant2: false, showM2: false, showCustomer: true, showDelivery: true, showWarehouse: false },
    signatures: [
      { title: 'Thủ kho xuất', sub: '(Ký, họ tên)', align: 'left' },
      { title: 'Thủ kho nhập', sub: '(Ký, họ tên)', align: 'center' },
      { title: 'Người lập', sub: '(Ký tên)', align: 'right' },
    ]
  },
  'WAREHOUSE_IN': {
    label: 'Phiếu nhập kho',
    showTable: true,
    customerLabel: 'Người giao hàng',
    deliveryLabel: 'Kho nhập',
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ten_hang', label: 'Tên hàng hóa' },
      { key: 'dvt', label: 'ĐVT' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'ghi_chu', label: 'Ghi chú' },
    ],
    signatures: [
      { title: 'Thủ kho', sub: '(Ký, họ tên)', align: 'right' },
      { title: 'Người giao', sub: '(Ký, họ tên)', align: 'left' },
    ]
  },
  'CASH_RECEIPT': {
    label: 'Phiếu thu',
    showTable: false,
    customerLabel: 'Người nộp tiền',
    defaultColumns: [],
    signatures: [
      { title: 'Giám đốc', sub: '(Ký, đóng dấu)', align: 'right' },
      { title: 'Kế toán', sub: '(Ký tên)', align: 'center' },
      { title: 'Thủ quỹ', sub: '(Ký tên)', align: 'right' },
      { title: 'Người nộp', sub: '(Ký tên)', align: 'left' },
    ]
  },
  'CASH_PAYMENT': {
    label: 'Phiếu chi',
    showTable: false,
    customerLabel: 'Người nhận tiền',
    defaultColumns: [],
    signatures: [
      { title: 'Giám đốc', sub: '(Ký, đóng dấu)', align: 'right' },
      { title: 'Kế toán', sub: '(Ký tên)', align: 'center' },
      { title: 'Thủ quỹ', sub: '(Ký tên)', align: 'right' },
      { title: 'Người nhận', sub: '(Ký tên)', align: 'left' },
    ]
  },
  'SALES_QUOTE': {
    label: 'Báo giá',
    showTable: true,
    showTotal: true,
    customerLabel: 'Kính gửi',
    deliveryLabel: 'Hiệu lực đến',
    easyOverrides: {
      showWarehouse: false,
      showDriver: false,
      showAssistant1: false,
      showAssistant2: false,
      showM2: false,
      showPlateCost: true,
      showMouldCost: true,
      showTransportCost: true,
    },
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ma_amis', label: 'Mã hàng' },
      { key: 'ten_hang', label: 'Tên sản phẩm' },
      { key: 'kich_thuoc', label: 'Quy cách' },
      { key: 'so_lop', label: 'Lớp' },
      { key: 'to_hop_song', label: 'Sóng' },
      { key: 'ma_ky_hieu', label: 'Mã ký hiệu' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'dvt', label: 'ĐVT' },
      { key: 'gia_ban', label: 'Đơn giá' },
      { key: 'thanh_tien', label: 'Thành tiền' },
      { key: 'ghi_chu', label: 'Ghi chú' },
    ],
    signatures: [
      { title: 'Đại diện công ty', sub: '(Ký, họ tên)', align: 'right' },
    ]
  },
  'delivery_order': {
    label: 'Phiếu giao hàng',
    showTable: true,
    customerLabel: 'Khách hàng',
    deliveryLabel: 'Địa chỉ giao',
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'ten_hang', label: 'Tên hàng' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'total_m2', label: 'M2' },
      { key: 'ghi_chu', label: 'Ghi chú' },
    ],
    signatures: [
      { title: 'Thủ kho', sub: '(Ký)', align: 'left' },
      { title: 'Giao hàng', sub: '(Ký)', align: 'center' },
      { title: 'Khách nhận', sub: '(Ký)', align: 'right' },
    ]
  },
  'YEU_CAU_GIAO_HANG': {
    label: 'Phiếu yêu cầu giao hàng (YCGH)',
    showTable: true,
    customerLabel: 'Khách hàng',
    deliveryLabel: 'Địa chỉ giao hàng',
    easyOverrides: {
      showDriver: false,
      showAssistant1: false,
      showAssistant2: false,
      showM2: true,
      showWarehouse: false,
      showCustomer: true,
      showDelivery: true,
    },
    defaultColumns: [
      { key: 'stt', label: 'STT' },
      { key: 'so_lenh', label: 'Số lệnh SX' },
      { key: 'ten_hang', label: 'Tên hàng' },
      { key: 'so_luong', label: 'Số lượng' },
      { key: 'dvt', label: 'ĐVT' },
      { key: 'total_m2', label: 'M²' },
      { key: 'trong_luong', label: 'Kg' },
      { key: 'ten_kho', label: 'Kho' },
      { key: 'ghi_chu', label: 'Ghi chú' },
    ],
    signatures: [
      { title: 'Người yêu cầu', sub: '(Ký, họ tên)', align: 'left' },
      { title: 'Người nhận hàng', sub: '(Ký, họ tên)', align: 'center' },
      { title: 'Thủ kho', sub: '(Ký, họ tên)', align: 'center' },
      { title: 'Người lập phiếu', sub: '(Ký, họ tên)', align: 'right' },
    ]
  }
}

DOC_TYPE_SCHEMAS.GOODS_RECEIPT = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Phiếu nhập kho',
}
DOC_TYPE_SCHEMAS.MATERIAL_ISSUE = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_OUT,
  label: 'Phiếu xuất NVL',
}
DOC_TYPE_SCHEMAS.PRODUCTION_ORDER = {
  ...DOC_TYPE_SCHEMAS.SALES_ORDER,
  label: 'Lệnh sản xuất',
}
DOC_TYPE_SCHEMAS.PRODUCTION_ORDER_DETAIL = {
  ...DOC_TYPE_SCHEMAS.PRODUCTION_ORDER,
  label: 'Chi tiết lệnh sản xuất',
}
DOC_TYPE_SCHEMAS.PRODUCTION_PHOI_RECEIPT = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Phiếu nhập phôi sóng',
}
DOC_TYPE_SCHEMAS.INVENTORY = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Báo cáo tồn kho',
}
DOC_TYPE_SCHEMAS.STOCK_CARD = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Thẻ kho',
}
DOC_TYPE_SCHEMAS.STOCK_ADJUSTMENT = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Biên bản kiểm kê',
}
DOC_TYPE_SCHEMAS.SALES_ORDER_DETAIL = {
  ...DOC_TYPE_SCHEMAS.SALES_ORDER,
  label: 'Chi tiết đơn bán hàng',
}
DOC_TYPE_SCHEMAS.SALES_QUOTE_LIST = {
  ...DOC_TYPE_SCHEMAS.SALES_ORDER,
  label: 'Danh sách báo giá',
}
DOC_TYPE_SCHEMAS.PURCHASE_ORDER = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Đơn mua hàng',
}
DOC_TYPE_SCHEMAS.PURCHASE_ORDER_LIST = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Danh sách đơn mua hàng',
}
DOC_TYPE_SCHEMAS.GOODS_RECEIPT_PURCHASE = {
  ...DOC_TYPE_SCHEMAS.WAREHOUSE_IN,
  label: 'Phiếu nhập kho mua hàng',
}

// Biến template hỗ trợ per loại chứng từ — hiện trong panel hint khi thiết kế
type TemplateVar = { var: string; desc: string }
const UNIVERSAL_VARS: TemplateVar[] = [
  { var: '{{company_name}}', desc: 'Tên công ty (pháp nhân)' },
  { var: '{{subtitle}}', desc: 'Tiêu đề phụ (VD: BÁO GIÁ)' },
  { var: '{{SUBTITLE}}', desc: 'Tiêu đề phụ (uppercase alias)' },
  { var: '{{document_number}}', desc: 'Số chứng từ (tự động)' },
  { var: '{{document_date}}', desc: 'Ngày lập (DD tháng MM năm YYYY)' },
  { var: '{{customer_name}}', desc: 'Tên khách hàng / NCC / đơn vị' },
  { var: '{{delivery_address}}', desc: 'Địa chỉ / thông tin bổ sung' },
  { var: '{{items_html}}', desc: 'Bảng hàng hóa (HTML)' },
  { var: '{{total_amount}}', desc: 'Tổng tiền (số)' },
  { var: '{{total_text}}', desc: 'Tổng tiền bằng chữ' },
  { var: '{{footer_html}}', desc: 'Footer tùy chỉnh' },
]
const FRONTEND_VAR_REGISTRY: Record<string, TemplateVar[]> = {
  SALES_QUOTE: [...UNIVERSAL_VARS,
    { var: '{{sales_rep}}', desc: 'Nhân viên kinh doanh' },
    { var: '{{dieu_khoan}}', desc: 'Điều khoản báo giá' },
    { var: '{{vat_amount}}', desc: 'Tiền VAT' },
    { var: '{{grand_total}}', desc: 'Tổng cộng (đã VAT)' },
  ],
  SALES_INVOICE: [...UNIVERSAL_VARS,
    { var: '{{vat_amount}}', desc: 'Tiền VAT' },
    { var: '{{grand_total}}', desc: 'Tổng cộng (đã VAT)' },
    { var: '{{company_address}}', desc: 'Địa chỉ công ty' },
    { var: '{{company_tax_code}}', desc: 'MST công ty' },
  ],
  PURCHASE_ORDER: [...UNIVERSAL_VARS,
    { var: '{{company_address}}', desc: 'Địa chỉ công ty' },
    { var: '{{company_phone}}', desc: 'SĐT công ty' },
    { var: '{{company_tax_code}}', desc: 'MST công ty' },
  ],
  GOODS_RECEIPT: [...UNIVERSAL_VARS],
  GOODS_RECEIPT_PURCHASE: [...UNIVERSAL_VARS],
  MATERIAL_ISSUE: [...UNIVERSAL_VARS],
  CASH_RECEIPT: [...UNIVERSAL_VARS,
    { var: '{{purpose}}', desc: 'Lý do thu tiền' },
  ],
  CASH_PAYMENT: [...UNIVERSAL_VARS,
    { var: '{{purpose}}', desc: 'Lý do chi tiền' },
  ],
  PURCHASE_REQUISITION: [...UNIVERSAL_VARS,
    { var: '{{department}}', desc: 'Phòng ban yêu cầu' },
    { var: '{{requester}}', desc: 'Người đề nghị' },
    { var: '{{purpose}}', desc: 'Lý do / mục đích' },
    { var: '{{phan_xuong}}', desc: 'Tên phân xưởng' },
  ],
}

const DEFAULT_CONFIG = {
  logoPos: 'left',
  headerColor: '#1677ff',
  pageSize: 'A4',
  orientation: 'portrait',
  showCompany: true,
  showContact: true,
  showMotto: false,
  mottoText: '<strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>ĐỘC LẬP - TỰ DO - HẠNH PHÚC',
  titleSize: 24,
  companyFontSize: 18,
  logoSize: 80,
  legalReference: '',
  fontFamily: 'Segoe UI',
  showDocNumber: true,
  showDocDate: true,
  vnDateFormat: false,
  showCustomer: true,
  customerLabel: 'Khách hàng',
  showDelivery: true,
  deliveryLabel: 'Địa chỉ giao',
  showWarehouse: true,
  showDriver: true,
  showAssistant1: true,
  showAssistant2: false,
  showM2: true,
  showTable: true,
  showTotal: false,
  showPlateCost: false,
  showMouldCost: false,
  showTransportCost: false,
  phoneOverride: '',
  emailOverride: '',
  introText: '',
  outroText: '',
  customContent: '',
  signatures: [
    { title: 'Giám đốc', sub: '(Ký, đóng dấu)', align: 'right' },
    { title: 'Người lập phiếu', sub: '(Ký, họ tên)', align: 'center' },
    { title: 'Người nhận hàng', sub: '(Ký, họ tên)', align: 'left' },
  ],
  selectedColumns: [],
}

export default function PrintTemplatePage() {
  const qc = useQueryClient()
  const authUser = useAuthStore(state => state.user)
  const isTruongPhong = authUser?.role === 'TRUONG_PHONG_SALE_ADMIN'
  const SALES_CODES = new Set(['sales_order', 'sales_invoice', 'sales_quote', 'sales_order_detail', 'sales_quote_list', 'delivery_order'])
  const canEditTemplate = (ma_mau: string) => !isTruongPhong || SALES_CODES.has(ma_mau.toLowerCase())
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['print-templates'],
    queryFn: systemApi.getTemplates,
  })

  const { data: phapNhans = [] } = useQuery({
    queryKey: ['phap-nhans'],
    queryFn: () => phapNhanApi.list().then(res => res.data),
  })

  const [selectedPhapNhanId, setSelectedPhapNhanId] = useState<number | null>(null)
  const activePhapNhan = phapNhans.find(p => p.id === selectedPhapNhanId) || phapNhans[0]

  const [editModal, setEditModal] = useState<PrintTemplate | null>(null)
  const [isNewMode, setIsNewMode] = useState(false)
  type EasyConfig = typeof DEFAULT_CONFIG & { selectedColumns: DocColumn[]; signatures: DocSignature[] }
  const [easyConfig, setEasyConfig] = useState<EasyConfig>(DEFAULT_CONFIG as EasyConfig)
  const [form] = Form.useForm()
  const watchedMaMau = Form.useWatch('ma_mau', form)
  const [previewHtml, setPreviewHtml] = useState('')
  const [activeTab, setActiveTab] = useState('easy')

  const VARIABLE_LABELS: Record<string, { label: string; desc: string }> = {
    company_name: { label: 'Tên công ty', desc: 'Tên pháp nhân của công ty' },
    company_details: { label: 'Địa chỉ & MST', desc: 'Địa chỉ, mã số thuế, số điện thoại' },
    logo_img: { label: 'Logo công ty', desc: 'Hình ảnh logo được thiết lập' },
    subtitle: { label: 'Tiêu đề phiếu', desc: 'Ví dụ: BÁO GIÁ, PHIẾU THU' },
    document_number: { label: 'Số chứng từ', desc: 'Mã số tự động của phiếu' },
    document_date: { label: 'Ngày chứng từ', desc: 'Ngày lập phiếu' },
    status: { label: 'Trạng thái', desc: 'Trạng thái duyệt của phiếu' },
    body_html: { label: 'Bảng hàng hóa', desc: 'Toàn bộ nội dung bảng dữ liệu' },
    footer_html: { label: 'Ghi chú chân trang', desc: 'Các điều khoản, lời chào cuối' },
    customer_name: { label: 'Tên khách hàng', desc: 'Tên viết tắt hoặc tên đơn vị' },
    tong_tien_hang: { label: 'Tiền hàng', desc: 'Tổng tiền hàng chưa bao gồm CP khác' },
    chi_phi_bang_in: { label: 'CP Bảng in', desc: '' },
    chi_phi_khuon: { label: 'CP Khuôn', desc: '' },
    chi_phi_van_chuyen: { label: 'CP Vận chuyển', desc: '' },
    tien_vat: { label: 'Tiền thuế VAT', desc: '' },
    tong_cong: { label: 'Tổng cộng', desc: 'Số tiền cuối cùng (có VAT + CP khác)' },
    dieu_khoan: { label: 'Điều khoản', desc: 'Nội dung điều khoản báo giá' },
  }

  const buildHtmlFromConfig = () => {
    const logoHtml = `<div class="logo" style="width: ${easyConfig.logoSize}px; height: ${easyConfig.logoSize}px; display: flex; align-items: center; justify-content: center;">{{logo_img}}</div>`
    const companyNameHtml = easyConfig.showCompany ? `<div style="font-size: ${easyConfig.companyFontSize}px; font-weight: bold; color: ${easyConfig.headerColor}; line-height: 1.2;">{{company_name}}</div>` : ''
    const companyDetailsHtml = easyConfig.showContact ? `<div style="font-size: 11px;">Địa chỉ: ${activePhapNhan?.dia_chi || '...'}<br/>MST: ${activePhapNhan?.ma_so_thue || '...'} ${easyConfig.phoneOverride || activePhapNhan?.so_dien_thoai ? ` - SĐT: ${easyConfig.phoneOverride || activePhapNhan?.so_dien_thoai}` : ''} ${easyConfig.emailOverride || activePhapNhan?.email ? ` - Email: ${easyConfig.emailOverride || activePhapNhan?.email}` : ''}</div>` : ''

    const mottoHtml = easyConfig.showMotto ? `
      <div style="flex: 1; text-align: center; font-size: 11px; line-height: 1.2; text-transform: uppercase;">
        ${easyConfig.mottoText}
        <div style="width: 100px; height: 1px; background: #333; margin: 5px auto;"></div>
      </div>
    ` : ''

    const legalHtml = easyConfig.legalReference ? `
    <div style="position: absolute; top: 0; right: 0; text-align: right; font-size: 10px; line-height: 1.2;">
      ${easyConfig.legalReference}
    </div>` : ''

    const dateStr = easyConfig.vnDateFormat ? `Tp. HCM, ngày {{document_day}} tháng {{document_month}} năm {{document_year}}` : `Ngày {{document_date}}`

    const signatureHtml = `
      <div style="margin-top: 30px; display: flex; flex-wrap: nowrap; gap: 10px; text-align: center; font-size: 13px;">
        ${(easyConfig.signatures || []).map((s: DocSignature, idx: number) => `
          <div style="flex: 1; min-width: 0; text-align: ${s.align || 'center'};">
            ${idx === (easyConfig.signatures || []).length - 1 && easyConfig.vnDateFormat ? `<div style="font-style: italic; margin-bottom: 5px;">${dateStr}</div>` : ''}
            <div style="margin-bottom: 20px;">
              <strong>${s.title}</strong><br/>
              <span style="font-style: italic; font-size: 11px;">${s.sub || '(Ký tên)'}</span>
              <div style="height: 60px;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `

    return `
<style>
  @page { size: ${easyConfig.pageSize} ${easyConfig.orientation}; margin: 10mm; }
  .print-page { font-family: '${easyConfig.fontFamily}', sans-serif; color: #333; line-height: 1.4; position: relative; padding-top: 15px; }
  .print-page p { margin: 0; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
</style>
<div class="print-page">
  ${legalHtml}
  <div style="display: flex; flex-direction: ${easyConfig.logoPos === 'center' ? 'column' : (easyConfig.logoPos === 'right' ? 'row-reverse' : 'row')}; align-items: center; border-bottom: 2px solid ${easyConfig.headerColor}; padding-bottom: 10px;">
    ${logoHtml}
    <div style="flex: 1; text-align: ${easyConfig.logoPos === 'center' ? 'center' : 'left'}; padding: 0 20px;">
      ${companyNameHtml}
      ${companyDetailsHtml}
    </div>
    ${easyConfig.showMotto ? mottoHtml : ''}
  </div>

  <div style="position: relative; margin-top: 20px; min-height: 80px; text-align: center;">
    <h1 style="margin: 0; font-size: ${easyConfig.titleSize}px; color: ${easyConfig.headerColor}; text-transform: uppercase;">{{subtitle}}</h1>
    <div style="font-size: 14px; margin-top: 5px;">
      ${easyConfig.showDocDate && !easyConfig.vnDateFormat ? '<div>Ngày {{document_date}}</div>' : ''}
      ${easyConfig.vnDateFormat ? `<div style="font-style: italic;">${dateStr}</div>` : ''}
      ${easyConfig.showDocNumber ? '<div>Số: <strong>{{document_number}}</strong></div>' : ''}
    </div>

    <div style="position: absolute; right: 0; top: 0; text-align: right; font-size: 11px; line-height: 1.3; font-weight: normal; color: #333;">
      ${easyConfig.showDriver ? '<div>Tài xế: {{driver_name}}</div>' : ''}
      ${easyConfig.showAssistant1 ? '<div>Lơ xe 1: {{assistant_1}}</div>' : ''}
      ${easyConfig.showAssistant2 ? '<div>Lơ xe 2: {{assistant_2}}</div>' : ''}
      ${easyConfig.showM2 ? '<div>Tổng: <strong>{{total_m2}} m2</strong></div>' : ''}
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 10px; margin-bottom: 10px;">
    <div style="flex: 1;">
      ${easyConfig.showCustomer ? `<div>${easyConfig.customerLabel || 'Khách hàng'}: <strong>{{customer_name}}</strong></div>` : ''}
      ${easyConfig.showDelivery ? `<div>${easyConfig.deliveryLabel || 'Địa chỉ giao'}: {{delivery_address}}</div>` : ''}
    </div>
    <div style="flex: 1; text-align: right;">
      ${easyConfig.showWarehouse ? '<div>Kho xuất: {{warehouse_name}}</div>' : ''}
    </div>
  </div>

  ${easyConfig.introText ? `<div style="margin-top: 15px; margin-bottom: 15px; font-size: 14px; line-height: 1.5;">${easyConfig.introText}</div>` : ''}

  ${easyConfig.showTable ? (() => {
    const RIGHT_KEYS = new Set(['so_luong', 'don_gia', 'gia_ban', 'thanh_tien'])
    const CENTER_KEYS = new Set(['stt', 'dvt', 'so_lop', 'to_hop_song', 'kich_thuoc'])
    const colAlign = (key: string) => RIGHT_KEYS.has(key) ? 'right' : CENTER_KEYS.has(key) ? 'center' : 'left'
    const theadCells = (easyConfig.selectedColumns || []).map((c: DocColumn) =>
      `<th style="text-align:${colAlign(c.key)}">${c.label}</th>`
    ).join('')
    return `
  <table style="margin-top:8px">
    <thead><tr>${theadCells}</tr></thead>
    <tbody>{{body_html}}</tbody>
  </table>`
  })() : ''}

  ${easyConfig.customContent ? `<div style="margin-top: 10px; font-size: 14px; line-height: 1.5;">${easyConfig.customContent}</div>` : ''}
  
  ${easyConfig.outroText ? `<div style="margin-top: 15px; font-size: 14px; line-height: 1.5;">${easyConfig.outroText}</div>` : ''}

  ${signatureHtml}

  <div style="margin-top: 30px;">{{footer_html}}</div>
</div>`
  }

  const updatePreview = () => {
    const vals = form.getFieldsValue()
    let html = vals.html_content || ''
    
    if (activeTab === 'easy') {
      html = buildHtmlFromConfig()
    }

    const mockItems = [
      { stt: 1, ten_hang: 'Thùng Carton 3 lớp A1', so_luong: '1,000', don_gia: '5,500', thanh_tien: '5,500,000', ma_sp: 'SP001', kich_thuoc: '30x20x10', dvt: 'Cái', ma_amis: 'NP-001', so_lop: '3', to_hop_song: 'B', gia_ban: '5,500', ghi_chu: 'Hàng gấp', cau_truc: 'K/B/K', qccl: 'Lằn thường' },
      { stt: 2, ten_hang: 'Phôi sóng BC 5 lớp', so_luong: '500', don_gia: '12,000', thanh_tien: '6,000,000', ma_sp: 'SP002', kich_thuoc: '100x120', dvt: 'm2', ma_amis: 'NP-002', so_lop: '5', to_hop_song: 'BC', gia_ban: '12,000', ghi_chu: '', cau_truc: 'LB/98B/98/98C/LA', qccl: '20.2+50+20.2' },
    ]

    const selectedCols: DocColumn[] = easyConfig.selectedColumns || []
    const theadHtml = selectedCols.length
      ? `<thead><tr>${selectedCols.map((col: DocColumn) => {
          const isNumeric = ['so_luong', 'don_gia', 'thanh_tien', 'gia_ban'].includes(col.key)
          return `<th style="border:1px solid #ddd;padding:8px;background:${easyConfig.headerColor};color:#fff;text-align:${isNumeric ? 'right' : 'left'}">${col.label}</th>`
        }).join('')}</tr></thead>`
      : ''
    const bodyRows = mockItems.map(item => {
      const tds = selectedCols.map((col: DocColumn) => {
        const val = item[col.key as keyof typeof item] || '...'
        const isNumeric = ['so_luong', 'don_gia', 'thanh_tien', 'gia_ban'].includes(col.key)
        return `<td style="border:1px solid #ddd;padding:8px;text-align:${isNumeric ? 'right' : 'left'}">${val}</td>`
      }).join('')
      return `<tr>${tds}</tr>`
    }).join('')
    const bodyHtml = selectedCols.length
      ? `<table style="width:100%;border-collapse:collapse">${theadHtml}<tbody>${bodyRows}</tbody></table>`
      : ''

    const mockData = {
      company_name: activePhapNhan?.ten_phap_nhan || 'CÔNG TY TNHH NAM PHƯƠNG',
      company_details: `Địa chỉ: ${activePhapNhan?.dia_chi || '...'}<br/>
        MST: ${activePhapNhan?.ma_so_thue || '...'} 
        ${easyConfig.showContact ? ` - SĐT: ${easyConfig.phoneOverride || activePhapNhan?.so_dien_thoai || '...'} - Email: ${easyConfig.emailOverride || activePhapNhan?.email || '...'}` : ''}`,
      logo_img: `<img src="/api/phap-nhan/logo/${encodeURIComponent(activePhapNhan?.ma_phap_nhan || '')}?t=${Date.now()}" style="height:${easyConfig.logoSize - 10}px; max-width:100%; object-fit:contain;" onerror="this.src='https://via.placeholder.com/60?text=LOGO'"/>`,
      subtitle: (vals.ten_mau || 'PHIẾU IN MẪU').toUpperCase(),
      document_number: '123/NP-2026',
      document_date: '12/05/2026',
      document_day: '12', document_month: '05', document_year: '2026',
      customer_name: 'CÔNG TY TNHH ABC VIỆT NAM',
      delivery_address: 'KCN Tân Bình, TP. HCM',
      warehouse_name: 'KHO THÀNH PHẨM',
      driver_name: 'NGUYỄN VĂN TẢI',
      assistant_1: 'LÊ VĂN PHỤ',
      assistant_2: 'TRẦN VĂN ĐẨY',
      total_m2: '1,250.50',
      total_so_luong: '1,500',
      total_thanh_tien: '11,500,000',
      tong_tien_hang: '11,500,000',
      chi_phi_bang_in: '500,000',
      chi_phi_bang_in_vis: 'table-row',
      chi_phi_khuon: '1,200,000',
      chi_phi_khuon_vis: 'table-row',
      chi_phi_van_chuyen: '300,000',
      chi_phi_van_chuyen_vis: 'table-row',
      tien_vat: '920,000',
      tong_cong: '14,420,000',
      dieu_khoan: 'Thanh toán chuyển khoản trong vòng 30 ngày.',
      status: 'MỚI',
      body_html: bodyHtml,
      footer_html: ''
    }

    Object.entries(mockData).forEach(([k, v]) => {
      html = html.replace(new RegExp(`{{${k}}}`, 'g'), v)
    })
    
    setPreviewHtml(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    /* Preview: mô phỏng @page margin — không dùng padding cố định để tránh conflict với template */
    body { margin: 0; padding: 0; background: #fff; }
    /* Global table fixes cho preview khớp với thực tế in */
    table { table-layout: fixed; }
    td, th { word-break: break-word; overflow-wrap: break-word; }
    tr { page-break-inside: avoid; }
    /* Preserve màu nền trong preview như khi in */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>${html}</body>
</html>`)
  }

  useEffect(() => {
    if (editModal && activeTab === 'easy') {
      const newHtml = buildHtmlFromConfig()
      form.setFieldsValue({ html_content: newHtml })
      updatePreview()
    }
  }, [easyConfig, activeTab])

  useEffect(() => {
    const ma = form.getFieldValue('ma_mau')
    if (editModal && ma && selectedPhapNhanId) {
      systemApi.getTemplate(ma, selectedPhapNhanId, true).then(tpl => {
        if (tpl && tpl.phap_nhan_id === selectedPhapNhanId) {
          form.setFieldsValue(tpl)
          if (tpl.variables_meta?.easy_config) {
            try { setEasyConfig({ ...DEFAULT_CONFIG, ...JSON.parse(tpl.variables_meta.easy_config as string) }) } catch(e) {}
          }
        }
        // Không có template cho pháp nhân này → giữ config hiện tại, cho phép tạo mới
        setTimeout(updatePreview, 50)
      }).catch(() => {
        // Template chưa tồn tại cho pháp nhân này — không báo lỗi, cho phép tạo mới
        setTimeout(updatePreview, 50)
      })
    } else {
      setTimeout(updatePreview, 50)
    }
  }, [selectedPhapNhanId])

  useEffect(() => {
    if (editModal) {
      if (editModal.variables_meta?.easy_config) {
        try { 
          setEasyConfig({ ...DEFAULT_CONFIG, ...JSON.parse(editModal.variables_meta.easy_config as string) })
        } catch (e) { console.error('Lỗi parse easy_config', e) }
      }
      updatePreview()
    }
  }, [editModal])

  const updateMut = useMutation({
    mutationFn: (payload: { ma_mau?: string; ten_mau?: string; html_content?: string; variables_meta?: Record<string, unknown> }) => {
      const ma = payload.ma_mau || editModal?.ma_mau
      return systemApi.updateTemplate(ma ?? '', {
        ma_mau: ma,
        ten_mau: payload.ten_mau,
        phap_nhan_id: selectedPhapNhanId ?? undefined,
        html_content: payload.html_content || buildHtmlFromConfig(),
        variables_meta: { ...VARIABLE_LABELS, easy_config: JSON.stringify(easyConfig), columns: easyConfig.selectedColumns }
      })
    },
    onSuccess: () => {
      message.success('Đã lưu cấu hình biểu mẫu')
      setEditModal(null)
      setIsNewMode(false)
      qc.invalidateQueries({ queryKey: ['print-templates'] })
    },
    onError: (e: { response?: { data?: { detail?: string } }; message?: string }) => message.error(e?.response?.data?.detail ?? e?.message ?? 'Lỗi lưu biểu mẫu'),
  })

  const columns = [
    { title: 'Mã mẫu', dataIndex: 'ma_mau', key: 'ma_mau', width: 120 },
    { title: 'Tên biểu mẫu', dataIndex: 'ten_mau', key: 'ten_mau' },
    { 
      title: 'Pháp nhân', 
      dataIndex: 'phap_nhan_id', 
      render: (id: number) => {
        const pn = phapNhans.find(p => p.id === id)
        return pn ? <Tag color="blue">{pn.ten_viet_tat || pn.ten_phap_nhan}</Tag> : <Tag color="default">Mặc định</Tag>
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      render: (_: unknown, record: PrintTemplate) => (
        <Space>
          {canEditTemplate(record.ma_mau) && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setIsNewMode(false)
                setEditModal(record)
                form.setFieldsValue(record)
                setSelectedPhapNhanId(record.phap_nhan_id ?? null)
                const metaAny = record.variables_meta as Record<string, unknown> | undefined
                const savedCols = metaAny?.columns as DocColumn[] | undefined
                const savedEasyCfg: EasyConfig | null = (() => { try { return metaAny?.easy_config ? JSON.parse(metaAny.easy_config as string) : null } catch { return null } })()
                setEasyConfig(savedEasyCfg ?? (savedCols ? { ...DEFAULT_CONFIG, selectedColumns: savedCols } : DEFAULT_CONFIG) as EasyConfig)
              }}
            >
              Sửa
            </Button>
          )}
          {canEditTemplate(record.ma_mau) && (
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                setIsNewMode(true)
                const copyRecord = { ...record, ten_mau: `${record.ten_mau} (Copy)` }
                setEditModal(copyRecord)
                form.setFieldsValue(copyRecord)
                setSelectedPhapNhanId(record.phap_nhan_id ?? null)
                const metaAny = record.variables_meta as Record<string, unknown> | undefined
                const savedCols = metaAny?.columns as DocColumn[] | undefined
                const savedEasyCfg: EasyConfig | null = (() => { try { return metaAny?.easy_config ? JSON.parse(metaAny.easy_config as string) : null } catch { return null } })()
                setEasyConfig(savedEasyCfg ?? (savedCols ? { ...DEFAULT_CONFIG, selectedColumns: savedCols } : DEFAULT_CONFIG) as EasyConfig)
                message.info('Đã sao chép cấu hình. Bạn có thể đổi Loại chứng từ hoặc Pháp nhân trước khi lưu.')
              }}
            >
              Copy
            </Button>
          )}
          {!isTruongPhong && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => Modal.confirm({
                title: 'Xóa biểu mẫu?',
                content: `Xóa "${record.ten_mau}"? Thao tác không thể hoàn tác.`,
                okType: 'danger',
                okText: 'Xóa',
                cancelText: 'Hủy',
                onOk: () => deleteMut.mutate(record),
              })}
            />
          )}
        </Space>
      ),
    },
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('master-print-template', columns, { nonHideable: ['ma_mau'] })

  const deleteMut = useMutation({
    mutationFn: (record: PrintTemplate) =>
      systemApi.deleteTemplate(record.ma_mau, record.phap_nhan_id ?? undefined),
    onSuccess: () => {
      message.success('Đã xóa biểu mẫu')
      qc.invalidateQueries({ queryKey: ['print-templates'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail ?? 'Lỗi xóa'),
  })

  const handleFinish = (vals: { html_content?: string; variables_meta?: Record<string, unknown>; [key: string]: unknown }) => {
    let finalHtml = vals.html_content
    let meta = vals.variables_meta || {}
    if (activeTab === 'easy') {
      if (!easyConfig.selectedColumns?.length) {
        message.error('Biểu mẫu cần có ít nhất một cột chi tiết')
        return
      }
      finalHtml = buildHtmlFromConfig()
      meta = { ...meta, columns: easyConfig.selectedColumns }
    }
    updateMut.mutate({ ...vals, html_content: finalHtml, variables_meta: meta })
  }

  return (
    <div style={{ padding: 24 }}>
      <Tabs 
        type="card"
        items={[
          {
            key: 'print',
            label: <span><LayoutOutlined /> Biểu mẫu In ấn (PDF)</span>,
            children: (
              <Card
                title={<Title level={4} style={{ margin: 0 }}>⚙ Quản lý Biểu mẫu In ấn</Title>}
                extra={
                  <Space>
                    {settingsButton}
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setIsNewMode(true)
                        setEditModal({ ma_mau: '', ten_mau: '', html_content: '' })
                        form.resetFields()
                        setEasyConfig(DEFAULT_CONFIG)
                        setSelectedPhapNhanId(phapNhans[0]?.id ?? null)
                      }}
                    >
                      Thêm mẫu mới
                    </Button>
                  </Space>
                }
              >
                <Alert
                  message="Hệ thống In ấn đa Pháp nhân"
                  description="Hệ thống tự động lưu mẫu in riêng cho từng pháp nhân khi bạn chọn pháp nhân trong trình thiết kế và nhấn Lưu."
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
                <Table dataSource={templates} columns={displayColumns} rowKey={(r, i) => `${r.ma_mau}_${r.phap_nhan_id || 0}`} loading={isLoading} pagination={false} />
              </Card>
            )
          },
          {
            key: 'excel',
            label: <span><ThunderboltOutlined /> Biểu mẫu Excel</span>,
            children: <ExcelTemplateTab phapNhans={phapNhans} />
          }
        ]}
      />

      <Modal
        title={
          <Space>
            {isNewMode ? <PlusOutlined /> : <EditOutlined />} 
            <span>{isNewMode ? 'Tạo biểu mẫu mới' : `Thiết kế biểu mẫu: ${editModal?.ten_mau}`}</span>
          </Space>
        }
        open={!!editModal}
        onCancel={() => { setEditModal(null); setIsNewMode(false) }}
        width="95%"
        style={{ top: 20 }}
        footer={[
          <Button key="back" onClick={() => { setEditModal(null); setIsNewMode(false) }}>Hủy bỏ</Button>,
          <Button key="submit" type="primary" size="large" loading={updateMut.isPending} onClick={() => form.submit()}>
            LƯU CHO PHÁP NHÂN ĐANG CHỌN
          </Button>
        ]}
      >
        <Row gutter={24}>
          <Col span={14}>
            <div style={{ height: '75vh', overflowY: 'auto', paddingRight: 10 }}>
              <Form form={form} layout="vertical" onFinish={handleFinish} onValuesChange={updatePreview}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="ma_mau" label="Loại chứng từ" rules={[{ required: true }]}>
                      <Select 
                          disabled={!isNewMode}
                          options={Object.entries(DOC_TYPE_SCHEMAS).map(([k, s]) => ({ label: s.label, value: k }))}
                          onChange={(val) => {
                            const schema = DOC_TYPE_SCHEMAS[val]
                              if (schema) {
                                form.setFieldsValue({ ten_mau: schema.label })
                                setEasyConfig({ 
                                  ...easyConfig, 
                                  showTable: schema.showTable, 
                                  showTotal: schema.showTotal || false, 
                                  customerLabel: schema.customerLabel || 'Khách hàng', 
                                  deliveryLabel: schema.deliveryLabel || 'Địa chỉ giao', 
                                  selectedColumns: [], // Start with empty columns as requested
                                  signatures: schema.signatures, 
                                  ...(schema.easyOverrides || {}) 
                                })
                              }
                          }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Thiết kế cho Pháp nhân">
                      <Select value={selectedPhapNhanId} onChange={setSelectedPhapNhanId} options={phapNhans.map(p => ({ label: p.ten_phap_nhan, value: p.id }))} />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item name="ten_mau" label="Tên biểu mẫu" rules={[{ required: true }]}><Input /></Form.Item>
                
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                  {
                    key: 'easy',
                    label: <span><SettingOutlined /> Cấu hình nhanh</span>,
                    children: (
                      <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
                        <Collapse defaultActiveKey={['1', '2', '3']} ghost>
                          <Collapse.Panel header={<Text strong><PictureOutlined /> 1. Logo & Thương hiệu</Text>} key="1">
                            <Row gutter={16}>
                              <Col span={8}><Form.Item label="Vị trí Logo"><Select value={easyConfig.logoPos} onChange={v => setEasyConfig({...easyConfig, logoPos:v})} options={[{label:'Trái',value:'left'},{label:'Giữa',value:'center'},{label:'Phải',value:'right'}]}/></Form.Item></Col>
                              <Col span={8}><Form.Item label="Màu chủ đạo"><Input type="color" value={easyConfig.headerColor} onChange={e => setEasyConfig({...easyConfig, headerColor:e.target.value})}/></Form.Item></Col>
                              <Col span={8}><Form.Item label="Kích thước Logo (px)"><InputNumber value={easyConfig.logoSize} onChange={v => setEasyConfig({...easyConfig, logoSize: v ?? 0})}/></Form.Item></Col>
                              <Col span={8}><Form.Item label="Cỡ chữ Tên Cty"><InputNumber value={easyConfig.companyFontSize} onChange={v => setEasyConfig({...easyConfig, companyFontSize: v ?? 0})}/></Form.Item></Col>
                              <Col span={8}><Form.Item label="Cỡ chữ Tiêu đề"><InputNumber value={easyConfig.titleSize} onChange={v => setEasyConfig({...easyConfig, titleSize: v ?? 0})}/></Form.Item></Col>
                              <Col span={8}><Form.Item label="Font chữ"><Input value={easyConfig.fontFamily} onChange={e => setEasyConfig({...easyConfig, fontFamily:e.target.value})}/></Form.Item></Col>
                              <Col span={6}><Form.Item label="Hiện Tên Công ty"><Switch checked={easyConfig.showCompany} onChange={v => setEasyConfig({...easyConfig, showCompany:v})}/></Form.Item></Col>
                              <Col span={6}><Form.Item label="Hiện Liên hệ"><Switch checked={easyConfig.showContact} onChange={v => setEasyConfig({...easyConfig, showContact:v})}/></Form.Item></Col>
                              {easyConfig.showContact && (
                                <>
                                  <Col span={6}><Form.Item label="SĐT (In ấn)"><Input size="small" placeholder={`Mặc định: ${phapNhans.find(p => p.id === selectedPhapNhanId)?.so_dien_thoai || '—'}`} value={easyConfig.phoneOverride} onChange={e => setEasyConfig({...easyConfig, phoneOverride:e.target.value})}/></Form.Item></Col>
                                  <Col span={6}><Form.Item label="Email (In ấn)"><Input size="small" placeholder={`Mặc định: ${phapNhans.find(p => p.id === selectedPhapNhanId)?.email || '—'}`} value={easyConfig.emailOverride} onChange={e => setEasyConfig({...easyConfig, emailOverride:e.target.value})}/></Form.Item></Col>
                                </>
                              )}
                            </Row>
                          </Collapse.Panel>

                          <Collapse.Panel header={<Text strong><LayoutOutlined /> 2. Bố cục & Trang giấy</Text>} key="2">
                            <Row gutter={16}>
                              <Col span={6}><Form.Item label="Khổ giấy"><Select value={easyConfig.pageSize} onChange={v => setEasyConfig({...easyConfig, pageSize:v})} options={[{label:'A4',value:'A4'},{label:'A5',value:'A5'}]}/></Form.Item></Col>
                              <Col span={6}><Form.Item label="Hướng giấy"><Select value={easyConfig.orientation} onChange={v => setEasyConfig({...easyConfig, orientation:v})} options={[{label:'Dọc',value:'portrait'},{label:'Ngang',value:'landscape'}]}/></Form.Item></Col>
                              <Col span={6}><Form.Item label="Hiện Số chứng từ"><Switch checked={easyConfig.showDocNumber} onChange={v => setEasyConfig({...easyConfig, showDocNumber:v})}/></Form.Item></Col>
                              <Col span={6}><Form.Item label="Hiện Ngày"><Switch checked={easyConfig.showDocDate} onChange={v => setEasyConfig({...easyConfig, showDocDate:v})}/></Form.Item></Col>
                              <Col span={12}><Form.Item label="Mã hiệu pháp lý (Góc phải)"><Input placeholder="Ví dụ: BM-05-KT" value={easyConfig.legalReference} onChange={e => setEasyConfig({...easyConfig, legalReference:e.target.value})}/></Form.Item></Col>
                              <Col span={12}><Form.Item label="Tiêu ngữ (Quốc hiệu)"><Switch checked={easyConfig.showMotto} onChange={v => setEasyConfig({...easyConfig, showMotto:v})}/> {easyConfig.showMotto && <ReactQuill theme="snow" value={easyConfig.mottoText} onChange={v => setEasyConfig({...easyConfig, mottoText:v})} style={{height:60, marginBottom:40}}/>}</Form.Item></Col>
                            </Row>
                          </Collapse.Panel>

                          <Collapse.Panel header={<Text strong><FormOutlined /> 3. Thông tin chung & Lời dẫn</Text>} key="3">
                             <Row gutter={16}>
                               <Col span={8}><Form.Item label="Nhãn Khách hàng"><Input value={easyConfig.customerLabel} onChange={e => setEasyConfig({...easyConfig, customerLabel:e.target.value})}/></Form.Item></Col>
                               <Col span={8}><Form.Item label="Nhãn Địa chỉ giao"><Input value={easyConfig.deliveryLabel} onChange={e => setEasyConfig({...easyConfig, deliveryLabel:e.target.value})}/></Form.Item></Col>
                               <Col span={8}><Form.Item label="Ngày định dạng VN"><Switch checked={easyConfig.vnDateFormat} onChange={v => setEasyConfig({...easyConfig, vnDateFormat:v})}/></Form.Item></Col>
                             </Row>
                             <Row gutter={16}>
                               <Col span={5}><Space>Kho:<Switch size="small" checked={easyConfig.showWarehouse} onChange={v => setEasyConfig({...easyConfig, showWarehouse:v})}/></Space></Col>
                               <Col span={5}><Space>Tài xế:<Switch size="small" checked={easyConfig.showDriver} onChange={v => setEasyConfig({...easyConfig, showDriver:v})}/></Space></Col>
                               <Col span={5}><Space>Tổng m2:<Switch size="small" checked={easyConfig.showM2} onChange={v => setEasyConfig({...easyConfig, showM2:v})}/></Space></Col>
                               <Col span={5}><Space>Lơ xe 1:<Switch size="small" checked={easyConfig.showAssistant1} onChange={v => setEasyConfig({...easyConfig, showAssistant1:v})}/></Space></Col>
                               <Col span={4}><Space>Lơ xe 2:<Switch size="small" checked={easyConfig.showAssistant2} onChange={v => setEasyConfig({...easyConfig, showAssistant2:v})}/></Space></Col>
                             </Row>
                             <div style={{marginTop:16}}><Text>Lời dẫn nhập (Dưới tên khách hàng):</Text><ReactQuill theme="snow" value={easyConfig.introText} onChange={v => setEasyConfig({...easyConfig, introText:v})} style={{height:80, marginBottom:40}}/></div>
                          </Collapse.Panel>

                          <Collapse.Panel header={<Text strong><ColumnHeightOutlined /> 4. Bảng hàng hóa & Cột dữ liệu</Text>} key="4">
                             <Space wrap style={{marginBottom:16}}>
                               {[
                                 { key: 'stt', label: 'STT' }, { key: 'ma_sp', label: 'Mã SP' }, { key: 'ma_amis', label: 'Mã AMIS' },
                                 { key: 'ten_hang', label: 'Tên hàng' }, { key: 'kich_thuoc', label: 'Quy cách' },
                                 { key: 'so_lop', label: 'Lớp' }, { key: 'to_hop_song', label: 'Sóng' }, { key: 'so_po', label: 'Số PO' }, { key: 'so_po_kh', label: 'Số PO KH' },
                                 { key: 'so_lsx', label: 'Số LSX' }, { key: 'ngay_po', label: 'Ngày PO' }, { key: 'kho_cat', label: 'Khổ×Cắt' },
                                 { key: 'so_luong', label: 'Số lượng' }, { key: 'dvt', label: 'ĐVT' },
                                 { key: 'total_m2', label: 'M2' }, { key: 'trong_luong', label: 'Kg' }, { key: 'the_tich', label: 'M3' },
                                 { key: 'cau_truc', label: 'Kết cấu' }, { key: 'qccl', label: 'QC Cán lằn' },
                                 { key: 'gia_ban', label: 'Đơn giá' }, { key: 'thanh_tien', label: 'Thành tiền' }, { key: 'ghi_chu', label: 'Ghi chú' }
                               ].map(col => {
                                 const isSelected = (easyConfig.selectedColumns || []).some((c: DocColumn) => c.key === col.key)
                                 return <Button key={col.key} size="small" type={isSelected ? 'primary' : 'default'} onClick={() => {
                                   let current = [...(easyConfig.selectedColumns || [])]
                                   if (isSelected) current = current.filter((c: DocColumn) => c.key !== col.key)
                                   else (current as DocColumn[]).push(col as DocColumn)
                                   setEasyConfig({ ...easyConfig, selectedColumns: current })
                                 }}>{col.label}</Button>
                               })}
                             </Space>
                              <div style={{marginTop:16}}>
                                <Row gutter={16}>
                                  <Col span={6}><Space>Hiện Bảng hàng hóa:<Switch size="small" checked={easyConfig.showTable} onChange={v => setEasyConfig({...easyConfig, showTable:v})}/></Space></Col>
                                  <Col span={6}><Space>Hiện Tổng cộng:<Switch size="small" checked={easyConfig.showTotal} onChange={v => setEasyConfig({...easyConfig, showTotal:v})}/></Space></Col>
                                  <Col span={6}><Space>Hiện Bảng in:<Switch size="small" checked={easyConfig.showPlateCost} onChange={v => setEasyConfig({...easyConfig, showPlateCost:v})}/></Space></Col>
                                  <Col span={6}><Space>Hiện Khuôn:<Switch size="small" checked={easyConfig.showMouldCost} onChange={v => setEasyConfig({...easyConfig, showMouldCost:v})}/></Space></Col>
                                </Row>
                              </div>
                             <div style={{marginTop:16}}><Text>Lời kết/Dẫn nhập (Dưới bảng):</Text><ReactQuill theme="snow" value={easyConfig.outroText} onChange={v => setEasyConfig({...easyConfig, outroText:v})} style={{height:80, marginBottom:40}}/></div>
                          </Collapse.Panel>

                          <Collapse.Panel header={<Text strong><ThunderboltOutlined /> 5. Chữ ký & Người duyệt</Text>} key="5">
                             {(easyConfig.signatures || []).map((sig: DocSignature, idx: number) => (
                                 <div key={idx} style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #eee', marginBottom: 8 }}>
                                  <Row gutter={8} align="middle">
                                    <Col span={8}><Input placeholder="Chức danh" value={sig.title} onChange={e => { const newSigs = [...easyConfig.signatures]; newSigs[idx].title = e.target.value; setEasyConfig({ ...easyConfig, signatures: newSigs }) }}/></Col>
                                    <Col span={8}><Input placeholder="Phụ đề" value={sig.sub} onChange={e => { const newSigs = [...easyConfig.signatures]; newSigs[idx].sub = e.target.value; setEasyConfig({ ...easyConfig, signatures: newSigs }) }}/></Col>
                                    <Col span={6}><Radio.Group value={sig.align || 'center'} onChange={e => { const newSigs = [...easyConfig.signatures]; newSigs[idx].align = e.target.value; setEasyConfig({ ...easyConfig, signatures: newSigs }) }}><Radio.Button value="left"><AlignLeftOutlined/></Radio.Button><Radio.Button value="center"><AlignCenterOutlined/></Radio.Button><Radio.Button value="right"><AlignRightOutlined/></Radio.Button></Radio.Group></Col>
                                    <Col span={2}><Button danger icon={<DeleteOutlined/>} onClick={() => setEasyConfig({...easyConfig, signatures: easyConfig.signatures.filter((_: DocSignature,i:number)=>i!==idx)})}/></Col>
                                  </Row>
                                </div>
                             ))}
                             <Button type="dashed" block icon={<PlusOutlined/>} onClick={() => setEasyConfig({...easyConfig, signatures:[...(easyConfig.signatures||[]), {title:'Người ký', sub:'(Ký tên)', align:'center'}]})}>Thêm vị trí ký</Button>
                          </Collapse.Panel>
                        </Collapse>
                      </div>
                    )
                  },
                  {
                    key: 'code',
                    label: <span><CodeOutlined /> Mã HTML</span>,
                    children: <Form.Item name="html_content"><Input.TextArea rows={22} style={{ fontFamily: 'monospace' }}/></Form.Item>
                  }
                ]} />
              </Form>
            </div>
          </Col>

          <Col span={10}>
            <div style={{ height: '75vh', border: '1px solid #d9d9d9', borderRadius: 8, display: 'flex', flexDirection: 'column', background: '#f0f2f5', overflow: 'hidden' }}>
              <div style={{ background: '#fff', padding: '8px 16px', borderBottom: '1px solid #d9d9d9', display: 'flex', justifyContent: 'space-between' }}>
                <Text strong><EyeOutlined /> XEM THỬ TRỰC TIẾP</Text>
                <Space><Tag color="blue">{easyConfig.pageSize}</Tag><Tag color="geekblue">{easyConfig.orientation === 'portrait' ? 'Dọc' : 'Ngang'}</Tag></Space>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', justifyContent: 'center' }}>
                {(() => {
                  const isPortrait = easyConfig.orientation === 'portrait';
                  const isA4 = easyConfig.pageSize === 'A4';
                  const w = isA4 ? (isPortrait ? 210 : 297) : (isPortrait ? 148 : 210);
                  const h = isA4 ? (isPortrait ? 297 : 210) : (isPortrait ? 210 : 148);
                  const scale = 1.8;
                  return (
                    <div style={{ position: 'relative', width: `${w * scale}px`, minHeight: `${h * scale}px`, overflow: 'hidden' }}>
                      {/* Shadow mô phỏng tờ giấy thật */}
                      <div style={{ position: 'absolute', inset: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.18)', borderRadius: 2, pointerEvents: 'none', zIndex: 1 }} />
                      <iframe
                        key={previewHtml.length + (selectedPhapNhanId || 0) + easyConfig.pageSize + easyConfig.orientation}
                        title="Live Preview"
                        srcDoc={previewHtml}
                        style={{
                          width: `${w}mm`,
                          height: `${h}mm`,
                          border: 'none',
                          transform: `scale(${scale / 3.7795})`,
                          transformOrigin: '0 0',
                          display: 'block',
                        }}
                        scrolling="no"
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* Panel biến template hỗ trợ */}
            {(() => {
              const key = (watchedMaMau || editModal?.ma_mau || '').toUpperCase()
              const vars = FRONTEND_VAR_REGISTRY[key] || UNIVERSAL_VARS
              return (
                <Collapse style={{ marginTop: 8 }} size="small" ghost>
                  <Collapse.Panel
                    header={<Text style={{ fontSize: 12 }}><CodeOutlined /> Biến hỗ trợ — click để copy ({vars.length})</Text>}
                    key="vars"
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                      {vars.map(v => (
                        <Tag
                          key={v.var}
                          style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                          title={v.desc}
                          onClick={() => navigator.clipboard.writeText(v.var).then(() => message.success(`Copied: ${v.var}`, 1))}
                        >
                          {v.var}
                        </Tag>
                      ))}
                    </div>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
                      Click → copy → paste vào HTML editor (tab Mã nguồn)
                    </Text>
                  </Collapse.Panel>
                </Collapse>
              )
            })()}
          </Col>
        </Row>
      </Modal>
    </div>
  )
}

// ─── Available meta keys per doc type for header_config selection ────────────
const DOC_META_KEYS: Record<string, { key: string; label: string }[]> = {
  GOODS_RECEIPT: [
    { key: 'document_number', label: 'Số phiếu' },
    { key: 'document_date', label: 'Ngày nhập' },
    { key: 'supplier_name', label: 'Nhà cung cấp' },
    { key: 'warehouse_name', label: 'Kho nhập' },
    { key: 'loai_nhap', label: 'Loại nhập' },
    { key: 'so_xe', label: 'Số xe' },
    { key: 'ghi_chu', label: 'Ghi chú' },
  ],
  MATERIAL_ISSUE: [
    { key: 'document_number', label: 'Số phiếu' },
    { key: 'document_date', label: 'Ngày xuất' },
    { key: 'warehouse_name', label: 'Kho xuất' },
    { key: 'so_lenh', label: 'Lệnh SX' },
    { key: 'ghi_chu', label: 'Ghi chú' },
  ],
  PURCHASE_ORDER: [
    { key: 'document_number', label: 'Số PO' },
    { key: 'document_date', label: 'Ngày PO' },
    { key: 'supplier_name', label: 'Nhà cung cấp' },
    { key: 'dieu_khoan_tt', label: 'Điều khoản TT' },
    { key: 'ghi_chu', label: 'Ghi chú' },
  ],
}

function ExcelTemplateTab({ phapNhans }: { phapNhans: PhapNhan[] }) {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editModal, setEditModal] = useState<ExcelTemplate | null>(null)
  const [selectedPhapNhanId, setSelectedPhapNhanId] = useState<number | null>(null)
  const [availableColumns, setAvailableColumns] = useState<DocColumn[]>([])
  const [availableMetaKeys, setAvailableMetaKeys] = useState<{ key: string; label: string }[]>([])
  const authUser = useAuthStore(state => state.user)
  const isTruongPhong = authUser?.role === 'TRUONG_PHONG_SALE_ADMIN'
  const SALES_CODES_XL = new Set(['sales_order', 'sales_invoice', 'sales_quote', 'sales_order_detail', 'sales_quote_list', 'delivery_order'])
  const canEditXl = (ma_mau: string) => !isTruongPhong || SALES_CODES_XL.has(ma_mau.toLowerCase())
  // Local state for sub-configs (Form.Item can't easily handle nested objects)
  const [styleConfig, setStyleConfig] = useState<ExcelStyleConfig>({})
  const [headerConfig, setHeaderConfig] = useState<ExcelHeaderField[]>([])
  const [footerConfig, setFooterConfig] = useState<ExcelFooterConfig>({})

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['excel-templates'],
    queryFn: systemApi.getExcelTemplates,
  })

  const saveMut = useMutation({
    mutationFn: (vals: { ma_mau: string; ten_mau: string; column_config?: ExcelColumnConfig[] }) => {
      if (!vals.column_config?.length) throw new Error('Mẫu Excel cần có ít nhất một cột')
      return systemApi.updateExcelTemplate(vals.ma_mau, {
        ...vals,
        phap_nhan_id: selectedPhapNhanId ?? undefined,
        header_config: headerConfig,
        footer_config: footerConfig,
        style_config: styleConfig,
      })
    },
    onSuccess: () => {
      message.success('Đã lưu mẫu Excel')
      setEditModal(null)
      qc.invalidateQueries({ queryKey: ['excel-templates'] })
    },
    onError: (e: { response?: { data?: { detail?: string } }; message?: string }) =>
      message.error(e?.response?.data?.detail ?? e?.message ?? 'Lỗi lưu mẫu Excel'),
  })

  const deleteMut = useMutation({
    mutationFn: (tpl: ExcelTemplate) => systemApi.deleteExcelTemplate(tpl.ma_mau, tpl.phap_nhan_id),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['excel-templates'] }) },
  })

  const openEdit = (record: ExcelTemplate) => {
    setEditModal(record)
    form.setFieldsValue({ ma_mau: record.ma_mau, ten_mau: record.ten_mau, column_config: record.column_config })
    setSelectedPhapNhanId(record.phap_nhan_id ?? null)
    setStyleConfig(record.style_config ?? { show_company_header: true, freeze_header: true, orientation: 'portrait', accent_color: '#1B5E20', alt_row_color: '#F1F8E9' })
    setHeaderConfig(record.header_config ?? [])
    setFooterConfig(record.footer_config ?? { show_total: false, sum_columns: [], show_signatures: false, signatures: [] })
    const schema = DOC_TYPE_SCHEMAS[record.ma_mau]
    if (schema) setAvailableColumns(schema.defaultColumns)
    setAvailableMetaKeys(DOC_META_KEYS[record.ma_mau] ?? [])
  }

  const tableColumns = [
    { title: 'Mã mẫu', dataIndex: 'ma_mau', key: 'ma_mau', width: 160 },
    { title: 'Tên mẫu', dataIndex: 'ten_mau', key: 'ten_mau' },
    {
      title: 'Pháp nhân',
      dataIndex: 'phap_nhan_id',
      width: 140,
      render: (id: number) => {
        const pn = phapNhans.find(p => p.id === id)
        return pn ? <Tag color="blue">{pn.ten_viet_tat || pn.ten_phap_nhan}</Tag> : <Tag>Mặc định</Tag>
      },
    },
    { title: 'Cột', dataIndex: 'column_config', width: 60, render: (c: ExcelColumnConfig[]) => c?.length || 0 },
    {
      title: 'Thao tác', key: 'action', width: 140,
      render: (_: unknown, r: ExcelTemplate) => (
        <Space>
          {canEditXl(r.ma_mau) && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>
          )}
          {!isTruongPhong && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: 'Xóa mẫu?', onOk: () => deleteMut.mutate(r) })} />
          )}
        </Space>
      ),
    },
  ]

  const sumColOptions = (form.getFieldValue('column_config') as ExcelColumnConfig[] ?? []).map(c => ({ label: c.label, value: c.key }))

  const { displayColumns: displayExcelColumns, settingsButton: excelSettingsButton } = useColumnPrefs('master-print-template-excel', tableColumns, { nonHideable: ['ma_mau'] })

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>📊 Mẫu xuất Excel</Title>}
      extra={<Space>{excelSettingsButton}<Button type="primary" icon={<PlusOutlined />} onClick={() => {
        setEditModal({ ma_mau: '', ten_mau: '', column_config: [] })
        form.resetFields()
        setSelectedPhapNhanId(null)
        setStyleConfig({ show_company_header: true, freeze_header: true, orientation: 'portrait', accent_color: '#1B5E20', alt_row_color: '#F1F8E9' })
        setHeaderConfig([])
        setFooterConfig({ show_total: false, sum_columns: [], show_signatures: false, signatures: [] })
        setAvailableColumns([])
        setAvailableMetaKeys([])
      }}>Thêm mẫu</Button></Space>}
    >
      <Table dataSource={templates} columns={displayExcelColumns} loading={isLoading} rowKey={r => `${r.ma_mau}_${r.phap_nhan_id || 0}`} pagination={false} size="small" />

      <Modal
        title="Thiết kế mẫu Excel"
        open={!!editModal}
        onCancel={() => setEditModal(null)}
        onOk={() => form.submit()}
        width={860}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={saveMut.mutate}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ma_mau" label="Loại chứng từ" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(DOC_TYPE_SCHEMAS).map(([k, s]) => ({ label: s.label, value: k }))}
                  onChange={(val) => {
                    const schema = DOC_TYPE_SCHEMAS[val]
                    if (schema) {
                      setAvailableColumns(schema.defaultColumns)
                      form.setFieldsValue({ ten_mau: `Xuất Excel ${schema.label}` })
                    }
                    setAvailableMetaKeys(DOC_META_KEYS[val] ?? [])
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Pháp nhân">
                <Select
                  value={selectedPhapNhanId}
                  onChange={setSelectedPhapNhanId}
                  options={[{ label: 'Dùng chung (Mặc định)', value: null }, ...phapNhans.map(p => ({ label: p.ten_phap_nhan, value: p.id }))]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ten_mau" label="Tên mẫu" rules={[{ required: true }]}><Input /></Form.Item>

          <Tabs
            size="small"
            items={[
              {
                key: 'cols',
                label: '📋 Cột dữ liệu',
                children: (
                  <Form.Item name="column_config">
                    <ExcelColumnDesigner availableColumns={availableColumns} />
                  </Form.Item>
                ),
              },
              {
                key: 'header',
                label: '📄 Header phiếu',
                children: (
                  <ExcelHeaderDesigner
                    value={headerConfig}
                    onChange={setHeaderConfig}
                    availableKeys={availableMetaKeys}
                  />
                ),
              },
              {
                key: 'footer',
                label: '✍️ Footer & Chữ ký',
                children: (
                  <ExcelFooterDesigner
                    value={footerConfig}
                    onChange={setFooterConfig}
                    columnOptions={sumColOptions}
                  />
                ),
              },
              {
                key: 'style',
                label: '🎨 Cài đặt',
                children: (
                  <ExcelStyleDesigner value={styleConfig} onChange={setStyleConfig} />
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </Card>
  )
}

// ─── ExcelColumnDesigner ─────────────────────────────────────────────────────
function ExcelColumnDesigner({ value = [], onChange, availableColumns }: {
  value?: ExcelColumnConfig[]
  onChange?: (v: ExcelColumnConfig[]) => void
  availableColumns: DocColumn[]
}) {
  const toggleColumn = (col: DocColumn) => {
    const exists = value.find(c => c.key === col.key)
    if (exists) onChange?.(value.filter(c => c.key !== col.key))
    else onChange?.([...value, { key: col.key, label: col.label, width: 15 }])
  }

  const updateCol = (key: string, field: string, val: string | number | null) => {
    onChange?.(value.map(c => c.key === key ? { ...c, [field]: val } : c))
  }

  const moveCol = (index: number, dir: -1 | 1) => {
    const arr = [...value]
    const target = index + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    onChange?.(arr)
  }

  return (
    <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
      <Text strong style={{ fontSize: 12 }}>Cột có sẵn (click để thêm/bỏ):</Text>
      <div style={{ margin: '8px 0 12px' }}>
        <Space wrap size="small">
          {availableColumns.map(c => (
            <Button key={c.key} size="small"
              type={value.find(v => v.key === c.key) ? 'primary' : 'default'}
              onClick={() => toggleColumn(c)}>
              {c.label}
            </Button>
          ))}
        </Space>
      </div>
      <Table size="small" dataSource={value} pagination={false} rowKey="key"
        columns={[
          {
            title: '', width: 60,
            render: (_: unknown, __: ExcelColumnConfig, idx: number) => (
              <Space size={2}>
                <Button size="small" type="text" onClick={() => moveCol(idx, -1)} disabled={idx === 0}>↑</Button>
                <Button size="small" type="text" onClick={() => moveCol(idx, 1)} disabled={idx === value.length - 1}>↓</Button>
              </Space>
            ),
          },
          { title: 'Trường', dataIndex: 'key', key: 'key', width: 130 },
          {
            title: 'Tiêu đề',
            dataIndex: 'label',
            render: (text: string, r: ExcelColumnConfig) =>
              <Input size="small" value={text} onChange={e => updateCol(r.key, 'label', e.target.value)} />,
          },
          {
            title: 'Độ rộng', dataIndex: 'width', width: 90,
            render: (val: number, r: ExcelColumnConfig) =>
              <InputNumber size="small" min={5} max={100} value={val} onChange={v => updateCol(r.key, 'width', v)} />,
          },
          {
            title: '', width: 40,
            render: (_: unknown, r: ExcelColumnConfig) =>
              <Button size="small" danger type="text" onClick={() => onChange?.(value.filter(c => c.key !== r.key))}>✕</Button>,
          },
        ]}
      />
    </div>
  )
}

// ─── ExcelHeaderDesigner ──────────────────────────────────────────────────────
function ExcelHeaderDesigner({ value, onChange, availableKeys }: {
  value: ExcelHeaderField[]
  onChange: (v: ExcelHeaderField[]) => void
  availableKeys: { key: string; label: string }[]
}) {
  const toggle = (k: { key: string; label: string }) => {
    const exists = value.find(f => f.key === k.key)
    if (exists) onChange(value.filter(f => f.key !== k.key))
    else onChange([...value, { key: k.key, label: k.label }])
  }
  const updateLabel = (key: string, label: string) => {
    onChange(value.map(f => f.key === key ? { ...f, label } : f))
  }
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...value]
    const t = i + dir
    if (t < 0 || t >= arr.length) return
    ;[arr[i], arr[t]] = [arr[t], arr[i]]
    onChange(arr)
  }

  return (
    <div style={{ padding: 4 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Các trường thông tin hiển thị trên đầu phiếu (trước bảng dữ liệu). Được sắp xếp 2 cột trái/phải.
      </Text>
      <div style={{ margin: '10px 0' }}>
        <Text strong style={{ fontSize: 12 }}>Trường có sẵn:</Text>
        <div style={{ marginTop: 6 }}>
          <Space wrap size="small">
            {availableKeys.map(k => (
              <Button key={k.key} size="small"
                type={value.find(f => f.key === k.key) ? 'primary' : 'default'}
                onClick={() => toggle(k)}>
                {k.label}
              </Button>
            ))}
          </Space>
        </div>
      </div>
      {value.length > 0 && (
        <Table size="small" dataSource={value} pagination={false} rowKey="key"
          columns={[
            {
              title: 'Thứ tự', width: 60,
              render: (_: unknown, __: ExcelHeaderField, idx: number) => (
                <Space size={2}>
                  <Button size="small" type="text" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</Button>
                  <Button size="small" type="text" onClick={() => move(idx, 1)} disabled={idx === value.length - 1}>↓</Button>
                </Space>
              ),
            },
            { title: 'Trường', dataIndex: 'key', width: 160 },
            {
              title: 'Nhãn hiển thị',
              dataIndex: 'label',
              render: (text: string, r: ExcelHeaderField) =>
                <Input size="small" value={text} onChange={e => updateLabel(r.key, e.target.value)} />,
            },
            {
              title: '', width: 40,
              render: (_: unknown, r: ExcelHeaderField) =>
                <Button size="small" danger type="text" onClick={() => onChange(value.filter(f => f.key !== r.key))}>✕</Button>,
            },
          ]}
        />
      )}
    </div>
  )
}

// ─── ExcelFooterDesigner ──────────────────────────────────────────────────────
function ExcelFooterDesigner({ value, onChange, columnOptions }: {
  value: ExcelFooterConfig
  onChange: (v: ExcelFooterConfig) => void
  columnOptions: { label: string; value: string }[]
}) {
  const set = (patch: Partial<ExcelFooterConfig>) => onChange({ ...value, ...patch })
  const [newSig, setNewSig] = useState('')

  return (
    <div style={{ padding: 4 }}>
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Dòng tổng cộng</Text>
            <div style={{ marginTop: 8 }}>
              <Space>
                <Switch checked={!!value.show_total} onChange={v => set({ show_total: v })} />
                <Text>Hiển thị dòng tổng</Text>
              </Space>
            </div>
            {value.show_total && (
              <div style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12 }} type="secondary">Cột nào được tính tổng:</Text>
                <Select
                  mode="multiple"
                  size="small"
                  style={{ width: '100%', marginTop: 4 }}
                  value={value.sum_columns ?? []}
                  options={columnOptions}
                  onChange={v => set({ sum_columns: v })}
                  placeholder="Chọn cột số..."
                />
              </div>
            )}
          </div>
        </Col>
        <Col span={12}>
          <div>
            <Text strong>Chữ ký</Text>
            <div style={{ marginTop: 8 }}>
              <Space>
                <Switch checked={!!value.show_signatures} onChange={v => set({ show_signatures: v })} />
                <Text>Hiển thị ô chữ ký</Text>
              </Space>
            </div>
            {value.show_signatures && (
              <div style={{ marginTop: 8 }}>
                {(value.signatures ?? []).map((sig, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <Input
                      size="small"
                      value={sig}
                      onChange={e => {
                        const sigs = [...(value.signatures ?? [])]
                        sigs[i] = e.target.value
                        set({ signatures: sigs })
                      }}
                    />
                    <Button size="small" danger type="text"
                      onClick={() => set({ signatures: (value.signatures ?? []).filter((_, j) => j !== i) })}>✕</Button>
                  </div>
                ))}
                <Space.Compact size="small" style={{ marginTop: 4, width: '100%' }}>
                  <Input
                    value={newSig}
                    onChange={e => setNewSig(e.target.value)}
                    placeholder="Tên ô chữ ký..."
                    onPressEnter={() => { if (newSig.trim()) { set({ signatures: [...(value.signatures ?? []), newSig.trim()] }); setNewSig('') } }}
                  />
                  <Button onClick={() => { if (newSig.trim()) { set({ signatures: [...(value.signatures ?? []), newSig.trim()] }); setNewSig('') } }}>+</Button>
                </Space.Compact>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}

// ─── ExcelStyleDesigner ───────────────────────────────────────────────────────
function ExcelStyleDesigner({ value, onChange }: {
  value: ExcelStyleConfig
  onChange: (v: ExcelStyleConfig) => void
}) {
  const set = (patch: Partial<ExcelStyleConfig>) => onChange({ ...value, ...patch })

  return (
    <div style={{ padding: 4 }}>
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12 }}>Màu header cột</Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <input type="color" value={value.accent_color || '#1B5E20'}
                onChange={e => set({ accent_color: e.target.value })}
                style={{ width: 40, height: 32, border: 'none', cursor: 'pointer', padding: 2 }} />
              <Input size="small" value={value.accent_color || '#1B5E20'}
                onChange={e => set({ accent_color: e.target.value })}
                style={{ width: 90, fontFamily: 'monospace' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12 }}>Màu dòng xen kẽ</Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <input type="color" value={value.alt_row_color || '#F1F8E9'}
                onChange={e => set({ alt_row_color: e.target.value })}
                style={{ width: 40, height: 32, border: 'none', cursor: 'pointer', padding: 2 }} />
              <Input size="small" value={value.alt_row_color || '#F1F8E9'}
                onChange={e => set({ alt_row_color: e.target.value })}
                style={{ width: 90, fontFamily: 'monospace' }} />
              <Button size="small" type="link" onClick={() => set({ alt_row_color: '' })}>Bỏ</Button>
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12 }}>Hướng trang</Text>
            <div style={{ marginTop: 6 }}>
              <Radio.Group value={value.orientation || 'portrait'} onChange={e => set({ orientation: e.target.value })} size="small">
                <Radio.Button value="portrait">Dọc (Portrait)</Radio.Button>
                <Radio.Button value="landscape">Ngang (Landscape)</Radio.Button>
              </Radio.Group>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <Space direction="vertical" size={6}>
              <Space>
                <Switch checked={value.show_company_header !== false} onChange={v => set({ show_company_header: v })} size="small" />
                <Text style={{ fontSize: 12 }}>Hiển thị thông tin công ty</Text>
              </Space>
              <Space>
                <Switch checked={value.freeze_header !== false} onChange={v => set({ freeze_header: v })} size="small" />
                <Text style={{ fontSize: 12 }}>Cố định dòng tiêu đề (Freeze pane)</Text>
              </Space>
            </Space>
          </div>
        </Col>
      </Row>
    </div>
  )
}
