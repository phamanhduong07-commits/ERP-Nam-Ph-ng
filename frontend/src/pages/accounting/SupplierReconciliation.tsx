import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Col, Row, Select, DatePicker, Button, Table, Typography, Space, Statistic
} from 'antd'
import { SearchOutlined, FilePdfOutlined, ShopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { apApi } from '../../api/accounting'
import { suppliersApi } from '../../api/suppliers'
import { printDocument, fmtVND, fmtNum } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function SupplierReconciliation() {
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs()
  ])

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.list({ page_size: 1000 }).then(r => r.data.items)
  })

  const { data: recon, isLoading, refetch } = useQuery({
    queryKey: ['supplier-reconciliation', supplierId, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')],
    queryFn: () => apApi.getReconciliation(supplierId!, {
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD')
    }),
    enabled: !!supplierId
  })

  const companyInfo = usePhapNhanForPrint()

  const handlePrint = () => {
    if (!recon) return
    const supplier = suppliers.find(s => s.id === supplierId)
    
    const bodyHtml = `
      <div class="recon-content">
        <h3 style="margin-top: 20px;">I. CHI TIẾT NHẬP KHO</h3>
        <table class="doc-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Số phiếu nhập</th>
              <th>Tên hàng</th>
              <th class="text-right">SL Thực nhập</th>
              <th>ĐVT</th>
              <th class="text-right">Đơn giá (PO)</th>
              <th class="text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${recon.items.map((it: any) => `
              <tr>
                <td class="text-center">${dayjs(it.ngay).format('DD/MM/YYYY')}</td>
                <td>${it.so_phieu}</td>
                <td>${it.ten_hang}</td>
                <td class="text-right">${fmtNum(it.so_luong)}</td>
                <td class="text-center">${it.dvt}</td>
                <td class="text-right">${fmtVND(it.don_gia)}</td>
                <td class="text-right">${fmtVND(it.thanh_tien)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6" class="text-right"><b>TỔNG GIÁ TRỊ NHẬP KHO (1)</b></td>
              <td class="text-right"><b>${fmtVND(recon.total_purchase_amount)}</b></td>
            </tr>
          </tfoot>
        </table>

        <h3 style="margin-top: 20px;">II. CHI TIẾT THANH TOÁN (PHIẾU CHI)</h3>
        <table class="doc-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Số phiếu chi</th>
              <th>Diễn giải</th>
              <th class="text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            ${recon.payments.map((p: any) => `
              <tr>
                <td class="text-center">${dayjs(p.ngay_phieu).format('DD/MM/YYYY')}</td>
                <td>${p.so_phieu}</td>
                <td>${p.dien_giai || ''}</td>
                <td class="text-right">${fmtVND(p.so_tien)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-right"><b>TỔNG ĐÃ CHI TRONG KỲ (2)</b></td>
              <td class="text-right"><b>${fmtVND(recon.total_paid_amount)}</b></td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 20px; padding: 15px; border: 2px solid #1b168e; border-radius: 8px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td><b>CHÊNH LỆCH CÒN PHẢI TRẢ (1) - (2):</b></td>
              <td class="text-right" style="font-size: 18px; color: #d32f2f;"><b>${fmtVND(recon.balance)} VNĐ</b></td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <div style="text-align: center; width: 45%;">
            <b>ĐẠI DIỆN NHÀ CUNG CẤP</b><br>
            <i>(Ký và ghi rõ họ tên)</i>
          </div>
          <div style="text-align: center; width: 45%;">
            <b>ĐẠI DIỆN ${companyInfo?.ten?.toUpperCase()}</b><br>
            <i>(Ký và ghi rõ họ tên)</i>
          </div>
        </div>
      </div>
    `

    printDocument({
      title: 'BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ NHÀ CUNG CẤP',
      subtitle: `Từ ngày ${dates[0].format('DD/MM/YYYY')} đến ${dates[1].format('DD/MM/YYYY')}`,
      documentNumber: `DC-NCC-${dayjs().format('YYMMDD')}`,
      documentDate: dayjs().format('DD/MM/YYYY'),
      companyName: companyInfo?.ten || 'CÔNG TY TNHH NAM PHƯƠNG',
      fields: [
        { label: 'Nhà cung cấp', value: supplier?.ten_don_vi || supplier?.ten_viet_tat || '—' },
        { label: 'Địa chỉ', value: supplier?.dia_chi || '—' },
        { label: 'Mã số thuế', value: supplier?.ma_so_thue || '—' }
      ],
      bodyHtml
    })
  }

  const columns = [
    { title: 'Ngày nhập', dataIndex: 'ngay', key: 'ngay', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Phiếu nhập', dataIndex: 'so_phieu', key: 'so_phieu' },
    { title: 'Tên hàng', dataIndex: 'ten_hang', key: 'ten_hang' },
    { title: 'SL Thực nhập', dataIndex: 'so_luong', key: 'so_luong', align: 'right' as const, render: (v: number) => fmtNum(v) },
    { title: 'ĐVT', dataIndex: 'dvt', key: 'dvt' },
    { title: 'Đơn giá (PO)', dataIndex: 'don_gia', key: 'don_gia', align: 'right' as const, render: (v: number) => fmtVND(v) },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', key: 'thanh_tien', align: 'right' as const, render: (v: number) => <Text strong>{fmtVND(v)}</Text> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <ShopOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>Đối chiếu công nợ Nhà cung cấp</Title>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Text type="secondary">Nhà cung cấp</Text>
            <Select
              showSearch
              placeholder="Chọn nhà cung cấp..."
              style={{ width: '100%', marginTop: 4 }}
              value={supplierId}
              onChange={setSupplierId}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={suppliers.map(s => ({ value: s.id, label: `${s.ma_ncc} - ${s.ten_viet_tat}` }))}
            />
          </Col>
          <Col span={8}>
            <Text type="secondary">Khoảng thời gian</Text>
            <RangePicker
              style={{ width: '100%', marginTop: 4 }}
              value={dates}
              onChange={(v) => v && setDates(v as [dayjs.Dayjs, dayjs.Dayjs])}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col span={8} style={{ paddingTop: 22 }}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
                Xem đối chiếu
              </Button>
              {recon && (
                <Button icon={<FilePdfOutlined />} onClick={handlePrint}>
                  Xuất biên bản
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {recon && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Tổng giá trị nhập" value={recon.total_purchase_amount} suffix="đ" valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Tổng đã chi trả" value={recon.total_paid_amount} suffix="đ" valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic title="Dư nợ phải trả" value={recon.balance} suffix="đ" valueStyle={{ color: recon.balance > 0 ? '#cf1322' : '#52c41a' }} />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết nhập kho (Goods Receipt)" styles={{ body: { padding: 0 } }}>
            <Table
              size="small"
              dataSource={recon.items}
              columns={columns}
              pagination={false}
              rowKey={(r: any, i?: number) => `${r.so_phieu}-${i}`}
            />
          </Card>

          <Card title="Chi tiết thanh toán (Phiếu chi)" style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
            <Table
              size="small"
              dataSource={recon.payments}
              columns={[
                { title: 'Ngày', dataIndex: 'ngay_phieu', render: (v) => dayjs(v).format('DD/MM/YYYY') },
                { title: 'Số phiếu chi', dataIndex: 'so_phieu' },
                { title: 'Hình thức', dataIndex: 'hinh_thuc_tt' },
                { title: 'Diễn giải', dataIndex: 'dien_giai' },
                { title: 'Số tiền', dataIndex: 'so_tien', align: 'right', render: (v) => fmtVND(v) },
              ]}
              pagination={false}
              rowKey="id"
            />
          </Card>
        </>
      )}
    </div>
  )
}
