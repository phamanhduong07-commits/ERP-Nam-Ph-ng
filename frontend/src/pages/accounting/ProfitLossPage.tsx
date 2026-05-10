import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Typography, Space, Button, DatePicker, Row, Col, Statistic, Select, List, Divider, Skeleton
} from 'antd'
import { 
  FilePdfOutlined, FileExcelOutlined, 
  SearchOutlined, PieChartOutlined, ArrowUpOutlined, ArrowDownOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { arApi } from '../../api/accounting'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { fmtVND, printToPdf } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function ProfitLossPage() {
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ])
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()

  // Lay danh muc phap nhan
  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data)
  })

  // Lay danh muc phan xuong
  const { data: listPhanXuong = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data)
  })

  const { data: pnl, isLoading, refetch } = useQuery({
    queryKey: ['pnl-report', dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanId, phanXuongId],
    queryFn: () => arApi.getPnl({
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
      phan_xuong_id: phanXuongId,
    })
  })

  const handleExportPdf = () => {
    if (!pnl) return
    const content = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="text-align:center">BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH</h2>
        <p style="text-align:center">Từ ngày ${dates[0].format('DD/MM/YYYY')} đến ${dates[1].format('DD/MM/YYYY')}</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background:#f0f2f5"><th style="text-align:left; border:1px solid #ddd; padding:8px">Chỉ tiêu</th><th style="text-align:right; border:1px solid #ddd; padding:8px">Số tiền</th></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">1. Doanh thu bán hàng</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.doanh_thu_gop)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">2. Các khoản giảm trừ doanh thu</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.giam_tru_doanh_thu)}</td></tr>
          <tr style="font-weight:bold"><td style="border:1px solid #ddd; padding:8px">3. Doanh thu thuần (1-2)</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.doanh_thu_thuan)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">4. Giá vốn hàng bán</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.gia_von_hang_ban)}</td></tr>
          <tr style="font-weight:bold; color:#1677ff"><td style="border:1px solid #ddd; padding:8px">5. Lợi nhuận gộp (3-4)</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.loi_nhuan_gop)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">6. Doanh thu tài chính</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.doanh_thu_tai_chinh)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">7. Chi phí tài chính</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.chi_phi_tai_chinh)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">8. Chi phí bán hàng</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.chi_phi_ban_hang)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">9. Chi phí quản lý doanh nghiệp</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.chi_phi_quan_ly)}</td></tr>
          <tr style="font-weight:bold"><td style="border:1px solid #ddd; padding:8px">10. Lợi nhuận thuần từ HĐKD</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.loi_nhuan_thuan_hdkd)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">11. Thu nhập khác</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.thu_nhap_khac)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">12. Chi phí khác</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.chi_phi_khac)}</td></tr>
          <tr style="font-weight:bold; color:#52c41a"><td style="border:1px solid #ddd; padding:8px">13. Tổng lợi nhuận trước thuế</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.tong_loi_nhuan_truoc_thue)}</td></tr>
          <tr><td style="border:1px solid #ddd; padding:8px">14. Thuế TNDN hiện hành</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.thue_tndn)}</td></tr>
          <tr style="font-weight:bold; font-size:1.2em; color:#d4380d"><td style="border:1px solid #ddd; padding:8px">15. LỢI NHUẬN SAU THUẾ</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(pnl.loi_nhuan_sau_thue)}</td></tr>
        </table>
      </div>
    `
    printToPdf('BAO_CAO_P_AND_L', content, true)
  }

  const pnlItems = pnl ? [
    { label: '1. Doanh thu bán hàng và cung cấp dịch vụ', value: pnl.doanh_thu_gop, indent: 0 },
    { label: '2. Các khoản giảm trừ doanh thu', value: pnl.giam_tru_doanh_thu, indent: 0 },
    { label: '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (1 - 2)', value: pnl.doanh_thu_thuan, indent: 0, bold: true },
    { label: '4. Giá vốn hàng bán', value: pnl.gia_von_hang_ban, indent: 0 },
    { label: '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (3 - 4)', value: pnl.loi_nhuan_gop, indent: 0, bold: true, color: '#1677ff' },
    { label: '6. Doanh thu hoạt động tài chính', value: pnl.doanh_thu_tai_chinh, indent: 0 },
    { label: '7. Chi phí tài chính', value: pnl.chi_phi_tai_chinh, indent: 0 },
    { label: '8. Chi phí bán hàng', value: pnl.chi_phi_ban_hang, indent: 0 },
    { label: '9. Chi phí quản lý doanh nghiệp', value: pnl.chi_phi_quan_ly, indent: 0 },
    { label: '10. Lợi nhuận thuần từ hoạt động kinh doanh', value: pnl.loi_nhuan_thuan_hdkd, indent: 0, bold: true },
    { label: '11. Thu nhập khác', value: pnl.thu_nhap_khac, indent: 0 },
    { label: '12. Chi phí khác', value: pnl.chi_phi_khac, indent: 0 },
    { label: '13. Lợi nhuận khác (11 - 12)', value: pnl.loi_nhuan_khac, indent: 0, bold: true },
    { label: '14. Tổng lợi nhuận kế toán trước thuế (10 + 13)', value: pnl.tong_loi_nhuan_truoc_thue, indent: 0, bold: true, color: '#52c41a' },
    { label: '15. Chi phí thuế TNDN hiện hành', value: pnl.thue_tndn, indent: 0 },
    { label: '16. Lợi nhuận sau thuế thu nhập doanh nghiệp (14 - 15)', value: pnl.loi_nhuan_sau_thue, indent: 0, bold: true, color: '#d4380d', large: true },
  ] : []

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space size="middle">
            <PieChartOutlined style={{ fontSize: 32, color: '#1677ff' }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>Báo cáo Kết quả Kinh doanh</Title>
              <Text type="secondary">Phân tích doanh thu, chi phí và lợi nhuận theo chuẩn kế toán</Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="Chọn Pháp nhân"
              allowClear
              value={phapNhanId}
              onChange={setPhapNhanId}
              options={listPhapNhan.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            />
            <Select
              style={{ width: 180 }}
              placeholder="Chọn Xưởng"
              allowClear
              value={phanXuongId}
              onChange={setPhanXuongId}
              options={listPhanXuong.map(px => ({ value: px.id, label: px.ten_xuong }))}
            />
            <RangePicker 
              value={dates} 
              onChange={(v) => v && setDates(v as [dayjs.Dayjs, dayjs.Dayjs])} 
              format="DD/MM/YYYY" 
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
              Cập nhật
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>PDF</Button>
            <Button icon={<FileExcelOutlined />}>Excel</Button>
          </Space>
        </Col>
      </Row>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : pnl && (
        <>
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card bordered={false} className="pnl-card" style={{ background: '#e6f7ff' }}>
                <Statistic 
                  title="Tổng Doanh thu" 
                  value={pnl.doanh_thu_thuan} 
                  prefix={<ArrowUpOutlined />} 
                  suffix="đ"
                  valueStyle={{ color: '#0050b3' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card bordered={false} style={{ background: '#fff7e6' }}>
                <Statistic 
                  title="Giá vốn hàng bán" 
                  value={pnl.gia_von_hang_ban} 
                  prefix={<ArrowDownOutlined />} 
                  suffix="đ"
                  valueStyle={{ color: '#d46b08' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card bordered={false} style={{ background: '#f6ffed' }}>
                <Statistic 
                  title="Lợi nhuận sau thuế" 
                  value={pnl.loi_nhuan_sau_thue} 
                  prefix={<ArrowUpOutlined />} 
                  suffix="đ"
                  valueStyle={{ color: '#389e0d' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết báo cáo" styles={{ body: { padding: '0 24px' } }}>
            <List
              dataSource={pnlItems}
              renderItem={(item) => (
                <List.Item style={{ padding: '16px 0' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    width: '100%',
                    paddingLeft: item.indent * 24,
                    fontWeight: item.bold ? 'bold' : 'normal',
                    fontSize: item.large ? '1.2em' : '1em',
                    color: item.color || 'inherit'
                  }}>
                    <Text strong={item.bold} style={{ color: item.color }}>{item.label}</Text>
                    <Text strong={item.bold} style={{ color: item.color }}>{fmtVND(item.value)}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}
    </div>
  )
}
