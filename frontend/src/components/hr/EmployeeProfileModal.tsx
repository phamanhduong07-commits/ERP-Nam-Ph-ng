import { useEffect, useState } from 'react'
import {
  Modal, Form, Input, InputNumber, Select, DatePicker, Button, Tabs, Table, Space, Tag,
  Row, Col, message, Popconfirm, Empty, Switch,
} from 'antd'
import {
  PrinterOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  CloseOutlined, UserOutlined, UploadOutlined, FileTextOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import {
  hrApi,
  type Employee,
  type FamilyRelation,
  type EmployeeDocument,
  type EmployeeHistory,
  type LaborContract,
} from '../../api/hr'

interface Props {
  open: boolean
  employee: Employee | null      // null = create mode
  onClose: () => void
  onSaved: (emp: Employee) => void
}

interface PersonalFormValues {
  ma_nv: string
  ho_dem?: string
  ten?: string
  gioi_tinh?: string
  ngay_sinh?: Dayjs
  quoc_tich?: string
  dan_toc?: string
  ton_giao?: string
  ten_bi_danh?: string
  noi_sinh_tinh?: string
  noi_sinh_dia_chi?: string
  cccd?: string
  ngay_cap?: Dayjs
  noi_cap?: string
  tinh_que_quan?: string
  huyen_que_quan?: string
  phuong_que_quan?: string
  dia_chi_que_quan?: string
  tinh_ho_khau?: string
  huyen_ho_khau?: string
  phuong_ho_khau?: string
  dia_chi_ho_khau?: string
  dien_thoai_ban?: string
  so_dien_thoai?: string
  email?: string
  dia_chi_hien_tai?: string
  avatar_url?: string
  // Sơ yếu
  trinh_do_hoc_van?: string
  chuyen_nganh?: string
  truong_dao_tao?: string
  nam_tot_nghiep?: number
  ngoai_ngu?: string
  tin_hoc?: string
  ky_nang_khac?: string
  so_yeu_tom_tat?: string
  // BHXH
  so_so_bhxh?: string
  ngay_tham_gia_bhxh?: Dayjs
  ma_bhyt?: string
  noi_kham_chua_benh?: string
  muc_dong_bhxh?: number
  // Bằng lái
  ngay_het_han_bang?: Dayjs
}

const HOC_VAN_OPTIONS = ['12/12', 'Trung cấp', 'Cao đẳng', 'Đại học', 'Sau đại học']
const HISTORY_LOAI_LABEL: Record<string, string> = {
  bo_phan: 'Bộ phận',
  chuc_vu: 'Chức vụ',
  luong_cb: 'Lương cơ bản',
  phu_cap: 'Phụ cấp',
  he_so: 'Hệ số',
}

const RELATION_OPTIONS = ['Bố', 'Mẹ', 'Vợ', 'Chồng', 'Con trai', 'Con gái', 'Anh', 'Chị', 'Em', 'Khác']

export default function EmployeeProfileModal({ open, employee, onClose, onSaved }: Props) {
  const [form] = Form.useForm<PersonalFormValues>()
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('resume')
  const [families, setFamilies] = useState<FamilyRelation[]>([])
  const [familyModalOpen, setFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<FamilyRelation | null>(null)
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [histories, setHistories] = useState<EmployeeHistory[]>([])
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyLoai, setHistoryLoai] = useState<string>('bo_phan')
  const [contracts, setContracts] = useState<LaborContract[]>([])
  // Phase 1 integration: Khám SK + BHLĐ + KPI
  const [healthChecks, setHealthChecks] = useState<any[]>([])
  const [bhldIssues, setBhldIssues] = useState<any[]>([])
  const [kpiEvaluations, setKpiEvaluations] = useState<any[]>([])

  const isCreate = !employee

  // Load form values + related data when employee changes
  useEffect(() => {
    if (!open) return
    if (employee) {
      // 1) Pre-fill form từ basic data từ list (UI mượt — không cần đợi API)
      form.setFieldsValue({
        ...employee,
        ngay_sinh: employee.ngay_sinh ? dayjs(employee.ngay_sinh) : undefined,
        ngay_cap: employee.ngay_cap ? dayjs(employee.ngay_cap) : undefined,
        ngay_tham_gia_bhxh: (employee as any).ngay_tham_gia_bhxh ? dayjs((employee as any).ngay_tham_gia_bhxh) : undefined,
      } as PersonalFormValues)
      // 2) Re-fetch DETAIL endpoint để lấy ĐẦY ĐỦ extended fields
      // (list endpoint chỉ trả basic cols để tiết kiệm payload).
      hrApi.getEmployee(employee.id).then(r => {
        const full = r.data as any
        form.setFieldsValue({
          ...full,
          ngay_sinh: full.ngay_sinh ? dayjs(full.ngay_sinh) : undefined,
          ngay_cap: full.ngay_cap ? dayjs(full.ngay_cap) : undefined,
          ngay_tham_gia_bhxh: full.ngay_tham_gia_bhxh ? dayjs(full.ngay_tham_gia_bhxh) : undefined,
          ngay_het_han_bang: full.ngay_het_han_bang ? dayjs(full.ngay_het_han_bang) : undefined,
        } as PersonalFormValues)
      }).catch(() => {/* giữ data list nếu detail fail */})
      // 3) Load all related data in parallel
      Promise.allSettled([
        hrApi.listFamilyRelations(employee.id).then(r => setFamilies(r.data)),
        hrApi.listEmployeeDocuments(employee.id).then(r => setDocuments(r.data)),
        hrApi.listEmployeeHistoryTyped(employee.id).then(r => setHistories(r.data)),
        hrApi.listEmployeeContracts(employee.id).then(r => setContracts(r.data)),
        // Phase 1: Khám SK + BHLĐ + KPI cá nhân
        hrApi.listHealthChecks({ employee_id: employee.id }).then(r => setHealthChecks(r.data)),
        hrApi.safetyListIssues({ employee_id: employee.id }).then(r => setBhldIssues(r.data)),
        hrApi.kpiListEvaluations({ employee_id: employee.id }).then(r => setKpiEvaluations(r.data)),
      ])
    } else {
      form.resetFields()
      form.setFieldsValue({ quoc_tich: 'Việt Nam' })
      setFamilies([])
      setDocuments([])
      setHistories([])
      setContracts([])
      setHealthChecks([])
      setBhldIssues([])
      setKpiEvaluations([])
    }
  }, [open, employee, form])

  const reloadHistories = async () => {
    if (!employee) return
    const r = await hrApi.listEmployeeHistoryTyped(employee.id)
    setHistories(r.data)
  }

  const reloadDocuments = async () => {
    if (!employee) return
    const r = await hrApi.listEmployeeDocuments(employee.id)
    setDocuments(r.data)
  }

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      setSaving(true)
      // Compose ho_ten from ho_dem + ten
      const ho_ten = [vals.ho_dem, vals.ten].filter(Boolean).join(' ').trim()
      const payload = {
        ...vals,
        ho_ten: ho_ten || vals.ten || vals.ho_dem || '',
        ngay_sinh: vals.ngay_sinh?.format('YYYY-MM-DD'),
        ngay_cap: vals.ngay_cap?.format('YYYY-MM-DD'),
        ngay_tham_gia_bhxh: vals.ngay_tham_gia_bhxh?.format('YYYY-MM-DD'),
        ngay_het_han_bang: vals.ngay_het_han_bang?.format('YYYY-MM-DD'),
      }
      const res = employee
        ? await hrApi.updateEmployee(employee.id, payload as Partial<Employee>)
        : await hrApi.createEmployee(payload as Partial<Employee>)
      message.success(employee ? 'Cập nhật thành công' : 'Thêm nhân viên thành công')
      onSaved(res.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (msg) message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFamily = async (values: Partial<FamilyRelation>) => {
    if (!employee) {
      message.warning('Lưu thông tin nhân viên trước khi thêm quan hệ gia đình')
      return
    }
    try {
      if (editingFamily) {
        await hrApi.updateFamilyRelation(editingFamily.id, values)
      } else {
        await hrApi.createFamilyRelation(employee.id, values)
      }
      const r = await hrApi.listFamilyRelations(employee.id)
      setFamilies(r.data)
      setFamilyModalOpen(false)
      setEditingFamily(null)
    } catch (err) {
      message.error('Lỗi khi lưu')
    }
  }

  const handleDeleteFamily = async (id: number) => {
    if (!employee) return
    await hrApi.deleteFamilyRelation(id)
    const r = await hrApi.listFamilyRelations(employee.id)
    setFamilies(r.data)
  }

  const familyColumns = [
    { title: 'STT', width: 50, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    { title: 'Họ và tên', dataIndex: 'ho_ten' },
    { title: 'Năm sinh', dataIndex: 'nam_sinh', width: 90 },
    { title: 'Mối quan hệ', dataIndex: 'moi_quan_he', width: 110 },
    { title: 'Nghề nghiệp', dataIndex: 'nghe_nghiep' },
    { title: 'SĐT', dataIndex: 'so_dien_thoai', width: 120 },
    { title: 'Ghi chú', dataIndex: 'ghi_chu' },
    {
      title: '',
      width: 80,
      render: (_: unknown, record: FamilyRelation) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingFamily(record); setFamilyModalOpen(true) }} />
          <Popconfirm title="Xóa quan hệ này?" onConfirm={() => handleDeleteFamily(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ─── Tab content: Thông tin sơ yếu (extends main form) ───
  const resumeTabContent = (
    <Row gutter={8}>
      <Col span={6}>
        <Form.Item label="Trình độ học vấn" name="trinh_do_hoc_van">
          <Select allowClear options={HOC_VAN_OPTIONS.map(v => ({ value: v, label: v }))} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Chuyên ngành" name="chuyen_nganh"><Input /></Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="Trường đào tạo" name="truong_dao_tao"><Input /></Form.Item>
      </Col>
      <Col span={4}>
        <Form.Item label="Năm tốt nghiệp" name="nam_tot_nghiep">
          <InputNumber style={{ width: '100%' }} min={1900} max={2100} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="Ngoại ngữ" name="ngoai_ngu" tooltip="VD: Anh - TOEIC 750"><Input /></Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="Tin học" name="tin_hoc" tooltip="VD: MOS, AutoCAD"><Input /></Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="Kỹ năng khác" name="ky_nang_khac"><Input /></Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item label="Sơ yếu tóm tắt" name="so_yeu_tom_tat">
          <Input.TextArea rows={4} placeholder="Tóm tắt quá trình học tập, kinh nghiệm làm việc..." />
        </Form.Item>
      </Col>
    </Row>
  )

  // ─── Tab content: BHXH ───
  const bhxhTabContent = (
    <Row gutter={8}>
      <Col span={6}>
        <Form.Item label="Số sổ BHXH" name="so_so_bhxh"><Input /></Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Ngày tham gia BHXH" name="ngay_tham_gia_bhxh">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Mã thẻ BHYT" name="ma_bhyt"><Input /></Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Mức đóng BHXH (VNĐ)" name="muc_dong_bhxh">
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={((v?: string) => (v ? Number(v.replace(/[^\d]/g, '')) : 0)) as never}
          />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item label="Nơi khám chữa bệnh ban đầu" name="noi_kham_chua_benh"><Input /></Form.Item>
      </Col>
    </Row>
  )

  // ─── Tab content: Vận chuyển (tài xế / lơ xe) ───
  const vanChuyenTabContent = (
    <Row gutter={8}>
      <Col span={6}>
        <Form.Item label="Là tài xế" name="is_tai_xe" valuePropName="checked" tooltip="Đánh dấu để đồng bộ sang danh mục Tài xế">
          <Switch checkedChildren="Có" unCheckedChildren="Không" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Là lơ xe" name="is_lo_xe" valuePropName="checked" tooltip="Đánh dấu để đồng bộ sang danh mục Lơ xe">
          <Switch checkedChildren="Có" unCheckedChildren="Không" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Hạng bằng lái" name="hang_bang_lai" tooltip="VD: B1, B2, C, D, E">
          <Input placeholder="B2, C, D..." />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="Ngày hết hạn bằng" name="ngay_het_han_bang">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>
  )

  // ─── Tab content: File hồ sơ ───
  const fileColumns = [
    { title: 'STT', width: 50, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: 'Tên tài liệu', dataIndex: 'ten_tai_lieu' },
    { title: 'Loại', dataIndex: 'loai_tai_lieu', width: 110 },
    { title: 'Đường dẫn', dataIndex: 'file_path', ellipsis: true,
      render: (v: string) => <a href={v} target="_blank" rel="noreferrer">{v}</a> },
    { title: 'Ngày hết hạn', dataIndex: 'ngay_het_han', width: 120,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    {
      title: '', width: 60,
      render: (_: unknown, r: EmployeeDocument) => (
        <Popconfirm title="Xóa tài liệu?" onConfirm={async () => { await hrApi.deleteEmployeeDocument(r.id); await reloadDocuments() }}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  // ─── Tab content: Quá trình hợp đồng (read-only — quản lý qua HR riêng) ───
  const contractColumns = [
    { title: 'Số HĐ', dataIndex: 'so_hop_dong', width: 140 },
    { title: 'Loại', dataIndex: 'loai_hop_dong', width: 150 },
    { title: 'Ngày ký', dataIndex: 'ngay_ky', width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Hiệu lực', dataIndex: 'ngay_hieu_luc', width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Hết hạn', dataIndex: 'ngay_het_han', width: 110,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Lương cơ bản', dataIndex: 'luong_co_ban', align: 'right' as const, width: 130,
      render: (v: number) => v?.toLocaleString('vi-VN') ?? 0 },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 100,
      render: (v: string) => <Tag color={v === 'hieu_luc' ? 'green' : 'default'}>{v}</Tag> },
  ]

  // ─── Tab content: History (Thuyên chuyển / Chức vụ / Lương / Phụ cấp) ───
  const historyColumns = [
    { title: 'Ngày hiệu lực', dataIndex: 'ngay_hieu_luc', width: 130,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Loại', dataIndex: 'loai', width: 130,
      render: (v: string) => <Tag>{HISTORY_LOAI_LABEL[v] || v}</Tag> },
    { title: 'Giá trị cũ', dataIndex: 'gia_tri_cu' },
    { title: 'Giá trị mới', dataIndex: 'gia_tri_moi' },
    { title: 'Lý do', dataIndex: 'ly_do', ellipsis: true },
    {
      title: '', width: 60,
      render: (_: unknown, r: EmployeeHistory) => (
        <Popconfirm title="Xóa bản ghi?" onConfirm={async () => { await hrApi.deleteEmployeeHistory(r.id); await reloadHistories() }}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const renderHistoryTab = (loai: string) => {
    const filtered = histories.filter(h => h.loai === loai)
    return (
      <>
        <div style={{ marginBottom: 8 }}>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setHistoryLoai(loai); setHistoryModalOpen(true) }}
            disabled={!employee}
          >
            Thêm bản ghi
          </Button>
          {!employee && <Tag color="orange" style={{ marginLeft: 8 }}>Lưu nhân viên trước</Tag>}
        </div>
        <Table
          size="small"
          columns={historyColumns.filter(c => 'dataIndex' in c && c.dataIndex !== 'loai')}
          dataSource={filtered}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: <Empty description={`Chưa có lịch sử ${HISTORY_LOAI_LABEL[loai] || loai}`} /> }}
        />
      </>
    )
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="95vw"
      style={{ top: 16, maxWidth: 1400 }}
      title={<><UserOutlined /> {isCreate ? 'Thêm hồ sơ nhân viên' : 'Cập nhật hồ sơ nhân viên'}</>}
      maskClosable={false}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={4}>
            <Button icon={<PrinterOutlined />} disabled>In (F7)</Button>
          </Space>
          <Space>
            <Button type="primary" icon={isCreate ? <PlusOutlined /> : <EditOutlined />} onClick={handleSave} loading={saving}>
              {isCreate ? 'Thêm (F4)' : 'Lưu (F3)'}
            </Button>
            <Button icon={<CloseOutlined />} onClick={onClose}>Thoát (Esc)</Button>
          </Space>
        </div>
      }
      styles={{ body: { padding: 12, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' } }}
    >
      <Form form={form} layout="vertical" size="small" requiredMark={false}>
        {/* ─── PHẦN 1: Thông tin lý lịch ─── */}
        <fieldset style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: '8px 12px', marginBottom: 12 }}>
          <legend style={{ padding: '0 6px', fontSize: 12, fontWeight: 600, color: '#1677ff' }}>
            Thông tin lý lịch
          </legend>
          <Row gutter={8}>
            {/* Left: 4-col grid spanning 18 */}
            <Col span={19}>
              {/* Row 1 */}
              <Row gutter={6}>
                <Col span={3}>
                  <Form.Item label="Mã NV" name="ma_nv" rules={[{ required: true, message: 'Bắt buộc' }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Họ đệm" name="ho_dem">
                    <Input placeholder="Nguyễn Văn" />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label="Tên" name="ten">
                    <Input placeholder="Tường" />
                  </Form.Item>
                </Col>
                <Col span={2}>
                  <Form.Item label="Giới tính" name="gioi_tinh">
                    <Select options={[
                      { value: 'Nam', label: 'Nam' },
                      { value: 'Nữ', label: 'Nữ' },
                      { value: 'Khác', label: 'Khác' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label="Ngày sinh" name="ngay_sinh">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label="Quốc tịch" name="quoc_tich">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label="Dân tộc" name="dan_toc">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label="Tôn giáo" name="ton_giao">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 2 */}
              <Row gutter={6}>
                <Col span={4}>
                  <Form.Item label="Tên bí danh" name="ten_bi_danh">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Nơi sinh (tỉnh)" name="noi_sinh_tinh">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item label="Nơi sinh (địa chỉ)" name="noi_sinh_dia_chi">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Số CMND/CCCD" name="cccd">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label="Ngày cấp" name="ngay_cap">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Nơi cấp" name="noi_cap">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 3 - Quê quán */}
              <Row gutter={6}>
                <Col span={4}>
                  <Form.Item label="Tỉnh quê quán" name="tinh_que_quan">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Huyện quê quán" name="huyen_que_quan">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Phường/Xã quê quán" name="phuong_que_quan">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Địa chỉ quê quán" name="dia_chi_que_quan">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 4 - Hộ khẩu */}
              <Row gutter={6}>
                <Col span={4}>
                  <Form.Item label="Tỉnh hộ khẩu" name="tinh_ho_khau">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Huyện hộ khẩu" name="huyen_ho_khau">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Phường/Xã hộ khẩu" name="phuong_ho_khau">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Địa chỉ hộ khẩu" name="dia_chi_ho_khau">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 5 - Liên hệ */}
              <Row gutter={6}>
                <Col span={4}>
                  <Form.Item label="Điện thoại bàn" name="dien_thoai_ban">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="Điện thoại di động" name="so_dien_thoai">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item label="Địa chỉ Email" name="email">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={11}>
                  <Form.Item label="Địa chỉ hiện tại" name="dia_chi_hien_tai">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Col>

            {/* Right: Photo box */}
            <Col span={5}>
              <div style={{
                marginTop: 24,
                width: '100%', aspectRatio: '3/4', maxHeight: 220,
                border: '1px dashed #d9d9d9', borderRadius: 4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: '#fafafa', color: '#bfbfbf',
              }}>
                <Form.Item name="avatar_url" noStyle>
                  <Input type="hidden" />
                </Form.Item>
                {form.getFieldValue('avatar_url')
                  ? <img src={form.getFieldValue('avatar_url')} alt="Ảnh nhân viên" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 4 }} />
                  : <>
                      <UserOutlined style={{ fontSize: 48 }} />
                      <div style={{ fontSize: 11, marginTop: 8 }}>Chưa có ảnh</div>
                    </>
                }
                <Button
                  size="small"
                  icon={<UploadOutlined />}
                  style={{ marginTop: 8 }}
                  disabled
                  title="Tính năng upload ảnh sẽ được triển khai khi có endpoint media riêng (Giai đoạn 2)"
                >
                  Tải ảnh (sắp ra mắt)
                </Button>
              </div>
            </Col>
          </Row>
        </fieldset>

        {/* ─── PHẦN 2: Tabs ─── */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          type="card"
          items={[
            { key: 'resume', label: 'Thông tin sơ yếu', children: resumeTabContent },
            {
              key: 'family',
              label: 'Quan hệ gia đình',
              children: (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => { setEditingFamily(null); setFamilyModalOpen(true) }}
                      disabled={!employee}
                    >
                      Thêm quan hệ
                    </Button>
                    {!employee && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>Lưu nhân viên trước</Tag>
                    )}
                  </div>
                  <Table
                    size="small"
                    columns={familyColumns}
                    dataSource={families}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: 'Chưa có quan hệ gia đình' }}
                  />
                </>
              ),
            },
            {
              key: 'files',
              label: 'File hồ sơ',
              children: (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={() => setDocModalOpen(true)}
                      disabled={!employee}
                    >
                      Thêm tài liệu
                    </Button>
                    {!employee && <Tag color="orange" style={{ marginLeft: 8 }}>Lưu nhân viên trước</Tag>}
                  </div>
                  <Table
                    size="small"
                    columns={fileColumns}
                    dataSource={documents}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: 'Chưa có tài liệu nào' }}
                  />
                </>
              ),
            },
            {
              key: 'contracts',
              label: 'Quá trình hợp đồng',
              children: (
                <>
                  <Tag color="blue" style={{ marginBottom: 8 }}>
                    Chỉ xem — quản lý hợp đồng chi tiết tại module HR riêng
                  </Tag>
                  <Table
                    size="small"
                    columns={contractColumns}
                    dataSource={contracts}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: 'Chưa có hợp đồng nào' }}
                  />
                </>
              ),
            },
            { key: 'transfers', label: 'Quá trình thuyên chuyển', children: renderHistoryTab('bo_phan') },
            { key: 'positions', label: 'Quá trình chức vụ', children: renderHistoryTab('chuc_vu') },
            { key: 'salary', label: 'Quá trình lương', children: renderHistoryTab('luong_cb') },
            { key: 'allowance', label: 'Quá trình phụ cấp', children: renderHistoryTab('phu_cap') },
            { key: 'bhxh', label: 'Quá trình BHXH', children: bhxhTabContent },
            // ─── Phase 1 integration: 3 tab mới ───
            { key: 'health', label: <span>🏥 Khám sức khỏe</span>, children: (
              <>
                <Tag color="cyan" style={{ marginBottom: 8 }}>
                  Theo TT 14/2013/TT-BYT — quản lý chi tiết tại trang Khám sức khỏe
                </Tag>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={healthChecks}
                  locale={{ emptyText: 'Chưa có lần khám nào' }}
                  columns={[
                    { title: 'Ngày khám', dataIndex: 'ngay_kham', width: 110,
                      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
                    { title: 'Loại', dataIndex: 'loai_kham', width: 130,
                      render: (v: string) => {
                        const labels: Record<string, string> = {
                          dinh_ky: '🩺 Định kỳ', dot_xuat: '🚨 Đột xuất',
                          truoc_tuyen_dung: '📋 Trước tuyển dụng', sau_om_dau: '🤒 Sau ốm đau',
                        }
                        return labels[v] || v
                      } },
                    { title: 'Phân loại SK', dataIndex: 'phan_loai_suc_khoe', width: 110,
                      render: (v: string) => {
                        if (!v) return '—'
                        const colors: Record<string, string> = { I: 'green', II: 'cyan', III: 'gold', IV: 'orange', V: 'red' }
                        return <Tag color={colors[v] || 'default'}>Loại {v}</Tag>
                      } },
                    { title: 'Nơi khám', dataIndex: 'noi_kham', ellipsis: true },
                    { title: 'Khám tiếp', dataIndex: 'ngay_kham_tiep_theo', width: 130,
                      render: (v: string) => {
                        if (!v) return '—'
                        const d = dayjs(v); const diff = d.diff(dayjs(), 'day')
                        if (diff < 0) return <Tag color="red">Quá hạn {Math.abs(diff)}d</Tag>
                        if (diff <= 30) return <Tag color="orange">{d.format('DD/MM')} ({diff}d)</Tag>
                        return d.format('DD/MM/YYYY')
                      } },
                    { title: 'Ghi chú', dataIndex: 'ket_luan', ellipsis: true },
                  ]}
                />
              </>
            )},
            { key: 'bhld', label: <span>🛡️ BHLĐ đã cấp</span>, children: (
              <>
                <Tag color="orange" style={{ marginBottom: 8 }}>
                  Cấp phát BHLĐ — quản lý chi tiết tại trang An toàn lao động
                </Tag>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={bhldIssues}
                  locale={{ emptyText: 'Chưa cấp BHLĐ nào' }}
                  columns={[
                    { title: 'Thiết bị', dataIndex: 'ten_equipment' },
                    { title: 'Ngày cấp', dataIndex: 'ngay_cap', width: 110,
                      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
                    { title: 'Số lượng', dataIndex: 'so_luong', width: 80, align: 'center' as const },
                    { title: 'Hạn sử dụng', dataIndex: 'han_su_dung_den', width: 130,
                      render: (v: string) => {
                        if (!v) return '—'
                        const d = dayjs(v); const diff = d.diff(dayjs(), 'day')
                        if (diff < 0) return <Tag color="red">Quá hạn {Math.abs(diff)}d</Tag>
                        if (diff <= 30) return <Tag color="orange">{d.format('DD/MM')} ({diff}d)</Tag>
                        return d.format('DD/MM/YYYY')
                      } },
                    { title: 'Lý do', dataIndex: 'ly_do', width: 130,
                      render: (v: string) => {
                        const labels: Record<string, string> = {
                          cap_moi: 'Cấp mới', thay_the: 'Thay thế', hong: 'Hỏng', mat: 'Mất',
                        }
                        return labels[v] || v
                      } },
                  ]}
                />
              </>
            )},
            { key: 'kpi', label: <span>🎯 KPI / Đánh giá</span>, children: (
              <>
                <Tag color="purple" style={{ marginBottom: 8 }}>
                  Lịch sử đánh giá KPI — chi tiết tại trang KPI / Đánh giá
                </Tag>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={kpiEvaluations}
                  locale={{ emptyText: 'Chưa có đánh giá KPI' }}
                  columns={[
                    { title: 'Chu kỳ', dataIndex: 'ten_chu_ky' },
                    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 140,
                      render: (v: string) => {
                        const m: Record<string, { color: string; label: string }> = {
                          chua_lam: { color: 'default', label: 'Chưa làm' },
                          nv_dang_cham: { color: 'gold', label: 'NV đang chấm' },
                          cho_ql: { color: 'orange', label: 'Chờ QL' },
                          cho_duyet: { color: 'cyan', label: 'Chờ duyệt' },
                          hoan_tat: { color: 'green', label: 'Hoàn tất' },
                        }
                        return <Tag color={m[v]?.color}>{m[v]?.label || v}</Tag>
                      } },
                    { title: 'Điểm NV', dataIndex: 'diem_nv_tu_cham', width: 90, align: 'center' as const,
                      render: (v: number) => v != null ? v.toFixed(2) : '—' },
                    { title: 'Điểm QL', dataIndex: 'diem_quan_ly', width: 90, align: 'center' as const,
                      render: (v: number) => v != null ? v.toFixed(2) : '—' },
                    { title: 'Điểm cuối', dataIndex: 'diem_cuoi_cung', width: 100, align: 'center' as const,
                      render: (v: number, r: any) => {
                        if (v == null) return '—'
                        const colors: Record<string, string> = { A: 'green', B: 'blue', C: 'gold', D: 'orange', E: 'red' }
                        return (
                          <span>
                            <strong>{v.toFixed(2)}</strong>
                            {r.xep_loai && <Tag color={colors[r.xep_loai] || 'default'} style={{ marginLeft: 4 }}>{r.xep_loai}</Tag>}
                          </span>
                        )
                      } },
                  ]}
                />
              </>
            )},
          ]}
        />
      </Form>

      {/* Family Relation Sub-modal */}
      <FamilyRelationFormModal
        open={familyModalOpen}
        initial={editingFamily}
        onCancel={() => { setFamilyModalOpen(false); setEditingFamily(null) }}
        onSubmit={handleSaveFamily}
      />

      {/* Document Sub-modal */}
      <DocumentFormModal
        open={docModalOpen}
        onCancel={() => setDocModalOpen(false)}
        onSubmit={async (values) => {
          if (!employee) return
          await hrApi.createEmployeeDocument(employee.id, values)
          await reloadDocuments()
          setDocModalOpen(false)
        }}
      />

      {/* History Sub-modal */}
      <HistoryFormModal
        open={historyModalOpen}
        loai={historyLoai}
        onCancel={() => setHistoryModalOpen(false)}
        onSubmit={async (values) => {
          if (!employee) return
          await hrApi.createEmployeeHistory(employee.id, { ...values, loai: historyLoai })
          await reloadHistories()
          setHistoryModalOpen(false)
        }}
      />
    </Modal>
  )
}

// ─── Family sub-modal ───
interface FamilyFormProps {
  open: boolean
  initial: FamilyRelation | null
  onCancel: () => void
  onSubmit: (values: Partial<FamilyRelation>) => void
}

function FamilyRelationFormModal({ open, initial, onCancel, onSubmit }: FamilyFormProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      if (initial) form.setFieldsValue(initial)
      else form.resetFields()
    }
  }, [open, initial, form])

  return (
    <Modal
      open={open}
      title={initial ? 'Sửa quan hệ gia đình' : 'Thêm quan hệ gia đình'}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      destroyOnClose
      width={520}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="Họ và tên" name="ho_ten" rules={[{ required: true, message: 'Bắt buộc' }]}>
          <Input />
        </Form.Item>
        <Row gutter={8}>
          <Col span={12}>
            <Form.Item label="Năm sinh" name="nam_sinh">
              <Input type="number" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Mối quan hệ" name="moi_quan_he">
              <Select allowClear options={RELATION_OPTIONS.map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Nghề nghiệp" name="nghe_nghiep">
          <Input />
        </Form.Item>
        <Form.Item label="Số điện thoại" name="so_dien_thoai">
          <Input />
        </Form.Item>
        <Form.Item label="Ghi chú" name="ghi_chu">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Document sub-modal ───
interface DocumentFormProps {
  open: boolean
  onCancel: () => void
  onSubmit: (values: Partial<EmployeeDocument>) => Promise<void>
}

function DocumentFormModal({ open, onCancel, onSubmit }: DocumentFormProps) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.resetFields() }, [open, form])

  return (
    <Modal
      open={open}
      title="Thêm tài liệu hồ sơ"
      onCancel={onCancel}
      onOk={async () => {
        const v = await form.validateFields()
        await onSubmit({
          ...v,
          ngay_het_han: v.ngay_het_han?.format('YYYY-MM-DD'),
        })
      }}
      destroyOnClose
      width={520}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="Tên tài liệu" name="ten_tai_lieu" rules={[{ required: true, message: 'Bắt buộc' }]}>
          <Input placeholder="VD: Bản sao CCCD, Bằng đại học..." />
        </Form.Item>
        <Form.Item label="Loại" name="loai_tai_lieu" initialValue="KHAC">
          <Select options={[
            { value: 'CCCD', label: 'CCCD/CMTND' },
            { value: 'HOP_DONG', label: 'Hợp đồng' },
            { value: 'BANG_CAP', label: 'Bằng cấp' },
            { value: 'CHUNG_CHI', label: 'Chứng chỉ' },
            { value: 'KHAC', label: 'Khác' },
          ]} />
        </Form.Item>
        <Form.Item label="Đường dẫn file" name="file_path" rules={[{ required: true, message: 'Bắt buộc' }]}
          tooltip="URL file đã upload (sau này sẽ có nút upload trực tiếp)">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item label="Ngày hết hạn (nếu có)" name="ngay_het_han">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── History sub-modal (Thuyên chuyển / Chức vụ / Lương / Phụ cấp) ───
interface HistoryFormProps {
  open: boolean
  loai: string
  onCancel: () => void
  onSubmit: (values: Partial<EmployeeHistory>) => Promise<void>
}

function HistoryFormModal({ open, loai, onCancel, onSubmit }: HistoryFormProps) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.resetFields() }, [open, form])

  return (
    <Modal
      open={open}
      title={`Thêm bản ghi: ${HISTORY_LOAI_LABEL[loai] || loai}`}
      onCancel={onCancel}
      onOk={async () => {
        const v = await form.validateFields()
        await onSubmit({
          ...v,
          ngay_hieu_luc: v.ngay_hieu_luc?.format('YYYY-MM-DD'),
        })
      }}
      destroyOnClose
      width={520}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ ngay_hieu_luc: dayjs() }}>
        <Form.Item label="Ngày hiệu lực" name="ngay_hieu_luc" rules={[{ required: true, message: 'Bắt buộc' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Row gutter={8}>
          <Col span={12}>
            <Form.Item label="Giá trị cũ" name="gia_tri_cu"><Input /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Giá trị mới" name="gia_tri_moi"><Input /></Form.Item>
          </Col>
        </Row>
        <Form.Item label="Lý do" name="ly_do">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
