import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Select, Input,
  Tag, message, Typography, Row, Col, Popconfirm,
} from 'antd'
import { SaveOutlined, DatabaseOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApiError } from '../../api/types'
import client from '../../api/client'
import { useAuthStore } from '../../store/auth'
import EmptyState from '../../components/EmptyState'

const { Title } = Typography

interface TaiKhoanNgamDinh {
  id: number
  ma_loai: string
  ten_loai: string
  nhom: string
  so_tk: string | null
  ghi_chu: string | null
}

const tkndApi = {
  list: (nhom?: string) =>
    client.get<TaiKhoanNgamDinh[]>('/tai-khoan-ngam-dinh', { params: nhom ? { nhom } : {} }),
  update: (id: number, d: { so_tk: string | null; ghi_chu?: string | null }) =>
    client.put<TaiKhoanNgamDinh>(`/tai-khoan-ngam-dinh/${id}`, d),
  bulkUpdate: (items: { id: number; so_tk: string | null }[]) =>
    client.post<TaiKhoanNgamDinh[]>('/tai-khoan-ngam-dinh/bulk-update', items),
  seed: () => client.get<{ seeded?: number; skipped?: boolean }>('/tai-khoan-ngam-dinh/seed'),
}

const QUERY_KEY = ['tai-khoan-ngam-dinh'] as const

const NHOM_OPTIONS = [
  { value: 'ban_hang', label: 'Bán hàng' },
  { value: 'mua_hang', label: 'Mua hàng' },
  { value: 'tien_te', label: 'Tiền tệ' },
  { value: 'thue', label: 'Thuế' },
  { value: 'chi_phi', label: 'Chi phí' },
  { value: 'san_xuat', label: 'Sản xuất' },
] as const

const NHOM_LABEL: Record<string, string> = Object.fromEntries(
  NHOM_OPTIONS.map((o) => [o.value, o.label]),
)

const NHOM_COLOR: Record<string, string> = {
  ban_hang: 'blue',
  mua_hang: 'orange',
  tien_te: 'green',
  thue: 'purple',
  chi_phi: 'red',
  san_xuat: 'cyan',
}

type Edits = Record<number, Partial<TaiKhoanNgamDinh>>

export default function TaiKhoanNgamDinhPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [nhomFilter, setNhomFilter] = useState<string | undefined>(undefined)
  const [edits, setEdits] = useState<Edits>({})

  const { data = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, nhomFilter ?? 'all'],
    queryFn: () => tkndApi.list(nhomFilter).then((r) => r.data),
  })

  const reset = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    setEdits({})
  }

  const onApiError = (e: unknown, fallback: string) =>
    message.error((e as ApiError)?.response?.data?.detail || fallback)

  const rowSaveMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { so_tk: string | null; ghi_chu?: string | null } }) =>
      tkndApi.update(id, d),
    onSuccess: () => {
      message.success('Đã lưu')
      reset()
    },
    onError: (e: unknown) => onApiError(e, 'Lỗi khi lưu'),
  })

  const bulkSaveMut = useMutation({
    mutationFn: (items: { id: number; so_tk: string | null }[]) => tkndApi.bulkUpdate(items),
    onSuccess: (res) => {
      message.success(`Đã lưu ${res.data.length} dòng`)
      reset()
    },
    onError: (e: unknown) => onApiError(e, 'Lỗi khi lưu tất cả'),
  })

  const seedMut = useMutation({
    mutationFn: () => tkndApi.seed(),
    onSuccess: (res) => {
      if (res.data.skipped) {
        message.info('Dữ liệu đã tồn tại, bỏ qua khởi tạo')
      } else {
        message.success(`Đã khởi tạo ${res.data.seeded ?? 0} tài khoản ngầm định`)
      }
      reset()
    },
    onError: (e: unknown) => onApiError(e, 'Lỗi khi khởi tạo dữ liệu'),
  })

  // ─── Edit tracking ──────────────────────────────────────────────────────────

  const setField = (row: TaiKhoanNgamDinh, key: 'so_tk' | 'ghi_chu', value: string) => {
    setEdits((prev) => {
      const next = { ...prev }
      const current = { ...(next[row.id] ?? {}) }
      const trimmed = value === '' ? null : value
      const original = row[key] ?? null
      if (trimmed === original) {
        delete current[key]
      } else {
        current[key] = trimmed
      }
      if (Object.keys(current).length === 0) {
        delete next[row.id]
      } else {
        next[row.id] = current
      }
      return next
    })
  }

  // Giá trị hiển thị: ưu tiên giá trị đang sửa, fallback giá trị gốc.
  const fieldValue = (row: TaiKhoanNgamDinh, key: 'so_tk' | 'ghi_chu'): string => {
    const edit = edits[row.id]
    if (edit && key in edit) return (edit[key] as string | null) ?? ''
    return row[key] ?? ''
  }

  const isDirty = (id: number) => Boolean(edits[id])
  const dirtyIds = Object.keys(edits).map(Number)

  const saveRow = (row: TaiKhoanNgamDinh) => {
    const edit = edits[row.id]
    if (!edit) return
    rowSaveMut.mutate({
      id: row.id,
      d: {
        so_tk: 'so_tk' in edit ? (edit.so_tk as string | null) : (row.so_tk ?? null),
        ...('ghi_chu' in edit ? { ghi_chu: edit.ghi_chu as string | null } : {}),
      },
    })
  }

  const saveAll = () => {
    if (dirtyIds.length === 0) {
      message.info('Không có thay đổi nào để lưu')
      return
    }
    const items = dirtyIds.map((id) => {
      const edit = edits[id]
      const original = data.find((r) => r.id === id)
      return {
        id,
        so_tk: 'so_tk' in edit ? (edit.so_tk as string | null) : (original?.so_tk ?? null),
      }
    })
    bulkSaveMut.mutate(items)
  }

  // ─── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<TaiKhoanNgamDinh> = [
    {
      title: 'Nhóm',
      dataIndex: 'nhom',
      width: 130,
      render: (v: string) => <Tag color={NHOM_COLOR[v] ?? 'default'}>{NHOM_LABEL[v] ?? v}</Tag>,
    },
    { title: 'Loại tài khoản', dataIndex: 'ten_loai' },
    {
      title: 'Số TK ngầm định',
      dataIndex: 'so_tk',
      width: 160,
      render: (_: unknown, row: TaiKhoanNgamDinh) => (
        <Input
          style={{ width: 120 }}
          placeholder="Nhập mã TK"
          value={fieldValue(row, 'so_tk')}
          onChange={(e) => setField(row, 'so_tk', e.target.value)}
        />
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      render: (_: unknown, row: TaiKhoanNgamDinh) => (
        <Input
          placeholder="Ghi chú"
          value={fieldValue(row, 'ghi_chu')}
          onChange={(e) => setField(row, 'ghi_chu', e.target.value)}
        />
      ),
    },
    {
      title: '',
      key: 'act',
      width: 90,
      align: 'center',
      render: (_: unknown, row: TaiKhoanNgamDinh) => (
        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          disabled={!isDirty(row.id)}
          loading={rowSaveMut.isPending && rowSaveMut.variables?.id === row.id}
          onClick={() => saveRow(row)}
        >
          Lưu
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[8, 8]}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Tài khoản ngầm định</Title>
          </Col>
          <Col>
            <Space wrap>
              <Select
                allowClear
                placeholder="Tất cả nhóm"
                style={{ width: 180 }}
                value={nhomFilter}
                onChange={(v) => setNhomFilter(v)}
                options={[...NHOM_OPTIONS]}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={bulkSaveMut.isPending}
                disabled={dirtyIds.length === 0}
                onClick={saveAll}
              >
                Lưu tất cả{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}
              </Button>
              {isAdmin && (
                <Popconfirm
                  title="Khởi tạo dữ liệu mặc định?"
                  description="Chỉ chạy khi bảng đang rỗng. Nếu đã có dữ liệu sẽ bỏ qua."
                  onConfirm={() => seedMut.mutate()}
                  okText="Khởi tạo"
                  cancelText="Huỷ"
                >
                  <Button icon={<DatabaseOutlined />} loading={seedMut.isPending}>
                    Khởi tạo dữ liệu
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </Col>
        </Row>

        <Table
          locale={{ emptyText: <EmptyState size="small" /> }}
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          pagination={false}
          size="small"
          onRow={(row) =>
            isDirty(row.id) ? { style: { borderLeft: '3px solid #faad14' } } : {}
          }
        />
      </Card>
    </div>
  )
}
