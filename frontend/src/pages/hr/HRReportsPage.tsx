/**
 * Báo cáo HR & Compliance — Phase 1.5.
 *
 * 5 báo cáo Excel cho HR + Sở LĐ:
 * 1. Danh sách NV (Sổ quản lý LĐ)
 * 2. Báo cáo lao động Sở LĐ-TBXH (quý/năm)
 * 3. Bình đẳng giới
 * 4. Chi phí nhân sự
 * 5. Tổng hợp HR theo tháng
 */
import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Tag, Typography, message,
} from 'antd'
import {
  FileExcelOutlined, FileTextOutlined, TeamOutlined, BarChartOutlined,
  DollarOutlined, CalendarOutlined, DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface ReportCard {
  key: string
  title: string
  desc: string
  icon: React.ReactNode
  color: string
  endpoint: string
  filename: (params: any) => string
  controls: React.ReactNode
  getParams: (state: any) => Record<string, any>
}

export default function HRReportsPage() {
  const [year, setYear] = useState(dayjs().year())
  const [quarter, setQuarter] = useState<number | undefined>(Math.ceil((dayjs().month() + 1) / 3))
  const [month, setMonth] = useState(dayjs().month() + 1)
  const [employeeStatus, setEmployeeStatus] = useState<string | undefined>('dang_lam')
  const [downloading, setDownloading] = useState<string | null>(null)

  const download = async (key: string, endpoint: string, params: Record<string, any>, filename: string) => {
    setDownloading(key)
    try {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
      })
      // Get token from localStorage
      const token = localStorage.getItem('access_token') || localStorage.getItem('token')
      const res = await fetch(`/api${endpoint}?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Lỗi ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      message.success(`Đã tải: ${filename}`)
    } catch (e: any) {
      message.error(e.message || 'Lỗi tải báo cáo')
    } finally {
      setDownloading(null)
    }
  }

  const reports: ReportCard[] = [
    {
      key: 'employees-list',
      title: 'Sổ quản lý lao động',
      desc: 'Danh sách toàn bộ NV theo mẫu Bộ LĐ-TBXH — gồm mã NV, họ tên, CCCD, pháp nhân, bộ phận, chức vụ, ngày vào, BHXH, trạng thái.',
      icon: <TeamOutlined />,
      color: '#1677ff',
      endpoint: '/hr/reports/employees-list',
      filename: () => `so-quan-ly-lao-dong-${dayjs().format('YYYYMMDD')}.xlsx`,
      controls: (
        <Select size="small" value={employeeStatus} onChange={setEmployeeStatus}
          style={{ width: 160 }} allowClear placeholder="Tất cả trạng thái"
          options={[
            { value: 'dang_lam', label: 'Đang làm việc' },
            { value: 'tam_nghi', label: 'Tạm nghỉ' },
            { value: 'da_nghi', label: 'Đã nghỉ việc' },
          ]} />
      ),
      getParams: () => ({ trang_thai: employeeStatus }),
    },
    {
      key: 'labor-report',
      title: 'Báo cáo lao động Sở LĐ-TBXH',
      desc: 'Báo cáo quý/năm: tổng LĐ, cơ cấu giới tính, theo pháp nhân, theo loại HĐLĐ, biến động tuyển/nghỉ trong kỳ.',
      icon: <FileTextOutlined />,
      color: '#722ed1',
      endpoint: '/hr/reports/labor-report',
      filename: () => `bao-cao-lao-dong-Q${quarter || 'N'}-${year}.xlsx`,
      controls: (
        <Space>
          <Select size="small" value={year} onChange={setYear} style={{ width: 100 }}
            options={Array.from({ length: 5 }, (_, i) => ({ value: dayjs().year() - i, label: dayjs().year() - i }))} />
          <Select size="small" value={quarter} onChange={setQuarter} style={{ width: 130 }}
            allowClear placeholder="Cả năm"
            options={[1, 2, 3, 4].map(q => ({ value: q, label: `Quý ${q}` }))} />
        </Space>
      ),
      getParams: () => ({ year, quarter }),
    },
    {
      key: 'gender-equality',
      title: 'Báo cáo bình đẳng giới',
      desc: 'Theo NĐ 145/2020 — phân tích Nam/Nữ theo bộ phận, tỷ lệ nữ, đáp ứng yêu cầu báo cáo bình đẳng giới hằng năm.',
      icon: <BarChartOutlined />,
      color: '#eb2f96',
      endpoint: '/hr/reports/gender-equality',
      filename: () => `binh-dang-gioi-${dayjs().format('YYYYMMDD')}.xlsx`,
      controls: null,
      getParams: () => ({}),
    },
    {
      key: 'hr-costs',
      title: 'Chi phí nhân sự năm',
      desc: 'Tổng hợp 5 khoản: lương BHXH, huấn luyện ATVSLĐ, TNLĐ, khám sức khỏe, BHLĐ — theo tỷ trọng %.',
      icon: <DollarOutlined />,
      color: '#52c41a',
      endpoint: '/hr/reports/hr-costs',
      filename: () => `chi-phi-nhan-su-${year}.xlsx`,
      controls: (
        <Select size="small" value={year} onChange={setYear} style={{ width: 100 }}
          options={Array.from({ length: 5 }, (_, i) => ({ value: dayjs().year() - i, label: dayjs().year() - i }))} />
      ),
      getParams: () => ({ year }),
    },
    {
      key: 'summary-report',
      title: 'Báo cáo HR tổng hợp tháng',
      desc: 'File 4 sheet: Tuyển mới · Nghỉ việc · Sinh nhật · HĐLĐ hết hạn trong tháng — gửi BGĐ định kỳ.',
      icon: <CalendarOutlined />,
      color: '#fa8c16',
      endpoint: '/hr/reports/summary-report',
      filename: () => `bao-cao-hr-${String(month).padStart(2, '0')}-${year}.xlsx`,
      controls: (
        <Space>
          <Select size="small" value={year} onChange={setYear} style={{ width: 100 }}
            options={Array.from({ length: 5 }, (_, i) => ({ value: dayjs().year() - i, label: dayjs().year() - i }))} />
          <Select size="small" value={month} onChange={setMonth} style={{ width: 110 }}
            options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))} />
        </Space>
      ),
      getParams: () => ({ year, month }),
    },
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Title level={4} style={{ margin: 0 }}>
        <FileExcelOutlined style={{ color: '#52c41a' }} /> Báo cáo HR & Compliance
      </Title>
      <Text type="secondary">
        Báo cáo định kỳ cho Sở LĐ-TBXH + tổng hợp nội bộ. Tất cả xuất Excel ngay, không cần đợi.
      </Text>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {reports.map(r => (
          <Col xs={24} md={12} lg={8} key={r.key}>
            <Card
              size="small"
              style={{ borderTop: `3px solid ${r.color}`, height: '100%' }}
              title={<Space><span style={{ color: r.color, fontSize: 18 }}>{r.icon}</span> {r.title}</Space>}
              actions={[
                <Button
                  key="download" type="primary" icon={<DownloadOutlined />}
                  loading={downloading === r.key}
                  onClick={() => download(r.key, r.endpoint, r.getParams({}), r.filename({}))}
                  style={{ width: '90%' }}
                >
                  Xuất Excel
                </Button>,
              ]}
            >
              <Text style={{ fontSize: 12 }} type="secondary">{r.desc}</Text>
              {r.controls && (
                <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed #f0f0f0' }}>
                  <Text strong style={{ fontSize: 11 }}>Tham số:</Text>{' '}
                  {r.controls}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" style={{ marginTop: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>💡 Lưu ý sử dụng</Title>
        <ul style={{ marginBottom: 0, color: '#595959', fontSize: 13 }}>
          <li><strong>Sổ quản lý LĐ</strong> phải in + ký + lưu nội bộ theo Điều 12 NĐ 145/2020/NĐ-CP.</li>
          <li><strong>Báo cáo Sở LĐ-TBXH</strong> nộp 6 tháng/lần (chậm nhất 5/7 và 5/1) theo TT 23/2014/TT-BLĐTBXH.</li>
          <li><strong>Bình đẳng giới</strong> báo cáo hằng năm cho UBND/Sở LĐ (NĐ 145/2020 Điều 80).</li>
          <li><strong>Chi phí nhân sự</strong> dùng cho ngân sách năm + phân tích cost-per-employee.</li>
          <li><strong>Tổng hợp tháng</strong> em đề xuất gửi BGĐ vào ngày 1-2 tháng kế tiếp.</li>
        </ul>
      </Card>
    </div>
  )
}
