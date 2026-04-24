import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Descriptions, InputNumber, message, Modal,
  Popconfirm, Row, Space, Statistic, Table, Tag, Typography,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, ExportOutlined,
  PlusOutlined, PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionPlansApi, PlanLineResponse, LINE_TRANG_THAI, PLAN_TRANG_THAI,
  calcSoDao, calcKhoTT,
} from '../../api/productionPlans'
import AddLinesModal from './AddLinesModal'

const { Text, Title } = Typography

interface Props {
  planId: number
  embedded?: boolean
}

export default function ProductionPlanDetail({ planId, embedded }: Props) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editLine, setEditLine] = useState<PlanLineResponse | null>(null)
  const [khoGiayEdit, setKhoGiayEdit] = useState<number | null>(null)

  const { data: plan, isLoading } = useQuery({
    queryKey: ['production-plan', planId],
    queryFn: () => productionPlansApi.get(planId).then(r => r.data),
  })

  const exportMut = useMutation({
    mutationFn: () => productionPlansApi.export(planId),
    onSuccess: () => {
      message.success('Đã xuất kế hoạch sản xuất')
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
      qc.invalidateQueries({ queryKey: ['production-plans'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xuất kế hoạch'),
  })

  const deleteLineMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.deleteLine(planId, lineId),
    onSuccess: () => {
      message.success('Đã xóa dòng')
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xóa dòng'),
  })

  const completeLineMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.completeLine(planId, lineId),
    onSuccess: () => {
      message.success('Đã hoàn thành dòng')
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const updateLineMut = useMutation({
    mutationFn: ({ lineId, khoGiay }: { lineId: number; khoGiay: number }) => {
      const ln = plan?.lines.find(l => l.id === lineId)
      const kho1 = ln?.kho1 ?? null
      const soDao = calcSoDao(khoGiay, kho1)
      return productionPlansApi.updateLine(planId, lineId, {
        kho_giay: khoGiay,
        so_dao: soDao ?? undefined,
      })
    },
    onSuccess: () => {
      message.success('Đã cập nhật khổ giấy')
      setEditLine(null)
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  if (isLoading || !plan) return <div style={{ padding: 24 }}>Đang tải...</div>

  const statusInfo = PLAN_TRANG_THAI[plan.trang_thai] ?? { label: plan.trang_thai, color: 'default' }
  const canEdit = plan.trang_thai !== 'hoan_thanh'
  const canExport = plan.trang_thai === 'nhap'

  const tong_sl = plan.lines.reduce((s, l) => s + Number(l.so_luong_ke_hoach), 0)
  const tong_ht = plan.lines.reduce((s, l) => s + Number(l.so_luong_hoan_thanh), 0)

  const cols: ColumnsType<PlanLineResponse> = [
    {
      title: '#',
      dataIndex: 'thu_tu',
      width: 45,
      align: 'center' as const,
      render: (v: number) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Ngày chạy',
      dataIndex: 'ngay_chay',
      width: 90,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM') : <Text type="secondary">—</Text>,
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 120,
      render: (v: string | null) => <Text code style={{ fontSize: 11 }}>{v || '—'}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 110,
      ellipsis: true,
      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Cấu trúc',
      width: 120,
      render: (_: unknown, r: PlanLineResponse) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>
            {r.loai_thung} · {r.so_lop}L · {r.to_hop_song}
          </Text>
          {r.dai && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.dai}×{r.rong}×{r.cao}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Kho1 (cm)',
      dataIndex: 'kho1',
      width: 80,
      align: 'right' as const,
      render: (v: number | null) =>
        v ? <Text style={{ fontSize: 12 }}>{Number(v).toFixed(1)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ch Khổ (cm)',
      dataIndex: 'kho_giay',
      width: 100,
      align: 'right' as const,
      render: (v: number | null, r: PlanLineResponse) => {
        if (editLine?.id === r.id) {
          const soDao = calcSoDao(khoGiayEdit, r.kho1)
          const khoTT = calcKhoTT(r.kho1, soDao)
          return (
            <Space direction="vertical" size={2}>
              <InputNumber
                size="small"
                style={{ width: 80 }}
                value={khoGiayEdit ?? undefined}
                min={0}
                step={1}
                autoFocus
                onChange={val => setKhoGiayEdit(val)}
              />
              {soDao !== null && (
                <Text type="secondary" style={{ fontSize: 10 }}>
                  → {soDao} dao, KhổTT={khoTT?.toFixed(1)}
                </Text>
              )}
            </Space>
          )
        }
        return (
          <Text
            style={{ fontSize: 12, cursor: canEdit ? 'pointer' : 'default', color: v ? undefined : '#bbb' }}
            onClick={() => {
              if (!canEdit) return
              setEditLine(r)
              setKhoGiayEdit(v ? Number(v) : null)
            }}
          >
            {v ? Number(v).toFixed(1) : '—'}
          </Text>
        )
      },
    },
    {
      title: 'Số dao',
      dataIndex: 'so_dao',
      width: 70,
      align: 'center' as const,
      render: (v: number | null) =>
        v ? <Text strong style={{ color: '#1677ff' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'KhổTT (cm)',
      dataIndex: 'kho_tt',
      width: 85,
      align: 'right' as const,
      render: (v: number | null) =>
        v ? Number(v).toFixed(1) : <Text type="secondary">—</Text>,
    },
    {
      title: 'SL KH',
      dataIndex: 'so_luong_ke_hoach',
      width: 80,
      align: 'right' as const,
      render: (v: number) => new Intl.NumberFormat('vi-VN').format(Number(v)),
    },
    {
      title: 'SL HT',
      dataIndex: 'so_luong_hoan_thanh',
      width: 80,
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: Number(v) > 0 ? '#52c41a' : undefined }}>
          {new Intl.NumberFormat('vi-VN').format(Number(v))}
        </Text>
      ),
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 90,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM') : '—',
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 95,
      render: (v: string) => {
        const s = LINE_TRANG_THAI[v] ?? { label: v, color: 'default' }
        return <Tag color={s.color} style={{ fontSize: 11 }}>{s.label}</Tag>
      },
    },
    {
      title: '',
      width: 95,
      fixed: 'right' as const,
      render: (_: unknown, r: PlanLineResponse) => {
        if (editLine?.id === r.id) {
          return (
            <Space size={4}>
              <Button
                size="small"
                type="primary"
                loading={updateLineMut.isPending}
                onClick={() => {
                  if (!khoGiayEdit) { message.warning('Nhập Ch Khổ'); return }
                  updateLineMut.mutate({ lineId: r.id, khoGiay: khoGiayEdit })
                }}
              >
                Lưu
              </Button>
              <Button size="small" onClick={() => setEditLine(null)}>Hủy</Button>
            </Space>
          )
        }
        return (
          <Space size={4}>
            {canEdit && r.trang_thai !== 'hoan_thanh' && (
              <Popconfirm
                title="Hoàn thành dòng này?"
                onConfirm={() => completeLineMut.mutate(r.id)}
                okText="Có" cancelText="Không"
              >
                <Button size="small" type="text" icon={<CheckCircleOutlined />} />
              </Popconfirm>
            )}
            {canEdit && (
              <Popconfirm
                title="Xóa dòng này?"
                onConfirm={() => deleteLineMut.mutate(r.id)}
                okText="Có" cancelText="Không"
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ padding: embedded ? 0 : 24 }}>
      {/* Header */}
      <Card
        size="small"
        style={{ marginBottom: 12 }}
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>{plan.so_ke_hoach}</Title>
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          </Space>
        }
        extra={
          <Space>
            {canExport && (
              <Button
                type="primary"
                icon={<ExportOutlined />}
                loading={exportMut.isPending}
                onClick={() => exportMut.mutate()}
              >
                Xuất kế hoạch
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>
            {canEdit && (
              <Button
                icon={<PlusOutlined />}
                onClick={() => setAddOpen(true)}
              >
                Thêm LSX
              </Button>
            )}
          </Space>
        }
      >
        <Row gutter={[16, 0]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="Ngày kế hoạch"
              value={dayjs(plan.ngay_ke_hoach).format('DD/MM/YYYY')}
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Tổng dòng" value={plan.lines.length} valueStyle={{ fontSize: 14 }} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Tổng SL kế hoạch"
              value={new Intl.NumberFormat('vi-VN').format(tong_sl)}
              suffix="cái"
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Đã hoàn thành"
              value={new Intl.NumberFormat('vi-VN').format(tong_ht)}
              suffix="cái"
              valueStyle={{ fontSize: 14, color: tong_ht > 0 ? '#52c41a' : undefined }}
            />
          </Col>
        </Row>
        {plan.ghi_chu && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            Ghi chú: {plan.ghi_chu}
          </Text>
        )}
      </Card>

      {/* Bảng dòng kế hoạch */}
      <Card size="small" title="Chi tiết kế hoạch sản xuất">
        <Table<PlanLineResponse>
          rowKey="id"
          dataSource={plan.lines}
          columns={cols}
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={10}>
                <Text strong>Tổng cộng</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={10} align="right">
                <Text strong>{new Intl.NumberFormat('vi-VN').format(tong_sl)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={11} align="right">
                <Text strong style={{ color: '#52c41a' }}>
                  {new Intl.NumberFormat('vi-VN').format(tong_ht)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={12} colSpan={3} />
            </Table.Summary.Row>
          )}
        />
      </Card>

      {/* Modal thêm LSX */}
      <AddLinesModal
        open={addOpen}
        planId={planId}
        existingItemIds={plan.lines.map(l => l.production_order_item_id)}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false)
          qc.invalidateQueries({ queryKey: ['production-plan', planId] })
        }}
      />
    </div>
  )
}
