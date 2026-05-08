import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Button, Input, Typography, Space, Card, Spin, Tooltip,
  theme, Avatar, Tag,
} from 'antd'
import {
  SendOutlined, RobotOutlined, UserOutlined,
  DeleteOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { agentApi, type ChatMessage } from '../../api/agent'
import { useAuthStore } from '../../store/auth'

const { Text, Paragraph } = Typography
const { TextArea } = Input

// Quick action prompts
const QUICK_ACTIONS = [
  { label: 'Tổng quan hôm nay', prompt: 'Cho tôi xem tổng quan hoạt động hôm nay' },
  { label: 'Doanh thu tháng', prompt: 'Doanh thu tháng này bao nhiêu?' },
  { label: 'Đơn hàng cần giao', prompt: 'Đơn hàng nào đang chờ giao trong 7 ngày tới?' },
  { label: 'Tồn kho sắp hết', prompt: 'Hàng tồn kho nào đang dưới mức tối thiểu?' },
  { label: 'Lệnh SX trễ', prompt: 'Lệnh sản xuất nào đang trễ kế hoạch?' },
  { label: 'Đơn mua chờ duyệt', prompt: 'Đơn mua hàng nào đang chờ duyệt?' },
]

function MessageBubble({ msg, userName }: { msg: ChatMessage; userName: string }) {
  const { token: tk } = theme.useToken()
  const isUser = msg.role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
      gap: 8,
      alignItems: 'flex-start',
    }}>
      {!isUser && (
        <Avatar
          size={32}
          icon={<RobotOutlined />}
          style={{ background: '#1b168e', flexShrink: 0, marginTop: 2 }}
        />
      )}

      <div style={{
        maxWidth: '72%',
        background: isUser ? '#1b168e' : tk.colorBgContainer,
        color: isUser ? '#fff' : tk.colorText,
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '10px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        border: isUser ? 'none' : `1px solid ${tk.colorBorderSecondary}`,
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
        fontSize: 14,
      }}>
        {msg.content}
      </div>

      {isUser && (
        <Avatar
          size={32}
          icon={<UserOutlined />}
          style={{ background: '#ff8200', flexShrink: 0, marginTop: 2 }}
        />
      )}
    </div>
  )
}

function TypingIndicator() {
  const { token: tk } = theme.useToken()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
      <Avatar size={32} icon={<RobotOutlined />} style={{ background: '#1b168e', flexShrink: 0, marginTop: 2 }} />
      <div style={{
        background: tk.colorBgContainer,
        border: `1px solid ${tk.colorBorderSecondary}`,
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <Space size={4}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7,
              borderRadius: '50%',
              background: '#1b168e',
              opacity: 0.4,
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </Space>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function AgentPage() {
  const { token: tk } = theme.useToken()
  const { user } = useAuthStore()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)

    try {
      const res = await agentApi.chat(trimmed, sessionId)
      const { reply, session_id } = res.data
      setSessionId(session_id)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Lỗi kết nối. Vui lòng thử lại.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${detail}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    if (sessionId) agentApi.clearSession(sessionId).catch(() => {})
    setMessages([])
    setSessionId(undefined)
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <Card
        size="small"
        style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none', flexShrink: 0 }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Avatar icon={<RobotOutlined />} style={{ background: '#1b168e' }} />
            <div>
              <Text strong style={{ fontSize: 15 }}>Trợ lý ERP Nam Phương</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Hỏi bằng tiếng Việt tự nhiên — Claude claude-sonnet-4-6
              </Text>
            </div>
          </Space>
          <Space>
            {sessionId && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                {messages.length / 2} lượt
              </Tag>
            )}
            <Tooltip title="Xóa hội thoại">
              <Button
                icon={<DeleteOutlined />}
                size="small"
                disabled={isEmpty}
                onClick={clearChat}
              />
            </Tooltip>
          </Space>
        </div>
      </Card>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        background: tk.colorBgLayout,
        border: `1px solid ${tk.colorBorderSecondary}`,
        borderTop: 'none',
        borderBottom: 'none',
      }}>
        {isEmpty && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <Avatar
              size={64}
              icon={<RobotOutlined />}
              style={{ background: '#1b168e', marginBottom: 16 }}
            />
            <Paragraph style={{ color: tk.colorTextSecondary, marginBottom: 4 }}>
              Xin chào <b>{user?.ho_ten}</b>! Tôi có thể giúp bạn truy vấn dữ liệu ERP.
            </Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 24 }}>
              Hỏi về đơn hàng, tồn kho, sản xuất, báo cáo...
            </Paragraph>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560, margin: '0 auto' }}>
              {QUICK_ACTIONS.map(a => (
                <Button
                  key={a.label}
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => sendMessage(a.prompt)}
                  style={{ borderRadius: 16 }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} userName={user?.ho_ten ?? ''} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions (khi đã có chat) */}
      {!isEmpty && (
        <div style={{
          padding: '8px 16px',
          background: tk.colorBgContainer,
          border: `1px solid ${tk.colorBorderSecondary}`,
          borderTop: 'none',
          borderBottom: 'none',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          {QUICK_ACTIONS.slice(0, 4).map(a => (
            <Button
              key={a.label}
              size="small"
              onClick={() => sendMessage(a.prompt)}
              disabled={loading}
              style={{ borderRadius: 12, fontSize: 12 }}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <Card
        size="small"
        style={{ borderRadius: '0 0 8px 8px', borderTop: 'none', flexShrink: 0 }}
        styles={{ body: { padding: '10px 12px' } }}
      >
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi... (Enter để gửi, Shift+Enter xuống dòng)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ borderRadius: '8px 0 0 8px', resize: 'none' }}
          />
          <Button
            type="primary"
            icon={loading ? <Spin size="small" /> : <SendOutlined />}
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              height: 'auto',
              borderRadius: '0 8px 8px 0',
              background: '#1b168e',
              border: 'none',
              padding: '0 20px',
            }}
          />
        </Space.Compact>
      </Card>
    </div>
  )
}
