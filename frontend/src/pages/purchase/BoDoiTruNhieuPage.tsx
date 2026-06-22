import { useState, useEffect } from 'react'
import {
  Button, Card, DatePicker, message, Select, Space,
  Table, Tag, Tooltip, Typography, Popconfirm,
} from 'antd'
import { DownloadOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { usePermission } from '../../hooks/usePermission'
import { exportToExcel } from '../../utils/excelUtils'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const API = ''

type PreviewRow = {
  supplier_id: number
  ten_ncc: string
  so_bao: number
  tong_tien: number
  items: { ma_doi_tru: string; ngay_doi_tru: string | null; tong_tien: number }[]
}

const fmt = (v: number) => v.toLocaleString('vi-VN')

export default function BoDoiTruNhieuPage() {
  const { isAdmin } = usePermission()
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([])
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phapNhanList, setPhapNhanList] = useState<{ id: number; ten_viet_tat: string; ten_phap_nhan: string }[]>([])
  const [tuNgay, setTuNgay] = useState(dayjs().startOf('month'))
  const [denNgay, setDenNgay] = useState(dayjs())
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [huyResult, setHuyResult] = useState<any[] | null>(null)

  useEffect(() => {
    client.get(`${API}/phap-nhan`).then(r => setPhapNhanList(r.data)).catch(() => {})
  }, [])

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: () => client.get(`${API}/suppliers?limit=500`).then(r => r.data.items ?? r.data),
  })

  const previewMut = useMutation({
    mutationFn: (body: object) => client.post(`${API}/doi-tru/nhieu-doi-tuong/preview-huy`, body),
    onSuccess: res => {
      setPreview(res.data)
      setHuyResult(null)
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi tải preview'),
  })

  const huyMut = useMutation({
    mutationFn: (body: object) => client.post(`${API}/doi-tru/nhieu-doi-tuong/huy`, body),
    onSuccess: (res) => {
      const total = res.data.reduce((s: number, r: any) => s + r.so_bao_doi_tru_huy, 0)
      message.success(`Đã hủy ${total} bản đối trừ`)
      setHuyResult(res.data)
      setPreview(null)
      setSelectedSuppliers([])
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi'),
  })

  function buildBody() {
    return {
      supplier_ids: selectedSuppliers,
      tu_ngay: tuNgay.format('YYYY-MM-DD'),
      den_ngay: denNgay.format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
    }
  }

  function handlePreview() {
    if (selectedSuppliers.length === 0) { message.warning('Chọn ít nhất 1 NCC'); return }
    previewMut.mutate(buildBody())
  }

  function handleHuy() {
    huyMut.mutate(buildBody())
  }

  function handleExport() {
    if (!huyResult) return
    exportToExcel(
      huyResult.map((r: any) => {
        const s = (suppliers || []).find((s: any) => s.id === r.supplier_id)
        return {
          'Nhà cung cấp': s ? (s.ten_viet_tat || s.ten_don_vi || s.ma_ncc) : r.supplier_id,
          'Số bản đã hủy': r.so_bao_doi_tru_huy,
        }
      }),
      `bo-doi-tru-nhieu-${dayjs().format('YYYYMMDD')}`,
    )
  }

  const previewCols = [
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', width: 240 },
    { title: 'Số bản sẽ hủy', dataIndex: 'so_bao', width: 130, render: (v: number) => <Tag color={v > 0 ? 'orange' : 'default'}>{v} bản</Tag> },
    { title: 'Tổng tiền', dataIndex: 'tong_tien', width: 160, align: 'right' as const, render: (v: number) => <Text type="warning">{fmt(v)}</Text> },
  ]

  const resultCols = [
    { title: 'Nhà cung cấp', dataIndex: 'supplier_id', render: (id: number) => {
      const s = (suppliers || []).find((s: any) => s.id === id)
      return s ? (s.ten_viet_tat || s.ten_don_vi || s.ma_ncc) : id
    }},
    { title: 'Số bản đã hủy', dataIndex: 'so_bao_doi_tru_huy', render: (v: number) => <Tag color={v > 0 ? 'green' : 'default'}>{v} bản</Tag> },
  ]

  const totalPreview = preview ? preview.reduce((s, r) => s + r.tong_tien, 0) : 0
  const totalBao = preview ? preview.reduce((s, r) => s + r.so_bao, 0) : 0

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><StopOutlined /> Bỏ đối trừ nhiều đối tượng</Title>
      <Text type="secondary">Hủy hàng loạt các bản đối trừ đã xác nhận theo nhiều NCC cùng lúc</Text>

      {/* ── Bộ lọc ── */}
      <Card style={{ marginTop: 16 }}>
        <Space wrap>
          <Select
            placeholder="Tất cả pháp nhân" allowClear style={{ width: 160 }}
            options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            onChange={v => { setPhapNhanId(v ?? null); setPreview(null); setHuyResult(null) }}
          />
          <Select
            mode="multiple" showSearch optionFilterProp="label"
            placeholder="Chọn nhiều NCC" style={{ minWidth: 400 }}
            options={(suppliers || []).map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
            onChange={v => { setSelectedSuppliers(v); setPreview(null); setHuyResult(null) }}
            value={selectedSuppliers}
            maxTagCount={3}
          />
          <DatePicker value={tuNgay} format="DD/MM/YYYY" onChange={d => { d && setTuNgay(d); setPreview(null) }} placeholder="Từ ngày" />
          <DatePicker value={denNgay} format="DD/MM/YYYY" onChange={d => { d && setDenNgay(d); setPreview(null) }} placeholder="Đến ngày" />
          <Button icon={<EyeOutlined />} onClick={handlePreview} loading={previewMut.isPending}>
            Xem trước
          </Button>
        </Space>
      </Card>

      {/* ── Preview ── */}
      {preview && (
        <Card
          title={
            <Space>
              <Text strong>Xem trước — sẽ hủy</Text>
              <Tag color="orange">{totalBao} bản đối trừ</Tag>
              <Tag color="red">Tổng: {fmt(totalPreview)} đ</Tag>
            </Space>
          }
          style={{ marginTop: 16 }}
          extra={
            <Tooltip title={!isAdmin ? 'Chỉ admin mới được hủy đối trừ hàng loạt' : ''}>
              <Popconfirm
                title="Xác nhận hủy đối trừ hàng loạt?"
                description={`Sẽ hủy ${totalBao} bản đối trừ, tổng ${fmt(totalPreview)} đ. Không thể hoàn tác.`}
                onConfirm={handleHuy}
                okText="Xác nhận hủy" cancelText="Không"
                okButtonProps={{ danger: true }}
                disabled={!isAdmin || totalBao === 0}
              >
                <Button
                  danger icon={<StopOutlined />}
                  loading={huyMut.isPending}
                  disabled={!isAdmin || totalBao === 0}
                >
                  Xác nhận hủy
                </Button>
              </Popconfirm>
            </Tooltip>
          }
        >
          <Table
            dataSource={preview} columns={previewCols}
            rowKey="supplier_id" size="small" pagination={false}
            expandable={{
              expandedRowRender: (row: PreviewRow) => (
                <Table
                  dataSource={row.items} size="small" pagination={false}
                  rowKey="ma_doi_tru"
                  columns={[
                    { title: 'Mã đối trừ', dataIndex: 'ma_doi_tru', width: 180 },
                    { title: 'Ngày', dataIndex: 'ngay_doi_tru', width: 120 },
                    { title: 'Số tiền', dataIndex: 'tong_tien', align: 'right' as const, render: fmt },
                  ]}
                />
              ),
              rowExpandable: (row: PreviewRow) => row.items.length > 0,
            }}
            locale={{ emptyText: 'Không có bản đối trừ nào trong khoảng thời gian này' }}
          />
        </Card>
      )}

      {/* ── Kết quả sau khi hủy ── */}
      {huyResult && (
        <Card
          title="Kết quả"
          style={{ marginTop: 16 }}
          extra={
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Xuất Excel
            </Button>
          }
        >
          <Table
            dataSource={huyResult} columns={resultCols}
            rowKey="supplier_id" size="small" pagination={false}
          />
        </Card>
      )}

      {!preview && !huyResult && (
        <div style={{ marginTop: 32, textAlign: 'center', color: '#999' }}>
          Chọn NCC và khoảng thời gian, nhấn <strong>Xem trước</strong> để kiểm tra trước khi hủy
        </div>
      )}
    </div>
  )
}
