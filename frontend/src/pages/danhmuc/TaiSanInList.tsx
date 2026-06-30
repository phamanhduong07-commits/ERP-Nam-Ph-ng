import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, DatePicker, Row, Col, Typography,
} from 'antd'
import { PlusOutlined, EyeOutlined, FileAddOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  taiSanInApi,
  type TaiSanInItem, type TaiSanInCreate,
  LOAI_LABELS, NGUOI_CHI_TRA_LABELS, TRANG_THAI_LABELS, TRANG_THAI_COLORS,
  type TaiSanLoai, type TaiSanTrangThai,
} from '../../api/taiSanIn'
import { customersApi } from '../../api/customers'
import { suppliersApi } from '../../api/suppliers'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { phapNhanApi } from '../../api/phap-nhan'
import { warehouseApi } from '../../api/warehouse'

const { Text } = Typography

const LOAI_OPTIONS = [
  { value: 'ban_in', label: 'Bản in' },
  { value: 'khuon_be', label: 'Khuôn bế' },
]

const NGUOI_CHI_TRA_OPTIONS = [
  { value: 'khach_hang', label: 'Khách hàng' },
  { value: 'cong_ty', label: 'Công ty' },
]

const TRANG_THAI_OPTIONS = [
  { value: 'cho_mua', label: 'Chờ mua' },
  { value: 'dang_mua', label: 'Đang mua' },
  { value: 'dang_dung', label: 'Đang dùng' },
  { value: 'hong', label: 'Hỏng' },
  { value: 'da_tra_khach', label: 'Đã trả khách' },
  { value: 'mat', label: 'Mất' },
]

