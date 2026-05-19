import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Card, Col, DatePicker, Progress, Row, Select, Statistic, Table, Tag, Tooltip,
} from 'antd'
import { WarningOutlined, ClockCircleOutlined, DollarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { purchaseApi, TRANG_THAI_PO, TRANG_THAI_PO_COLOR } from '../../api/purchase'
import { phapNhanApi } from '../../api/phap_nhan'
import { fmtVND } from '../../utils/exportUtils'

const { RangePicker } = DatePicker

export default function PurchaseDashboardPage() {
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>([
    dayjs().startOf('month'), dayjs(),
  ])

  const params = useMemo(() => ({
    phap_nhan_id: phapNhanId,
    tu_ngay: dateRange?.[0]?.format('YYYY-MM-DD'),
    den_ngay: dateRange?.[1]?.format('YYYY-MM-DD'),
  }), [phapNhanId, dateRange])

  const { data, isFetching } = useQuery({
    queryKey: ['purchase-dashboard', params],
    queryFn: () => purchaseApi.dashboard(params).then(r => r.data),
  })

  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
  })

  const kpi = data?.kpi
  const byPhapNhan = data?.by_phap_nhan ?? []
  const topNcc = data?.top_ncc ?? []
  const poByStatus = data?.po_by_status ?? {}

  const maxGrNcc = Math.max(...topNcc.map(n => n.tong_gia_tri_gr), 1)

  const colsPhapNhan: ColumnsType<typeof byPhapNhan[0]> = [
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', ellipsis: true },
    { title: 'Số GR', dataIndex: 'so_phieu_gr', width: 70, align: 'right' },
    { title: 'Giá trị GR', dataIndex: 'tong_gia_tri_gr', width: 150, align: 'right', render: fmtVND },
    { title: 'Số HĐ', dataIndex: 'so_hoa_don', width: 70, align: 'right' },
    { title: 'Giá trị HĐ', dataIndex: 'tong_gia_tri_hd', width: 150, align: 'right', render: fmtVND },
    {
      title: 'Còn nợ', dataIndex: 'tong_con_no', width: 150, align: 'right',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#faad14' : '#52c41a', fontWeight: 600 }}>{fmtVND(v)}</span>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Báo cáo quản trị mua hàng</h2>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col>
            <Select
              allowClear placeholder="Pháp nhân" style={{ width: 180 }}
              options={listPhapNhan.map((p: any) => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
              value={phapNhanId}
              onChange={setPhapNhanId}
            />
          </Col>
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
              onChange={v => setDateRange(v)}
            />
          </Col>
        </Row>
      </Card>

      {/* Warning alerts */}
      {!isFetching && ((kpi?.po_qua_han ?? 0) > 0 || (kpi?.gr_cho_nhap ?? 0) > 0 || (kpi?.hd_qua_han ?? 0) > 0) && (
        <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
          {(kpi?.po_qua_han ?? 0) > 0 && (
            <Col xs={24} sm={8}>
              <Alert
                type="warning"
                showIcon
                icon={<ClockCircleOutlined />}
                message={
                  <span>
                    <strong>{kpi!.po_qua_han}</strong> đơn mua&nbsp;
                    <Tooltip title="PO đã gửi NCC nhưng ngày giao dự kiến đã qua"><span style={{ borderBottom: '1px dashed #d48806', cursor: 'help' }}>quá hạn giao</span></Tooltip>
                  </span>
                }
                style={{ padding: '6px 12px' }}
              />
            </Col>
          )}
          {(kpi?.gr_cho_nhap ?? 0) > 0 && (
            <Col xs={24} sm={8}>
              <Alert
                type="info"
                showIcon
                icon={<WarningOutlined />}
                message={
                  <span>
                    <strong>{kpi!.gr_cho_nhap}</strong> phiếu nhập kho&nbsp;
                    <Tooltip title="Phiếu nhập trạng thái Chờ duyệt, chưa cập nhật tồn"><span style={{ borderBottom: '1px dashed #0958d9', cursor: 'help' }}>chờ duyệt</span></Tooltip>
                  </span>
                }
                style={{ padding: '6px 12px' }}
              />
            </Col>
          )}
          {(kpi?.hd_qua_han ?? 0) > 0 && (
            <Col xs={24} sm={8}>
              <Alert
                type="error"
                showIcon
                icon={<DollarOutlined />}
                message={
                  <span>
                    <strong>{kpi!.hd_qua_han}</strong> hóa đơn&nbsp;
                    <Tooltip title="Hóa đơn mua hàng đã quá hạn thanh toán"><span style={{ borderBottom: '1px dashed #a8071a', cursor: 'help' }}>quá hạn thanh toán</span></Tooltip>
                  </span>
                }
                style={{ padding: '6px 12px' }}
              />
            </Col>
          )}
        </Row>
      )}

      {/* KPI Cards — Row 1 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={6}>
          <Card size="small" loading={isFetching}>
            <Statistic title="Tổng PO trong kỳ" value={kpi?.tong_po ?? 0} suffix="đơn" />
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{fmtVND(kpi?.tong_gia_tri_po)}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={isFetching}>
            <Statistic title="Tổng GR đã duyệt" value={kpi?.tong_gr ?? 0} suffix="phiếu" />
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{fmtVND(kpi?.tong_gia_tri_gr)}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={isFetching}>
            <Statistic title="Hóa đơn mua hàng" value={kpi?.tong_hoa_don ?? 0} suffix="HĐ" />
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{fmtVND(kpi?.tong_gia_tri_hd)}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={isFetching}>
            <Statistic
              title="Còn phải trả NCC"
              value={kpi?.tong_con_no ?? 0}
              formatter={v => fmtVND(Number(v))}
              valueStyle={{ color: (kpi?.tong_con_no ?? 0) > 0 ? '#faad14' : '#52c41a' }}
            />
            <Progress
              percent={kpi && kpi.tong_gia_tri_hd > 0 ? Math.round(kpi.tong_da_tt / kpi.tong_gia_tri_hd * 100) : 0}
              size="small"
              style={{ marginTop: 4 }}
              strokeColor="#52c41a"
            />
          </Card>
        </Col>
      </Row>

      {/* PO by Status */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {Object.entries(poByStatus).map(([status, count]) => (
          <Col key={status}>
            <Card size="small" loading={isFetching} style={{ minWidth: 110, textAlign: 'center' }}>
              <Tag color={TRANG_THAI_PO_COLOR[status] ?? 'default'}>{TRANG_THAI_PO[status] ?? status}</Tag>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{count}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* By pháp nhân */}
        <Col span={14}>
          <Card
            title="Phân tích theo pháp nhân"
            size="small"
            style={{ marginBottom: 12 }}
            loading={isFetching}
          >
            <Table
              rowKey="phap_nhan_id"
              columns={colsPhapNhan}
              dataSource={byPhapNhan}
              size="small"
              pagination={false}
              summary={() => (
                <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                  <Table.Summary.Cell index={0}>Tổng</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{kpi?.tong_gr}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{fmtVND(kpi?.tong_gia_tri_gr)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{kpi?.tong_hoa_don}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">{fmtVND(kpi?.tong_gia_tri_hd)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">{fmtVND(kpi?.tong_con_no)}</Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>

        {/* Top NCC */}
        <Col span={10}>
          <Card title="Top 10 NCC theo giá trị nhận hàng" size="small" loading={isFetching}>
            {topNcc.map((ncc, i) => (
              <div key={ncc.supplier_id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 500 }}>{i + 1}. {ncc.ten_ncc}</span>
                  <span style={{ color: '#666' }}>{ncc.so_phieu_gr} GR — {fmtVND(ncc.tong_gia_tri_gr)}</span>
                </div>
                <Progress
                  percent={Math.round(ncc.tong_gia_tri_gr / maxGrNcc * 100)}
                  size="small"
                  showInfo={false}
                  strokeColor={i === 0 ? '#1677ff' : i < 3 ? '#52c41a' : '#d9d9d9'}
                  style={{ marginTop: 2 }}
                />
              </div>
            ))}
            {topNcc.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>Không có dữ liệu</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
