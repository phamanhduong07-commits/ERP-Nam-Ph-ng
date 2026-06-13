/**
 * Dashboard HR — Phiên bản 2 (redesign sạch, dễ nhìn).
 *
 * Bố cục:
 * 1) Hero header — gradient + welcome + quick actions
 * 2) 4 KPI cards — đồng nhất (icon to + số to + sub label)
 * 3) Việc cần làm hôm nay — alerts strip compact (6 chip clickable)
 * 4) Hàng charts — Donut (3 cái) + center text
 * 5) Top bộ phận — rank list với progress bar
 * 6) Cơ cấu độ tuổi — bar chart đẹp với rounded
 */
import { useQuery } from '@tanstack/react-query'
import {
  Card, Col, Row, Statistic, Typography, Empty, Tag, Space, Alert, Skeleton,
  Button, Avatar, Progress, Divider,
} from 'antd'
import {
  TeamOutlined, PercentageOutlined, GiftOutlined, CalendarOutlined,
  MobileOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined,
  DashboardOutlined, MedicineBoxOutlined, SafetyOutlined, AlertOutlined,
  ReloadOutlined, ApartmentOutlined, RightOutlined,
} from '@ant-design/icons'
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Link } from 'react-router-dom'
import { hrApi } from '../../api/hr'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// ─── Module navigation groups ───
const MODULE_GROUPS = [
  {
    label: 'Nhân sự', color: '#1677ff',
    items: [
      { to: '/hr/employees', icon: '👤', label: 'Hồ sơ nhân viên' },
      { to: '/hr/departments', icon: '🏢', label: 'Cơ cấu tổ chức' },
      { to: '/hr/permission-matrix', icon: '🔒', label: 'Phân quyền' },
      { to: '/hr/team-permissions', icon: '🔑', label: 'Quyền cá nhân' },
    ],
  },
  {
    label: 'Chấm công', color: '#52c41a',
    items: [
      { to: '/hr/attendance', icon: '⏰', label: 'Chấm công & Đơn từ' },
      { to: '/hr/checkin-locations', icon: '📍', label: 'Địa điểm' },
      { to: '/hr/approvals', icon: '📝', label: 'Phê duyệt đơn từ' },
    ],
  },
  {
    label: 'Tiền lương', color: '#fa8c16',
    items: [
      { to: '/hr/production-output', icon: '📦', label: 'Sản lượng tháng' },
      { to: '/hr/payroll-adjustments', icon: '💰', label: 'Phụ cấp & Khấu trừ' },
      { to: '/hr/payroll-runs', icon: '💵', label: 'Bảng lương tháng' },
      { to: '/hr/payroll-complaints', icon: '⚠️', label: 'Khiếu nại lương' },
      { to: '/hr/payroll-config', icon: '⚙️', label: 'Cấu hình lương' },
    ],
  },
  {
    label: 'Phúc lợi', color: '#722ed1',
    items: [
      { to: '/hr/rewards', icon: '🏆', label: 'Khen thưởng & Kỷ luật' },
      { to: '/hr/benefits', icon: '🎁', label: 'Phúc lợi nhân viên' },
      { to: '/hr/health-checks', icon: '🏥', label: 'Khám sức khỏe' },
      { to: '/hr/safety', icon: '🛡️', label: 'An toàn lao động' },
      { to: '/hr/kpi', icon: '🎯', label: 'KPI / Đánh giá' },
    ],
  },
  {
    label: 'Báo cáo', color: '#13c2c2',
    items: [
      { to: '/hr/reports', icon: '📑', label: 'Báo cáo HR' },
      { to: '/hr/me', icon: '📱', label: 'Cổng nhân viên' },
    ],
  },
]