export default function TaiSanInList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [ymhForm] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [ymhModalOpen, setYmhModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [filterLoai, setFilterLoai] = useState<TaiSanLoai | undefined>()
  const [filterKh, setFilterKh] = useState<number | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<TaiSanTrangThai | undefined>()
  const [filterChuaThu, setFilterChuaThu] = useState<boolean | undefined>()

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['tai-san-in', filterLoai, filterKh, filterTrangThai, filterChuaThu],
    queryFn: () =>
      taiSanInApi.list({
        loai: filterLoai,
        customer_id: filterKh,
        trang_thai: filterTrangThai,
        chua_thu_tien: filterChuaThu,
      }).then(r => r.data),
  })

  const { data: khList = [] } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const { data: supplierList = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: nvlList = [] } = useQuery({
    queryKey: ['other-materials-search-all'],
    queryFn: () => otherMaterialsApi.search({ limit: 500 }).then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-all'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: TaiSanInCreate) => taiSanInApi.create(d),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tai-san-in'] })
      setModalOpen(false)
      form.resetFields()
      message.success('Đã tạo tài sản')
      navigate(`/tai-san-in/${res.data.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi tạo'),
  })

  const taoYmhMut = useMutation({
    mutationFn: (d: Parameters<typeof taiSanInApi.taoYmh>[0]) => taiSanInApi.taoYmh(d),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tai-san-in'] })
      setYmhModalOpen(false)
      ymhForm.resetFields()
      setSelectedIds([])
      message.success(`Đã tạo YCMH ${res.data.so_ymh}`)
      navigate('/purchasing/ymh')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi tạo YCMH'),
  })

  const selectedRows = rows.filter(r => selectedIds.includes(r.id))

  const rowSelection = {
    selectedRowKeys: selectedIds,
    onChange: (keys: React.Key[]) => setSelectedIds(keys as number[]),
    getCheckboxProps: (record: TaiSanInItem) => ({
      disabled: record.trang_thai !== 'cho_mua',
    }),
  }

  const columns: ColumnsType<TaiSanInItem> = [
    { title: 'Mã', dataIndex: 'ma_tai_san', width: 140, fixed: 'left' },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 100,
      render: (v: TaiSanLoai) => (
        <Tag color={v === 'ban_in' ? 'blue' : 'purple'}>{LOAI_LABELS[v]}</Tag>
      ),
    },
    { title: 'Mô tả', dataIndex: 'mo_ta', ellipsis: true },
    { title: 'Khách hàng', dataIndex: 'ten_khach', width: 160 },
    { title: 'NCC', dataIndex: 'ten_ncc', width: 140, ellipsis: true },
    { title: 'Mã NVL', dataIndex: 'ma_nvl', width: 110 },
    {
      title: 'Người chi trả',
      dataIndex: 'nguoi_chi_tra',
      width: 120,
      render: (v) => NGUOI_CHI_TRA_LABELS[v as keyof typeof NGUOI_CHI_TRA_LABELS] ?? v,
    },
    {
      title: 'Giá trị',
      dataIndex: 'gia_tri',
      width: 120,
      align: 'right',
      render: (v) => Number(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: TaiSanTrangThai) => (
        <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v]}</Tag>
      ),
    },
    {
      title: 'Đã thu',
      dataIndex: 'da_thu_tien',
      width: 80,
      align: 'center',
      render: (v, row) =>
        row.nguoi_chi_tra === 'khach_hang' ? (
          <Tag color={v ? 'success' : 'warning'}>{v ? 'Rồi' : 'Chưa'}</Tag>
        ) : null,
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'so_san_pham',
      width: 90,
      align: 'center',
      render: (v) => <Tag>{v}</Tag>,
    },
    { title: 'Ngày tạo', dataIndex: 'ngay_tao', width: 110 },
    {
      title: '',
      key: 'action',
      width: 60,
      fixed: 'right',
      render: (_, row) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/tai-san-in/${row.id}`)}
        />
      ),
    },
  ]

  return (
    <Card
      title="Bản in / Khuôn bế"
      extra={
        <Space>
          {selectedIds.length > 0 && (
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() => setYmhModalOpen(true)}
            >
              Lập YCMH ({selectedIds.length})
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Thêm mới
          </Button>
        </Space>
      }
    >
      {/* Bộ lọc */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="Loại"
            allowClear
            style={{ width: 140 }}
            options={LOAI_OPTIONS}
            value={filterLoai}
            onChange={setFilterLoai}
          />
        </Col>
        <Col>
          <Select
            placeholder="Khách hàng"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            options={khList.map((k: any) => ({ value: k.id, label: k.ten_viet_tat }))}
            value={filterKh}
            onChange={setFilterKh}
          />
        </Col>
        <Col>
          <Select
            placeholder="Trạng thái"
            allowClear
            style={{ width: 140 }}
            options={TRANG_THAI_OPTIONS}
            value={filterTrangThai}
            onChange={setFilterTrangThai}
          />
        </Col>
        <Col>
          <Button
            type={filterChuaThu ? 'primary' : 'default'}
            onClick={() => setFilterChuaThu(filterChuaThu ? undefined : true)}
          >
            Chưa thu tiền
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1200 }}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: false }}
        rowSelection={rowSelection}
      />

      {/* Modal tạo mới */}
      <Modal
        title="Tạo bản in / khuôn bế mới"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ nguoi_chi_tra: 'khach_hang', trang_thai: 'cho_mua', gia_tri: 0 }}
          onFinish={(v) =>
            createMut.mutate({
              ...v,
              ngay_tao: v.ngay_tao ? dayjs(v.ngay_tao).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            })
          }
        >
          <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
            <Select options={LOAI_OPTIONS} />
          </Form.Item>
          <Form.Item name="mo_ta" label="Mô tả">
            <Input />
          </Form.Item>
          <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={khList.map((k: any) => ({ value: k.id, label: k.ten_viet_tat }))}
            />
          </Form.Item>
          <Form.Item name="nguoi_chi_tra" label="Người chi trả" rules={[{ required: true }]}>
            <Select options={NGUOI_CHI_TRA_OPTIONS} />
          </Form.Item>
          <Form.Item name="gia_tri" label="Giá trị (đ)">
            <InputNumber style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} min={0} />
          </Form.Item>
          <Form.Item name="supplier_id" label="NCC làm bản in / khuôn bế">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn nhà cung cấp"
              options={supplierList.map((s: any) => ({ value: s.id, label: s.ten_viet_tat }))}
            />
          </Form.Item>
          <Form.Item name="other_material_id" label="Mã NVL (danh mục vật tư)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn mã NVL"
              options={nvlList.map((m: any) => ({ value: m.id, label: `${m.value} — ${m.ten}` }))}
            />
          </Form.Item>
          <Form.Item name="ngay_tao" label="Ngày tạo" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal lập YCMH */}
      <Modal
        title="Lập YCMH từ Bản in / Khuôn bế"
        open={ymhModalOpen}
        onCancel={() => { setYmhModalOpen(false); ymhForm.resetFields() }}
        onOk={() => ymhForm.submit()}
        confirmLoading={taoYmhMut.isPending}
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">Đã chọn {selectedIds.length} tài sản: </Text>
          <Text>{selectedRows.map(r => r.ma_tai_san).join(', ')}</Text>
        </div>
        <Form
          form={ymhForm}
          layout="vertical"
          initialValues={{ ngay_yeu_cau: dayjs() }}
          onFinish={(v) =>
            taoYmhMut.mutate({
              ids: selectedIds,
              ngay_yeu_cau: dayjs(v.ngay_yeu_cau).format('YYYY-MM-DD'),
              phap_nhan_id: v.phap_nhan_id,
              phan_xuong_id: v.phan_xuong_id || null,
              ghi_chu: v.ghi_chu || null,
            })
          }
        >
          <Form.Item
            name="ngay_yeu_cau"
            label="Ngày yêu cầu"
            rules={[{ required: true, message: 'Chọn ngày yêu cầu' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="phap_nhan_id"
            label="Pháp nhân"
            rules={[{ required: true, message: 'Pháp nhân là bắt buộc' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn pháp nhân"
              options={phapNhanList.map((p: any) => ({
                value: p.id,
                label: p.ten_viet_tat || p.ten_phap_nhan,
              }))}
              onChange={(val) => {
                // clear phan_xuong nếu không thuộc pháp nhân này
                ymhForm.setFieldValue('phan_xuong_id', undefined)
              }}
            />
          </Form.Item>
          <Form.Item
            name="phan_xuong_id"
            label="Phân xưởng (tuỳ chọn)"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn phân xưởng"
              options={phanXuongList.map((px: any) => ({
                value: px.id,
                label: px.ten_xuong,
              }))}
              onChange={(val) => {
                if (val) {
                  const px = phanXuongList.find((p: any) => p.id === val)
                  if (px?.phap_nhan_id) {
                    ymhForm.setFieldValue('phap_nhan_id', px.phap_nhan_id)
                  }
                }
              }}
            />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
