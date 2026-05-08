import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Checkbox, Col, Empty, Row, Select, Space, Tag, Typography, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { permissionsApi, rolesApi, type Permission } from '../../api/permissions'

const { Title, Text } = Typography

export default function RolePermissionsPage() {
  const qc = useQueryClient()
  const [roleId, setRoleId] = useState<number | undefined>()
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([])

  const { data: rolesPage, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => rolesApi.list({ page: 1, page_size: 100 }).then(r => r.data),
  })

  const { data: permissionsPage, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions', 'list'],
    queryFn: () => permissionsApi.list({ page: 1, page_size: 100 }).then(r => r.data),
  })

  const { data: roleDetail, isLoading: roleLoading } = useQuery({
    queryKey: ['roles', roleId],
    enabled: !!roleId,
    queryFn: () => rolesApi.get(roleId!).then(r => r.data),
  })

  useEffect(() => {
    if (roleDetail) {
      setSelectedPermissionIds(roleDetail.role_permissions.map(rp => rp.permission.id))
    }
  }, [roleDetail])

  const roles = rolesPage?.items || []
  const permissions = permissionsPage?.items || []

  const grouped = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((acc, p) => {
      const group = p.nhom || 'khac'
      if (!acc[group]) acc[group] = []
      acc[group].push(p)
      return acc
    }, {})
  }, [permissions])

  const assignMutation = useMutation({
    mutationFn: () => rolesApi.assignPermissions(roleId!, selectedPermissionIds),
    onSuccess: () => {
      message.success('Đã cập nhật phân quyền')
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không cập nhật được phân quyền'),
  })

  return (
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Phân quyền vai trò</Title>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="Chọn vai trò"
              loading={rolesLoading}
              style={{ width: 280 }}
              value={roleId}
              onChange={setRoleId}
              options={roles.map(r => ({ value: r.id, label: `${r.ten_vai_tro} (${r.ma_vai_tro})` }))}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!roleId}
              loading={assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Lưu phân quyền
            </Button>
          </Space>
        </Col>
      </Row>

      {!roleId ? (
        <Empty description="Chọn một vai trò để phân quyền" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Text strong>{roleDetail?.ten_vai_tro}</Text>
            {roleDetail && <Tag style={{ marginLeft: 8 }}>{roleDetail.ma_vai_tro}</Tag>}
          </div>

          {Object.entries(grouped).map(([group, items]) => (
            <Card key={group} size="small" title={group} loading={permissionsLoading || roleLoading}>
              <Checkbox.Group
                style={{ width: '100%' }}
                value={selectedPermissionIds}
                onChange={values => setSelectedPermissionIds(values as number[])}
              >
                <Row gutter={[12, 12]}>
                  {items.map(p => (
                    <Col span={8} key={p.id}>
                      <Checkbox value={p.id}>
                        <Space direction="vertical" size={0}>
                          <Text>{p.ten_quyen}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{p.ma_quyen}</Text>
                        </Space>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Card>
          ))}
        </Space>
      )}
    </Card>
  )
}
