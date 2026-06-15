import React, { useState, useMemo } from 'react'
import { Input, Typography, Badge, Empty } from 'antd'
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

const { Title, Text } = Typography

interface ReportItem {
  icon: string
  name: string
  desc: string
  path: string
  permissions?: string[]
}

interface ReportGroup {
  title: string
  color: string
  bg: string
  items: ReportItem[]
}

const GROUPS: ReportGroup[] = [
  {
    title: 'Tổng hợp Group',
    color: '#1d3557',
    bg: '#e8f0fe',
    items: [
      { icon: '💰', name: 'Dòng tiền Group (Ngày)', desc: 'Thu chi từng ngân hàng, từng pháp nhân theo ngày', path: '/reports/cashflow-daily', permissions: ['report.export'] },
      { icon: '📊', name: 'P&L Group (3 PN)', desc: 'Lãi lỗ 3 pháp nhân song song + tổng Group', path: '/reports/group-pnl', permissions: ['report.export'] },
      { icon: '📈', name: 'Doanh số Group (Xưởng)', desc: 'Doanh số toàn Group theo từng phân xưởng', path: '/reports/sales-group', permissions: ['report.export'] },
      { icon: '🏦', name: 'Công nợ Group', desc: 'AR/AP aging 7 buckets toàn Group', path: '/reports/group-debt', permissions: ['report.cong_no'] },
      { icon: '🎯', name: 'Doanh số NV Kinh doanh', desc: 'Thực hiện vs mục tiêu từng nhân viên KD', path: '/reports/sales-nvkd', permissions: ['report.export'] },
    ],
  },
  {
    title: 'Báo cáo Quản trị',
    color: '#E65100',
    bg: '#fff3e0',
    items: [
      { icon: '🏭', name: 'Lãi lỗ Phân xưởng', desc: 'Doanh thu, chi phí, lãi lỗ từng phân xưởng', path: '/accounting/reports/workshop-pnl', permissions: ['report.export'] },
      { icon: '🔧', name: 'Giá thành sản phẩm', desc: 'Chi phí sản xuất theo LSX và từng sản phẩm', path: '/accounting/reports/production-costing', permissions: ['report.export'] },
      { icon: '💹', name: 'Doanh thu', desc: 'Báo cáo doanh thu theo kỳ và khách hàng', path: '/reports/revenue', permissions: ['report.export'] },
      { icon: '⚡', name: 'Hiệu suất sản xuất', desc: 'KPI năng suất, tỷ lệ hoàn thành, lãng phí', path: '/reports/production-performance', permissions: ['report.view'] },
    ],
  },
  {
    title: 'Tài chính & Thuế',
    color: '#1565C0',
    bg: '#e3f2fd',
    items: [
      { icon: '📋', name: 'Lãi / Lỗ', desc: 'Báo cáo lãi lỗ tổng hợp theo kỳ', path: '/accounting/profit-loss', permissions: ['accounting.view'] },
      { icon: '📑', name: 'Bảng CĐPS (Thuế)', desc: 'Cân đối phát sinh phục vụ khai thuế', path: '/reports/tax-trial-balance', permissions: ['accounting.view'] },
      { icon: '🧾', name: 'Tờ khai thuế GTGT', desc: 'Tổng hợp GTGT đầu vào / đầu ra theo kỳ', path: '/reports/vat-summary', permissions: ['accounting.view'] },
    ],
  },
  {
    title: 'Kho & Công nợ',
    color: '#1B5E20',
    bg: '#e8f5e9',
    items: [
      { icon: '📦', name: 'Nhập-Xuất-Tồn kho', desc: 'Biến động kho theo kỳ, từng mặt hàng', path: '/reports/inventory', permissions: ['report.inventory'] },
      { icon: '🗂️', name: 'Tồn phôi & Thành phẩm', desc: 'Tồn kho phôi và thành phẩm theo xưởng', path: '/reports/phoi-thanh-pham', permissions: ['report.phoi_thanh_pham'] },
      { icon: '💳', name: 'Công nợ tổng hợp', desc: 'Công nợ khách hàng và nhà cung cấp', path: '/reports/debt-summary', permissions: ['report.cong_no'] },
    ],
  },
  {
    title: 'Mua hàng',
    color: '#00695C',
    bg: '#e0f2f1',
    items: [
      { icon: '🛒', name: 'Báo cáo mua hàng', desc: 'Tổng hợp mua hàng theo NCC, vật tư, kỳ', path: '/purchasing/reports', permissions: ['purchase.reports'] },
    ],
  },
  {
    title: 'Nhân sự',
    color: '#4E342E',
    bg: '#efebe9',
    items: [
      { icon: '👥', name: 'Báo cáo HR', desc: 'Chấm công, lương, tổng hợp nhân sự', path: '/hr/reports', permissions: ['hr.view'] },
    ],
  },
]

const ReportingHubPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''
  const userPerms: string[] = (user as any)?.permissions ?? []

  const canSee = (perms?: string[]) => {
    if (role === 'ADMIN' || !perms || perms.length === 0) return true
    return perms.some(p => userPerms.includes(p))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return GROUPS
      .map(g => ({
        ...g,
        items: g.items.filter(r =>
          canSee(r.permissions) &&
          (!q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.items.length > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, userPerms.join(',')])

  const totalVisible = filtered.reduce((s, g) => s + g.items.length, 0)

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1d3557 0%, #457b9d 100%)',
        borderRadius: 12,
        padding: '32px 36px',
        marginBottom: 36,
        color: '#fff',
      }}>
        <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
          Trung tâm Báo cáo
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, display: 'block', marginTop: 6, marginBottom: 22 }}>
          Nam Phương Group — {totalVisible} báo cáo
        </Text>
        <Input
          prefix={<SearchOutlined style={{ color: '#aaa' }} />}
          placeholder="Tìm nhanh tên báo cáo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          size="large"
          style={{ maxWidth: 460, borderRadius: 8 }}
        />
      </div>

      {filtered.length === 0 ? (
        <Empty description={`Không tìm thấy báo cáo nào với từ khóa "${search}"`} style={{ padding: '60px 0' }} />
      ) : (
        filtered.map((group, gi) => (
          <div key={group.title} style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 4, height: 18, borderRadius: 2, background: group.color, flexShrink: 0 }} />
              <Title level={5} style={{ margin: 0, color: group.color, fontWeight: 700, fontSize: 14 }}>
                {group.title}
              </Title>
              <Badge count={group.items.length} style={{ background: group.color }} />
              <div style={{ flex: 1, height: 1, background: '#e8e8e8', marginLeft: 4 }} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: gi === 0
                ? 'repeat(auto-fill, minmax(180px, 1fr))'
                : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {group.items.map(item => (
                <HubCard
                  key={item.path}
                  item={item}
                  groupColor={group.color}
                  groupBg={group.bg}
                  onClick={() => navigate(item.path)}
                  highlight={search.trim()}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

interface HubCardProps {
  item: ReportItem
  groupColor: string
  groupBg: string
  onClick: () => void
  highlight: string
}

const HubCard: React.FC<HubCardProps> = ({ item, groupColor, groupBg, onClick, highlight }) => {
  const [hovered, setHovered] = useState(false)

  const mark = (text: string) => {
    if (!highlight) return <>{text}</>
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#ffe58f', padding: '0 1px', borderRadius: 2 }}>
          {text.slice(idx, idx + highlight.length)}
        </mark>
        {text.slice(idx + highlight.length)}
      </>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? groupBg : '#fafafa',
        border: `1.5px solid ${hovered ? groupColor : '#ebebeb'}`,
        borderRadius: 10,
        padding: '16px 14px 12px',
        cursor: 'pointer',
        transition: 'all 0.16s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        boxShadow: hovered ? `0 4px 18px ${groupColor}25` : '0 1px 4px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        outline: 'none',
      }}
    >
      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 2 }}>{item.icon}</div>
      <Text strong style={{
        fontSize: 12.5,
        color: hovered ? groupColor : '#1a1a1a',
        lineHeight: 1.35,
        display: 'block',
      }}>
        {mark(item.name)}
      </Text>
      <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.4, flexGrow: 1 }}>
        {mark(item.desc)}
      </Text>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <ArrowRightOutlined style={{
          color: hovered ? groupColor : '#d0d0d0',
          fontSize: 11,
          transform: hovered ? 'translateX(3px)' : 'none',
          transition: 'transform 0.16s, color 0.16s',
        }} />
      </div>
    </div>
  )
}

export default ReportingHubPage
