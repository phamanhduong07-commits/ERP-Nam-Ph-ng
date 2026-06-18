import { useState, useEffect } from 'react'
import {
  Button, Card, DatePicker, message, Select, Space,
  Table, Tag, Typography, Alert, Popconfirm,
} from 'antd'
import { StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const API = ''

export default function BoDoiTruNhieuPage() {
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([])
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phapNhanList, setPhapNhanList] = useState<{ id: number; ten_viet_tat: string; ten_phap_nhan: string }[]>([])
  const [tuNgay, setTuNgay] = useState(dayjs().startOf('month'))
  const [denNgay, setDenNgay] = useState(dayjs())
  const [result, setResult] = useState<any[] | null>(null)

  useEffect(() => {
    client.get(`${API}/phap-nhan`).then(r => setPhapNhanList(r.data)).catch(() => {})
  }, [])

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: () => client.get(`${API}/suppliers?limit=500`).then(r => r.data.items ?? r.data),
  })

  const huyMut = useMutation({
    mutationFn: (body: object) => client.post(`${API}/doi-tru/nhieu-doi-tuong/huy`, body),
    onSuccess: (res) => {
      const total = res.data.reduce((s: number, r: any) => s + r.so_bao_doi_tru_huy, 0)
      message.success(`Đã hủy ${total} bản đối trừ`)
      setResult(res.data)
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi'),
  })

  function handleHuy() {
    if (selectedSuppliers.length === 0) { message.warning('Chọn ít nhất 1 NCC'); return }
    huyMut.mutate({
      supplier_ids: selectedSuppliers,
      tu_ngay: tuNgay.format('YYYY-MM-DD'),
      den_ngay: denNgay.format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
    })
  }

  const cols = [
    { title: 'Nhà cung cấp', dataIndex: 'supplier_id', render: (id: number) => {
      const s = (suppliers || []).find((s: any) => s.id === id)
      return s ? (s.ten_viet_tat || s.ten_don_vi || s.ma_ncc) : id
    }},
    { title: 'Số bản đã hủy', dataIndex: 'so_bao_doi_tru_huy', render: (v: number) => <Tag color={v > 0 ? 'orange' : 'default'}>{v} bản</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><StopOutlined /> Bỏ đối trừ nhiều đối tượng</Title>
      <Text type="secondary">Hủy hàng loạt các bản đối trừ đã xác nhận theo nhiều NCC cùng lúc</Text>

      <Card style={{ marginTop: 16 }}>
        <Space wrap>
          <Select
            placeholder="Tất cả pháp nhân" allowClear style={{ width: 160 }}
            options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            onChange={v => setPhapNhanId(v ?? null)}
          />
          <Select
            mode="multiple" showSearch optionFilterProp="label"
            placeholder="Chọn nhiều NCC" style={{ minWidth: 400 }}
            options={(suppliers || []).map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
            onChange={setSelectedSuppliers}
            value={selectedSuppliers}
            maxTagCount={3}
          />
          <DatePicker value={tuNgay} format="DD/MM/YYYY" onChange={d => d && setTuNgay(d)} placeholder="Từ ngày" />
          <DatePicker value={denNgay} format="DD/MM/YYYY" onChange={d => d && setDenNgay(d)} placeholder="Đến ngày" />
          <Popconfirm
            title="Xác nhận hủy đối trừ hàng loạt?"
            description="Tất cả bản đối trừ đã xác nhận trong khoảng thời gian sẽ bị hủy"
            onConfirm={handleHuy}
            okText="Xác nhận hủy" cancelText="Không"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<StopOutlined />} loading={huyMut.isPending}>
              Hủy đối trừ hàng loạt
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      {result && (
        <Card title="Kết quả" style={{ marginTop: 16 }}>
          <Table
            dataSource={result} columns={cols}
            rowKey="supplier_id" size="small" pagination={false}
          />
        </Card>
      )}

      {!result && (
        <Alert
          style={{ marginTop: 24 }}
          message="Chọn nhà cung cấp và khoảng thời gian, sau đó xác nhận để hủy toàn bộ đối trừ trong kỳ"
          type="warning" showIcon
        />
      )}
    </div>
  )
}
