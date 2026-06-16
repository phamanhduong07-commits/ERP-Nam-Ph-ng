import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Spin, message } from 'antd'
import type { SelectProps } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { QuickAddConfig } from '../config/quickAddConfigs'
import client from '../api/client'

interface QuickAddSelectProps extends Omit<SelectProps, 'onChange'> {
  config: QuickAddConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (value: any) => void
  /** Called with the full created record after successful save. Use to invalidate RQ cache or update local state. */
  onCreated?: (record: Record<string, unknown>) => void
}

export default function QuickAddSelect({
  config,
  value,
  onChange,
  onCreated,
  disabled,
  ...selectProps
}: QuickAddSelectProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()

  const handleOpen = () => {
    form.resetFields()
    setError(null)
    setOpen(true)
  }

  const handleCancel = () => {
    if (loading) return
    setOpen(false)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      setError(null)
      const res = await client.post<Record<string, unknown>>(config.endpoint, values)
      const record = res.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newValue = record[config.valueField ?? 'id'] as any
      onChange?.(newValue)
      onCreated?.(record)
      message.success(`Đã tạo: ${record[config.labelField]}`)
      setOpen(false)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return // AntD validation error
      const apiErr = err as { response?: { data?: { detail?: string } } }
      setError(apiErr?.response?.data?.detail ?? 'Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Select
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...selectProps}
          style={{ flex: 1, ...selectProps.style }}
        />
        {!disabled && (
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={handleOpen}
            title={config.title}
            style={{ flexShrink: 0 }}
          />
        )}
      </div>

      <Modal
        title={config.title}
        open={open}
        onCancel={handleCancel}
        onOk={handleSubmit}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={loading}
        destroyOnClose
        width={420}
      >
        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical">
          {config.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `${field.label} là bắt buộc` }] : undefined}
            >
              {field.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />
              ) : field.type === 'textarea' ? (
                <Input.TextArea rows={3} placeholder={field.placeholder} />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}
        </Form>
        {loading && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Spin size="small" />
          </div>
        )}
      </Modal>
    </>
  )
}
