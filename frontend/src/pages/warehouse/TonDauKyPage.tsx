import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, InputNumber, Select, Space,
  Table, Tabs, Tag, Typography, message,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { warehouseApi, type TonDauKyBalance, type TonDauKyItemPayload } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import PageLayout from '../../components/PageLayout'

const { Title, Text } = Typography

interface RowItem {
  key: number
  warehouse_id: number | undefined
  paper_material_id: number | undefined
  other_material_id: number | undefined
  ten_hang: string
  don_vi: string
  so_luong: number
  don_gia: number
}

function fmtNum(v: number) {
  return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function fmtVnd(v: number) {
  return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫'
}

let rowKey = 1

export default function TonDauKyPage() {
  const qc = useQueryClient()
  const [rows, setRows] = useState<RowItem[]>([
    { key: rowKey++, warehouse_id: undefined, paper_material_id: undefined, other_material_id: undefined, ten_hang: '', don_vi: 'Kg', so_luong: 0, don_gia: 0 },
  ])

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: paperMats = [] } = useQuery({
    queryKey: ['paper-materials-list'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 500 }).then(r => r.data.items),
  })

  const { data: otherMats = [] } = useQuery({
    queryKey: ['other-materials-list'],
    queryFn: () => otherMaterialsApi.list({ page_size: 500 }).then(r => r.data.items),
  })

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['ton-dau-ky'],
    queryFn: () => warehouseApi.getTonDauKy().then(r => r.data),
  })

  const submitMut = useMutation({
    mutationFn: (items: TonDauKyItemPayload[]) => warehouseApi.postTonDauKy(items),
    onSuccess: (res) => {
      const { success, failed } = res.data
      if (failed.length > 0) {
        const errors = failed.map(f => `Dòng ${f.index + 1}: ${f.error}`).join('\n')
        message.warning(`Nhập ${success} thành công, ${failed.length} lỗi:\n${errors}`)
      } else {
        message.success(`Nhập tồn đầu kỳ thành công: ${success} mặt hàng`)
      }
      qc.invalidateQueries({ queryKey: ['ton-dau-ky'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      setRows([{ key: rowKey++, warehouse_id: undefined, paper_material_id: undefined, other_material_id: undefined, ten_hang: '', don_vi: 'Kg', so_luong: 0, don_gia: 0 }])
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi nhập tồn đầu kỳ'),
  })

  function addRow() {
    setRows(prev => [...prev, { key: rowKey++, warehouse_id: undefined, paper_material_id: undefined, other_material_id: undefined, ten_hang: '', don_vi: 'Kg', so_luong: 0, don_gia: 0 }])
  }

  function removeRow(key: number) {
    setRows(prev => prev.filter(r => r.key !== key))
  }

  function updateRow(key: number, field: Partial<RowItem>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...field } : r))
  }

  function handleSubmit() {
    const invalid = rows.filter(r => !r.warehouse_id || (!r.paper_material_id && !r.other_material_id && !r.ten_hang) || r.so_luong <= 0)
    if (invalid.length > 0) {
      message.error('Vui lòng điền đầy đủ: Kho, Mặt hàng, Số lượng (> 0) cho tất cả các dòng')
      return
    }
    const items: TonDauKyItemPayload[] = rows.map(r => ({
      warehouse_id: r.warehouse_id!,
      paper_material_id: r.paper_material_id ?? null,
      other_material_id: r.other_material_id ?? null,
      so_luong: r.so_luong,
      don_gia: r.don_gia,
      ten_hang: r.ten_hang || null,
      don_vi: r.don_vi || null,
    }))
    submitMut.mutate(items)
  }

  const inputColumns: ColumnsType<RowItem> = [
    {
      title: 'Kho',
      width: 200,
      render: (_, r) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn kho"
          value={r.warehouse_id}
          onChange={v => updateRow(r.key, { warehouse_id: v })}
          options={warehouses.map(w => ({ value: w.id, label: w.ten_kho }))}
          showSearch
          filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
        />
      ),
    },
    {
      title: 'Giấy cuộn',
      width: 200,
      render: (_, r) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn giấy (nếu có)"
          value={r.paper_material_id}
          allowClear
          onChange={v => {
            const mat = paperMats.find(m => m.id === v)
            updateRow(r.key, { paper_material_id: v, other_material_id: undefined, ten_hang: mat?.ten || '', don_vi: mat?.dvt || 'Kg' })
          }}
          options={paperMats.map(m => ({ value: m.id, label: `${m.ma_chinh} – ${m.ten}` }))}
          showSearch
          filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
        />
      ),
    },
    {
      title: 'NVL khác',
      width: 200,
      render: (_, r) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn NVL (nếu có)"
          value={r.other_material_id}
          allowClear
          onChange={v => {
            const mat = otherMats.find(m => m.id === v)
            updateRow(r.key, { other_material_id: v, paper_material_id: undefined, ten_hang: mat?.ten || '', don_vi: mat?.dvt || 'Cái' })
          }}
          options={otherMats.map(m => ({ value: m.id, label: `${m.ma_chinh} – ${m.ten}` }))}
          showSearch
          filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
        />
      ),
    },
    {
      title: 'Số lượng (kg)',
      width: 150,
      render: (_, r) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={r.so_luong}
          onChange={v => updateRow(r.key, { so_luong: v ?? 0 })}
          formatter={v => v ? Number(v).toLocaleString('vi-VN') : '0'}
        />
      ),
    },
    {
      title: 'Đơn giá (đ/kg)',
      width: 150,
      render: (_, r) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={r.don_gia}
          onChange={v => updateRow(r.key, { don_gia: v ?? 0 })}
          formatter={v => v ? Number(v).toLocaleString('vi-VN') : '0'}
        />
      ),
    },
    {
      title: '',
      width: 50,
      render: (_, r) => (
        <Button
          icon={<DeleteOutlined />}
          type="text"
          danger
          disabled={rows.length <= 1}
          onClick={() => removeRow(r.key)}
        />
      ),
    },
  ]

  const balanceColumns: ColumnsType<TonDauKyBalance> = [
    { title: 'Kho', dataIndex: 'ten_kho', width: 150 },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 120 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 70 },
    {
      title: 'Tồn lượng',
      dataIndex: 'ton_luong',
      width: 120,
      align: 'right',
      render: v => fmtNum(v),
    },
    {
      title: 'Đơn giá BQ',
      dataIndex: 'don_gia_binh_quan',
      width: 130,
      align: 'right',
      render: v => fmtVnd(v),
    },
    {
      title: 'Giá trị tồn',
      dataIndex: 'gia_tri_ton',
      width: 140,
      align: 'right',
      render: v => <Text strong>{fmtVnd(v)}</Text>,
    },
    {
      title: 'Loại',
      width: 100,
      render: (_, r) => r.paper_material_id
        ? <Tag color="blue">Giấy cuộn</Tag>
        : r.other_material_id
          ? <Tag color="orange">NVL khác</Tag>
          : r.product_id
            ? <Tag color="green">Thành phẩm</Tag>
            : <Tag>Khác</Tag>,
    },
  ]

  const tabItems = [
    {
      key: 'input',
      label: 'Nhập từng dòng',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Table
            dataSource={rows}
            columns={inputColumns}
            rowKey="key"
            pagination={false}
            scroll={{ x: 950 }}
            size="small"
          />
          <Space>
            <Button icon={<PlusOutlined />} onClick={addRow}>Thêm dòng</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={submitMut.isPending}
            >
              Xác nhận nhập tồn đầu kỳ
            </Button>
          </Space>
        </Space>
      ),
    },
    {
      key: 'excel',
      label: 'Import Excel',
      children: (
        <Card>
          <Alert
            type="info"
            message="Tính năng đang phát triển"
            description="Import hàng loạt từ file Excel sẽ có trong phiên bản tiếp theo."
            showIcon
          />
        </Card>
      ),
    },
  ]

  return (
    <PageLayout title="Nhập tồn đầu kỳ">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="warning"
          showIcon
          message="Chỉ dùng khi khởi tạo hệ thống. Mỗi mặt hàng chỉ nhập 1 lần."
          description="Nếu cần điều chỉnh sau khi đã nhập, hãy dùng chức năng Kiểm kê / Điều chỉnh tồn kho."
        />

        <Card title="Nhập tồn đầu kỳ mới">
          <Tabs items={tabItems} />
        </Card>

        <Card title={`Tồn kho hiện tại (${balances.length} mặt hàng)`}>
          <Table
            dataSource={balances}
            columns={balanceColumns}
            rowKey="id"
            loading={balancesLoading}
            size="small"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 900 }}
          />
        </Card>
      </Space>
    </PageLayout>
  )
}
