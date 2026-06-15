/**
 * Cơ cấu tổ chức — cây 4 cấp: Pháp nhân → Bộ phận → Tổ → Nhân viên.
 *
 * Left  : Tree view với count NV mỗi node. Click node → load detail bên phải.
 * Right : Detail panel theo loại node (pháp nhân/bộ phận/tổ/NV).
 *
 * CRUD: Department (sửa qua right form) + Team (sửa/tạo/xóa qua right form).
 * NV: chỉ hiển thị mini-info; chỉnh sửa chi tiết tại trang Hồ sơ NV.
 */
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, Select, Space, Tree, Typography, message, Row, Col,
  Tag, Empty, Popconfirm, Statistic, Avatar, List, Badge, Divider,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  TeamOutlined, BankOutlined, UserOutlined, FolderOutlined,
} from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { hrApi, Department, Employee, Team } from '../../api/hr'
import { phapNhanApi } from '../../api/phap_nhan'
import { useHotkey } from '../../hooks/useHotkey'

const { Title, Text } = Typography

type NodeKind = 'phap_nhan' | 'bo_phan' | 'to' | 'nv'
interface SelectedNode {
  kind: NodeKind
  id: number
  parentDeptId?: number  // dùng khi tạo mới Tổ
}

// Màu cho từng cấp
const KIND_COLOR: Record<NodeKind, string> = {
  phap_nhan: '#722ed1',
  bo_phan:   '#1677ff',
  to:        '#13c2c2',
  nv:        '#52c41a',
}
const KIND_ICON: Record<NodeKind, React.ReactNode> = {
  phap_nhan: <BankOutlined />,
  bo_phan:   <ApartmentOutlined />,
  to:        <FolderOutlined />,
  nv:        <UserOutlined />,
}

