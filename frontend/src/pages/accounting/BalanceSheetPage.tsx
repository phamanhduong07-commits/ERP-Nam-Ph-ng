import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Typography, Space, Button, DatePicker, Divider, Row, Col, Statistic, Select, List, Skeleton, Tag
} from 'antd'
import { 
  FilePdfOutlined, FileExcelOutlined, 
  SearchOutlined, BankOutlined, AuditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { arApi } from '../../api/accounting'
import { phapNhanApi } from '../../api/phap_nhan'
import { fmtVND, printToPdf } from '../../utils/exportUtils'

const { Title, Text } = Typography

export default function BalanceSheetPage() {
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs().endOf('month'))
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()

  // Lay danh muc phap nhan
  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data)
  })

  const { data: bs, isLoading, refetch } = useQuery({
    queryKey: ['balance-sheet', date.format('YYYY-MM-DD'), phapNhanId],
    queryFn: () => arApi.getBalanceSheet({
      ngay: date.format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
    })
  })

  const handleExportPdf = () => {
    if (!bs) return
    const content = `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="text-align:center">BẢNG CÂN ĐỐI KẾ TOÁN</h2>
        <p style="text-align:center">Tại ngày ${date.format('DD/MM/YYYY')}</p>
        <div style="display:flex; justify-content: space-between; margin-top: 20px;">
          <div style="width:48%">
            <h3 style="background:#f0f2f5; padding:8px; border:1px solid #ddd">A. TÀI SẢN</h3>
            <table style="width:100%; border-collapse: collapse;">
              <tr><td style="border:1px solid #ddd; padding:8px">Tiền và tương đương tiền</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.tai_san.tien_mat_va_tgnh)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Phải thu khách hàng</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.tai_san.phai_thu_khach_hang)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Hàng tồn kho</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.tai_san.hang_ton_kho)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Tài sản cố định</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.tai_san.tai_san_co_dinh)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Hao mòn lũy kế</td><td style="text-align:right; border:1px solid #ddd; padding:8px">(${fmtVND(Math.abs(bs.tai_san.hao_mon_luy_ke))})</td></tr>
              <tr style="font-weight:bold; background:#e6f7ff"><td style="border:1px solid #ddd; padding:8px">TỔNG CỘNG TÀI SẢN</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.tai_san.tong_tai_san)}</td></tr>
            </table>
          </div>
          <div style="width:48%">
            <h3 style="background:#f0f2f5; padding:8px; border:1px solid #ddd">B. NGUỒN VỐN</h3>
            <table style="width:100%; border-collapse: collapse;">
              <tr><td style="border:1px solid #ddd; padding:8px">Phải trả người bán</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.nguon_von.phai_tra_nha_cung_cap)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Thuế và các khoản phải nộp</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.nguon_von.thue_va_cac_khoan_phai_nop)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Phải trả người lao động</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.nguon_von.phai_tra_nguoi_lao_dong)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Vốn góp chủ sở hữu</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.nguon_von.von_gop_chu_so_huu)}</td></tr>
              <tr><td style="border:1px solid #ddd; padding:8px">Lợi nhuận chưa phân phối</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.nguon_von.loi_nhuan_sau_thue_chua_phan_phoi)}</td></tr>
              <tr style="font-weight:bold; background:#f6ffed"><td style="border:1px solid #ddd; padding:8px">TỔNG CỘNG NGUỒN VỐN</td><td style="text-align:right; border:1px solid #ddd; padding:8px">${fmtVND(bs.nguon_von.tong_nguon_von)}</td></tr>
            </table>
          </div>
        </div>
      </div>
    `
    printToPdf('BANG_CAN_DOI_KE_TOAN', content, true)
  }

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space size="middle">
            <BankOutlined style={{ fontSize: 32, color: '#1677ff' }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>Bảng Cân đối Kế toán</Title>
              <Text type="secondary">Tình hình tài sản và nguồn vốn của doanh nghiệp</Text>
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
            <DatePicker 
              value={date} 
              onChange={(v) => v && setDate(v)} 
              format="DD/MM/YYYY" 
              placeholder="Chọn ngày"
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
              Cập nhật
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>Xuất PDF</Button>
          </Space>
        </Col>
      </Row>

      {isLoading ? (
        <Skeleton active />
      ) : bs && (
        <Row gutter={24}>
          <Col span={12}>
            <Card 
              title={<Space><AuditOutlined /> TÀI SẢN</Space>} 
              extra={<Tag color="blue">Tổng: {fmtVND(bs.tai_san.tong_tai_san)}</Tag>}
            >
              <List itemLayout="horizontal">
                <List.Item extra={fmtVND(bs.tai_san.tien_mat_va_tgnh)}>
                  <List.Item.Meta title="Tiền và tương đương tiền" description="Tiền mặt, tiền gửi ngân hàng" />
                </List.Item>
                <List.Item extra={fmtVND(bs.tai_san.phai_thu_khach_hang)}>
                  <List.Item.Meta title="Các khoản phải thu ngắn hạn" description="Nợ từ khách hàng (131)" />
                </List.Item>
                <List.Item extra={fmtVND(bs.tai_san.hang_ton_kho)}>
                  <List.Item.Meta title="Hàng tồn kho" description="NVL, Thành phẩm, CCDC" />
                </List.Item>
                <List.Item extra={fmtVND(bs.tai_san.tai_san_co_dinh)}>
                  <List.Item.Meta title="Tài sản cố định" description="Máy móc, nhà xưởng, phương tiện" />
                </List.Item>
                <List.Item extra={<Text type="danger">({fmtVND(Math.abs(bs.tai_san.hao_mon_luy_ke))})</Text>}>
                  <List.Item.Meta title="Hao mòn lũy kế" description="Giá trị đã khấu hao" />
                </List.Item>
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                  <Text strong>TỔNG CỘNG TÀI SẢN</Text>
                  <Text strong color="blue">{fmtVND(bs.tai_san.tong_tai_san)}</Text>
                </div>
              </List>
            </Card>
          </Col>
          <Col span={12}>
            <Card 
              title={<Space><AuditOutlined /> NGUỒN VỐN</Space>} 
              extra={<Tag color="green">Tổng: {fmtVND(bs.nguon_von.tong_nguon_von)}</Tag>}
            >
              <List itemLayout="horizontal">
                <List.Item extra={fmtVND(bs.nguon_von.phai_tra_nha_cung_cap)}>
                  <List.Item.Meta title="Phải trả người bán" description="Nợ nhà cung cấp (331)" />
                </List.Item>
                <List.Item extra={fmtVND(bs.nguon_von.thue_va_cac_khoan_phai_nop)}>
                  <List.Item.Meta title="Thuế và các khoản phải nộp" description="VAT, Thuế TNDN" />
                </List.Item>
                <List.Item extra={fmtVND(bs.nguon_von.phai_tra_nguoi_lao_dong)}>
                  <List.Item.Meta title="Phải trả người lao động" description="Lương, bảo hiểm" />
                </List.Item>
                <List.Item extra={fmtVND(bs.nguon_von.von_gop_chu_so_huu)}>
                  <List.Item.Meta title="Vốn góp của chủ sở hữu" description="Vốn điều lệ" />
                </List.Item>
                <List.Item extra={fmtVND(bs.nguon_von.loi_nhuan_sau_thue_chua_phan_phoi)}>
                  <List.Item.Meta title="Lợi nhuận sau thuế chưa phân phối" description="Lợi nhuận tích lũy (421)" />
                </List.Item>
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                  <Text strong>TỔNG CỘNG NGUỒN VỐN</Text>
                  <Text strong color="green">{fmtVND(bs.nguon_von.tong_nguon_von)}</Text>
                </div>
              </List>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
