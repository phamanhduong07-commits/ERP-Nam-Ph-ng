import { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Typography, Button, Space, Input, InputNumber, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { receiptApi, paymentApi } from '../../api/accounting'
import type { JournalEntry } from '../../api/accounting'
import client from '../../api/client'

const { Text } = Typography

export interface JournalLine {
  key: number
  dien_giai: string
  tk_no: string
  tk_co: string
  so_tien: number
}

interface HachToanSectionProps {
  documentId?: number
  documentLoai: 'phieu_thu' | 'phieu_chi'
  trangThai: string
  tkNo?: string
  tkCo?: string
  soTien?: number
  dienGiai?: string
  initialOverride?: JournalLine[] | null
}

function buildPreviewLines(tkNo: string, tkCo: string, soTien: number, dienGiai: string): JournalLine[] {
  if (!tkNo || !soTien) return []
  return [
    { key: 1, dien_giai: dienGiai || '', tk_no: tkNo, tk_co: '',   so_tien: soTien },
    { key: 2, dien_giai: dienGiai || '', tk_no: '',   tk_co: tkCo, so_tien: soTien },
  ]
}

function journalEntriesToLines(entries: JournalEntry[]): JournalLine[] {
  const lines: JournalLine[] = []
  let key = 1
  for (const entry of entries) {
    for (const line of entry.lines) {
      lines.push({
        key: key++,
        dien_giai: line.dien_giai || entry.dien_giai || '',
        tk_no: line.so_tien_no > 0 ? line.so_tk : '',
        tk_co: line.so_tien_co > 0 ? line.so_tk : '',
        so_tien: line.so_tien_no > 0 ? line.so_tien_no : line.so_tien_co,
      })
    }
  }
  return lines
}

let _nextKey = 100

export default function HachToanSection({
  documentId,
  documentLoai,
  trangThai,
  tkNo = '',
  tkCo = '',
  soTien = 0,
  dienGiai = '',
  initialOverride,
}: HachToanSectionProps) {
  const isDaDuyet = trangThai === 'da_duyet'
  const isHuy = trangThai === 'huy'
  const isEditable = !isDaDuyet && !isHuy
  const qc = useQueryClient()

  // editLines = null means "use auto-preview", array means user has customized
  const [editLines, setEditLines] = useState<JournalLine[] | null>(
    initialOverride && initialOverride.length > 0
      ? initialOverride.map((l, i) => ({ ...l, key: i + 1 }))
      : null
  )
  const [saving, setSaving] = useState(false)

  // Sync initialOverride when record is loaded
  useEffect(() => {
    if (initialOverride && initialOverride.length > 0) {
      setEditLines(initialOverride.map((l, i) => ({ ...l, key: i + 1 })))
    }
  }, [documentId])

  const { data: journalEntries = [], isFetching } = useQuery({
    queryKey: ['journal-entries', documentLoai, documentId],
    queryFn: () =>
      documentLoai === 'phieu_thu'
        ? receiptApi.getJournalEntries(documentId!)
        : paymentApi.getJournalEntries(documentId!),
    enabled: isDaDuyet && !!documentId,
  })

  const saveOverride = useCallback(async (lines: JournalLine[] | null) => {
    if (!documentId) return
    setSaving(true)
    try {
      const payload = lines
        ? lines.map(l => ({
            so_tk: l.tk_no || l.tk_co,
            dien_giai: l.dien_giai,
            so_tien_no: l.tk_no ? l.so_tien : 0,
            so_tien_co: l.tk_co ? l.so_tien : 0,
          }))
        : []
      const url = documentLoai === 'phieu_thu'
        ? `/api/accounting/receipts/${documentId}/journal-lines`
        : `/api/accounting/payments/${documentId}/journal-lines`
      await client.patch(url, { lines: payload })
    } catch {
      message.error('Lưu bút toán thất bại')
    } finally {
      setSaving(false)
    }
  }, [documentId, documentLoai])

  if (isHuy) return null

  const previewLines = buildPreviewLines(tkNo, tkCo, soTien, dienGiai)
  const displayLines: JournalLine[] = isDaDuyet
    ? journalEntriesToLines(journalEntries)
    : (editLines ?? previewLines)

  const totalNo  = displayLines.filter(r => r.tk_no).reduce((s, r) => s + r.so_tien, 0)
  const totalCo  = displayLines.filter(r => r.tk_co).reduce((s, r) => s + r.so_tien, 0)
  const balanced = displayLines.length > 0 && Math.abs(totalNo - totalCo) < 1

  function handleAddLine() {
    const base = editLines ?? previewLines
    const newLine: JournalLine = {
      key: ++_nextKey,
      dien_giai: dienGiai || '',
      tk_no: '',
      tk_co: '',
      so_tien: 0,
    }
    const next = [...base, newLine]
    setEditLines(next)
    saveOverride(next)
  }

  function handleClearLines() {
    setEditLines(null)
    saveOverride(null)
  }

  function handleUpdateLine(key: number, field: keyof JournalLine, value: string | number) {
    const base = editLines ?? previewLines
    const next = base.map(l => l.key === key ? { ...l, [field]: value } : l)
    setEditLines(next)
    saveOverride(next)
  }

  function handleDeleteLine(key: number) {
    const base = editLines ?? previewLines
    const next = base.filter(l => l.key !== key)
    setEditLines(next.length ? next : null)
    saveOverride(next.length ? next : null)
  }

  const columns = isDaDuyet ? [
    {
      title: '#',
      key: 'stt',
      width: 40,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
      key: 'dien_giai',
      ellipsis: true,
    },
    {
      title: 'TK Nợ',
      dataIndex: 'tk_no',
      key: 'tk_no',
      width: 90,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : null,
    },
    {
      title: 'TK Có',
      dataIndex: 'tk_co',
      key: 'tk_co',
      width: 90,
      render: (v: string) => v ? <Tag color="purple">{v}</Tag> : null,
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      key: 'so_tien',
      width: 130,
      align: 'right' as const,
      render: (v: number) => <Text strong>{v.toLocaleString('vi-VN')} đ</Text>,
    },
  ] : [
    {
      title: '#',
      key: 'stt',
      width: 40,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
      key: 'dien_giai',
      render: (v: string, record: JournalLine) => (
        <Input
          size="small"
          value={v}
          onChange={e => handleUpdateLine(record.key, 'dien_giai', e.target.value)}
          onBlur={e => handleUpdateLine(record.key, 'dien_giai', e.target.value)}
          style={{ fontSize: 13 }}
        />
      ),
    },
    {
      title: 'TK Nợ',
      dataIndex: 'tk_no',
      key: 'tk_no',
      width: 90,
      render: (v: string, record: JournalLine) => (
        <Input
          size="small"
          value={v}
          maxLength={10}
          onChange={e => handleUpdateLine(record.key, 'tk_no', e.target.value)}
          style={{ fontSize: 13, textAlign: 'center' }}
          placeholder="VD: 112"
        />
      ),
    },
    {
      title: 'TK Có',
      dataIndex: 'tk_co',
      key: 'tk_co',
      width: 90,
      render: (v: string, record: JournalLine) => (
        <Input
          size="small"
          value={v}
          maxLength={10}
          onChange={e => handleUpdateLine(record.key, 'tk_co', e.target.value)}
          style={{ fontSize: 13, textAlign: 'center' }}
          placeholder="VD: 131"
        />
      ),
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      key: 'so_tien',
      width: 140,
      align: 'right' as const,
      render: (v: number, record: JournalLine) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          step={1000}
          formatter={val => val ? Number(val).toLocaleString('vi-VN') : ''}
          parser={val => Number((val || '').replace(/[^0-9]/g, ''))}
          onChange={val => handleUpdateLine(record.key, 'so_tien', val ?? 0)}
          style={{ width: '100%', fontSize: 13 }}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 36,
      render: (_: unknown, record: JournalLine) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteLine(record.key)}
        />
      ),
    },
  ]

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 14 }}>Hạch toán</Text>
        <Space size={8}>
          {isEditable && (
            <>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddLine}
                loading={saving}
              >
                Thêm dòng
              </Button>
              <Popconfirm
                title="Xóa hết dòng và dùng bút toán tự động?"
                onConfirm={handleClearLines}
                okText="Xóa hết"
                cancelText="Hủy"
                disabled={!editLines}
              >
                <Button
                  size="small"
                  icon={<ClearOutlined />}
                  disabled={!editLines}
                >
                  Xóa hết dòng
                </Button>
              </Popconfirm>
            </>
          )}
          {isDaDuyet
            ? <Tag color="green">Đã hạch toán</Tag>
            : editLines
              ? <Tag color="orange">Tùy chỉnh</Tag>
              : <Tag color="default">Xem trước</Tag>
          }
          {displayLines.length > 0 && (
            <Tag color={balanced ? 'green' : 'red'}>
              {balanced ? '✓ Cân đối' : '✗ Không cân'}
            </Tag>
          )}
        </Space>
      </div>

      <Table
        size="small"
        dataSource={displayLines}
        columns={columns}
        pagination={false}
        loading={isFetching}
        rowKey="key"
        bordered
        style={{ fontSize: 13 }}
        summary={displayLines.length > 0 ? () => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={2}>
              <Text strong>Tổng cộng</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="center">
              <Text strong style={{ color: '#1677ff' }}>{totalNo.toLocaleString('vi-VN')}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="center">
              <Text strong style={{ color: '#722ed1' }}>{totalCo.toLocaleString('vi-VN')}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
            {!isDaDuyet && <Table.Summary.Cell index={5} />}
          </Table.Summary.Row>
        ) : undefined}
      />
    </div>
  )
}
