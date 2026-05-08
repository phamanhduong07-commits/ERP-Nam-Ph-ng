import { useState } from 'react'
import { Modal, Upload, Button, Table, Tag, Space, Typography, Alert, message, Card } from 'antd'
import { UploadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'

const { Text } = Typography

interface ImportExcelDialogProps {
  title: string
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
  importFn: (file: File, commit: boolean) => Promise<any>
  templateUrl?: string
}

export default function ImportExcelDialog({
  title, visible, onCancel, onSuccess, importFn, templateUrl
}: ImportExcelDialogProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleImport = async (commit: boolean) => {
    if (fileList.length === 0) {
      message.warning('Vui lòng chọn file Excel')
      return
    }

    setLoading(true)
    try {
      const res = await importFn(fileList[0].originFileObj as File, commit)
      setResult(res)
      if (commit && (!res.errors || res.errors.length === 0)) {
        message.success('Import thành công!')
        onSuccess()
        onCancel()
      } else if (commit) {
        message.error('Import có lỗi, vui lòng kiểm tra danh sách bên dưới')
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Lỗi khi import file')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: 'Dòng', dataIndex: 'row', width: 80 },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      width: 120,
      render: (s: string) => {
        if (s === 'create') return <Tag color="green">Tạo mới</Tag>
        if (s === 'update') return <Tag color="blue">Cập nhật</Tag>
        if (s === 'error') return <Tag color="red">Lỗi</Tag>
        if (s === 'skip') return <Tag color="default">Bỏ qua</Tag>
        return <Tag>{s}</Tag>
      }
    },
    { 
      title: 'Lỗi chi tiết', 
      dataIndex: 'errors',
      render: (errs: string[]) => (
        <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
          {errs?.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )
    }
  ]

  // Đối với Sales/Purchase Order, cấu trúc kết quả hơi khác
  const isOrderImport = result && (result.total_orders !== undefined || result.total_pos !== undefined)

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={() => { setResult(null); setFileList([]); onCancel() }}
      width={900}
      footer={[
        <Button key="close" onClick={onCancel}>Đóng</Button>,
        <Button 
          key="check" 
          icon={<CheckCircleOutlined />} 
          onClick={() => handleImport(false)}
          loading={loading}
          disabled={fileList.length === 0}
        >
          Kiểm tra dữ liệu
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          icon={<UploadOutlined />} 
          onClick={() => handleImport(true)}
          loading={loading}
          disabled={fileList.length === 0 || (result && result.errors && result.errors.length > 0)}
        >
          Thực hiện Import
        </Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Upload
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList }) => setFileList(fileList.slice(-1))}
            accept=".xlsx,.xls"
          >
            <Button icon={<UploadOutlined />}>Chọn file Excel (.xlsx)</Button>
          </Upload>
          {templateUrl && (
            <Button type="link" href={templateUrl} target="_blank">Tải file mẫu</Button>
          )}
        </div>

        {result && !isOrderImport && (
          <Alert
            message="Kết quả kiểm tra"
            description={
              <Space split={<Text type="secondary">|</Text>}>
                <Text>Tổng: <b>{result.total}</b></Text>
                <Text type="success">Tạo mới: <b>{result.created}</b></Text>
                <Text style={{ color: '#1677ff' }}>Cập nhật: <b>{result.updated}</b></Text>
                <Text type="danger">Lỗi: <b>{result.errors}</b></Text>
                <Text type="secondary">Bỏ qua: <b>{result.skipped}</b></Text>
              </Space>
            }
            type={result.errors > 0 ? "warning" : "success"}
            showIcon
          />
        )}

        {result && isOrderImport && (
          <Alert
            message="Kết quả kiểm tra đơn hàng"
            description={
              <Space direction="vertical">
                <Text>Tổng số đơn hàng: <b>{result.total_orders || result.total_pos}</b></Text>
                {result.errors.length > 0 && (
                  <div style={{ color: '#ff4d4f' }}>
                    <ExclamationCircleOutlined /> Có {result.errors.length} lỗi trong file. Vui lòng sửa trước khi import.
                  </div>
                )}
              </Space>
            }
            type={result.errors.length > 0 ? "error" : "success"}
            showIcon
          />
        )}

        {result && !isOrderImport && result.rows && (
          <Table
            dataSource={result.rows.filter((r: any) => r.status === 'error' || r.status === 'create' || r.status === 'update')}
            columns={columns}
            size="small"
            pagination={{ pageSize: 10 }}
            rowKey="row"
            scroll={{ y: 300 }}
          />
        )}

        {result && isOrderImport && result.errors.length > 0 && (
          <Card title="Danh sách lỗi" size="small">
            <div style={{ maxHeight: 300, overflowY: 'auto', color: '#ff4d4f' }}>
              {result.errors.map((e: string, i: number) => <div key={i} style={{ marginBottom: 4 }}>• {e}</div>)}
            </div>
          </Card>
        )}
      </Space>
    </Modal>
  )
}
