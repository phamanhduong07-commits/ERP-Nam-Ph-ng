import { useEffect, useMemo, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Checkbox, Typography, Space, Row, Col, Spin, App, List, Layout, Modal } from 'antd'
import { SaveOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons'
import { permissionsApi, rolesApi } from '../../api/permissions'

const { Title, Text } = Typography
const { Sider, Content } = Layout

export default function PermissionMatrixPage() {
  const qc = useQueryClient()
  const { message } = App.useApp()
  
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [rolePermissions, setRolePermissions] = useState<Set<number>>(new Set())
  const [hasChanges, setHasChanges] = useState(false)

  const { data: rolesPage, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', 'list', 'matrix'],
    queryFn: () => rolesApi.list({ page: 1, page_size: 100 }).then(r => r.data),
  })

  const { data: permissionsPage, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions', 'list', 'matrix'],
    queryFn: () => permissionsApi.list({ page: 1, page_size: 100 }).then(r => r.data),
  })

  const roles = rolesPage?.items || []
  const permissions = permissionsPage?.items || []

  // Initialize selected role state
  useEffect(() => {
    if (selectedRoleId && roles.length > 0) {
      const role = roles.find(r => r.id === selectedRoleId)
      if (role) {
        setRolePermissions(new Set(role.role_permissions?.map((rp: { permission: { id: number } }) => rp.permission.id) || []))
        setHasChanges(false)
      }
    } else if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id)
    }
  }, [selectedRoleId, roles])

  const handleToggle = (permissionId: number, checked: boolean) => {
    setRolePermissions(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(permissionId)
      } else {
        next.delete(permissionId)
      }
      return next
    })
    setHasChanges(true)
  }

  const handleSelectAllGroup = (permissionIds: number[], checked: boolean) => {
    setRolePermissions(prev => {
      const next = new Set(prev)
      permissionIds.forEach(id => {
        if (checked) next.add(id)
        else next.delete(id)
      })
      return next
    })
    setHasChanges(true)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedRoleId) return
      return rolesApi.assignPermissions(selectedRoleId, Array.from(rolePermissions))
    },
    onSuccess: () => {
      message.success('Đã lưu phân quyền thành công!')
      setHasChanges(false)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi lưu phân quyền')
    }
  })

  // Group permissions by 'nhom'
  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, p) => {
      const g = p.nhom || 'Quyền chung'
      if (!acc[g]) acc[g] = []
      acc[g].push(p)
      return acc
    }, {} as Record<string, typeof permissions>)
  }, [permissions])

  const isLoading = rolesLoading || permissionsLoading
  const selectedRole = roles.find(r => r.id === selectedRoleId)

  return (
    <Card styles={{ body: { padding: 0 } }} style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>Phân quyền chi tiết (Role Permissions)</Title>
            <Text type="secondary">Quản lý quyền truy cập của từng chức vụ/phòng ban</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['roles'] })}>Tải lại</Button>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                loading={saveMut.isPending}
                disabled={!hasChanges}
                onClick={() => saveMut.mutate()}
              >
                Lưu thay đổi
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
      
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>
      ) : (
        <Layout style={{ background: '#fff', flex: 1, height: '100%', overflow: 'hidden' }}>
          {/* Cột trái: Danh sách Role */}
          <Sider width={320} style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
            <List
              dataSource={roles}
              size="small"
              renderItem={(role) => (
                <List.Item
                  onClick={() => {
                    if (hasChanges) {
                      Modal.confirm({
                        title: 'Chưa lưu thay đổi',
                        content: 'Bạn có những thay đổi chưa lưu. Bạn có chắc chắn muốn chuyển sang vai trò khác không?',
                        onOk: () => setSelectedRoleId(role.id),
                      })
                    } else {
                      setSelectedRoleId(role.id)
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 24px',
                    background: selectedRoleId === role.id ? '#e6f4ff' : 'transparent',
                    borderLeft: selectedRoleId === role.id ? '3px solid #1677ff' : '3px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ color: selectedRoleId === role.id ? '#1677ff' : 'inherit' }}>
                      {role.ten_vai_tro}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{role.ma_vai_tro}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Sider>

          {/* Cột phải: Danh sách quyền của Role được chọn */}
          <Content style={{ padding: '24px', overflowY: 'auto' }}>
            {selectedRole ? (
              <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <div style={{ marginBottom: 24, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                  <Space>
                    <SafetyOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                    <div>
                      <Title level={5} style={{ margin: 0, color: '#389e0d' }}>
                        Đang phân quyền cho: {selectedRole.ten_vai_tro}
                      </Title>
                      <Text type="secondary">Mã: {selectedRole.ma_vai_tro}</Text>
                    </div>
                  </Space>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Object.entries(groupedPermissions).map(([groupName, perms]) => {
                    const groupPermIds = perms.map(p => p.id)
                    const isAllChecked = groupPermIds.every(id => rolePermissions.has(id))
                    const isIndeterminate = groupPermIds.some(id => rolePermissions.has(id)) && !isAllChecked

                    return (
                      <Card 
                        key={groupName} 
                        size="small" 
                        title={<Text strong>{groupName}</Text>}
                        extra={
                          <Checkbox 
                            indeterminate={isIndeterminate}
                            checked={isAllChecked}
                            onChange={e => handleSelectAllGroup(groupPermIds, e.target.checked)}
                          >
                            Chọn tất cả
                          </Checkbox>
                        }
                        styles={{ header: { background: '#fafafa' } }}
                      >
                        <Row gutter={[16, 12]}>
                          {perms.map(p => (
                            <Col xs={24} sm={12} md={8} key={p.id}>
                              <Checkbox
                                checked={rolePermissions.has(p.id)}
                                onChange={e => handleToggle(p.id, e.target.checked)}
                              >
                                <span style={{ fontSize: 13 }}>{p.ten_quyen}</span>
                              </Checkbox>
                            </Col>
                          ))}
                        </Row>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 100, color: '#999' }}>
                Vui lòng chọn một chức vụ/phòng ban bên trái để bắt đầu phân quyền.
              </div>
            )}
          </Content>
        </Layout>
      )}
    </Card>
  )
}
