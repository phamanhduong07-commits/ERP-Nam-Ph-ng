import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Col, DatePicker, Progress, Row, Select, Space, Statistic, Table, Tabs, Tag, Button,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { DownloadOutlined } from '@ant-design/icons'
import { purchaseApi, DoiSoatKhoRow, DoiSoatKhoSummary, TRANG_THAI_PO, TRANG_THAI_PO_COLOR } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'
import { warehouseApi, GoodsReceipt, GoodsReceiptItem, PhanXuong } from '../../api/warehouse'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"

const { RangePicker } = DatePicker

export default function DoiSoatKhoPage() {
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [loaiHang, setLoaiHang] = useState<string | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [activeTab, setActiveTab] = useState('chi-tiet')

  const params = useMemo(() => ({
    supplier_id: supplierId,
    trang_thai: trangThai,
    loai_hang: loaiHang,
    phan_xuong_id: phanXuongId,
    tu_ngay: dateRange?.[0]?.format('YYYY-MM-DD'),
    den_ngay: dateRange?.[1]?.format('YYYY-MM-DD'),
  }), [supplierId, trangThai, loaiHang, phanXuongId, dateRange])

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['doi-soat-kho', params],
    queryFn: () => purchaseApi.doiSoatKho(params).then(r => r.data),
  })

  const { data: summary = [], isFetching: loadingSummary } = useQuery({
    queryKey: ['doi-soat-kho-summary', { supplier_id: supplierId, phan_xuong_id: phanXuongId, loai_hang: loaiHang, tu_ngay: params.tu_ngay, den_ngay: params.den_ngay }],
    queryFn: () => purchaseApi.doiSoatKhoSummary({
      supplier_id: supplierId,
      phan_xuong_id: phanXuongId,
      loai_hang: loaiHang,
      tu_ngay: params.tu_ngay,
      den_ngay: params.den_ngay,
    }).then(r => r.data),
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: nhapNhanhRows = [], isFetching: loadingNhapNhanh } = useQuery({
    queryKey: ['doi-soat-nhap-nhanh', { supplier_id: supplierId, tu_ngay: params.tu_ngay, den_ngay: params.den_ngay }],
    queryFn: () => warehouseApi.listGoodsReceipts({
      trang_thai: 'nhap_nhanh',
      supplier_id: supplierId,
      tu_ngay: params.tu_ngay,
      den_ngay: params.den_ngay,
    }).then(r => r.data),
  })

  const totalDat = useMemo(() => rows.reduce((s, r) => s + r.thanh_tien_dat, 0), [rows])
  const totalNhan = useMemo(() => rows.reduce((s, r) => s + r.thanh_tien_da_nhan, 0), [rows])
  const totalConLai = useMemo(() => totalDat - totalNhan, [totalDat, totalNhan])
  const tyLeChung = totalDat > 0 ? Math.round(totalNhan / totalDat * 100) : 0

  function exportChiTiet() {
    exportToExcel('doi_soat_kho_chi_tiet', [{
      name: 'Chi tiết',
      headers: ['Số PO', 'Ngày PO', 'Nhà CC', 'Pháp nhân', 'Phân xưởng', 'Trạng thái PO',
        'Tên hàng', 'ĐVT', 'SL đặt', 'SL đã nhận', 'SL còn lại', 'Tỉ lệ (%)',
        'Tiền đặt', 'Tiền đã nhận'],
      rows: rows.map(r => [
        r.so_po, r.ngay_po ?? '', r.ten_ncc, r.ten_phap_nhan ?? '', r.ten_phan_xuong ?? '',
        TRANG_THAI_PO[r.po_trang_thai] ?? r.po_trang_thai,
        r.ten_hang, r.dvt, r.so_luong_dat, r.so_luong_da_nhan, r.so_luong_con_lai, r.ty_le_nhan,
        r.thanh_tien_dat, r.thanh_tien_da_nhan,
      ]),
      colWidths: [16, 12, 20, 18, 16, 14, 24, 6, 10, 12, 12, 10, 16, 16],
    }])
  }

  function exportTongHop() {
    exportToExcel('doi_soat_kho_tong_hop', [{
      name: 'Tổng hợp',
      headers: ['Nhà cung cấp', 'Số PO', 'Tổng SL đặt', 'Tổng SL đã nhận',
        'Còn lại', 'Tỉ lệ (%)', 'Tiền đặt', 'Tiền đã nhận'],
      rows: summary.map(s => [
        s.ten_ncc, s.so_po_count, s.tong_dat, s.tong_da_nhan,
        s.tong_con_lai, s.ty_le_nhan, s.tong_tien_dat, s.tong_tien_da_nhan,
      ]),
      colWidths: [24, 8, 14, 16, 12, 10, 18, 18],
    }])
  }

  const colsChiTiet: ColumnsType<DoiSoatKhoRow> = [
    { title: 'Số PO', dataIndex: 'so_po', width: 130 },
    { title: 'Ngày PO', dataIndex: 'ngay_po', width: 100, render: v => v ?? '-' },
    { title: 'Nhà CC', dataIndex: 'ten_ncc', width: 150 },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130, render: v => v ?? '-' },
    {
      title: 'TT PO', dataIndex: 'po_trang_thai', width: 110,
      render: (v: string) => <Tag color={TRANG_THAI_PO_COLOR[v] ?? 'default'}>{TRANG_THAI_PO[v] ?? v}</Tag>,
    },
    {
      title: 'Loại', dataIndex: 'loai_hang', width: 100,
      render: (v: string) => {
        if (v === 'giay_cuon') return <Tag color="blue">Giấy cuộn</Tag>
        if (v === 'nvl_khac') return <Tag color="orange">NVL khác</Tag>
        return <Tag>Khác</Tag>
      },
    },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
    { title: 'SL đặt', dataIndex: 'so_luong_dat', width: 90, align: 'right', render: v => v.toLocaleString('vi-VN') },
    {
      title: 'SL đã nhận', dataIndex: 'so_luong_da_nhan', width: 100, align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Còn lại', dataIndex: 'so_luong_con_lai', width: 90, align: 'right',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#faad14' : '#52c41a' }}>
          {v.toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      title: 'Tỉ lệ', dataIndex: 'ty_le_nhan', width: 110,
      render: (v: number) => <Progress percent={v} size="small" style={{ marginBottom: 0 }} />,
    },
    { title: 'Tiền đặt', dataIndex: 'thanh_tien_dat', width: 130, align: 'right', render: fmtVND },
    { title: 'Tiền đã nhận', dataIndex: 'thanh_tien_da_nhan', width: 130, align: 'right', render: fmtVND },
  ]

  const colsTongHop: ColumnsType<DoiSoatKhoSummary> = [
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', width: 200 },
    { title: 'Số PO', dataIndex: 'so_po_count', width: 70, align: 'right' },
    {
      title: 'SL đặt', dataIndex: 'tong_dat', width: 110, align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'SL đã nhận', dataIndex: 'tong_da_nhan', width: 120, align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Còn lại', dataIndex: 'tong_con_lai', width: 100, align: 'right',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#faad14' : '#52c41a' }}>{v.toLocaleString('vi-VN')}</span>
      ),
    },
    {
      title: 'Tỉ lệ nhận', dataIndex: 'ty_le_nhan', width: 150,
      render: (v: number) => <Progress percent={v} size="small" style={{ marginBottom: 0 }} />,
    },
    { title: 'Tiền đặt', dataIndex: 'tong_tien_dat', width: 150, align: 'right', render: fmtVND },
    { title: 'Tiền đã nhận', dataIndex: 'tong_tien_da_nhan', width: 150, align: 'right', render: fmtVND },
  ]

  const colsNhapNhanh: ColumnsType<GoodsReceipt> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 140 },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110, render: v => v ?? '-' },
    { title: 'Nhà CC', width: 160, render: (_, r) => (r as any).ten_ncc ?? '-' },
    { title: 'Xưởng', width: 140, render: (_, r) => (r as any).ten_phan_xuong ?? '-' },
    { title: 'Kho nhập', width: 160, render: (_, r) => (r as any).ten_kho ?? '-' },
    { title: 'Tổng giá trị', dataIndex: 'tong_gia_tri', width: 130, align: 'right', render: v => fmtVND(Number(v)) },
    {
      title: 'Tên hàng', width: 200, render: (_, r) => {
        const items: GoodsReceiptItem[] = r.items ?? []
        if (items.length === 0) return '-'
        return items.map(it => it.ten_hang || '-').join(', ')
      },
    },
    {
      title: 'SL nhập', width: 100, align: 'right', render: (_, r) => {
        const items: GoodsReceiptItem[] = r.items ?? []
        const total = items.reduce((s, it) => s + Number(it.so_luong || 0), 0)
        return total > 0 ? total.toLocaleString('vi-VN') : '-'
      },
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Đối soát kho — PO vs GR</h2>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="Nhà cung cấp"
            style={{ width: 220 }}
            showSearch
            optionFilterProp="label"
            options={suppliers.map(s => ({
              value: s.id,
              label: s.ten_viet_tat || s.ten_don_vi,
            }))}
            value={supplierId}
            onChange={setSupplierId}
          />
          <Select
            allowClear
            placeholder="Trạng thái PO"
            style={{ width: 150 }}
            options={Object.entries(TRANG_THAI_PO).map(([k, v]) => ({ value: k, label: v }))}
            value={trangThai}
            onChange={setTrangThai}
          />
          <Select
            allowClear
            placeholder="Loại hàng"
            style={{ width: 140 }}
            options={[
              { value: 'giay_cuon', label: 'Giấy cuộn' },
              { value: 'nvl_khac', label: 'NVL khác' },
            ]}
            value={loaiHang}
            onChange={setLoaiHang}
          />
          <Select
            allowClear
            placeholder="Phân xưởng"
            style={{ width: 180 }}
            showSearch
            optionFilterProp="label"
            options={(phanXuongList as PhanXuong[]).map(px => ({
              value: px.id,
              label: px.ten_xuong,
            }))}
            value={phanXuongId}
            onChange={setPhanXuongId}
          />
          <RangePicker
            format="DD/MM/YYYY"
            value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
            onChange={v => setDateRange(v)}
          />
        </Space>
      </Card>

      {/* KPI cards */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tổng tiền đặt hàng" value={totalDat} formatter={v => fmtVND(Number(v))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Đã nhận (giá trị)" value={totalNhan} formatter={v => fmtVND(Number(v))} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Còn phải giao" value={totalConLai} formatter={v => fmtVND(Number(v))} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tỉ lệ hoàn thành" value={tyLeChung} suffix="%" valueStyle={{ color: tyLeChung >= 90 ? '#52c41a' : '#1677ff' }} />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          activeTab !== 'nhap-nhanh' && (
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={activeTab === 'chi-tiet' ? exportChiTiet : exportTongHop}
            >
              Xuất Excel
            </Button>
          )
        }
        items={[
          {
            key: 'chi-tiet',
            label: `Chi tiết (${rows.length})`,
            children: (
              <Table<DoiSoatKhoRow>
                rowKey="poi_id"
                columns={colsChiTiet}
                dataSource={rows}
                loading={isFetching}
                size="small"
                scroll={{ x: 1300 }}
                pagination={{ pageSize: 50, showSizeChanger: true }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                      {/* cols 0-7: Số PO, Ngày PO, Nhà CC, Pháp nhân, TT PO, Loại, Tên hàng, ĐVT */}
                      <Table.Summary.Cell index={0} colSpan={8}>Tổng cộng</Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right">
                        {rows.reduce((s, r) => s + r.so_luong_dat, 0).toLocaleString('vi-VN')}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={9} align="right">
                        {rows.reduce((s, r) => s + r.so_luong_da_nhan, 0).toLocaleString('vi-VN')}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={10} align="right">
                        {rows.reduce((s, r) => s + r.so_luong_con_lai, 0).toLocaleString('vi-VN')}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={11} />
                      <Table.Summary.Cell index={12} align="right">{fmtVND(totalDat)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={13} align="right">{fmtVND(totalNhan)}</Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            ),
          },
          {
            key: 'nhap-nhanh',
            label: `Nhập nhanh (${nhapNhanhRows.length})`,
            children: (
              <Table<GoodsReceipt>
                rowKey="id"
                columns={colsNhapNhanh}
                dataSource={nhapNhanhRows}
                loading={loadingNhapNhanh}
                size="small"
                scroll={{ x: 1000 }}
                pagination={{ pageSize: 50, showSizeChanger: true }}
                expandable={{
                  expandedRowRender: (r) => {
                    const items: GoodsReceiptItem[] = r.items ?? []
                    if (items.length === 0) return <span style={{ color: '#999' }}>Chưa có mục hàng</span>
                    return (
                      <Table
                        rowKey="id"
                        size="small"
                        dataSource={items}
                        pagination={false}
                        columns={[
                          { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                          { title: 'ĐVT', dataIndex: 'don_vi_tinh', width: 70 },
                          { title: 'SL', dataIndex: 'so_luong', width: 90, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
                          { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right', render: v => fmtVND(Number(v)) },
                          { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, align: 'right', render: v => fmtVND(Number(v)) },
                        ] satisfies ColumnsType<GoodsReceiptItem>}
                      />
                    )
                  },
                  rowExpandable: (r) => (r.items?.length ?? 0) > 0,
                }}
              />
            ),
          },
          {
            key: 'tong-hop',
            label: `Tổng hợp theo NCC (${summary.length})`,
            children: (
              <Table<DoiSoatKhoSummary>
                rowKey="supplier_id"
                columns={colsTongHop}
                dataSource={summary}
                loading={loadingSummary}
                size="small"
                scroll={{ x: 900 }}
                pagination={false}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                      <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        {summary.reduce((s, r) => s + r.so_po_count, 0)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        {summary.reduce((s, r) => s + r.tong_dat, 0).toLocaleString('vi-VN')}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        {summary.reduce((s, r) => s + r.tong_da_nhan, 0).toLocaleString('vi-VN')}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right">
                        {summary.reduce((s, r) => s + r.tong_con_lai, 0).toLocaleString('vi-VN')}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} />
                      <Table.Summary.Cell index={6} align="right">
                        {fmtVND(summary.reduce((s, r) => s + r.tong_tien_dat, 0))}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        {fmtVND(summary.reduce((s, r) => s + r.tong_tien_da_nhan, 0))}
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