export default function DepartmentPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<SelectedNode | null>(null)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editingTeam, setEditingTeam] = useState<Partial<Team> | null>(null)
  const [deptForm] = Form.useForm()
  const [teamForm] = Form.useForm()

  // ─── Queries ───
  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
  })
  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })
  const { data: teams = [] } = useQuery({
    queryKey: ['hr-teams'],
    queryFn: () => hrApi.listTeams().then(r => r.data),
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-org'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  // ─── Mutations ───
  const saveDeptMut = useMutation({
    mutationFn: (data: Partial<Department>) =>
      editingDept?.id ? hrApi.updateDepartment(editingDept.id, data) : hrApi.createDepartment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-depts'] })
      message.success('Đã lưu bộ phận')
      setEditingDept(null)
      deptForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const deleteDeptMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-depts'] })
      message.success('Đã xóa bộ phận')
      setSelected(null)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không xóa được'),
  })

  const saveTeamMut = useMutation({
    mutationFn: (data: Partial<Team>) =>
      editingTeam?.id ? hrApi.updateTeam(editingTeam.id!, data) : hrApi.createTeam(data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['hr-teams'] })
      message.success('Đã lưu tổ')
      setEditingTeam(null)
      teamForm.resetFields()
      // Auto-select tổ vừa tạo
      const newTeam = r.data as Team
      if (newTeam?.id) setSelected({ kind: 'to', id: newTeam.id })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const deleteTeamMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-teams'] })
      message.success('Đã xóa tổ')
      setSelected(null)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không xóa được tổ'),
  })

  // ─── Build tree data: Pháp nhân → BP → Tổ → NV ───
  const treeData = useMemo<DataNode[]>(() => {
    return phapNhanList.map(pn => {
      const deptsOfPN = depts.filter(d =>
        employees.some(e => e.phap_nhan_id === pn.id && e.bo_phan_id === d.id)
      )
      const empsNoBoPhan = employees.filter(e => e.phap_nhan_id === pn.id && !e.bo_phan_id)

      return {
        key: `pn-${pn.id}`,
        title: (
          <span style={{ fontWeight: 600 }}>
            <Tag color="purple" style={{ marginRight: 6 }}>Pháp nhân</Tag>
            {pn.ten_viet_tat || pn.ten_phap_nhan}
            <Badge
              count={employees.filter(e => e.phap_nhan_id === pn.id).length}
              showZero
              style={{ backgroundColor: KIND_COLOR.phap_nhan, marginLeft: 8 }}
            />
          </span>
        ),
        icon: <BankOutlined style={{ color: KIND_COLOR.phap_nhan }} />,
        children: [
          ...deptsOfPN.map(d => buildDeptNode(d, pn.id)),
          ...(empsNoBoPhan.length > 0 ? [{
            key: `pn-${pn.id}-orphan`,
            title: <Text type="warning">⚠ {empsNoBoPhan.length} NV chưa gán bộ phận</Text>,
            isLeaf: true,
            selectable: false,
          }] : []),
        ],
      }
    })

    function buildDeptNode(d: Department, pnId: number): DataNode {
      const teamsOfDept = teams.filter(t => t.bo_phan_id === d.id)
      const empsInDept = employees.filter(e => e.phap_nhan_id === pnId && e.bo_phan_id === d.id)
      const empsNoTeam = empsInDept.filter(e => !e.to_id)
      return {
        key: `dept-${d.id}-pn-${pnId}`,
        title: (
          <span>
            <Tag color="blue" style={{ marginRight: 6 }}>Bộ phận</Tag>
            <strong>{d.ten_bo_phan}</strong>
            <Badge
              count={empsInDept.length}
              showZero
              style={{ backgroundColor: KIND_COLOR.bo_phan, marginLeft: 8 }}
            />
          </span>
        ),
        icon: <ApartmentOutlined style={{ color: KIND_COLOR.bo_phan }} />,
        children: [
          ...teamsOfDept.map(t => buildTeamNode(t, pnId)),
          ...(empsNoTeam.length > 0 ? empsNoTeam.map(e => buildEmpNode(e)) : []),
        ],
      }
    }

    function buildTeamNode(t: Team, pnId: number): DataNode {
      const empsInTeam = employees.filter(e => e.to_id === t.id && e.phap_nhan_id === pnId)
      return {
        key: `team-${t.id}-pn-${pnId}`,
        title: (
          <span>
            <Tag color="cyan" style={{ marginRight: 6 }}>Tổ</Tag>
            {t.ten_to}
            <Badge
              count={empsInTeam.length}
              showZero
              style={{ backgroundColor: KIND_COLOR.to, marginLeft: 8 }}
            />
          </span>
        ),
        icon: <FolderOutlined style={{ color: KIND_COLOR.to }} />,
        children: empsInTeam.map(e => buildEmpNode(e)),
      }
    }

    function buildEmpNode(e: Employee): DataNode {
      return {
        key: `emp-${e.id}`,
        title: (
          <span>
            <Avatar size={18} style={{ marginRight: 6, backgroundColor: KIND_COLOR.nv, fontSize: 10, verticalAlign: 'middle' }}>
              {(e.ho_ten || '?').charAt(0)}
            </Avatar>
            <Text>{e.ho_ten}</Text>
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
              ({e.ma_nv}{e.ten_chuc_vu ? ` · ${e.ten_chuc_vu}` : ''})
            </Text>
          </span>
        ),
        icon: <UserOutlined style={{ color: KIND_COLOR.nv }} />,
        isLeaf: true,
      }
    }
  }, [phapNhanList, depts, teams, employees])

  // ─── Click handler ───
  const onSelectNode = (keys: React.Key[]) => {
    if (!keys.length) { setSelected(null); return }
    const key = String(keys[0])
    if (key.startsWith('pn-') && !key.includes('orphan')) {
      const id = parseInt(key.split('-')[1])
      setSelected({ kind: 'phap_nhan', id })
    } else if (key.startsWith('dept-')) {
      const id = parseInt(key.split('-')[1])
      setSelected({ kind: 'bo_phan', id })
      const d = depts.find(x => x.id === id)
      if (d) {
        setEditingDept(d)
        deptForm.setFieldsValue(d)
      }
    } else if (key.startsWith('team-')) {
      const id = parseInt(key.split('-')[1])
      setSelected({ kind: 'to', id })
      const t = teams.find(x => x.id === id)
      if (t) {
        setEditingTeam(t)
        teamForm.setFieldsValue(t)
      }
    } else if (key.startsWith('emp-')) {
      const id = parseInt(key.split('-')[1])
      setSelected({ kind: 'nv', id })
    }
  }

  useHotkey('ctrl+n', () => { setEditingDept({} as Department); deptForm.resetFields() }, 'Thêm phòng ban mới')

  // ─── Stats tổng quan ───
  const stats = useMemo(() => ({
    phapNhan: phapNhanList.length,
    boPhan: depts.length,
    to: teams.length,
    nv: employees.length,
  }), [phapNhanList, depts, teams, employees])

  // ─── Render right panel theo node được chọn ───
  const renderRightPanel = () => {
    if (!selected && !editingDept && !editingTeam) {
      return (
        <Card size="small">
          <Empty
            image={<ApartmentOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
            description={
              <div>
                <Text strong>Chọn 1 nút trên cây bên trái</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  hoặc bấm "+ Thêm bộ phận" / "+ Thêm tổ" để tạo mới
                </Text>
              </div>
            }
          />
        </Card>
      )
    }

    if (selected?.kind === 'phap_nhan') {
      const pn = phapNhanList.find(p => p.id === selected.id)
      if (!pn) return null
      const empCount = employees.filter(e => e.phap_nhan_id === pn.id).length
      const deptCount = new Set(
        employees.filter(e => e.phap_nhan_id === pn.id && e.bo_phan_id).map(e => e.bo_phan_id)
      ).size
      return (
        <Card size="small" title={<><BankOutlined /> Pháp nhân: {pn.ten_phap_nhan}</>}>
          <Row gutter={16}>
            <Col span={8}><Statistic title="Bộ phận" value={deptCount} /></Col>
            <Col span={8}><Statistic title="Tổng NV" value={empCount} /></Col>
            <Col span={8}><Statistic title="Tên viết tắt" value={pn.ten_viet_tat || '—'} /></Col>
          </Row>
          <Divider />
          <Text type="secondary">Mã: {pn.ma_phap_nhan}</Text>
        </Card>
      )
    }

    if (selected?.kind === 'nv') {
      const e = employees.find(x => x.id === selected.id)
      if (!e) return null
      return (
        <Card size="small" title={<><UserOutlined /> {e.ho_ten}</>}>
          <Row gutter={[16, 8]}>
            <Col span={12}><Text type="secondary">Mã NV:</Text> <strong>{e.ma_nv}</strong></Col>
            <Col span={12}><Text type="secondary">SĐT:</Text> {e.so_dien_thoai || '—'}</Col>
            <Col span={12}><Text type="secondary">Chức vụ:</Text> {e.ten_chuc_vu || '—'}</Col>
            <Col span={12}><Text type="secondary">Bộ phận:</Text> {e.ten_bo_phan || '—'}</Col>
            <Col span={12}><Text type="secondary">Tổ:</Text> {e.ten_to || '—'}</Col>
            <Col span={12}><Text type="secondary">Pháp nhân:</Text> {e.ten_phap_nhan || '—'}</Col>
          </Row>
          <Divider />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Để chỉnh sửa hồ sơ, vào <strong>Hồ sơ nhân viên</strong> → click NV.
          </Text>
        </Card>
      )
    }

    // Bộ phận hoặc Tổ — render form sửa
    if (editingDept || (selected?.kind === 'bo_phan' && !editingTeam)) {
      const empsInDept = selected?.kind === 'bo_phan'
        ? employees.filter(e => e.bo_phan_id === selected.id) : []
      return (
        <Card
          size="small"
          title={<><ApartmentOutlined /> {editingDept?.id ? 'Sửa bộ phận' : 'Thêm bộ phận'}</>}
          extra={selected?.kind === 'bo_phan' && (
            <Space>
              <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => {
                // Tạo tổ con cho BP này
                setEditingTeam({ bo_phan_id: selected.id, ten_to: '' })
                teamForm.resetFields()
                teamForm.setFieldsValue({ bo_phan_id: selected.id })
              }}>Thêm tổ con</Button>
              <Popconfirm
                title="Xóa bộ phận?"
                description="Phải đảm bảo không còn NV/tổ thuộc bộ phận này."
                onConfirm={() => editingDept?.id && deleteDeptMut.mutate(editingDept.id)}
                okText="Xóa" okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )}
        >
          <Form form={deptForm} layout="vertical" onFinish={v => saveDeptMut.mutate(v)}>
            <Row gutter={12}>
              <Col span={10}>
                <Form.Item name="ma_bo_phan" label="Mã" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={14}>
                <Form.Item name="ten_bo_phan" label="Tên bộ phận" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="mo_ta" label="Mô tả">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space>
              <Button onClick={() => { setEditingDept(null); deptForm.resetFields() }}>Hủy</Button>
              <Button type="primary" onClick={() => deptForm.submit()} loading={saveDeptMut.isPending}>
                Lưu
              </Button>
            </Space>
          </Form>
          {empsInDept.length > 0 && (
            <>
              <Divider>Nhân viên thuộc bộ phận ({empsInDept.length})</Divider>
              <List
                size="small"
                dataSource={empsInDept.slice(0, 20)}
                renderItem={e => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar size="small" style={{ backgroundColor: KIND_COLOR.nv }}>{(e.ho_ten || '?').charAt(0)}</Avatar>}
                      title={<span>{e.ho_ten} <Text type="secondary" style={{ fontSize: 12 }}>({e.ma_nv})</Text></span>}
                      description={
                        <Space size={4} wrap>
                          {e.ten_to && <Tag color="cyan">{e.ten_to}</Tag>}
                          {e.ten_chuc_vu && <Tag>{e.ten_chuc_vu}</Tag>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              {empsInDept.length > 20 && <Text type="secondary">… và {empsInDept.length - 20} NV khác</Text>}
            </>
          )}
        </Card>
      )
    }

    if (editingTeam || selected?.kind === 'to') {
      const empsInTeam = selected?.kind === 'to'
        ? employees.filter(e => e.to_id === selected.id) : []
      return (
        <Card
          size="small"
          title={<><FolderOutlined /> {editingTeam?.id ? `Sửa tổ: ${editingTeam.ten_to}` : 'Thêm tổ mới'}</>}
          extra={editingTeam?.id && (
            <Popconfirm
              title="Xóa tổ này?"
              description="Phải đảm bảo không còn NV thuộc tổ."
              onConfirm={() => deleteTeamMut.mutate(editingTeam.id!)}
              okText="Xóa" okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        >
          <Form form={teamForm} layout="vertical" onFinish={v => saveTeamMut.mutate(v)}>
            <Form.Item name="ten_to" label="Tên tổ" rules={[{ required: true }]}>
              <Input placeholder="VD: Tổ In, Tổ Thành phẩm…" />
            </Form.Item>
            <Form.Item name="bo_phan_id" label="Thuộc bộ phận" rules={[{ required: true }]}>
              <Select
                showSearch optionFilterProp="label"
                options={depts.map(d => ({ value: d.id, label: d.ten_bo_phan }))}
              />
            </Form.Item>
            <Form.Item name="to_truong_id" label="Tổ trưởng">
              <Select
                showSearch optionFilterProp="label" allowClear
                options={employees.map(e => ({ value: e.id, label: `${e.ho_ten} (${e.ma_nv})` }))}
                placeholder="Chọn 1 NV làm tổ trưởng"
              />
            </Form.Item>
            <Form.Item name="mo_ta" label="Mô tả">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space>
              <Button onClick={() => { setEditingTeam(null); teamForm.resetFields() }}>Hủy</Button>
              <Button type="primary" onClick={() => teamForm.submit()} loading={saveTeamMut.isPending}>
                Lưu
              </Button>
            </Space>
          </Form>
          {empsInTeam.length > 0 && (
            <>
              <Divider>Nhân viên trong tổ ({empsInTeam.length})</Divider>
              <List
                size="small"
                dataSource={empsInTeam}
                renderItem={e => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar size="small" style={{ backgroundColor: KIND_COLOR.nv }}>{(e.ho_ten || '?').charAt(0)}</Avatar>}
                      title={<span>{e.ho_ten} <Text type="secondary" style={{ fontSize: 12 }}>({e.ma_nv})</Text></span>}
                      description={e.ten_chuc_vu}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Card>
      )
    }

    return null
  }

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <ApartmentOutlined /> Cơ cấu Tổ chức
          </Title>
          <Text type="secondary">
            Cây 4 cấp: Pháp nhân → Bộ phận → Tổ → Nhân viên · click 1 node để xem chi tiết
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => {
              setEditingDept({} as any)
              deptForm.resetFields()
            }}>Thêm bộ phận</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingTeam({ ten_to: '', bo_phan_id: undefined })
              teamForm.resetFields()
            }}>Thêm tổ</Button>
          </Space>
        </Col>
      </Row>

      {/* Stats overview */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Pháp nhân" value={stats.phapNhan} prefix={<BankOutlined style={{ color: KIND_COLOR.phap_nhan }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Bộ phận" value={stats.boPhan} prefix={<ApartmentOutlined style={{ color: KIND_COLOR.bo_phan }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tổ" value={stats.to} prefix={<FolderOutlined style={{ color: KIND_COLOR.to }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Nhân viên" value={stats.nv} prefix={<TeamOutlined style={{ color: KIND_COLOR.nv }} />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card size="small" title="Cây tổ chức" styles={{ body: { padding: 12, maxHeight: 'calc(100vh - 340px)', overflow: 'auto' } }}>
            <Tree
              showIcon
              defaultExpandAll
              blockNode
              treeData={treeData}
              onSelect={onSelectNode}
              selectedKeys={
                selected ? [
                  selected.kind === 'phap_nhan' ? `pn-${selected.id}` :
                  selected.kind === 'bo_phan'   ? `dept-${selected.id}` :
                  selected.kind === 'to'        ? `team-${selected.id}` :
                                                  `emp-${selected.id}`
                ] : []
              }
            />
          </Card>
        </Col>
        <Col span={10}>
          {renderRightPanel()}
        </Col>
      </Row>
    </div>
  )
}
