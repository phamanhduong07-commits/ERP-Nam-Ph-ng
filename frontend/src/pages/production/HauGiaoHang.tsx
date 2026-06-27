import { useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckOutlined,
  CloseOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  approveTask,
  khoNhanTask,
  listTasks,
  rejectTask,
  HUONG_XU_LY_LABELS,
  TINH_TRANG_LABELS,
  TRANG_THAI_LABELS,
  type DeliveryPostTask,
} from '../../api/delivery-post-tasks'
import { warehousesApi, type Warehouse } from '../../api/warehouses'

const { Text } = Typography

// ── helpers ──────────────────────────────────────────────────────────────────

const trangThaiColor: Record<string, string> = {
  cho_duyet: 'processing',
  cho_kho_nhan: 'warning',
  hoan_thanh: 'success',
  tu_choi: 'error',
}

function TinhTrangTag({ value }: { value: string }) {
  const colors: Record<string, string> = {
    giao_thieu: 'orange',
    giao_du: 'purple',
    bu_hao: 'cyan',
    loi_phat_hien: 'red',
  }
  return <Tag color={colors[value] || 'default'}>{TINH_TRANG_LABELS[value] || value}</Tag>
}

function HuongXuLyTag({ value }: { value: string }) {
  return <Tag>{HUONG_XU_LY_LABELS[value] || value}</Tag>
}

// ── shared columns ────────────────────────────────────────────────────────────

function baseColumns(): ColumnsType<DeliveryPostTask> {
  return [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 140,
      render: v => <Text strong>{v || '—'}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Hàng hóa',
      dataIndex: 'ten_hang',
      ellipsis: true,
    },
    {
      title: 'Tình trạng',
      dataIndex: 'tinh_trang',
      width: 130,
      render: v => <TinhTrangTag value={v} />,
    },
    {
      title: 'Hướng xử lý',
      dataIndex: 'huong_xu_ly',
      width: 160,
      render: v => <HuongXuLyTag value={v} />,
    },
    {
      title: 'SL cũ → mới',
      width: 120,
      render: (_, r) => (
        <span>
          {r.so_luong_cu} → {r.so_luong_moi}
          {r.so_luong_bu_hao > 0 && (
            <Text type="secondary"> (+{r.so_luong_bu_hao} bù)</Text>
          )}
        </span>
      ),
    },
    {
      title: 'Yêu cầu bởi',
      width: 130,
      render: (_, r) => r.created_by?.full_name || '—',
    },
    {
      title: 'Ghi chú SA',
      dataIndex: 'ghi_chu_sa',
      ellipsis: true,
      render: v => v || '—',
    },
  ]
}

// ── ChoChoDuyetTab ─────────────────────────────────────────────────────────────

