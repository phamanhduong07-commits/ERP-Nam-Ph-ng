import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Checkbox, Table, Typography, Space, Row, Col, Spin, Tooltip, App } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import { permissionsApi, rolesApi } from '../../api/permissions'

const { Title, Text } = Typography

export default function PermissionMatrixPage() {
  const qc = useQueryClient()
  const { message } = App.useApp()
  
  // State for matrix: Record<role_id, Set<permission_id>>
  const [matrixState, setMatrixState] = useState<Record<number, Set<number>>>({})
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

  // Initialize state from fetched data
  useEffect(() => {
    if (roles.length > 0) {
      const newState: Record<number, Set<number>> = {}
      roles.forEach(role => {
        newState[role.id] = new Set(role.role_permissions?.map(rp => rp.permission.id) || [])
      })
      setMatrixState(newState)
      setHasChanges(false)
    }
  }, [roles])

  const handleToggle = (roleId: number, permissionId: number, checked: boolean) => {
    setMatrixState(prev => {
      const next = { ...prev }
      const set = new Set(next[roleId])
      if (checked) {
        set.add(permissionId)
      } else {
        set.delete(permissionId)
      }
      next[roleId] = set
      return next
    })
    setHasChanges(true)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      // For each role, send assignPermissions request
      // Optimally, we should only send for changed roles, but here we just save all.
      // Or we can just find which roles have differences.
      const promises = []
      for (const role of roles) {
        const currentSet = new Set(role.role_permissions?.map(rp => rp.permission.id) || [])
        const newStateSet = matrixState[role.id] || new Set()
        
        // Check if sets are different
        let isDiff = currentSet.size !== newStateSet.size
        if (!isDiff) {
          for (let item of currentSet) {
            if (!newStateSet.has(item)) {
              isDiff = true
              break
            }
          }
        }

        if (isDiff) {
          promises.push(rolesApi.assignPermissions(role.id, Array.from(newStateSet)))
        }
      }
      if (promises.length === 0) return []
      return Promise.all(promises)
    },
    onSuccess: (res) => {
      if (res.length > 0) {
        message.success(`Đã lưu phân quyền cho ${res.length} vai trò`)
      } else {
        message.info('Không có thay đổi nào để lưu')
      }
      setHasChanges(false)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail || 'Lỗi khi lưu phân quyền')
    }
  })

  // Group permissions by 'nhom' to create headers
  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, p) => {
      const g = p.nhom || 'Khác'
      if (!acc[g]) acc[g] = []
      acc[g].push(p)
      return acc
    }, {} as Record<string, typeof permissions>)
  }, [permissions])

  // Generate Table Columns
  const columns = useMemo(() => {
    const cols: any[] = [
      {
        title: 'Phòng ban - Chức vụ',
        dataIndex: 'ten_vai_tro',
        key: 'ten_vai_tro',
        fixed: 'left',
        width: 250,
        render: (v: string, r: any) => (
          <div>
            <div style={{ fontWeight: 600 }}>{v}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.ma_vai_tro}</Text>
          </div>
        )
      }
    ]

    Object.entries(groupedPermissions).forEach(([groupName, perms]) => {
      const children = perms.map(p => ({
        title: (
          <Tooltip title={`${p.ten_quyen} (${p.ma_quyen})`}>
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 120, padding: '8px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.ten_quyen}
            </div>
          </Tooltip>
        ),
        key: `perm_${p.id}`,
        width: 60,
        align: 'center',
        render: (_: any, role: any) => {
          const checked = matrixState[role.id]?.has(p.id) || false
          return (
            <Checkbox 
              checked={checked} 
              onChange={e => handleToggle(role.id, p.id, e.target.checked)}
            />
          )
        }
      }))
      
      cols.push({
        title: groupName,
        children
      })
    })

    return cols
  }, [groupedPermissions, matrixState])

  const isLoading = rolesLoading || permissionsLoading

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>Ma trận phân quyền (Role Matrix)</Title>
            <Text type="secondary">Phân quyền nhanh cho các vị trí, phòng ban, chức vụ</Text>
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
                Lưu ma trận
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
      
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>
      ) : (
        <Table
          dataSource={roles}
          rowKey="id"
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
          size="small"
          bordered
        />
      )}
    </Card>
  )
}
