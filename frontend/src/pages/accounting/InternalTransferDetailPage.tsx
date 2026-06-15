import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Descriptions, Modal, Space, Spin, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import {
  internalTransferApi, InternalTransfer,
  TRANG_THAI_INTERNAL_TRANSFER, HINH_THUC_TT,
} from '../../api/accounting'
import type { ApiError } from '../../api/types'

const { Title } = Typography

export default function InternalTransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const transferId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: transfer, isLoading } = useQuery<InternalTransfer>({
    queryKey: ['internal-transfer', transferId],
    queryFn: () => internalTransferApi.get(transferId),
    enabled: !!transferId,
  })

  const approveMut = useMutation({
    mutationFn: () => internalTransferApi.approve(transferId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu chuyển tiền')
      qc.invalidateQueries({ queryKey: ['internal-transfer', transferId] })
      qc.invalidateQueries({ queryKey: ['internal-transfers'] })
    },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi duyệt'),
  })

  const cancelMut = useMutation({
    mutationFn: () => internalTransferApi.cancel(transferId),
    onSuccess: () => {
      message.success('Đã hủy phiếu chuyển tiền')
      qc.invalidateQueries({ queryKey: ['internal-transfer', transferId] })
      qc.invalidateQueries({ queryKey: ['internal-transfers'] })
    },
    onError: (e: ApiError) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!transfer) return <div style={{ padding: 24 }}>Không tìm thấy phiếu chuyển tiền</div>

  const status = TRANG_THAI_INTERNAL_TRANSFER[transfer.trang_thai]
  const canApprove = transfer.trang_thai === 'cho_duyet'
  const canCancel = transfer.trang_thai !== 'huy'

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/internal-transfers')} />
          <Title level={4} style={{ margin: 0 }}>{transfer.so_phieu}</Title>
          <Tag color={status?.color}>{status?.label ?? transfer.trang_thai}</Tag>
        </Space>
        <Space>
          {canApprove && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={approveMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Duyệt phiếu chuyển tiền?',
                onOk: () => approveMut.mutate(),
              })}
            >
              Duyệt
            </Button>
          )}
          {canCancel && (
            <Button
              danger
              icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Hủy phiếu chuyển tiền?',
                okType: 'danger',
                onOk: () => cancelMut.mutate(),
              })}
            >
              Hủy
            </Button>
          )}
        </Space>
      </div>

      <Card size="small">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số phiếu">{transfer.so_phieu}</Descriptions.Item>
          <Descriptions.Item label="Ngày phiếu">
            {dayjs(transfer.ngay_phieu).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Từ pháp nhân">
            {transfer.tu_phap_nhan_ten ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Đến pháp nhân">
            {transfer.den_phap_nhan_ten ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Từ tài khoản">
            {transfer.tu_tai_khoan ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Đến tài khoản">
            {transfer.den_tai_khoan ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức TT">
            {HINH_THUC_TT[transfer.hinh_thuc_tt] ?? transfer.hinh_thuc_tt}
          </Descriptions.Item>
          <Descriptions.Item label="Số tiền">
            <strong style={{ color: '#1677ff', fontSize: 16 }}>{fmtVND(transfer.so_tien)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="TK Nợ">{transfer.tk_no}</Descriptions.Item>
          <Descriptions.Item label="TK Có">{transfer.tk_co}</Descriptions.Item>
          <Descriptions.Item label="Số tham chiếu">{transfer.so_tham_chieu ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">
            {dayjs(transfer.created_at).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
          {transfer.dien_giai && (
            <Descriptions.Item label="Diễn giải" span={2}>{transfer.dien_giai}</Descriptions.Item>
          )}
          {transfer.ngay_duyet && (
            <Descriptions.Item label="Ngày duyệt" span={2}>
              {dayjs(transfer.ngay_duyet).format('DD/MM/YYYY HH:mm')}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </div>
  )
}