function ChoDuyetTab() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [approveForm] = Form.useForm()
  const [rejectForm] = Form.useForm()
  const [approveTarget, setApproveTarget] = useState<DeliveryPostTask | null>(null)
  const [rejectTarget, setRejectTarget] = useState<DeliveryPostTask | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-post-tasks', 'cho_duyet'],
    queryFn: () => listTasks({ trang_thai: 'cho_duyet', page_size: 200 }),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { ghi_chu_tp?: string } }) =>
      approveTask(id, payload),
    onSuccess: () => {
      message.success('Đã duyệt yêu cầu')
      qc.invalidateQueries({ queryKey: ['delivery-post-tasks'] })
      setApproveTarget(null)
      approveForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi duyệt'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { ghi_chu_tp?: string } }) =>
      rejectTask(id, payload),
    onSuccess: () => {
      message.success('Đã từ chối yêu cầu — phiếu đã được mở khóa')
      qc.invalidateQueries({ queryKey: ['delivery-post-tasks'] })
      setRejectTarget(null)
      rejectForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi từ chối'),
  })

  const columns: ColumnsType<DeliveryPostTask> = [
    ...baseColumns(),
    {
      title: 'Hành động',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="Duyệt">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => setApproveTarget(r)}
            >
              Duyệt
            </Button>
          </Tooltip>
          <Tooltip title="Từ chối">
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setRejectTarget(r)}
            >
              Từ chối
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Table
        loading={isLoading}
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 50 }}
      />

      {/* Approve modal */}
      <Modal
        open={!!approveTarget}
        title={`Duyệt yêu cầu — ${approveTarget?.so_phieu}`}
        onCancel={() => { setApproveTarget(null); approveForm.resetFields() }}
        onOk={() => {
          approveForm.validateFields().then(vals => {
            approveMut.mutate({ id: approveTarget!.id, payload: vals })
          })
        }}
        confirmLoading={approveMut.isPending}
        okText="Xác nhận duyệt"
      >
        {approveTarget && (
          <div style={{ marginBottom: 12 }}>
            <p><strong>Hàng:</strong> {approveTarget.ten_hang}</p>
            <p><strong>Tình trạng:</strong> <TinhTrangTag value={approveTarget.tinh_trang} /></p>
            <p><strong>Hướng xử lý:</strong> <HuongXuLyTag value={approveTarget.huong_xu_ly} /></p>
            <p><strong>SL:</strong> {approveTarget.so_luong_cu} → {approveTarget.so_luong_moi}
              {approveTarget.so_luong_bu_hao > 0 && ` (bù hao: ${approveTarget.so_luong_bu_hao})`}
            </p>
            {approveTarget.ghi_chu_sa && <p><strong>Ghi chú SA:</strong> {approveTarget.ghi_chu_sa}</p>}
          </div>
        )}
        <Form form={approveForm} layout="vertical">
          <Form.Item name="ghi_chu_tp" label="Ghi chú (Trưởng Phòng)">
            <Input.TextArea rows={2} placeholder="Ghi chú nếu cần..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        title={`Từ chối yêu cầu — ${rejectTarget?.so_phieu}`}
        onCancel={() => { setRejectTarget(null); rejectForm.resetFields() }}
        onOk={() => {
          rejectForm.validateFields().then(vals => {
            rejectMut.mutate({ id: rejectTarget!.id, payload: vals })
          })
        }}
        confirmLoading={rejectMut.isPending}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
      >
        <p>Từ chối sẽ mở khóa phiếu giao hàng để SA có thể gửi lại yêu cầu mới.</p>
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="ghi_chu_tp" label="Lý do từ chối" rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}>
            <Input.TextArea rows={2} placeholder="Nhập lý do từ chối..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ── ChoKhoTab ─────────────────────────────────────────────────────────────────

