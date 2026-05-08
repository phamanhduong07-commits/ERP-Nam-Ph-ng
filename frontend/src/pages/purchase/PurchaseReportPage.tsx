/**
 * Báo cáo Mua hàng:
 *  - Tab 1: Sổ chi tiết mua hàng (theo NCC + kỳ)
 *  - Tab 2: Biên bản đối chiếu công nợ phải trả (theo NCC + kỳ)
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider,
  Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { purchaseReturnsApi } from '../../api/purchaseReturns'
import type { SoChiTietRow } from '../../api/purchaseReturns'
import client from '../../api/client'
import { exportToExcel } from '../../utils/exportUtils'

const { Title, Text } = Typography

const fmtVND = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + 'đ' : '—'

const INVOICE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  nhap: { label: 'Chưa TT', color: 'default' },
  da_tt_mot_phan: { label: 'Đã TT một phần', color: 'orange' },
  da_tt_du: { label: 'Đã TT đủ', color: 'green' },
  qua_han: { label: 'Quá hạn', color: 'red' },
  huy: { label: 'Huỷ', color: 'default' },
}

const HINH_THUC_LABELS: Record<string, string> = {
  CK: 'Chuyển khoản',
  tien_mat: 'Tiền mặt',
  bu_tru_cong_no: 'Bù trừ công nợ',
  khac: 'Khác',
}

// ─── Tab 1: Sổ chi tiết mua hàng ───────────────────────────────────────────

function SoChiTietTab() {
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs(),
  ])

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => client.get<{ id: number; ten_viet_tat: string }[]>('/suppliers').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['so-chi-tiet-mua', supplierId, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')],
    queryFn: () => purchaseReturnsApi.getSoChiTiet({
      supplier_id: supplierId,
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
    }).then(r => r.data),
    staleTime: 60_000,
  })

  const CHUNG_TU_LABELS: Record<string, string> = {
    hoa_don_mua: 'Hóa đơn mua',
    phieu_chi: 'Phiếu chi',
    purchase_return: 'Trả hàng/GG',
    huy_phieu_chi: 'Huỷ phiếu chi',
  }

  const columns: ColumnsType<SoChiTietRow> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Chứng từ',
      dataIndex: 'chung_tu_loai',
      width: 140,
      render: (v: string | null) => v ? (
        <Tag color={v === 'hoa_don_mua' ? 'blue' : v === 'phieu_chi' ? 'green' : 'orange'}>
          {CHUNG_TU_LABELS[v] || v}
        </Tag>
      ) : '—',
    },
    {
      title: 'NCC',
      dataIndex: 'ten_ncc',
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
      ellipsis: true,
    },
    {
      title: 'Phát sinh Nợ (TK 331)',
      dataIndex: 'phat_sinh_no',
      width: 160,
      align: 'right',
      render: (v: number) => v > 0 ? (
        <Text style={{ color: '#1677ff' }}>{fmtVND(v)}</Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Phát sinh Có (TK 331)',
      dataIndex: 'phat_sinh_co',
      width: 160,
      align: 'right',
      render: (v: number) => v > 0 ? (
        <Text style={{ color: '#389e0d' }}>{fmtVND(v)}</Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Số dư',
      dataIndex: 'so_du',
      width: 140,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#fa8c16' : '#389e0d' }}>{fmtVND(v)}</Text>
      ),
    },
  ]

  const tongNo = data?.rows.reduce((s, r) => s + r.phat_sinh_no, 0) ?? 0
  const tongCo = data?.rows.reduce((s, r) => s + r.phat_sinh_co, 0) ?? 0

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Row gutter={[8, 8]} align="middle">
        <Col>
          <Select
            style={{ width: 240 }}
            placeholder="Tất cả nhà cung cấp"
            allowClear showSearch optionFilterProp="label"
            value={supplierId}
            onChange={v => setSupplierId(v)}
            options={(suppliers as any[]).map(s => ({ value: s.id, label: s.ten_viet_tat }))}
          />
        </Col>
        <Col>
          <DatePicker.RangePicker
            value={[dates[0], dates[1]]}
            format="DD/MM/YYYY"
            onChange={ds => ds && setDates([ds[0]!, ds[1]!])}
          />
        </Col>
        <Col>
          <Button
            icon={<FileExcelOutlined />}
            style={{ color: '#217346', borderColor: '#217346' }}
            disabled={!data}
            onClick={() => {
              if (!data) return
              const tu = dates[0].format('DDMMYYYY')
              const den = dates[1].format('DDMMYYYY')
              exportToExcel(`SoChiTietMuaHang_${tu}_${den}`, [{
                name: 'Sổ chi tiết',
                headers: ['Ngày', 'Chứng từ', 'NCC', 'Diễn giải', 'Phát sinh Nợ', 'Phát sinh Có', 'Số dư'],
                rows: (data.rows ?? []).map((r: SoChiTietRow) => [
                  dayjs(r.ngay).format('DD/MM/YYYY'),
                  CHUNG_TU_LABELS[r.chung_tu_loai ?? ''] ?? r.chung_tu_loai ?? '',
                  r.ten_ncc ?? '',
                  r.dien_giai,
                  r.phat_sinh_no > 0 ? r.phat_sinh_no : '',
                  r.phat_sinh_co > 0 ? r.phat_sinh_co : '',
                  r.so_du,
                ]),
                colWidths: [12, 16, 22, 30, 16, 16, 16],
              }])
            }}
          >
            Xuất Excel
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>
        </Col>
      </Row>

      {isLoading && <Spin />}

      {data && (
        <>
          <Row gutter={16}>
            <Col xs={8}>
              <Statistic
                title="Số dư đầu kỳ"
                value={data.so_du_dau_ky}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 16, color: '#fa8c16' }}
              />
            </Col>
            <Col xs={8}>
              <Statistic
                title="PS Nợ (HĐ mua phát sinh)"
                value={tongNo}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 16, color: '#1677ff' }}
              />
            </Col>
            <Col xs={8}>
              <Statistic
                title="PS Có (TT + Trả hàng)"
                value={tongCo}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 16, color: '#389e0d' }}
              />
            </Col>
          </Row>
          <Statistic
            title="Số dư cuối kỳ (còn phải trả)"
            value={data.so_du_cuoi_ky}
            formatter={v => fmtVND(Number(v))}
            valueStyle={{ fontSize: 20, color: data.so_du_cuoi_ky > 0 ? '#fa541c' : '#52c41a' }}
          />

          <Table<SoChiTietRow>
            rowKey={(r, i) => `${r.ngay}-${r.chung_tu_id}-${i}`}
            size="small"
            dataSource={data.rows}
            columns={columns}
            pagination={{ pageSize: 50, showSizeChanger: false }}
            scroll={{ x: 900 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <Text strong>Tổng phát sinh trong kỳ</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#1677ff' }}>{fmtVND(tongNo)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#389e0d' }}>{fmtVND(tongCo)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: '#fa8c16' }}>{fmtVND(data.so_du_cuoi_ky)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </>
      )}
    </Space>
  )
}

// ─── Tab 2: Biên bản đối chiếu công nợ ────────────────────────────────────

function DoiChieuTab() {
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs(),
  ])

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => client.get<{ id: number; ten_viet_tat: string }[]>('/suppliers').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['doi-chieu-cn', supplierId, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')],
    queryFn: () => purchaseReturnsApi.getDoiChieu(supplierId!, {
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
    }).then(r => r.data),
    enabled: !!supplierId,
    staleTime: 60_000,
  })

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Row gutter={[8, 8]} align="middle">
        <Col>
          <Select
            style={{ width: 280 }}
            placeholder="Chọn nhà cung cấp"
            showSearch optionFilterProp="label"
            value={supplierId}
            onChange={v => setSupplierId(v)}
            options={(suppliers as any[]).map(s => ({ value: s.id, label: s.ten_viet_tat }))}
          />
        </Col>
        <Col>
          <DatePicker.RangePicker
            value={[dates[0], dates[1]]}
            format="DD/MM/YYYY"
            onChange={ds => ds && setDates([ds[0]!, ds[1]!])}
          />
        </Col>
        <Col>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In / PDF</Button>
        </Col>
      </Row>

      {!supplierId && (
        <Alert type="info" showIcon message="Chọn nhà cung cấp để xem biên bản đối chiếu" />
      )}

      {isLoading && <Spin />}

      {data && (
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ PHẢI TRẢ</span>
            </Space>
          }
        >
          {/* Thông tin NCC */}
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Nhà cung cấp" span={2}>
              <Text strong>{data.ten_ncc}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="MST">{data.ma_so_thue || '—'}</Descriptions.Item>
            <Descriptions.Item label="Kỳ đối chiếu">
              {dayjs(data.tu_ngay).format('DD/MM/YYYY')} — {dayjs(data.den_ngay).format('DD/MM/YYYY')}
            </Descriptions.Item>
          </Descriptions>

          {/* Số dư đầu kỳ */}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={8}>
              <Statistic
                title="Số dư đầu kỳ"
                value={data.so_du_dau_ky}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ color: '#fa8c16', fontSize: 16 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Phát sinh trong kỳ (HĐ mua)"
                value={data.tong_hoa_don}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ color: '#1677ff', fontSize: 16 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Số dư cuối kỳ (còn phải trả)"
                value={data.so_du_cuoi_ky}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ color: data.so_du_cuoi_ky > 0 ? '#fa541c' : '#52c41a', fontSize: 16 }}
              />
            </Col>
          </Row>

          <Divider>Hóa đơn mua hàng trong kỳ</Divider>
          <Table
            rowKey="id"
            size="small"
            dataSource={data.hoa_don}
            pagination={false}
            scroll={{ x: 700 }}
            columns={[
              { title: 'Số HĐ', dataIndex: 'so_hoa_don', width: 130 },
              {
                title: 'Ngày', dataIndex: 'ngay', width: 100,
                render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
              },
              {
                title: 'Tổng TT', dataIndex: 'tong_thanh_toan', width: 130, align: 'right',
                render: (v: number) => fmtVND(v),
              },
              {
                title: 'Đã TT', dataIndex: 'da_thanh_toan', width: 120, align: 'right',
                render: (v: number) => <Text style={{ color: '#389e0d' }}>{fmtVND(v)}</Text>,
              },
              {
                title: 'Còn lại', dataIndex: 'con_lai', width: 120, align: 'right',
                render: (v: number) => <Text strong style={{ color: v > 0 ? '#fa541c' : '#389e0d' }}>{fmtVND(v)}</Text>,
              },
              {
                title: 'Trạng thái', dataIndex: 'trang_thai', width: 130,
                render: (v: string) => {
                  const cfg = INVOICE_STATUS_LABELS[v] || { label: v, color: 'default' }
                  return <Tag color={cfg.color}>{cfg.label}</Tag>
                },
              },
            ]}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong>{fmtVND(data.tong_hoa_don)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text strong style={{ color: '#389e0d' }}>{fmtVND(data.tong_thanh_toan)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#fa541c' }}>
                    {fmtVND(data.tong_hoa_don - data.tong_thanh_toan - data.tong_tra_hang)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} />
              </Table.Summary.Row>
            )}
          />

          {data.thanh_toan.length > 0 && (
            <>
              <Divider>Thanh toán trong kỳ</Divider>
              <Table
                rowKey="id"
                size="small"
                dataSource={data.thanh_toan}
                pagination={false}
                columns={[
                  { title: 'Số phiếu chi', dataIndex: 'so_phieu', width: 140 },
                  {
                    title: 'Ngày', dataIndex: 'ngay', width: 100,
                    render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
                  },
                  {
                    title: 'Hình thức', dataIndex: 'hinh_thuc', width: 140,
                    render: (v: string) => HINH_THUC_LABELS[v] || v,
                  },
                  {
                    title: 'Số tiền', dataIndex: 'so_tien', align: 'right',
                    render: (v: number) => <Text strong style={{ color: '#389e0d' }}>{fmtVND(v)}</Text>,
                  },
                ]}
              />
            </>
          )}

          {data.tra_hang.length > 0 && (
            <>
              <Divider>Trả hàng / Giảm giá trong kỳ</Divider>
              <Table
                rowKey="id"
                size="small"
                dataSource={data.tra_hang}
                pagination={false}
                columns={[
                  { title: 'Số phiếu', dataIndex: 'so_phieu', width: 140 },
                  {
                    title: 'Ngày', dataIndex: 'ngay', width: 100,
                    render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
                  },
                  {
                    title: 'Loại', dataIndex: 'loai', width: 100,
                    render: (v: string) => <Tag color={v === 'tra_hang' ? 'orange' : 'blue'}>
                      {v === 'tra_hang' ? 'Trả hàng' : 'Giảm giá'}
                    </Tag>,
                  },
                  {
                    title: 'Giá trị', dataIndex: 'tong_thanh_toan', align: 'right',
                    render: (v: number) => <Text strong style={{ color: '#fa8c16' }}>{fmtVND(v)}</Text>,
                  },
                ]}
              />
            </>
          )}

          <Divider />
          <Row gutter={16} justify="end">
            <Col xs={24} sm={12}>
              <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                <Row justify="space-between">
                  <Text>Số dư đầu kỳ:</Text>
                  <Text strong>{fmtVND(data.so_du_dau_ky)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>+ Hóa đơn mua:</Text>
                  <Text style={{ color: '#1677ff' }}>{fmtVND(data.tong_hoa_don)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>– Đã thanh toán:</Text>
                  <Text style={{ color: '#389e0d' }}>{fmtVND(data.tong_thanh_toan)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>– Trả hàng/giảm giá:</Text>
                  <Text style={{ color: '#fa8c16' }}>{fmtVND(data.tong_tra_hang)}</Text>
                </Row>
                <Divider style={{ margin: '6px 0' }} />
                <Row justify="space-between">
                  <Text strong>= Số dư cuối kỳ:</Text>
                  <Text strong style={{ fontSize: 16, color: data.so_du_cuoi_ky > 0 ? '#fa541c' : '#52c41a' }}>
                    {fmtVND(data.so_du_cuoi_ky)}
                  </Text>
                </Row>
              </Card>
            </Col>
          </Row>
        </Card>
      )}
    </Space>
  )
}

// ─── Page chính ──────────────────────────────────────────────────────────────

export default function PurchaseReportPage() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>Báo cáo Mua hàng</Title>
        </Space>
      </Row>

      <Tabs
        defaultActiveKey="so-chi-tiet"
        items={[
          {
            key: 'so-chi-tiet',
            label: 'Sổ chi tiết mua hàng',
            children: <SoChiTietTab />,
          },
          {
            key: 'doi-chieu',
            label: 'Biên bản đối chiếu công nợ',
            children: <DoiChieuTab />,
          },
        ]}
      />
    </div>
  )
}
