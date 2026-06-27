import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Col, Descriptions, Drawer, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, Tabs, Divider, message, Tooltip, Badge,
  Modal, Radio, Input,
} from 'antd'
import { WarningOutlined, ReloadOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import type { PhanXuong, TonKho } from '../../api/warehouse'
import { warehouseApi } from '../../api/warehouse'
import { exportExcelWithTemplate } from '../../utils/exportUtils'
import { khoAoPhoiApi, type HangLoiPhoiRow } from '../../api/kho_ao_phoi'
import { productionOrdersApi, type PhieuNhapPhoiSongListItem } from '../../api/productionOrders'
import { usePermission } from '../../hooks/usePermission'
import { getErrorMessage } from '../../utils/errorUtils'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

const fmtMoney = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '—'

const fmtDate = (v: string | null | undefined) =>
  v ? v.split('T')[0].split('-').reverse().join('/') : '—'

interface Specs {
  loai_thung?: string | null
  dai?: number | null
  rong?: number | null
  cao?: number | null
  so_lop?: number | null
  to_hop_song?: string | null
  kho_tt?: number | null
  dai_tt?: number | null
  loai_in?: string | null
  so_mau?: number | null
  quy_cach?: string | null
  ngay_giao_hang?: string | null
}

interface HangLoiRow extends Specs {
  id: number
  so_phieu: string
  ngay_nhap: string | null
  production_order_id: number | null
  so_lenh: string | null
  ngay_lenh: string | null
  so_don: string | null
  ten_hang: string | null
  so_luong_ke_hoach: number | null
  so_luong_nhap: number
  so_luong_loi: number
  trang_thai_loi: string | null
  dvt: string
  ten_khach_hang: string | null
  dia_chi_giao: string | null
  ten_nv_theo_doi: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  ghi_chu: string | null
}

interface HangTraVeRow extends Specs {
  id: number
  so_phieu_tra: string | null
  ngay_tra: string | null
  sales_return_id: number | null
  ten_hang: string | null
  so_luong_tra: number
  don_gia_tra: number
  tinh_trang_hang: string | null
  dvt: string
  ten_khach_hang: string | null
  ly_do_tra: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  ten_nv_theo_doi: string | null
  so_lenh: string | null
  ghi_chu: string | null
}

interface KhoLoiData {
  hang_loi: HangLoiRow[]
  hang_tra_ve: HangTraVeRow[]
}

interface DefectRecordTraVeRow {
  id: number
  ref_type: string
  ref_id: number
  khau: string
  so_luong: number
  trang_thai: 'cho_xu_ly' | 'ban_phe' | 'tan_dung' | 'da_xu_ly' | 'huy'
  ghi_chu: string | null
  so_lenh: string | null
  ten_hang: string | null
  ngay: string | null
  dvt: string | null
  ten_khach_hang: string | null
  ly_do_tra: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  created_at: string | null
  updated_at: string | null
}

const TINH_TRANG_LABELS: Record<string, string> = { hong: 'Hỏng', loi: 'Lỗi', tot: 'Tốt' }
const TINH_TRANG_COLORS: Record<string, string> = { hong: 'red', loi: 'orange', tot: 'green' }

function specsToText(r: Specs): string {
  const parts: string[] = []
  if (r.loai_thung) parts.push(r.loai_thung)
  if (r.so_lop) parts.push(`${r.so_lop} lớp`)
  if (r.quy_cach) parts.push(r.quy_cach)
  return parts.join(' · ')
}

function SpecsBlock({ r }: { r: Specs }) {
  const text = specsToText(r)
  return text
    ? <Text type="secondary" style={{ fontSize: 11 }}>{text}</Text>
    : <Text type="secondary">—</Text>
}

function DrawerLoi({ row, onClose }: { row: HangLoiRow | null; onClose: () => void }) {
  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      title={row ? <Space><WarningOutlined style={{ color: '#cf1322' }} />{row.ten_hang || row.so_phieu}</Space> : ''}
      width={520}
      destroyOnClose
    >
      {row && (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Descriptions title="Thông tin phiếu" size="small" bordered column={2}>
            <Descriptions.Item label="Số phiếu TP" span={2}>
              <Text code>{row.so_phieu}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày nhập">{fmtDate(row.ngay_nhap)}</Descriptions.Item>
            <Descriptions.Item label="Lệnh SX">
              {row.so_lenh ? <Text code>{row.so_lenh}</Text> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Đơn hàng">{row.so_don || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngày lệnh">{fmtDate(row.ngay_lenh)}</Descriptions.Item>
            <Descriptions.Item label="Khách hàng" span={2}>{row.ten_khach_hang || '—'}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ giao" span={2}>{row.dia_chi_giao || '—'}</Descriptions.Item>
            <Descriptions.Item label="NV theo dõi" span={2}>{row.ten_nv_theo_doi || '—'}</Descriptions.Item>
            <Descriptions.Item label="Xưởng">{row.ten_phan_xuong?.replace(/^Xưởng\s+/i, '') || '—'}</Descriptions.Item>
            <Descriptions.Item label="Pháp nhân">{row.ten_phap_nhan || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '4px 0' }} />

          <Descriptions title="Số lượng" size="small" bordered column={2}>
            <Descriptions.Item label="KH (thùng)">{fmtN(row.so_luong_ke_hoach)}</Descriptions.Item>
            <Descriptions.Item label="Đã nhập">{fmtN(row.so_luong_nhap)}</Descriptions.Item>
            <Descriptions.Item label="SL lỗi" span={2}>
              <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                {fmtN(row.so_luong_loi)} {row.dvt}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '4px 0' }} />

          <Descriptions title="Thông số kỹ thuật" size="small" bordered column={2}>
            <Descriptions.Item label="Tên hàng" span={2}>{row.ten_hang || '—'}</Descriptions.Item>
            <Descriptions.Item label="Loại thùng">{row.loai_thung || '—'}</Descriptions.Item>
            <Descriptions.Item label="Số lớp">{row.so_lop ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="D×R×C" span={2}>{row.quy_cach || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tổ hợp sóng">{row.to_hop_song || '—'}</Descriptions.Item>
            <Descriptions.Item label="Khổ TT">{row.kho_tt ? `${row.kho_tt} mm` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Dài TT">{row.dai_tt ? `${row.dai_tt} mm` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Loại in">{row.loai_in || '—'}</Descriptions.Item>
            <Descriptions.Item label="Số màu">{row.so_mau ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngày giao KH" span={2}>{fmtDate(row.ngay_giao_hang)}</Descriptions.Item>
          </Descriptions>

          {row.ghi_chu && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <Descriptions size="small" bordered>
                <Descriptions.Item label="Ghi chú" span={2}>{row.ghi_chu}</Descriptions.Item>
              </Descriptions>
            </>
          )}
        </Space>
      )}
    </Drawer>
  )
}

function DrawerTra({ row, onClose }: { row: HangTraVeRow | null; onClose: () => void }) {
  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      title={row ? <Space><WarningOutlined style={{ color: '#fa8c16' }} />{row.ten_hang || row.so_phieu_tra}</Space> : ''}
      width={520}
      destroyOnClose
    >
      {row && (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Descriptions title="Thông tin phiếu trả" size="small" bordered column={2}>
            <Descriptions.Item label="Số phiếu trả" span={2}>
              <Text code>{row.so_phieu_tra}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày trả">{fmtDate(row.ngay_tra)}</Descriptions.Item>
            <Descriptions.Item label="Lệnh SX">
              {row.so_lenh ? <Text code>{row.so_lenh}</Text> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng" span={2}>{row.ten_khach_hang || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tình trạng">
              <Tag color={TINH_TRANG_COLORS[row.tinh_trang_hang || ''] || 'default'}>
                {TINH_TRANG_LABELS[row.tinh_trang_hang || ''] || row.tinh_trang_hang}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="NV theo dõi">{row.ten_nv_theo_doi || '—'}</Descriptions.Item>
            <Descriptions.Item label="Xưởng">{row.ten_phan_xuong?.replace(/^Xưởng\s+/i, '') || '—'}</Descriptions.Item>
            <Descriptions.Item label="Pháp nhân">{row.ten_phap_nhan || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '4px 0' }} />

          <Descriptions title="Số lượng & giá trị" size="small" bordered column={2}>
            <Descriptions.Item label="SL trả" span={2}>
              <Text strong style={{ color: '#fa8c16', fontSize: 16 }}>
                {fmtN(row.so_luong_tra)} {row.dvt}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Đơn giá trả" span={2}>{fmtMoney(row.don_gia_tra)}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '4px 0' }} />

          <Descriptions title="Thông số kỹ thuật" size="small" bordered column={2}>
            <Descriptions.Item label="Tên hàng" span={2}>{row.ten_hang || '—'}</Descriptions.Item>
            <Descriptions.Item label="Loại thùng">{row.loai_thung || '—'}</Descriptions.Item>
            <Descriptions.Item label="Số lớp">{row.so_lop ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="D×R×C" span={2}>{row.quy_cach || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tổ hợp sóng">{row.to_hop_song || '—'}</Descriptions.Item>
            <Descriptions.Item label="Khổ TT">{row.kho_tt ? `${row.kho_tt} mm` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Dài TT">{row.dai_tt ? `${row.dai_tt} mm` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Loại in">{row.loai_in || '—'}</Descriptions.Item>
            <Descriptions.Item label="Số màu">{row.so_mau ?? '—'}</Descriptions.Item>
          </Descriptions>

          {(row.ly_do_tra || row.ghi_chu) && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <Descriptions size="small" bordered>
                {row.ly_do_tra && (
                  <Descriptions.Item label="Lý do trả" span={2}>{row.ly_do_tra}</Descriptions.Item>
                )}
                {row.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>{row.ghi_chu}</Descriptions.Item>
                )}
              </Descriptions>
            </>
          )}
        </Space>
      )}
    </Drawer>
  )
}

export default function KhoLoiPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canTransfer = hasPermission('inventory.transfer')

  const [filterPhapNhanId, setFilterPhapNhanId] = useState<number | undefined>()
  const [filterPhanXuongId, setFilterPhanXuongId] = useState<number | undefined>()
  const [selectedLoi, setSelectedLoi] = useState<HangLoiRow | null>(null)
  const [selectedTra, setSelectedTra] = useState<HangTraVeRow | null>(null)
  const [disposalModal, setDisposalModal] = useState<{ record: DefectRecordTraVeRow; queryKey: string } | null>(null)
  const [disposalTrangThai, setDisposalTrangThai] = useState<string>('ban_phe')
  const [disposalGhiChu, setDisposalGhiChu] = useState<string>('')
  const [disposalLoading, setDisposalLoading] = useState(false)

  const [activeTab, setActiveTab] = useState('loi')

  const [phoiDuShowAll, setPhoiDuShowAll] = useState(false)
  const [phoiDuXuLyModal, setPhoiDuXuLyModal] = useState<{ phieu: PhieuNhapPhoiSongListItem; excess: number } | null>(null)
  const [xuLyLoaiXuLy, setXuLyLoaiXuLy] = useState('da_nhap_kho_tan_dung')
  const [xuLyGhiChu, setXuLyGhiChu] = useState('')
  const [xuLyLoading, setXuLyLoading] = useState(false)

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: phapNhanList = [] } = useQuery<{ id: number; ten_viet_tat: string }[]>({
    queryKey: ['phap-nhan-list'],
    queryFn: () => client.get<{ id: number; ten_viet_tat: string }[]>('/phap-nhan').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const filterParams = { phap_nhan_id: filterPhapNhanId, phan_xuong_id: filterPhanXuongId }

  const { data: phoiDuPhieuList = [], isLoading: phoiDuLoading } = useQuery<PhieuNhapPhoiSongListItem[]>({
    queryKey: ['phoi-du-phieu', filterPhanXuongId],
    queryFn: () => productionOrdersApi.listAllPhieu({ phan_xuong_id: filterPhanXuongId }).then(r => r.data),
    staleTime: 0,
  })

  const allPhoiDuItems = useMemo(() => {
    return phoiDuPhieuList
      .map(phieu => {
        const slKh = phieu.items.reduce((s, it) => s + it.so_luong_ke_hoach, 0)
        const slTt = phieu.tong_so_luong_thuc_te
        return { phieu, slKh, slTt, excess: slTt - slKh }
      })
      .filter(r => r.excess > 0)
  }, [phoiDuPhieuList])

  const phoiDuItems = useMemo(
    () => phoiDuShowAll ? allPhoiDuItems : allPhoiDuItems.filter(r => !r.phieu.phoi_du_trang_thai),
    [allPhoiDuItems, phoiDuShowAll],
  )

  const phoiDuChuaXuLyCount = useMemo(
    () => allPhoiDuItems.filter(r => !r.phieu.phoi_du_trang_thai).length,
    [allPhoiDuItems],
  )

  const { data: khoAoTpData = [], isLoading: khoAoTpLoading } = useQuery<DefectRecordTraVeRow[]>({
    queryKey: ['defect-records-tp', filterParams],
    queryFn: () => client.get<DefectRecordTraVeRow[]>('/defect-records', { params: { khau: 'tp', ...filterParams } }).then(r => r.data),
    staleTime: 0,
  })

  const { data: khoAoPhoiData = [], isLoading: khoAoPhoiLoading } = useQuery<HangLoiPhoiRow[]>({
    queryKey: ['kho-ao-phoi', filterParams],
    queryFn: () => khoAoPhoiApi.list(filterParams).then(r => r.data),
    staleTime: 0,
  })

  const { data: khoAoTraVeData = [], isLoading: khoAoTraVeLoading } = useQuery<DefectRecordTraVeRow[]>({
    queryKey: ['defect-records-tra-ve', filterParams],
    queryFn: () => client.get<DefectRecordTraVeRow[]>('/defect-records', { params: { khau: 'tra_ve', ...filterParams } }).then(r => r.data),
    staleTime: 0,
  })

  const { data: tanDungRows = [], isLoading: tdLoading, refetch: tdRefetch } = useQuery<TonKho[]>({
    queryKey: ['tan-dung-ton-kho', filterPhanXuongId],
    queryFn: () => warehouseApi.getTonKho({ loai_kho: 'TAN_DUNG', phan_xuong_id: filterPhanXuongId }).then(r => r.data),
    enabled: activeTab === 'tan-dung',
    staleTime: 0,
  })

  const { data, isLoading, refetch } = useQuery<KhoLoiData>({
    queryKey: ['kho-loi-tra-ve', filterParams],
    queryFn: () => client.get<KhoLoiData>('/warehouse/kho-loi-tra-ve', { params: filterParams }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const hangLoi: HangLoiRow[] = data?.hang_loi ?? []
  const hangTraVe: HangTraVeRow[] = data?.hang_tra_ve ?? []
  const totalLoi = hangLoi.reduce((s, r) => s + r.so_luong_loi, 0)
  const totalTra = hangTraVe.reduce((s, r) => s + r.so_luong_tra, 0)
  const tpChorXuLyCount = khoAoTpData.filter(r => r.trang_thai === 'cho_xu_ly').length

  const handleExportLoi = () => {
    if (hangLoi.length === 0) {
      message.warning('Không có dữ liệu hàng lỗi để xuất')
      return
    }
    // Làm phẳng dữ liệu: ngày về dạng dd/mm/yyyy, gộp thông số kỹ thuật thành 1 cột.
    const rows = hangLoi.map(r => ({
      so_phieu: r.so_phieu,
      so_lenh: r.so_lenh ?? '',
      ten_hang: r.ten_hang ?? '',
      quy_cach: specsToText(r),
      ten_khach_hang: r.ten_khach_hang ?? '',
      ten_phan_xuong: r.ten_phan_xuong?.replace(/^Xưởng\s+/i, '') ?? '',
      ten_phap_nhan: r.ten_phap_nhan ?? '',
      ngay_nhap: fmtDate(r.ngay_nhap),
      so_luong_nhap: r.so_luong_nhap,
      so_luong_loi: r.so_luong_loi,
      dvt: r.dvt,
      ghi_chu: r.ghi_chu ?? '',
    }))
    exportExcelWithTemplate(
      `HangLoi_${new Date().toISOString().slice(0, 10)}`,
      'Hàng lỗi',
      rows,
      [
        { key: 'so_phieu', label: 'Số phiếu TP', width: 18 },
        { key: 'so_lenh', label: 'Lệnh SX', width: 16 },
        { key: 'ten_hang', label: 'Tên hàng', width: 30 },
        { key: 'quy_cach', label: 'Quy cách', width: 24 },
        { key: 'ten_khach_hang', label: 'Khách hàng', width: 22 },
        { key: 'ten_phan_xuong', label: 'Xưởng', width: 14 },
        { key: 'ten_phap_nhan', label: 'Pháp nhân', width: 14 },
        { key: 'ngay_nhap', label: 'Ngày nhập', width: 12 },
        { key: 'so_luong_nhap', label: 'SL nhập', width: 10 },
        { key: 'so_luong_loi', label: 'SL lỗi', width: 10 },
        { key: 'dvt', label: 'ĐVT', width: 8 },
        { key: 'ghi_chu', label: 'Ghi chú', width: 28 },
      ],
    )
  }

  const handleExportTra = () => {
    if (hangTraVe.length === 0) {
      message.warning('Không có dữ liệu hàng trả về để xuất')
      return
    }
    const rows = hangTraVe.map(r => ({
      so_phieu_tra: r.so_phieu_tra ?? '',
      so_lenh: r.so_lenh ?? '',
      ten_hang: r.ten_hang ?? '',
      quy_cach: specsToText(r),
      ten_khach_hang: r.ten_khach_hang ?? '',
      tinh_trang_hang: TINH_TRANG_LABELS[r.tinh_trang_hang ?? ''] ?? (r.tinh_trang_hang ?? ''),
      ly_do_tra: r.ly_do_tra ?? '',
      ten_phan_xuong: r.ten_phan_xuong?.replace(/^Xưởng\s+/i, '') ?? '',
      ten_phap_nhan: r.ten_phap_nhan ?? '',
      ngay_tra: fmtDate(r.ngay_tra),
      so_luong_tra: r.so_luong_tra,
      don_gia_tra: r.don_gia_tra,
      dvt: r.dvt,
      ghi_chu: r.ghi_chu ?? '',
    }))
    exportExcelWithTemplate(
      `HangTraVe_${new Date().toISOString().slice(0, 10)}`,
      'Hàng trả về',
      rows,
      [
        { key: 'so_phieu_tra', label: 'Số phiếu trả', width: 18 },
        { key: 'so_lenh', label: 'Lệnh SX', width: 16 },
        { key: 'ten_hang', label: 'Tên hàng', width: 30 },
        { key: 'quy_cach', label: 'Quy cách', width: 24 },
        { key: 'ten_khach_hang', label: 'Khách hàng', width: 22 },
        { key: 'tinh_trang_hang', label: 'Tình trạng', width: 12 },
        { key: 'ly_do_tra', label: 'Lý do trả', width: 28 },
        { key: 'ten_phan_xuong', label: 'Xưởng', width: 14 },
        { key: 'ten_phap_nhan', label: 'Pháp nhân', width: 14 },
        { key: 'ngay_tra', label: 'Ngày trả', width: 12 },
        { key: 'so_luong_tra', label: 'SL trả', width: 10 },
        { key: 'don_gia_tra', label: 'Đơn giá trả', width: 14 },
        { key: 'dvt', label: 'ĐVT', width: 8 },
        { key: 'ghi_chu', label: 'Ghi chú', width: 28 },
      ],
    )
  }

  const colsLoi: ColumnsType<HangLoiRow> = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string | null, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v || '—'}</Text>
          <SpecsBlock r={r} />
        </Space>
      ),
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 130,
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 100,
      render: (v: string | null) => v
        ? <Tag style={{ fontSize: 11 }}>{v.replace(/^Xưởng\s+/i, '')}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 90,
      render: (v: string | null) => v ? <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ngày nhập',
      dataIndex: 'ngay_nhap',
      width: 95,
      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: 'Nhập (thùng)',
      dataIndex: 'so_luong_nhap',
      width: 100,
      align: 'right' as const,
      render: (v: number) => fmtN(v),
    },
    {
      title: 'SL lỗi',
      dataIndex: 'so_luong_loi',
      width: 90,
      align: 'right' as const,
      sorter: (a, b) => a.so_luong_loi - b.so_luong_loi,
      render: (v: number, r) => (
        <Text strong style={{ color: '#cf1322' }}>{fmtN(v)} {r.dvt}</Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai_loi',
      width: 130,
      render: (v: string | null) => {
        if (!v) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        if (v === 'cho_xu_ly') return <Tag color="red" style={{ fontSize: 11 }}>Chưa xử lý</Tag>
        if (v === 'da_nhap_kho_ao') return <Tag color="green" style={{ fontSize: 11 }}>Đã vào kho tận dụng</Tag>
        return <Tag style={{ fontSize: 11 }}>{v}</Tag>
      },
    },
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('production-kho-loi', colsLoi)

  const colsTra: ColumnsType<HangTraVeRow> = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string | null, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v || '—'}</Text>
          <SpecsBlock r={r} />
        </Space>
      ),
    },
    {
      title: 'Số phiếu trả',
      dataIndex: 'so_phieu_tra',
      width: 140,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 130,
      ellipsis: true,
      render: (v: string | null) => v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tình trạng',
      dataIndex: 'tinh_trang_hang',
      width: 95,
      render: (v: string | null) => v
        ? <Tag color={TINH_TRANG_COLORS[v] || 'default'}>{TINH_TRANG_LABELS[v] || v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 100,
      render: (v: string | null) => v
        ? <Tag style={{ fontSize: 11 }}>{v.replace(/^Xưởng\s+/i, '')}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 90,
      render: (v: string | null) => v ? <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ngày trả',
      dataIndex: 'ngay_tra',
      width: 95,
      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: 'SL trả',
      dataIndex: 'so_luong_tra',
      width: 90,
      align: 'right' as const,
      sorter: (a, b) => a.so_luong_tra - b.so_luong_tra,
      render: (v: number, r) => (
        <Text strong style={{ color: '#fa8c16' }}>{fmtN(v)} {r.dvt}</Text>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <WarningOutlined style={{ fontSize: 20, color: '#cf1322' }} />
            <Title level={4} style={{ margin: 0 }}>Kho tận dụng — Hàng lỗi & Trả về</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Select
              size="small" style={{ width: 140 }} placeholder="Pháp nhân" allowClear
              value={filterPhapNhanId} onChange={v => setFilterPhapNhanId(v)}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat }))}
            />
            <Select
              size="small" style={{ width: 150 }} placeholder="Xưởng" allowClear
              value={filterPhanXuongId} onChange={v => setFilterPhanXuongId(v)}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong.replace(/^Xưởng\s+/i, '') }))}
            />
            <ReloadOutlined
              style={{ cursor: 'pointer', color: '#1677ff' }}
              onClick={() => refetch()}
            />
          </Space>
        </Col>
      </Row>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Statistic title="Phiếu lỗi" value={hangLoi.length} valueStyle={{ fontSize: 18, color: '#cf1322' }} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="Tổng SL lỗi (thùng)" value={totalLoi} formatter={v => fmtN(Number(v))} valueStyle={{ fontSize: 18, color: '#cf1322' }} />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic
            title={<Badge count={tpChorXuLyCount} offset={[6, 0]}><span>TP chờ xử lý</span></Badge>}
            value={tpChorXuLyCount}
            valueStyle={{ fontSize: 18, color: tpChorXuLyCount > 0 ? '#cf1322' : '#8c8c8c' }}
          />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic title="Phiếu trả xấu" value={hangTraVe.length} valueStyle={{ fontSize: 18, color: '#fa8c16' }} />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic title="Tổng SL trả (thùng)" value={totalTra} formatter={v => fmtN(Number(v))} valueStyle={{ fontSize: 18, color: '#fa8c16' }} />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic
            title={<Badge count={khoAoPhoiData.filter(r => r.trang_thai === 'cho_xu_ly').length} offset={[6, 0]}><span>Phôi lỗi chờ XL</span></Badge>}
            value={khoAoPhoiData.length}
            valueStyle={{ fontSize: 18, color: '#722ed1' }}
          />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic
            title={<Badge count={phoiDuChuaXuLyCount} offset={[6, 0]}><span>Phôi dư chờ XL</span></Badge>}
            value={allPhoiDuItems.length}
            valueStyle={{ fontSize: 18, color: '#52c41a' }}
          />
        </Col>
        <Col xs={12} sm={4}>
          <Statistic
            title="Tồn kho TAN_DUNG"
            value={tanDungRows.reduce((s, r) => s + r.ton_luong, 0)}
            formatter={v => fmtN(Number(v))}
            valueStyle={{ fontSize: 18, color: '#13c2c2' }}
          />
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key)}
        items={[
          {
            key: 'loi',
            label: `⚠️ Hàng lỗi (${hangLoi.length})`,
            children: (
              <>
              <Row justify="end" style={{ marginBottom: 8 }}>
                <Space>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    disabled={hangLoi.length === 0}
                    onClick={handleExportLoi}
                  >
                    Xuất Excel
                  </Button>
                  {settingsButton}
                </Space>
              </Row>
              <Table<HangLoiRow>
                rowKey="id"
                size="small"
                loading={isLoading}
                dataSource={hangLoi}
                columns={displayColumns}
                onRow={r => ({ onClick: () => setSelectedLoi(r), style: { cursor: 'pointer' } })}
                rowClassName={() => 'hoverable-row'}
                pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                scroll={{ x: 900 }}
                summary={() => hangLoi.length > 0 ? (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6}>
                      <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      <Text strong>{fmtN(hangLoi.reduce((s, r) => s + r.so_luong_nhap, 0))}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <Text strong style={{ color: '#cf1322' }}>{fmtN(totalLoi)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null}
              />

              {/* Kho ảo TP — hàng lỗi chờ xử lý */}
              {(khoAoTpData.length > 0 || khoAoTpLoading) && (
                <>
                <Divider style={{ margin: '16px 0 8px' }} />
                <Row align="middle" style={{ marginBottom: 8 }}>
                  <Col flex="auto">
                    <Text strong style={{ color: '#cf1322' }}>
                      Kho tận dụng — TP lỗi chờ xử lý ({khoAoTpData.length})
                    </Text>
                  </Col>
                </Row>
                <Table<DefectRecordTraVeRow>
                  rowKey="id"
                  size="small"
                  loading={khoAoTpLoading}
                  dataSource={khoAoTpData}
                  pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                  scroll={{ x: 860 }}
                  columns={[
                    {
                      title: 'Tên hàng',
                      dataIndex: 'ten_hang',
                      ellipsis: true,
                      render: (v: string | null) => v ? <Text strong style={{ fontSize: 13 }}>{v}</Text> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Lệnh SX',
                      dataIndex: 'so_lenh',
                      width: 130,
                      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Xưởng',
                      dataIndex: 'ten_phan_xuong',
                      width: 100,
                      render: (v: string | null) => v ? <Tag style={{ fontSize: 11 }}>{v.replace(/^Xưởng\s+/i, '')}</Tag> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Ngày',
                      dataIndex: 'ngay',
                      width: 95,
                      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
                    },
                    {
                      title: 'SL lỗi',
                      dataIndex: 'so_luong',
                      width: 90,
                      align: 'right' as const,
                      render: (v: number, r) => <Text strong style={{ color: '#cf1322' }}>{fmtN(v)} {r.dvt ?? 'Thùng'}</Text>,
                    },
                    {
                      title: 'Trạng thái',
                      dataIndex: 'trang_thai',
                      width: 130,
                      render: (v: string) => {
                        const map: Record<string, [string, string]> = {
                          cho_xu_ly: ['Chờ xử lý', 'red'],
                          ban_phe: ['Bán phế phẩm', 'orange'],
                          tan_dung: ['Tận dụng', 'blue'],
                          da_xu_ly: ['Đã xử lý', 'green'],
                          huy: ['Huỷ', 'default'],
                        }
                        const [label, color] = map[v] ?? [v, 'default']
                        return <Tag color={color} style={{ fontSize: 11 }}>{label}</Tag>
                      },
                    },
                    {
                      title: 'Thao tác',
                      width: 160,
                      render: (_: unknown, r: DefectRecordTraVeRow) => {
                        if (r.trang_thai !== 'cho_xu_ly') return null
                        return (
                          <Space size={4}>
                            <Tooltip title="Đánh dấu bán phế phẩm">
                              <Button
                                size="small"
                                danger
                                disabled={!canTransfer}
                                onClick={e => {
                                  e.stopPropagation()
                                  client.patch(`/defect-records/${r.id}/trang-thai`, { trang_thai: 'ban_phe' })
                                    .then(() => { message.success('Đã cập nhật'); queryClient.invalidateQueries({ queryKey: ['defect-records-tp'] }) })
                                    .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi cập nhật')))
                                }}
                              >Bán phế</Button>
                            </Tooltip>
                            <Tooltip title="Tận dụng vào sản phẩm khác">
                              <Button
                                size="small"
                                disabled={!canTransfer}
                                onClick={e => {
                                  e.stopPropagation()
                                  client.patch(`/defect-records/${r.id}/trang-thai`, { trang_thai: 'tan_dung' })
                                    .then(() => { message.success('Đã cập nhật'); queryClient.invalidateQueries({ queryKey: ['defect-records-tp'] }) })
                                    .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi cập nhật')))
                                }}
                              >Tận dụng</Button>
                            </Tooltip>
                          </Space>
                        )
                      },
                    },
                  ] as ColumnsType<DefectRecordTraVeRow>}
                />
                </>
              )}
              </>
            ),
          },
          {
            key: 'tra',
            label: `↩️ Hàng trả về xấu (${hangTraVe.length})`,
            children: (() => {
              const khoAoRefIds = new Set(khoAoTraVeData.map(r => r.ref_id))
              return (
              <>
              <Row justify="end" style={{ marginBottom: 8 }}>
                <Space>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    disabled={hangTraVe.length === 0}
                    onClick={handleExportTra}
                  >
                    Xuất Excel (danh sách)
                  </Button>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    disabled={khoAoTraVeData.length === 0}
                    onClick={() => {
                      const url = `${client.defaults.baseURL ?? '/api'}/defect-records/export?khau=tra_ve`
                      window.open(url, '_blank')
                    }}
                  >
                    Xuất Excel (kho tận dụng)
                  </Button>
                </Space>
              </Row>
              <Table<HangTraVeRow>
                rowKey="id"
                size="small"
                loading={isLoading}
                dataSource={hangTraVe}
                columns={[
                  ...colsTra,
                  {
                    title: 'Thao tác',
                    width: 120,
                    render: (_: unknown, r: HangTraVeRow) => {
                      if (khoAoRefIds.has(r.id)) return <Tag color="green" style={{ fontSize: 11 }}>Đã vào kho tận dụng</Tag>
                      if (r.tinh_trang_hang !== 'hong' && r.tinh_trang_hang !== 'loi') return null
                      return (
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          disabled={!canTransfer}
                          onClick={e => {
                            e.stopPropagation()
                            client.post('/defect-records/nhap', { ref_type: 'sales_return_item', ref_id: r.id })
                              .then(() => {
                                message.success('Đã nhập kho tận dụng')
                                queryClient.invalidateQueries({ queryKey: ['defect-records-tra-ve'] })
                                queryClient.invalidateQueries({ queryKey: ['kho-loi-tra-ve'] })
                              })
                              .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi nhập kho tận dụng')))
                          }}
                        >Nhập kho tận dụng</Button>
                      )
                    },
                  } as ColumnsType<HangTraVeRow>[number],
                ]}
                onRow={r => ({ onClick: () => setSelectedTra(r), style: { cursor: 'pointer' } })}
                rowClassName={() => 'hoverable-row'}
                pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                scroll={{ x: 900 }}
                summary={() => hangTraVe.length > 0 ? (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={7}>
                      <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <Text strong style={{ color: '#fa8c16' }}>{fmtN(totalTra)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null}
              />

              {/* Hàng trả về lỗi/hỏng trong kho ảo */}
              {(khoAoTraVeData.length > 0 || khoAoTraVeLoading) && (
                <>
                <Divider style={{ margin: '16px 0 8px' }} />
                <Row align="middle" style={{ marginBottom: 8 }}>
                  <Col flex="auto">
                    <Text strong style={{ color: '#cf1322' }}>
                      Kho tận dụng — Hàng trả lỗi/hỏng chờ xử lý ({khoAoTraVeData.length})
                    </Text>
                  </Col>
                </Row>
                <Table<DefectRecordTraVeRow>
                  rowKey="id"
                  size="small"
                  loading={khoAoTraVeLoading}
                  dataSource={khoAoTraVeData}
                  pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                  scroll={{ x: 860 }}
                  columns={[
                    {
                      title: 'Tên hàng',
                      dataIndex: 'ten_hang',
                      ellipsis: true,
                      render: (v: string | null) => v ? <Text strong style={{ fontSize: 13 }}>{v}</Text> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Số phiếu trả',
                      dataIndex: 'so_lenh',
                      width: 140,
                      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Khách hàng',
                      dataIndex: 'ten_khach_hang',
                      width: 130,
                      ellipsis: true,
                      render: (v: string | null) => v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Lý do trả',
                      dataIndex: 'ly_do_tra',
                      width: 160,
                      ellipsis: true,
                      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Ngày trả',
                      dataIndex: 'ngay',
                      width: 95,
                      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
                    },
                    {
                      title: 'SL',
                      dataIndex: 'so_luong',
                      width: 85,
                      align: 'right' as const,
                      render: (v: number, r) => <Text strong style={{ color: '#cf1322' }}>{fmtN(v)} {r.dvt ?? 'Thùng'}</Text>,
                    },
                    {
                      title: 'Trạng thái',
                      dataIndex: 'trang_thai',
                      width: 130,
                      render: (v: string) => {
                        const map: Record<string, [string, string]> = {
                          cho_xu_ly: ['Chờ xử lý', 'red'],
                          ban_phe: ['Bán phế phẩm', 'orange'],
                          tan_dung: ['Tận dụng', 'blue'],
                          da_xu_ly: ['Đã xử lý', 'green'],
                          huy: ['Huỷ', 'default'],
                        }
                        const [label, color] = map[v] ?? [v, 'default']
                        return <Tag color={color} style={{ fontSize: 11 }}>{label}</Tag>
                      },
                    },
                    {
                      title: 'Thao tác',
                      width: 150,
                      render: (_: unknown, r: DefectRecordTraVeRow) => (
                        <Space size={4}>
                          {r.trang_thai === 'cho_xu_ly' && (
                            <Button
                              size="small"
                              type="primary"
                              disabled={!canTransfer}
                              onClick={e => {
                                e.stopPropagation()
                                setDisposalTrangThai('ban_phe')
                                setDisposalGhiChu(r.ghi_chu ?? '')
                                setDisposalModal({ record: r, queryKey: 'defect-records-tra-ve' })
                              }}
                            >Xử lý</Button>
                          )}
                          <Tooltip title="In phiếu xử lý">
                            <Button
                              size="small"
                              icon={<PrinterOutlined />}
                              onClick={e => {
                                e.stopPropagation()
                                window.open(`/api/defect-records/${r.id}/print`, '_blank')
                              }}
                            />
                          </Tooltip>
                        </Space>
                      ),
                    },
                  ] as ColumnsType<DefectRecordTraVeRow>}
                />
                </>
              )}
              </>
              )
            })(),
          },
          {
            key: 'phoi-du',
            label: `📦 Phôi dư (${phoiDuItems.length})`,
            children: (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Col>
                    <Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>Hiện đã xử lý:</Text>
                      <Switch size="small" checked={phoiDuShowAll} onChange={v => setPhoiDuShowAll(v)} />
                    </Space>
                  </Col>
                </Row>
                <Table<{ phieu: PhieuNhapPhoiSongListItem; slKh: number; slTt: number; excess: number }>
                  rowKey={r => r.phieu.id}
                  size="small"
                  loading={phoiDuLoading}
                  dataSource={phoiDuItems}
                  pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                  scroll={{ x: 900 }}
                  columns={[
                    {
                      title: 'Ngày / Ca',
                      width: 100,
                      render: (_, r) => (
                        <Space direction="vertical" size={0}>
                          <Text style={{ fontSize: 12 }}>{fmtDate(r.phieu.ngay)}</Text>
                          {r.phieu.ca && <Text type="secondary" style={{ fontSize: 11 }}>Ca {r.phieu.ca}</Text>}
                        </Space>
                      ),
                    },
                    {
                      title: 'Số lệnh',
                      width: 130,
                      render: (_, r) => r.phieu.so_lenh
                        ? <Text code style={{ fontSize: 12 }}>{r.phieu.so_lenh}</Text>
                        : <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Tên hàng',
                      ellipsis: true,
                      render: (_, r) => {
                        const first = r.phieu.items[0]
                        return (
                          <Space direction="vertical" size={0}>
                            <Text strong style={{ fontSize: 13 }}>{first?.ten_hang || '—'}</Text>
                            {first?.chieu_kho && first.chieu_cat && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {first.chieu_kho} × {first.chieu_cat}
                              </Text>
                            )}
                          </Space>
                        )
                      },
                    },
                    {
                      title: 'KH',
                      width: 75,
                      align: 'right' as const,
                      render: (_, r) => fmtN(r.slKh),
                    },
                    {
                      title: 'Thực tế',
                      width: 80,
                      align: 'right' as const,
                      render: (_, r) => fmtN(r.slTt),
                    },
                    {
                      title: 'Phôi dư',
                      width: 85,
                      align: 'right' as const,
                      sorter: (a, b) => a.excess - b.excess,
                      render: (_, r) => <Text strong style={{ color: '#52c41a' }}>{fmtN(r.excess)}</Text>,
                    },
                    {
                      title: 'Trạng thái',
                      width: 150,
                      render: (_, r) => {
                        const v = r.phieu.phoi_du_trang_thai
                        if (!v) return <Tag color="orange" style={{ fontSize: 11 }}>Chưa xử lý</Tag>
                        const map: Record<string, [string, string]> = {
                          da_nhap_kho_tan_dung: ['Nhập kho TDụng', 'cyan'],
                          giao_sx: ['Giao SX', 'blue'],
                          giao_khach: ['Giao khách', 'green'],
                          huy: ['Huỷ', 'default'],
                        }
                        const [label, color] = map[v] ?? [v, 'default']
                        return <Tag color={color} style={{ fontSize: 11 }}>{label}</Tag>
                      },
                    },
                    {
                      title: 'Thao tác',
                      width: 80,
                      render: (_, r) => {
                        if (r.phieu.phoi_du_trang_thai) return null
                        return (
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            disabled={!canTransfer}
                            onClick={e => {
                              e.stopPropagation()
                              setPhoiDuXuLyModal({ phieu: r.phieu, excess: r.excess })
                              setXuLyLoaiXuLy('da_nhap_kho_tan_dung')
                              setXuLyGhiChu('')
                            }}
                          >Xử lý</Button>
                        )
                      },
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'tan-dung',
            label: `🏭 Kho TAN_DUNG (${tanDungRows.length})`,
            children: (
              <>
                <Row justify="end" style={{ marginBottom: 8 }}>
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => tdRefetch()}>Làm mới</Button>
                </Row>
                <Table<TonKho>
                  rowKey="id"
                  size="small"
                  loading={tdLoading}
                  dataSource={tanDungRows}
                  pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                  scroll={{ x: 700 }}
                  columns={[
                    {
                      title: 'Xưởng',
                      dataIndex: 'ten_phan_xuong',
                      width: 140,
                      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
                    },
                    {
                      title: 'Kho',
                      dataIndex: 'ten_kho',
                      width: 200,
                      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
                    },
                    {
                      title: 'Kích thước (Khổ × Cắt)',
                      dataIndex: 'ten_hang',
                      render: (v: string) => <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</Text>,
                    },
                    {
                      title: 'Tồn kho',
                      dataIndex: 'ton_luong',
                      width: 110,
                      align: 'right' as const,
                      sorter: (a: TonKho, b: TonKho) => a.ton_luong - b.ton_luong,
                      render: (v: number, r: TonKho) => (
                        <Space direction="vertical" size={0} style={{ lineHeight: 1.3 }}>
                          <Text strong style={{ color: v > 0 ? '#389e0d' : '#cf1322', fontSize: 13 }}>{fmtN(v)}</Text>
                          <Text type="secondary" style={{ fontSize: 10 }}>{r.don_vi}</Text>
                        </Space>
                      ),
                    },
                    {
                      title: 'Cập nhật',
                      dataIndex: 'cap_nhat_luc',
                      width: 120,
                      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
                    },
                  ]}
                  summary={() => tanDungRows.length > 0 ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <Text strong style={{ fontSize: 12 }}>Tổng: {tanDungRows.length} loại phôi</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ color: '#389e0d' }}>
                          {fmtN(tanDungRows.reduce((s, r) => s + r.ton_luong, 0))} tấm
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} />
                    </Table.Summary.Row>
                  ) : null}
                />
              </>
            ),
          },
          {
            key: 'phoi-loi',
            label: `🟣 Phôi lỗi (${khoAoPhoiData.length})`,
            children: (
              <Table<HangLoiPhoiRow>
                rowKey="id"
                size="small"
                loading={khoAoPhoiLoading}
                dataSource={khoAoPhoiData}
                pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} dòng` }}
                scroll={{ x: 900 }}
                columns={[
                  {
                    title: 'Tên hàng',
                    dataIndex: 'ten_hang',
                    ellipsis: true,
                    render: (v: string | null, r) => (
                      <Space direction="vertical" size={0}>
                        <Text strong style={{ fontSize: 13 }}>{v || '—'}</Text>
                        {r.ca && <Text type="secondary" style={{ fontSize: 11 }}>Ca {r.ca} · {fmtDate(r.ngay)}</Text>}
                      </Space>
                    ),
                  },
                  {
                    title: 'Lệnh SX',
                    dataIndex: 'so_lenh',
                    width: 130,
                    render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Xưởng',
                    dataIndex: 'ten_phan_xuong',
                    width: 100,
                    render: (v: string | null) => v ? <Tag style={{ fontSize: 11 }}>{v.replace(/^Xưởng\s+/i, '')}</Tag> : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Pháp nhân',
                    dataIndex: 'ten_phap_nhan',
                    width: 90,
                    render: (v: string | null) => v ? <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'SL phôi lỗi',
                    dataIndex: 'so_luong',
                    width: 100,
                    align: 'right' as const,
                    render: (v: number) => <Text strong style={{ color: '#722ed1' }}>{fmtN(v)} tấm</Text>,
                  },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'trang_thai',
                    width: 130,
                    render: (v: string) => {
                      const map: Record<string, [string, string]> = {
                        cho_xu_ly: ['Chờ xử lý', 'purple'],
                        ban_phe: ['Bán phế phẩm', 'orange'],
                        tan_dung: ['Tận dụng SP khác', 'blue'],
                        da_xu_ly: ['Đã xử lý', 'green'],
                        huy: ['Huỷ', 'default'],
                      }
                      const [label, color] = map[v] ?? [v, 'default']
                      return <Tag color={color} style={{ fontSize: 11 }}>{label}</Tag>
                    },
                  },
                  {
                    title: 'LSX tận dụng',
                    dataIndex: 'so_lenh_tan_dung',
                    width: 120,
                    render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Thao tác',
                    width: 160,
                    render: (_: unknown, r: HangLoiPhoiRow) => {
                      if (r.trang_thai !== 'cho_xu_ly') return null
                      return (
                        <Space size={4}>
                          <Tooltip title="Đánh dấu bán phế phẩm">
                            <Button
                              size="small"
                              danger
                              disabled={!canTransfer}
                              onClick={e => {
                                e.stopPropagation()
                                khoAoPhoiApi.updateTrangThai(r.id, { trang_thai: 'ban_phe' })
                                  .then(() => { message.success('Đã cập nhật'); queryClient.invalidateQueries({ queryKey: ['kho-ao-phoi'] }) })
                                  .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi cập nhật')))
                              }}
                            >Bán phế</Button>
                          </Tooltip>
                          <Tooltip title="Tận dụng vào sản phẩm khác">
                            <Button
                              size="small"
                              disabled={!canTransfer}
                              onClick={e => {
                                e.stopPropagation()
                                khoAoPhoiApi.updateTrangThai(r.id, { trang_thai: 'tan_dung' })
                                  .then(() => { message.success('Đã cập nhật'); queryClient.invalidateQueries({ queryKey: ['kho-ao-phoi'] }) })
                                  .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi cập nhật')))
                              }}
                            >Tận dụng</Button>
                          </Tooltip>
                        </Space>
                      )
                    },
                  },
                ] as ColumnsType<HangLoiPhoiRow>}
              />
            ),
          },
        ]}
      />

      <DrawerLoi row={selectedLoi} onClose={() => setSelectedLoi(null)} />
      <DrawerTra row={selectedTra} onClose={() => setSelectedTra(null)} />

      <Modal
        open={!!phoiDuXuLyModal}
        title="Xử lý phôi dư"
        okText="Xác nhận"
        cancelText="Huỷ"
        confirmLoading={xuLyLoading}
        onCancel={() => setPhoiDuXuLyModal(null)}
        onOk={() => {
          if (!phoiDuXuLyModal) return
          if (!xuLyGhiChu.trim()) { message.warning('Vui lòng nhập ghi chú'); return }
          setXuLyLoading(true)
          productionOrdersApi.nhapPhoiDuKho(phoiDuXuLyModal.phieu.id, {
            so_luong_du: phoiDuXuLyModal.excess,
            loai_xu_ly: xuLyLoaiXuLy,
            ghi_chu: xuLyGhiChu,
          })
            .then(() => {
              message.success('Đã xử lý phôi dư')
              queryClient.invalidateQueries({ queryKey: ['phoi-du-phieu'] })
              queryClient.invalidateQueries({ queryKey: ['tan-dung-ton-kho'] })
              setPhoiDuXuLyModal(null)
              if (xuLyLoaiXuLy === 'da_nhap_kho_tan_dung') {
                setActiveTab('tan-dung')
              }
            })
            .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi xử lý')))
            .finally(() => setXuLyLoading(false))
        }}
      >
        {phoiDuXuLyModal && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <Text strong>{phoiDuXuLyModal.phieu.items[0]?.ten_hang || '—'}</Text>
              {phoiDuXuLyModal.phieu.so_lenh && (
                <Text type="secondary" style={{ marginLeft: 8 }}>({phoiDuXuLyModal.phieu.so_lenh})</Text>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Phôi dư: <Text strong style={{ color: '#52c41a' }}>{fmtN(phoiDuXuLyModal.excess)} tấm</Text>
              </Text>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Hướng xử lý:</Text>
              <Radio.Group value={xuLyLoaiXuLy} onChange={e => setXuLyLoaiXuLy(e.target.value)}>
                <Space direction="vertical">
                  <Radio value="da_nhap_kho_tan_dung">Nhập kho tận dụng</Radio>
                  <Radio value="giao_sx">Giao SX (sử dụng luôn)</Radio>
                  <Radio value="giao_khach">Giao khách</Radio>
                  <Radio value="huy">Huỷ bỏ</Radio>
                </Space>
              </Radio.Group>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                Ghi chú: <Text type="danger">*</Text>
              </Text>
              <Input.TextArea
                rows={2}
                value={xuLyGhiChu}
                onChange={e => setXuLyGhiChu(e.target.value)}
                placeholder="Bắt buộc nhập ghi chú"
              />
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        open={!!disposalModal}
        title="Xử lý hàng trả về lỗi/hỏng"
        okText="Xác nhận"
        cancelText="Huỷ"
        confirmLoading={disposalLoading}
        onCancel={() => setDisposalModal(null)}
        onOk={() => {
          if (!disposalModal) return
          setDisposalLoading(true)
          client.patch(`/defect-records/${disposalModal.record.id}/trang-thai`, {
            trang_thai: disposalTrangThai,
            ghi_chu: disposalGhiChu || undefined,
          })
            .then(() => {
              message.success('Đã cập nhật trạng thái')
              queryClient.invalidateQueries({ queryKey: [disposalModal.queryKey] })
              setDisposalModal(null)
            })
            .catch((err: unknown) => message.error(getErrorMessage(err, 'Lỗi cập nhật')))
            .finally(() => setDisposalLoading(false))
        }}
      >
        {disposalModal && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <Text strong>{disposalModal.record.ten_hang || '—'}</Text>
              {disposalModal.record.ten_khach_hang && (
                <Text type="secondary" style={{ marginLeft: 8 }}>({disposalModal.record.ten_khach_hang})</Text>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                SL: {fmtN(disposalModal.record.so_luong)} {disposalModal.record.dvt ?? 'Thùng'}
              </Text>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Hướng xử lý:</Text>
              <Radio.Group value={disposalTrangThai} onChange={e => setDisposalTrangThai(e.target.value)}>
                <Space direction="vertical">
                  <Radio value="ban_phe">Bán phế phẩm</Radio>
                  <Radio value="tan_dung">Tận dụng (sản phẩm khác)</Radio>
                  <Radio value="huy">Huỷ</Radio>
                  <Radio value="da_xu_ly">Đã xử lý (khác)</Radio>
                </Space>
              </Radio.Group>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Ghi chú:</Text>
              <Input.TextArea
                rows={2}
                value={disposalGhiChu}
                onChange={e => setDisposalGhiChu(e.target.value)}
                placeholder="Mô tả thêm (tuỳ chọn)"
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}