function ChoKhoTab() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [target, setTarget] = useState<DeliveryPostTask | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-post-tasks', 'cho_kho_nhan'],
    queryFn: () => listTasks({ trang_thai: 'cho_kho_nhan', page_size: 200 }),
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })
  const warehouses: Warehouse[] = warehousesData || []

  const khoNhanMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { kho_id: number; ghi_chu_kho?: string } }) =>
      khoNhanTask(id, payload),
    onSuccess: () => {
      message.success('Đã xác nhận nhận hàng — tồn kho đã cập nhật')
      qc.invalidateQueries({ queryKey: ['delivery-post-tasks'] })
      setTarget(null)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xác nhận'),
  })

  const columns: ColumnsType<DeliveryPostTask> = [
    ...baseColumns(),
    {
      title: 'Duyệt bởi',
      width: 130,
      render: (_, r) => r.approved_by?.full_name || '—',
    },
    {
      title: 'Ghi chú TP',
      dataIndex: 'ghi_chu_tp',
      ellipsis: true,
      render: v => v || '—',
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<InboxOutlined />}
          onClick={() => setTarget(r)}
        >
          Xác nhận nhận hàng
        </Button>
      ),
    },
  ]

  return (
    <>
      <Table
        loading={isLoading}
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 50 }}
      />

      <Modal
        open={!!target}
        title={`Kho xác nhận nhận hàng — ${target?.so_phieu}`}
        onCancel={() => { setTarget(null); form.resetFields() }}
        onOk={() => {
          form.validateFields().then(vals => {
            khoNhanMut.mutate({ id: target!.id, payload: vals })
          })
        }}
        confirmLoading={khoNhanMut.isPending}
        okText="Xác nhận"
      >
        {target && (
          <div style={{ marginBottom: 12 }}>
            <p><strong>Hàng:</strong> {target.ten_hang}</p>
            <p><strong>Số lượng về kho:</strong> {(target.so_luong_cu - target.so_luong_moi).toFixed(3)} {target.dvt}</p>
            <p><strong>Hướng xử lý:</strong> <HuongXuLyTag value={target.huong_xu_ly} /></p>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="kho_id" label="Kho nhận hàng" rules={[{ required: true, message: 'Chọn kho nhận' }]}>
            <Select placeholder="Chọn kho..." showSearch optionFilterProp="label">
              {warehouses.map(w => (
                <Select.Option key={w.id} value={w.id} label={w.ten_kho}>
                  {w.ten_kho} <Text type="secondary">({w.ma_kho})</Text>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="ghi_chu_kho" label="Ghi chú kho">
            <Input.TextArea rows={2} placeholder="Ghi chú..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ── LichSuTab ─────────────────────────────────────────────────────────────────

function LichSuTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['delivery-post-tasks', 'lich_su'],
    queryFn: () => listTasks({ page_size: 200 }),
  })

  const columns: ColumnsType<DeliveryPostTask> = [
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 140,
      render: v => (
        <Badge
          status={trangThaiColor[v] as any || 'default'}
          text={TRANG_THAI_LABELS[v] || v}
        />
      ),
    },
    ...baseColumns(),
    {
      title: 'Duyệt bởi',
      width: 130,
      render: (_, r) => r.approved_by?.full_name || '—',
    },
    {
      title: 'Ghi chú TP',
      dataIndex: 'ghi_chu_tp',
      ellipsis: true,
      render: v => v || '—',
    },
    {
      title: 'Kho xác nhận',
      width: 130,
      render: (_, r) => r.kho_confirmed_by?.full_name || '—',
    },
  ]

  return (
    <Table
      loading={isLoading}
      dataSource={data?.items || []}
      columns={columns}
      rowKey="id"
      size="small"
      scroll={{ x: 1400 }}
      pagination={{ pageSize: 50 }}
    />
  )
}

// ── Embeddable content (dùng trong tab của trang khác) ───────────────────────

export function HauGiaoHangContent() {
  const { data: choDuyet } = useQuery({
    queryKey: ['delivery-post-tasks', 'cho_duyet'],
    queryFn: () => listTasks({ trang_thai: 'cho_duyet', page_size: 200 }),
  })
  const { data: choKho } = useQuery({
    queryKey: ['delivery-post-tasks', 'cho_kho_nhan'],
    queryFn: () => listTasks({ trang_thai: 'cho_kho_nhan', page_size: 200 }),
  })

  const choDuyetCount = choDuyet?.total ?? 0
  const choKhoCount = choKho?.total ?? 0

  return (
    <Tabs
      defaultActiveKey="cho_duyet"
      items={[
        {
          key: 'cho_duyet',
          label: (
            <Badge count={choDuyetCount} offset={[8, 0]}>
              Chờ duyệt
            </Badge>
          ),
          children: <ChoDuyetTab />,
        },
        {
          key: 'cho_kho_nhan',
          label: (
            <Badge count={choKhoCount} offset={[8, 0]} color="orange">
              Chờ kho xác nhận
            </Badge>
          ),
          children: <ChoKhoTab />,
        },
        {
          key: 'lich_su',
          label: 'Lịch sử',
          children: <LichSuTab />,
        },
      ]}
    />
  )
}

// ── Standalone page ───────────────────────────────────────────────────────────

export default function HauGiaoHangPage() {
  return (
    <App>
      <Card title="Hậu Giao Hàng" style={{ margin: 16 }}>
        <HauGiaoHangContent />
      </Card>
    </App>
  )
}
