import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal, Table, Button, Tag, Space, Badge } from 'antd'
import { Typography, Tooltip } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { cauTrucApi, type CauTruc } from '../../../api/cauTruc'
import EmptyState from '../../../components/EmptyState'

const { Text } = Typography

interface CauTrucModalProps {
  open: boolean
  soLop: number
  onClose: () => void
  onSelect: (ct: CauTruc) => void
}

export default function CauTrucModal({ open, soLop: _soLop, onClose, onSelect }: CauTrucModalProps) {
  const [filterLop, setFilterLop] = useState<number | undefined>(undefined)

  const { data = [], isLoading } = useQuery({
    queryKey: ['cau-truc', filterLop],
    queryFn: () => cauTrucApi.list({ so_lop: filterLop, active_only: true }).then(r => r.data),
    enabled: open,
  })

  const cols: ColumnsType<CauTruc> = [
    {
      title: 'Tên kết cấu',
      dataIndex: 'ten_cau_truc',
      render: (v: string, r: CauTruc) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          {r.ghi_chu && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.ghi_chu}</Text>}
        </div>
      ),
    },
    {
      title: 'Lớp',
      dataIndex: 'so_lop',
      width: 60,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}L</Tag>,
    },
    {
      title: 'Sóng',
      dataIndex: 'to_hop_song',
      width: 60,
      align: 'center' as const,
      render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '—',
    },
    {
      title: 'Cấu trúc lớp giấy',
      render: (_: unknown, r: CauTruc) => {
        const layers: { label: string; code: string | null; isSong: boolean }[] = [
          { label: 'Mặt',    code: r.mat,    isSong: false },
          { label: 'Sóng 1', code: r.song_1, isSong: true },
          { label: 'Mặt 1',  code: r.mat_1,  isSong: false },
          ...(r.so_lop >= 5 ? [
            { label: 'Sóng 2', code: r.song_2, isSong: true },
            { label: 'Mặt 2',  code: r.mat_2,  isSong: false },
          ] : []),
          ...(r.so_lop >= 7 ? [
            { label: 'Sóng 3', code: r.song_3, isSong: true },
            { label: 'Mặt 3',  code: r.mat_3,  isSong: false },
          ] : []),
        ]
        const hasAny = layers.some(l => l.code)
        if (!hasAny) {
          const songs = r.to_hop_song ? r.to_hop_song.split('') : []
          const numMat = r.so_lop === 3 ? 2 : r.so_lop === 5 ? 3 : 4
          return (
            <Space size={2}>
              {Array.from({ length: numMat }).map((_, i) => (
                <>
                  <Tag key={`m${i}`} style={{ fontSize: 11, background: '#f5f5f5', margin: '1px' }}>Mặt</Tag>
                  {i < songs.length && (
                    <Tag key={`s${i}`} color="blue" style={{ fontSize: 11, margin: '1px' }}>
                      Sóng {songs[i]}
                    </Tag>
                  )}
                </>
              ))}
            </Space>
          )
        }
        return (
          <Space wrap size={[2, 2]}>
            {layers.map((l, i) => (
              <Tooltip key={i} title={l.label}>
                <Tag color={l.isSong ? 'blue' : undefined} style={{ fontSize: 11, margin: '1px' }}>
                  {l.code || <span style={{ color: '#bfbfbf' }}>—</span>}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        )
      },
    },
    {
      title: '',
      width: 80,
      render: (_: unknown, r: CauTruc) => (
        <Button type="primary" size="small" onClick={() => onSelect(r)}>Chọn</Button>
      ),
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <AppstoreOutlined />
          <span>Chọn kết cấu giấy thông dụng</span>
          <Badge count={data.length} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      destroyOnClose
    >
      <Space style={{ marginBottom: 12 }}>
        <Text>Lọc:</Text>
        {[undefined, 3, 5, 7].map(n => (
          <Button
            key={String(n)}
            size="small"
            type={filterLop === n ? 'primary' : 'default'}
            onClick={() => setFilterLop(n)}
          >
            {n === undefined ? 'Tất cả' : `${n} lớp`}
          </Button>
        ))}
      </Space>
      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        rowKey="id"
        dataSource={data}
        columns={cols}
        loading={isLoading}
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
        onRow={(r) => ({
          onDoubleClick: () => onSelect(r),
          style: { cursor: 'pointer' },
        })}
      />
      <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
        Nhấn đôi vào dòng hoặc nút Chọn để áp dụng kết cấu. Quản lý tại: Danh mục → Kết cấu thông dụng
      </Text>
    </Modal>
  )
}
