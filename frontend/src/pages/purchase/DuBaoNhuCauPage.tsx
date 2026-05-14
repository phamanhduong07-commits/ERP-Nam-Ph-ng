import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, InputNumber, Row, Select, Space, Statistic, Table, Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { purchaseApi, DuBaoNhuCauRow } from '../../api/purchase'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'

const MUC_DO_COLOR: Record<string, string> = {
  cao: 'red',
  trung_binh: 'orange',
  thap: 'green',
}

const MUC_DO_LABEL: Record<string, string> = {
  cao: 'Ưu tiên cao',
  trung_binh: 'Trung bình',
  thap: 'Thấp',
}

export default function DuBaoNhuCauPage() {
  const [thangPhanTich, setThangPhanTich] = useState(3)
  const [thangDuTru, setThangDuTru] = useState(1)
  const [loaiNvl, setLoaiNvl] = useState<string | undefined>()

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ['du-bao-nhu-cau', thangPhanTich, thangDuTru, loaiNvl],
    queryFn: () =>
      purchaseApi.duBaoNhuCau({ thang_phan_tich: thangPhanTich, thang_du_tru: thangDuTru, loai_nvl: loaiNvl }).then(r => r.data),
  })

  const mucDoCao = useMemo(() => rows.filter(r => r.muc_do_uu_tien === 'cao').length, [rows])
  const tongCanMua = useMemo(() => rows.reduce((s, r) => s + r.uoc_tinh_tien_mua, 0), [rows])
  const tongMatHang = useMemo(() => rows.filter(r => r.can_mua > 0).length, [rows])

  function handleExport() {
    exportToExcel('du_bao_nhu_cau', [{
      name: 'Dự báo nhu cầu',
      headers: [
        'Mã hàng', 'Tên hàng', 'Loại', 'Mức độ',
        'TB xuất/tháng', 'Tồn hiện tại', 'Dự kiến cần', 'Cần mua',
        'Đơn giá gần nhất', 'Ước tính tiền', 'Tổng xuất kỳ', 'Tổng nhập kỳ',
      ],
      rows: rows.map(r => [
        r.ma_hang, r.ten_hang, r.loai === 'giay_cuon' ? 'Giấy cuộn' : 'NVL khác',
        MUC_DO_LABEL[r.muc_do_uu_tien] ?? r.muc_do_uu_tien,
        r.tb_xuat_thang, r.ton_hien_tai, r.du_kien_can, r.can_mua,
        r.don_gia_mua_gan_nhat, r.uoc_tinh_tien_mua, r.tong_xuat_ky, r.tong_nhap_ky,
      ]),
      colWidths: [12, 30, 10, 12, 14, 14, 14, 12, 18, 18, 14, 14],
    }])
  }

  const columns: ColumnsType<DuBaoNhuCauRow> = [
    {
      title: 'Mức độ',
      dataIndex: 'muc_do_uu_tien',
      width: 110,
      render: (v: string) => <Tag color={MUC_DO_COLOR[v]}>{MUC_DO_LABEL[v] ?? v}</Tag>,
    },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 100 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 90,
      render: (v: string) => v === 'giay_cuon' ? <Tag color="blue">Giấy</Tag> : <Tag>NVL</Tag>,
    },
    {
      title: `TB xuất/tháng (${thangPhanTich}T)`,
      dataIndex: 'tb_xuat_thang',
      width: 150,
      align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Tồn hiện tại',
      dataIndex: 'ton_hien_tai',
      width: 120,
      align: 'right',
      render: (v: number, r) => (
        <span style={{ color: v < r.tb_xuat_thang * 0.5 ? '#f5222d' : v < r.tb_xuat_thang ? '#faad14' : '#52c41a' }}>
          {v.toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      title: `Cần đảm bảo (${thangDuTru}T)`,
      dataIndex: 'du_kien_can',
      width: 140,
      align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Cần mua',
      dataIndex: 'can_mua',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: v > 0 ? 700 : undefined, color: v > 0 ? '#1677ff' : '#52c41a' }}>
          {v > 0 ? v.toLocaleString('vi-VN') : '—'}
        </span>
      ),
    },
    {
      title: 'Đơn giá gần nhất',
      dataIndex: 'don_gia_mua_gan_nhat',
      width: 140,
      align: 'right',
      render: fmtVND,
    },
    {
      title: 'Ước tính tiền',
      dataIndex: 'uoc_tinh_tien_mua',
      width: 140,
      align: 'right',
      render: (v: number) => v > 0 ? <span style={{ fontWeight: 600 }}>{fmtVND(v)}</span> : '—',
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Dự báo nhu cầu mua hàng</h2>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <span>Phân tích</span>
          <InputNumber
            min={1} max={12} value={thangPhanTich}
            onChange={v => setThangPhanTich(v ?? 3)}
            addonAfter="tháng gần nhất"
            style={{ width: 180 }}
          />
          <span>Đảm bảo tồn kho</span>
          <InputNumber
            min={1} max={6} value={thangDuTru}
            onChange={v => setThangDuTru(v ?? 1)}
            addonAfter="tháng"
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="Loại NVL"
            style={{ width: 140 }}
            options={[
              { value: 'giay_cuon', label: 'Giấy cuộn' },
              { value: 'nvl_khac', label: 'NVL khác' },
            ]}
            value={loaiNvl}
            onChange={setLoaiNvl}
          />
          <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
            Tính toán
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!rows.length}>
            Xuất Excel
          </Button>
        </Space>
      </Card>

      {/* KPI summary */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={<><Badge color="red" /> Ưu tiên cao</>}
              value={mucDoCao}
              suffix="mặt hàng"
              valueStyle={{ color: mucDoCao > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Mặt hàng cần mua" value={tongMatHang} suffix="loại" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Ước tính tổng chi"
              value={tongCanMua}
              formatter={v => fmtVND(Number(v))}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tổng mặt hàng phân tích" value={rows.length} suffix="loại" />
          </Card>
        </Col>
      </Row>

      {/* Forecast table */}
      <Table<DuBaoNhuCauRow>
        rowKey={r => `${r.paper_material_id ?? 'p'}-${r.other_material_id ?? 'o'}`}
        columns={columns}
        dataSource={rows}
        loading={isFetching}
        size="small"
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        rowClassName={r => r.muc_do_uu_tien === 'cao' ? 'row-urgent' : ''}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
              <Table.Summary.Cell index={0} colSpan={8}>Tổng cộng</Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} align="right">{fmtVND(tongCanMua)}</Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <style>{`.row-urgent td { background: #fff1f0 !important; }`}</style>

      <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
        Thuật toán: Trung bình tiêu thụ/tháng × số tháng đảm bảo − tồn kho hiện tại.
        Dữ liệu dựa trên lịch sử xuất kho sản xuất (XUAT_SX) trong {thangPhanTich} tháng gần nhất.
      </div>
    </div>
  )
}
