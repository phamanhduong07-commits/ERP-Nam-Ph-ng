import { Row, Col, Card, Space, Button, Tag, Popconfirm, Modal } from 'antd'
import { Typography } from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined,
  FileAddOutlined, SendOutlined,
} from '@ant-design/icons'
import type { QuoteItem } from '../../../api/quotes'

const { Title, Text } = Typography

interface QuoteData {
  so_bao_gia: string
  trang_thai: string
}

interface QuoteToolbarProps {
  isEdit: boolean
  quoteData: QuoteData | undefined
  onBack: () => void
  isReadonly: boolean
  canApprove: boolean
  isPendingSave: boolean
  onSave: () => void
  isSubmitting: boolean
  isApproving: boolean
  onSubmit: () => void
  onApprove: () => void
  items: QuoteItem[]
  isCreatingOrder: boolean
  onOpenCreateOrder: () => void
  lastSavedAt: Date | null
}

export default function QuoteToolbar({
  isEdit, quoteData, onBack,
  isReadonly, canApprove,
  isPendingSave, onSave,
  isSubmitting, onSubmit,
  isApproving, onApprove,
  items, isCreatingOrder, onOpenCreateOrder,
  lastSavedAt,
}: QuoteToolbarProps) {
  const status = quoteData?.trang_thai

  return (
    <Card style={{ marginBottom: 12 }}>
      <Row justify="space-between" align="middle">
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Danh sách</Button>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Báo giá: ${quoteData?.so_bao_gia}` : 'Thêm báo giá mới'}
            </Title>
            {lastSavedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đã lưu tự động lúc {lastSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
            {quoteData && (
              <Tag color={status === 'moi' ? 'blue' : status === 'da_duyet' ? 'green' : 'red'}>
                {status === 'moi' ? 'Mới' : status === 'da_duyet' ? 'Đã duyệt' : status}
              </Tag>
            )}
          </Space>
        </Col>
        <Col>
          <Space>
            {!isReadonly && (
              <Button
                type="primary" icon={<SaveOutlined />}
                loading={isPendingSave} onClick={onSave}
              >
                {isEdit ? 'Lưu thay đổi' : 'Lưu báo giá'}
              </Button>
            )}

            {isEdit && status === 'moi' && !canApprove && (
              <Popconfirm
                title="Gửi báo giá để trưởng phòng duyệt?"
                description="Sau khi gửi, bạn sẽ không thể chỉnh sửa nữa."
                onConfirm={() => {
                  const zeroItems = items.filter(it => !(it.gia_ban > 0))
                  if (zeroItems.length > 0) {
                    Modal.confirm({
                      title: 'Có mặt hàng chưa có giá bán',
                      content: `${zeroItems.length} mặt hàng có giá bán = 0. Vẫn tiếp tục gửi duyệt?`,
                      okText: 'Gửi duyệt',
                      cancelText: 'Xem lại',
                      onOk: onSubmit,
                    })
                  } else {
                    onSubmit()
                  }
                }}
                okText="Gửi duyệt" cancelText="Huỷ"
              >
                <Button icon={<SendOutlined />} loading={isSubmitting}>Gửi duyệt</Button>
              </Popconfirm>
            )}

            {isEdit && (status === 'moi' || status === 'cho_duyet') && canApprove && (
              <Popconfirm
                title="Duyệt báo giá này?"
                description="Sau khi duyệt sẽ không thể chỉnh sửa nội dung báo giá."
                onConfirm={onApprove}
                okText="Duyệt" cancelText="Huỷ"
              >
                <Button icon={<CheckCircleOutlined />} type="primary" ghost loading={isApproving}>
                  Duyệt báo giá
                </Button>
              </Popconfirm>
            )}

            {isEdit && status === 'da_duyet' && (
              <Button
                type="primary" icon={<FileAddOutlined />}
                loading={isCreatingOrder}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={onOpenCreateOrder}
              >
                Lập đơn hàng
              </Button>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  )
}
