import { useState } from 'react'
import {
  Table, Typography, Switch, Space, Tag, Button, Modal, message,
} from 'antd'
import { SyncOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { warehouseApi, type DoiSoatCuonRow } from '../../api/warehouse'

const { Title, Text } = Typography

function fmtKg(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' kg'
}

function fmtPct(n: number | null) {
  if (n === null) return '—'
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'
}

export default function DoiSoatCuonPage() {
  const [showAll, setShowAll] = useState(false)
  const queryClient = useQueryClient()

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['doi-soat-cuon', showAll],
    queryFn: () => warehouseApi.getDoiSoatCuon(showAll).then(r => r.data),
  })

  const syncMutation = useMutation({
    mutationFn: ({ paper_material_id, warehouse_id }: { paper_material_id: number; warehouse_id: number }) =>
      warehouseApi.syncCuon(paper_material_id, warehouse_id).then(r => r.data),
    onSuccess: (data) => {
      message.success(
        `Đồng bộ thành công: ${fmtKg(data.old_ton)} → ${fmtKg(data.new_ton)} (chênh lệch ${fmtKg(data.chenh_lech)})`
      )
      queryClient.invalidateQueries({ queryKey: ['doi-soat-cuon'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ'
      message.error(msg)
    },
  })

  function handleSync(row: DoiSoatCuonRow) {
    Modal.confirm({
      title: 'Xác nhận đồng bộ',
      content: (
        <div>
          <p>Đồng bộ sổ sách theo cuộn vật lý cho:</p>
          <p><strong>{row.ten || row.ma_giay}</strong> — {row.warehouse_name}</p>
          <p>Tồn vật lý: <strong>{fmtKg(row.paper_roll_ton)}</strong></p>
          <p>Tồn sổ sách: <strong>{fmtKg(row.balance_ton)}</strong></p>
          <p>Chênh lệch: <strong style={{ color: row.chenh_lech !== 0 ? '#cf1322' : '#389e0d' }}>{fmtKg(row.chenh_lech)}</strong></p>
        </div>
      ),
      okText: 'Đồng bộ',
      cancelText: 'Hủy',
      onOk: () => syncMutation.mutate({ paper_material_id: row.paper_material_id, warehouse_id: row.warehouse_id }),
    })
  }

  function handleSyncAll() {
    const discrepancies = (rows ?? []).filter(r => Math.abs(r.chenh_lech) > 0.001)
    if (discrepancies.length === 0) {
      message.info('Không có chênh lệch nào cần đồng bộ')
      return
    }
    Modal.confirm({
      title: 'Đồng bộ tất cả chênh lệch',
      content: `Sẽ đồng bộ ${discrepancies.length} mặt hàng có chênh lệch. Tiếp tục?`,
      okText: 'Đồng bộ tất cả',
      cancelText: 'Hủy',
      onOk: async () => {
        let ok = 0
        let fail = 0
        for (const row of discrepancies) {
          try {
            await warehouseApi.syncCuon(row.paper_material_id, row.warehouse_id)
            ok++
          } catch {
            fail++
          }
        }
        if (fail === 0) {
          message.success(`Đồng bộ thành công ${ok} mặt hàng`)
        } else {
          message.warning(`Thành công ${ok}, thất bại ${fail}`)
        }
        queryClient.invalidateQueries({ queryKey: ['doi-soat-cuon'] })
      },
    })
  }

  const columns: ColumnsType<DoiSoatCuonRow> = [
    {
      title: 'Kho',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 140,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Mã giấy',
      dataIndex: 'ma_giay',
      key: 'ma_giay',
      width: 100,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Tên',
      dataIndex: 'ten',
      key: 'ten',
      ellipsis: true,
    },
    {
      title: 'Khổ (mm)',
      dataIndex: 'kho_mm',
      key: 'kho_mm',
      width: 90,
      align: 'right',
      render: (v: number | null) => v != null ? v.toLocaleString('vi-VN') : '—',
    },
    {
      title: 'ĐL (gsm)',
      dataIndex: 'dinh_luong',
      key: 'dinh_luong',
      width: 90,
      align: 'right',
      render: (v: number | null) => v != null ? v.toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Số cuộn',
      dataIndex: 'so_cuon',
      key: 'so_cuon',
      width: 90,
      align: 'right',
    },
    {
      title: 'Tồn thực tế (kg)',
      dataIndex: 'paper_roll_ton',
      key: 'paper_roll_ton',
      width: 140,
      align: 'right',
      render: (v: number) => fmtKg(v),
    },
    {
      title: 'Tồn sổ sách (kg)',
      dataIndex: 'balance_ton',
      key: 'balance_ton',
      width: 140,
      align: 'right',
      render: (v: number) => fmtKg(v),
    },
    {
      title: 'Chênh lệch (kg)',
      dataIndex: 'chenh_lech',
      key: 'chenh_lech',
      width: 140,
      align: 'right',
      render: (v: number) => {
        const abs = Math.abs(v)
        if (abs <= 0.001) {
          return <Tag icon={<CheckCircleOutlined />} color="success">0</Tag>
        }
        return (
          <Tag icon={<WarningOutlined />} color="error">
            {v > 0 ? '+' : ''}{fmtKg(v)}
          </Tag>
        )
      },
    },
    {
      title: '% chênh lệch',
      dataIndex: 'chenh_lech_phan_tram',
      key: 'chenh_lech_phan_tram',
      width: 120,
      align: 'right',
      render: (v: number | null) => {
        if (v === null) return '—'
        const abs = Math.abs(v)
        if (abs <= 0.001) return <Tag color="success">0%</Tag>
        return <Tag color={abs > 5 ? 'error' : 'warning'}>{fmtPct(v)}</Tag>
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_: unknown, row: DoiSoatCuonRow) => (
        <Button
          size="small"
          icon={<SyncOutlined />}
          onClick={() => handleSync(row)}
          disabled={Math.abs(row.chenh_lech) <= 0.001}
          loading={syncMutation.isPending}
        >
          Đồng bộ
        </Button>
      ),
    },
  ]

  const discrepancyCount = (rows ?? []).filter(r => Math.abs(r.chenh_lech) > 0.001).length

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 4 }}>Đối soát cuộn giấy — Thực tế vs Sổ sách</Title>
      <Text type="secondary">So sánh tồn kho theo cuộn vật lý với số liệu sổ sách kế toán</Text>

      <div style={{ marginTop: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <Switch
            checked={showAll}
            onChange={setShowAll}
            checkedChildren="Hiện tất cả"
            unCheckedChildren="Chỉ hiện chênh lệch"
          />
          {!showAll && discrepancyCount > 0 && (
            <Tag color="error">{discrepancyCount} mặt hàng chênh lệch</Tag>
          )}
        </Space>
        <Space>
          <Button icon={<SyncOutlined />} onClick={() => refetch()}>Làm mới</Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleSyncAll}
            disabled={discrepancyCount === 0}
          >
            Đồng bộ tất cả ({discrepancyCount})
          </Button>
        </Space>
      </div>

      <Table<DoiSoatCuonRow>
        columns={columns}
        dataSource={rows}
        rowKey={r => `${r.paper_material_id}_${r.warehouse_id}`}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        rowClassName={r => Math.abs(r.chenh_lech) > 0.001 ? 'ant-table-row-warning' : ''}
      />
    </div>
  )
}
