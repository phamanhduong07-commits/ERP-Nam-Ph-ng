import { useState, useEffect } from 'react'
import {
  Button, Card, DatePicker, message, Select, Space,
  Table, Tag, Tooltip, Typography, Popconfirm,
} from 'antd'
import { StopOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { usePermission } from '../../hooks/usePermission'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const API = ''

export default function BoDoiTruPage() {
  const qc = useQueryClient()
  const { isAdmin, role } = usePermission()
  const canHuy = isAdmin || role === 'KE_TOAN'
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phapNhanList, setPhapNhanList] = useState<{ id: number; ten_viet_tat: string; ten_phap_nhan: string }[]>([])
  const [tuNgay, setTuNgay] = useState(dayjs().startOf('month'))
  const [denNgay, setDenNgay] = useState(dayjs())

  useEffect(() => {
    client.get(`${API}/phap-nhan`).then(r => setPhapNhanList(r.data)).catch(() => {})
  }, [])

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: () => client.get(`${API}/suppliers?limit=500`).then(r => r.data.items ?? r.data),
  })

  const { data: listData, isLoading } = useQuery({
    queryKey: ['doi-tru-list', supplierId, phapNhanId, tuNgay, denNgay],
    queryFn: () => client.get(`${API}/doi-tru/`, {
      params: {
        supplier_id: supplierId || undefined,
        phap_nhan_id: phapNhanId || undefined,
        trang_thai: 'da_xac_nhan',
        tu_ngay: tuNgay.format('YYYY-MM-DD'),
        den_ngay: denNgay.format('YYYY-MM-DD'),
        limit: 200,
      },
    }).then(r => r.data),
    enabled: !!supplierId,
  })

  const huyMut = useMutation({
    mutationFn: (id: number) => client.post(`${API}/doi-tru/${id}/huy`),
    onSuccess: (_, id) => {
      message.success(`Đã hủy đối trừ #${id}`)
      qc.invalidateQueries({ queryKey: ['doi-tru-list'] })
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi hủy đối trừ'),
  })

  const statusTag = (s: string) => {
    if (s === 'da_xac_nhan') return <Tag color="green">Đã xác nhận</Tag>
    if (s === 'da_huy') return <Tag color="red">Đã hủy</Tag>
    return <Tag>{s}</Tag>
  }

  const cols = [
    { title: 'Mã đối trừ', dataIndex: 'ma_doi_tru', width: 160 },
    { title: 'Ngày', dataIndex: 'ngay_doi_tru', width: 110 },
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc' },
    { title: 'Tổng tiền', dataIndex: 'tong_tien_doi_tru', render: (v: number) => v.toLocaleString('vi-VN') },
    { title: 'Số cặp', dataIndex: 'items', render: (items: any[]) => `${items?.length ?? 0} cặp` },
    { title: 'Trạng thái', dataIndex: 'trang_thai', render: statusTag },
    {
      title: 'Thao tác', key: 'action',
      render: (row: any) => (
        row.trang_thai === 'da_xac_nhan' ? (
          <Tooltip title={!canHuy ? 'Chỉ kế toán mới được hủy đối trừ' : ''}>
            <Popconfirm
              title="Xác nhận hủy đối trừ?"
              description="Hóa đơn và phiếu chi sẽ trở về trạng thái chưa đối trừ"
              onConfirm={() => huyMut.mutate(row.id)}
              okText="Hủy đối trừ" cancelText="Không"
              okButtonProps={{ danger: true }}
              disabled={!canHuy}
            >
              <Button danger size="small" icon={<StopOutlined />} loading={huyMut.isPending} disabled={!canHuy}>
                Bỏ đối trừ
              </Button>
            </Popconfirm>
          </Tooltip>
        ) : null
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><StopOutlined /> Bỏ đối trừ</Title>
      <Text type="secondary">Hủy các lần đối trừ đã xác nhận — hóa đơn và phiếu chi sẽ trở về trạng thái gốc</Text>

      <Card style={{ marginTop: 16 }}>
        <Space wrap>
          <Select
            placeholder="Tất cả pháp nhân" allowClear style={{ width: 160 }}
            options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            onChange={v => setPhapNhanId(v ?? null)}
          />
          <Select
            showSearch optionFilterProp="label" placeholder="Tất cả NCC"
            style={{ width: 280 }} allowClear
            options={(suppliers || []).map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
            onChange={v => setSupplierId(v ?? null)}
          />
          <DatePicker value={tuNgay} format="DD/MM/YYYY" onChange={d => d && setTuNgay(d)} placeholder="Từ ngày" />
          <DatePicker value={denNgay} format="DD/MM/YYYY" onChange={d => d && setDenNgay(d)} placeholder="Đến ngày" />
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }} loading={isLoading}>
        <Table
          dataSource={listData?.items || []}
          columns={cols}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: supplierId ? 'Không có đối trừ nào trong khoảng thời gian này' : 'Chọn nhà cung cấp để xem danh sách đối trừ' }}
          expandable={{
            expandedRowRender: (row: any) => (
              <Table
                dataSource={row.items || []}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Hóa đơn', dataIndex: 'so_hoa_don' },
                  { title: 'Phiếu chi', dataIndex: 'so_phieu_chi' },
                  { title: 'Số tiền đối trừ', dataIndex: 'so_tien_doi_tru', render: (v: number) => v.toLocaleString('vi-VN') },
                ]}
              />
            ),
          }}
        />
      </Card>
    </div>
  )
}