// ─── Color tokens ───
const COLORS_PHAP_NHAN = ['#722ed1', '#1677ff', '#13c2c2', '#52c41a', '#fa8c16']
const COLORS_GENDER: Record<string, string> = {
  'Nam': '#1677ff', 'Nữ': '#eb2f96', 'Không rõ': '#d9d9d9',
}
const COLORS_AGE = ['#52c41a', '#1677ff', '#fa8c16', '#fa541c', '#cf1322']
const COLORS_TENURE = ['#bae0ff', '#69b1ff', '#1677ff', '#003eb3']
const BAR_DEPT_COLORS = ['#1677ff', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16',
                         '#eb2f96', '#fa541c', '#13a8a8', '#73d13d', '#9254de']

// ─── Helper: vietnamese date ───
const VN_WEEKDAY = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// ─── Center label cho donut ───
function DonutCenter({ label, value }: { label: string; value: number | string }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
      <tspan x="50%" dy="-0.2em" fontSize="11" fill="#8c8c8c">{label}</tspan>
      <tspan x="50%" dy="1.4em" fontSize="22" fontWeight="700" fill="#1677ff">{value}</tspan>
    </text>
  )
}

export default function HRDashboardPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['hr-dashboard-overview'],
    queryFn: () => hrApi.hrDashboardOverview().then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 10 }} /></div>
  }
  if (!data) return <Empty description="Không có dữ liệu" />

  const { summary, by_gender, by_phap_nhan, by_bo_phan, age_distribution, tenure_distribution, alerts } = data
  const today = dayjs()
  const totalTasksToday =
    (alerts.tnld_unreported || 0) + (alerts.health_overdue || 0) +
    alerts.contracts_expiring_60d + alerts.birthdays_30d
  // Max value cho thanh progress của top bộ phận
  const maxDept = by_bo_phan[0]?.value || 1

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* ─── Hero header gradient ─── */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
          border: 'none',
          color: '#fff',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0, color: '#fff' }}>
              <DashboardOutlined /> Dashboard Nhân sự
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              {VN_WEEKDAY[today.day()]}, ngày {today.format('DD/MM/YYYY')} · Tự động cập nhật mỗi 60 giây
              {totalTasksToday > 0 && <> · <strong>{totalTasksToday} việc</strong> cần xử lý</>}
            </Text>
          </Col>
          <Col>
            <Space>
              <Link to="/hr/reports">
                <Button ghost style={{ borderColor: '#fff', color: '#fff' }}>📑 Xuất báo cáo</Button>
              </Link>
              <Button
                ghost
                icon={<ReloadOutlined spin={isFetching} />}
                onClick={() => refetch()}
                style={{ borderColor: '#fff', color: '#fff' }}
              >
                Làm mới
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ─── Module navigation ─── */}
      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '6px 16px' } }}>
        {MODULE_GROUPS.map((group, gIdx) => (
          <div key={group.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px',
                color: '#fff', background: group.color,
                padding: '2px 10px', borderRadius: 4,
                minWidth: 84, textAlign: 'center', flexShrink: 0,
              }}>
                {group.label}
              </span>
              {group.items.map(item => (
                <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 6,
                    border: '1px solid #e5e7eb', background: '#fafafa',
                    fontSize: 12.5, color: '#374151', whiteSpace: 'nowrap', cursor: 'pointer',
                  }}>
                    {item.icon} {item.label}
                  </span>
                </Link>
              ))}
            </div>
            {gIdx < MODULE_GROUPS.length - 1 && (
              <div style={{ height: 1, background: '#f0f1f5' }} />
            )}
          </div>
        ))}
      </Card>

      {/* ─── TNLĐ chưa báo: alert đỏ NẾU có ─── */}
      {alerts.tnld_unreported ? (
        <Alert
          type="error" showIcon icon={<AlertOutlined />}
          message={`⚠ ${alerts.tnld_unreported} vụ TNLĐ nặng/tử vong CHƯA báo Sở LĐ-TBXH!`}
          description={<>Theo luật phải báo trong 24h. <Link to="/hr/safety">→ Vào trang An toàn lao động</Link></>}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {/* ─── 4 KPI cards đồng nhất ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <BigKpiCard
            icon={<TeamOutlined />}
            label="Tổng nhân viên"
            value={summary.total}
            color="#1677ff"
            sub={
              <Space size={4} wrap>
                <Tag color="green" style={{ margin: 0 }}>● {summary.dang_lam} đang làm việc</Tag>
                {summary.tam_nghi > 0 && <Tag color="orange" style={{ margin: 0 }}>{summary.tam_nghi} tạm nghỉ</Tag>}
                {summary.da_nghi > 0 && <Tag style={{ margin: 0 }}>{summary.da_nghi} đã nghỉ việc</Tag>}
              </Space>
            }
          />
        </Col>
        <Col xs={12} md={6}>
          <BigKpiCard
            icon={<ArrowUpOutlined />}
            label={`Tuyển mới ${today.year()}`}
            value={summary.new_hires_ytd}
            color="#52c41a"
            sub={<Text type="secondary" style={{ fontSize: 12 }}>Tính từ ngày 01/01/{today.year()}</Text>}
          />
        </Col>
        <Col xs={12} md={6}>
          <BigKpiCard
            icon={<ArrowDownOutlined />}
            label={`Nghỉ việc ${today.year()}`}
            value={summary.resigned_ytd}
            color="#cf1322"
            sub={<Text type="secondary" style={{ fontSize: 12 }}>Tính từ ngày 01/01/{today.year()}</Text>}
          />
        </Col>
        <Col xs={12} md={6}>
          <BigKpiCard
            icon={<PercentageOutlined />}
            label="Tỉ lệ nghỉ việc"
            value={`${summary.turnover_pct}%`}
            color={summary.turnover_pct > 10 ? '#cf1322' : '#52c41a'}
            sub={
              <Tag color={summary.turnover_pct > 10 ? 'red' : 'green'} style={{ margin: 0 }}>
                {summary.turnover_pct > 10 ? '⚠ Cao hơn 10%' : '✓ Trong ngưỡng an toàn'}
              </Tag>
            }
          />
        </Col>
      </Row>

      {/* ─── Việc cần làm — alerts compact 1 card ─── */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <WarningOutlined style={{ color: '#fa8c16' }} />
            <span>Việc cần xử lý</span>
            {totalTasksToday > 0 && (
              <Tag color="orange">{totalTasksToday} hạng mục</Tag>
            )}
          </Space>
        }
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <AlertChip
              to="/hr/benefits?tab=events&loai=sinh_nhat_nv&days=30"
              icon={<GiftOutlined />}
              count={alerts.birthdays_30d}
              label="Sinh nhật trong 30 ngày tới"
              color="#fa8c16"
              unit="nhân viên"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <AlertChip
              to="/hr/employees?filter=contracts_expiring_60"
              icon={<CalendarOutlined />}
              count={alerts.contracts_expiring_60d}
              label="Hợp đồng lao động hết hạn trong 60 ngày"
              color="#cf1322"
              unit="hợp đồng"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <AlertChip
              to="/hr/health-checks?filter=overdue"
              icon={<MedicineBoxOutlined />}
              count={alerts.health_overdue ?? 0}
              label="Khám sức khỏe đã quá hạn"
              color="#cf1322"
              unit="nhân viên"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <AlertChip
              to="/hr/safety?tab=trainings&filter=cert_expiring_60"
              icon={<SafetyOutlined />}
              count={alerts.cert_expiring_60d ?? 0}
              label="Chứng chỉ An toàn vệ sinh lao động sắp hết hạn"
              color="#fa8c16"
              unit="chứng chỉ"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <AlertChip
              to="/hr/employees?filter=no_account"
              icon={<MobileOutlined />}
              count={alerts.no_account}
              label="Nhân viên chưa được cấp tài khoản đăng nhập"
              color="#1677ff"
              unit="nhân viên"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <AlertChip
              to="/hr/employees?filter=missing_info"
              icon={<WarningOutlined />}
              count={alerts.missing_info}
              label="Hồ sơ chưa đầy đủ (thiếu CCCD/SĐT/BHXH)"
              color="#d48806"
              unit="nhân viên"
            />
          </Col>
        </Row>
      </Card>

      {/* ─── 3 Donut charts — center text ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card size="small" title="🏢 Theo Pháp nhân" styles={{ body: { paddingTop: 0 } }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={by_phap_nhan} dataKey="value" nameKey="name"
                  cx="50%" cy="48%" innerRadius={56} outerRadius={80}
                  paddingAngle={2}
                  label={({ value, percent }: any) =>
                    percent > 0.05 ? `${value} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  labelLine={false}
                >
                  {by_phap_nhan.map((_, i) => (
                    <Cell key={i} fill={COLORS_PHAP_NHAN[i % COLORS_PHAP_NHAN.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <DonutCenter label="Tổng" value={summary.total} />
                <RTooltip formatter={((v: number, n: string) => [`${v} NV`, n]) as any} />
              </PieChart>
            </ResponsiveContainer>
            <Space wrap size={6} style={{ marginTop: 4, justifyContent: 'center', display: 'flex' }}>
              {by_phap_nhan.map((p: any, i) => (
                <Tag key={i} color={COLORS_PHAP_NHAN[i % COLORS_PHAP_NHAN.length]} style={{ margin: 2 }}>
                  {p.name}: <strong>{p.value}</strong>
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="🚻 Theo Giới tính" styles={{ body: { paddingTop: 0 } }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={by_gender.filter(g => g.value > 0)}
                  dataKey="value" nameKey="name"
                  cx="50%" cy="48%" innerRadius={56} outerRadius={80}
                  paddingAngle={2}
                  label={({ value, percent }: any) =>
                    percent > 0.05 ? `${value} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  labelLine={false}
                >
                  {by_gender.filter(g => g.value > 0).map((g, i) => (
                    <Cell key={i} fill={COLORS_GENDER[g.name] || '#bfbfbf'} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <DonutCenter label="Tổng" value={summary.dang_lam} />
                <RTooltip formatter={((v: number, n: string) => [`${v} NV`, n]) as any} />
              </PieChart>
            </ResponsiveContainer>
            <Space wrap size={6} style={{ marginTop: 4, justifyContent: 'center', display: 'flex' }}>
              {by_gender.filter(g => g.value > 0).map((g, i) => (
                <Tag key={i} color={COLORS_GENDER[g.name] || 'default'} style={{ margin: 2 }}>
                  {g.name}: <strong>{g.value}</strong>
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="⏳ Theo Thâm niên" styles={{ body: { paddingTop: 0 } }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={tenure_distribution.filter(t => t.value > 0)}
                  dataKey="value" nameKey="name"
                  cx="50%" cy="48%" innerRadius={56} outerRadius={80}
                  paddingAngle={2}
                  label={({ value, percent }: any) =>
                    percent > 0.05 ? `${value}` : ''
                  }
                  labelLine={false}
                >
                  {tenure_distribution.filter(t => t.value > 0).map((_, i) => (
                    <Cell key={i} fill={COLORS_TENURE[i % COLORS_TENURE.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <DonutCenter label="Trung bình" value="2.3 năm" />
                <RTooltip formatter={((v: number, n: string) => [`${v} NV`, n]) as any} />
              </PieChart>
            </ResponsiveContainer>
            <Space wrap size={6} style={{ marginTop: 4, justifyContent: 'center', display: 'flex' }}>
              {tenure_distribution.filter(t => t.value > 0).map((t, i) => (
                <Tag key={i} color={COLORS_TENURE[i % COLORS_TENURE.length]} style={{ margin: 2 }}>
                  {t.name}: <strong>{t.value}</strong>
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ─── Top bộ phận (rank list) + Cơ cấu độ tuổi (bar) ─── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card size="small" title={<><ApartmentOutlined /> Top 10 bộ phận đông NV nhất</>}>
            <div style={{ padding: '4px 0' }}>
              {by_bo_phan.map((bp, idx) => {
                const pct = (bp.value / maxDept) * 100
                const color = BAR_DEPT_COLORS[idx % BAR_DEPT_COLORS.length]
                return (
                  <div key={bp.name} style={{ marginBottom: 12 }}>
                    <Row justify="space-between" align="middle" style={{ marginBottom: 4 }}>
                      <Col>
                        <Space size={8}>
                          <Avatar size={22} style={{ backgroundColor: color, fontSize: 11, fontWeight: 700 }}>
                            {idx + 1}
                          </Avatar>
                          <Text strong>{bp.name}</Text>
                        </Space>
                      </Col>
                      <Col>
                        <Text strong style={{ color, fontSize: 14 }}>{bp.value} NV</Text>
                      </Col>
                    </Row>
                    <Progress
                      percent={pct} showInfo={false} strokeColor={color}
                      trailColor="#f0f0f0" size="small"
                    />
                  </div>
                )
              })}
              {by_bo_phan.length === 0 && <Empty description="Chưa có dữ liệu" />}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card size="small" title="👥 Cơ cấu Độ tuổi">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={age_distribution}
                margin={{ left: 0, right: 20, top: 20, bottom: 10 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <RTooltip
                  cursor={{ fill: 'rgba(22, 119, 255, 0.05)' }}
                  formatter={((v: number) => [`${v} NV`, 'Số lượng']) as any}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 12, fontWeight: 600 }}>
                  {age_distribution.map((_, i) => (
                    <Cell key={i} fill={COLORS_AGE[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Divider style={{ margin: '8px 0' }} />
            <Row gutter={[4, 4]}>
              {age_distribution.map((a, i) => (
                <Col span={a.name.length > 4 ? 12 : 4} key={a.name}>
                  <Space size={4}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, background: COLORS_AGE[i], borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }} type="secondary">{a.name}: <strong>{a.value}</strong></Text>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ─── BigKpiCard ───
function BigKpiCard({
  icon, label, value, color, sub,
}: {
  icon: React.ReactNode; label: string; value: number | string; color: string; sub?: React.ReactNode
}) {
  return (
    <Card size="small" style={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
      <Row gutter={12} align="middle">
        <Col>
          <div
            style={{
              width: 48, height: 48, borderRadius: 10,
              background: `${color}15`, color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {icon}
          </div>
        </Col>
        <Col flex={1}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{label}</Text>
          <Text strong style={{ fontSize: 28, color, lineHeight: 1.1, display: 'block' }}>
            {value}
          </Text>
          {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
        </Col>
      </Row>
    </Card>
  )
}

// ─── AlertChip ───
function AlertChip({
  to, icon, count, label, color, unit,
}: {
  to: string; icon: React.ReactNode; count: number; label: string; color: string; unit?: string
}) {
  const isWarn = count > 0
  return (
    <Link to={to} style={{ display: 'block', height: '100%' }}>
      <Card
        size="small"
        hoverable
        styles={{
          body: {
            padding: '12px 14px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }
        }}
        style={{
          borderColor: isWarn ? color : '#f0f0f0',
          background: isWarn ? `${color}08` : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s',
          height: '100%',
          minHeight: 86,
        }}
      >
        <Row align="middle" gutter={12} wrap={false} style={{ width: '100%' }}>
          <Col flex="40px">
            <div
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: isWarn ? `${color}20` : '#f0f0f0',
                color: isWarn ? color : '#bfbfbf',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}
            >
              {icon}
            </div>
          </Col>
          <Col flex="1 1 auto" style={{ minWidth: 0, overflow: 'hidden' }}>
            <Text
              style={{
                fontSize: 12, color: '#595959', lineHeight: 1.3,
                // Đảm bảo 2 dòng đồng nhất cho mọi label (clamp)
                minHeight: 32, display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              } as React.CSSProperties}
            >
              {label}
            </Text>
            <Space size={4} align="baseline" style={{ marginTop: 4 }}>
              <Text strong style={{ fontSize: 20, color: isWarn ? color : '#bfbfbf', lineHeight: 1 }}>
                {count}
              </Text>
              {unit && (
                <Text type="secondary" style={{ fontSize: 12 }}>{unit}</Text>
              )}
            </Space>
          </Col>
          <Col flex="16px">
            <RightOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
          </Col>
        </Row>
      </Card>
    </Link>
  )
}
