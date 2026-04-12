import { CaretRightFilled, CodeOutlined } from '@ant-design/icons'
import { Empty, Flex, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography, message, theme } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import JsonResultViewer from './JsonResultViewer'
import type { McpRunRecord, McpServerRecord, McpToolRecord } from './mcpTypes'

type McpToolRunnerModalProps = {
  onClose: () => void
  onFinished: (run: McpRunRecord) => Promise<void> | void
  open: boolean
  server: McpServerRecord | null
  tool: McpToolRecord | null
}

type ToolFormField = {
  description: string
  enumValues: string[]
  name: string
  required: boolean
  title: string
  type: string
}

type ToolFormValues = Record<string, boolean | number | string | undefined>

function safePrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getToolFields(tool: McpToolRecord | null): ToolFormField[] {
  if (!tool) {
    return []
  }

  const properties = tool.inputSchema.properties
  const required = Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return []
  }

  return Object.entries(properties).map(([fieldName, fieldSchema]) => {
    const schema = fieldSchema && typeof fieldSchema === 'object' && !Array.isArray(fieldSchema) ? fieldSchema : {}

    return {
      description: typeof schema.description === 'string' ? schema.description : '',
      enumValues: Array.isArray(schema.enum) ? schema.enum.filter((item): item is string => typeof item === 'string') : [],
      name: fieldName,
      required: required.includes(fieldName),
      title: typeof schema.title === 'string' ? schema.title : fieldName,
      type: typeof schema.type === 'string' ? schema.type : 'json'
    }
  })
}

function buildInitialValues(tool: McpToolRecord | null): ToolFormValues {
  if (!tool) {
    return {}
  }

  const properties = tool.inputSchema.properties

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(properties).flatMap(([fieldName, fieldSchema]) => {
      const schema = fieldSchema && typeof fieldSchema === 'object' && !Array.isArray(fieldSchema) ? fieldSchema : {}

      if (typeof schema.default === 'undefined') {
        return []
      }

      if (schema.type === 'array' || schema.type === 'object') {
        return [[fieldName, safePrettyJson(schema.default)]]
      }

      return [[fieldName, schema.default]]
    })
  )
}

function McpToolRunnerModal({
  onClose,
  onFinished,
  open,
  server,
  tool
}: McpToolRunnerModalProps): React.JSX.Element {
  const { token } = theme.useToken()
  const [form] = Form.useForm<ToolFormValues>()
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<McpRunRecord | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const toolFields = useMemo(() => getToolFields(tool), [tool])

  useEffect(() => {
    if (!open) {
      return
    }

    form.resetFields()
    form.setFieldsValue(buildInitialValues(tool))
    setLastRun(null)
  }, [form, open, tool])

  // 按 schema 类型把表单值还原成工具真正需要的参数对象。
  const parseFormValues = (values: ToolFormValues): Record<string, unknown> => {
    return toolFields.reduce<Record<string, unknown>>((payload, field) => {
      const value = values[field.name]

      if (field.type === 'boolean') {
        payload[field.name] = value === true
        return payload
      }

      if (typeof value === 'undefined' || value === null || value === '') {
        return payload
      }

      if (field.type === 'array' || field.type === 'object' || field.type === 'json') {
        try {
          payload[field.name] = JSON.parse(String(value))
        } catch {
          throw new Error(`${field.title} must be valid JSON.`)
        }

        return payload
      }

      payload[field.name] = value
      return payload
    }, {})
  }

  const handleRunTool = async (): Promise<void> => {
    if (!server || !tool) {
      return
    }

    try {
      const values = await form.validateFields()
      setRunning(true)
      const run = await window.api.callMcpTool({
        arguments: parseFormValues(values),
        serverId: server.id,
        toolName: tool.name
      })

      setLastRun(run)
      messageApi.success(`Executed ${tool.title}`)
      await onFinished(run)
    } catch (runError) {
      if (runError instanceof Error) {
        messageApi.error(runError.message)
      }
    } finally {
      setRunning(false)
    }
  }

  const renderField = (field: ToolFormField): React.JSX.Element => {
    if (field.enumValues.length > 0) {
      return (
        <Form.Item
          key={field.name}
          extra={field.description || undefined}
          label={field.title}
          name={field.name}
          rules={field.required ? [{ required: true, message: `Please select ${field.title}.` }] : undefined}
        >
          <Select
            options={field.enumValues.map((value) => ({ label: value, value }))}
            placeholder={`Select ${field.title}`}
          />
        </Form.Item>
      )
    }

    if (field.type === 'boolean') {
      return (
        <Form.Item
          key={field.name}
          extra={field.description || undefined}
          label={field.title}
          name={field.name}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      )
    }

    if (field.type === 'integer' || field.type === 'number') {
      return (
        <Form.Item
          key={field.name}
          extra={field.description || undefined}
          label={field.title}
          name={field.name}
          rules={field.required ? [{ required: true, message: `Please enter ${field.title}.` }] : undefined}
        >
          <InputNumber placeholder={`Enter ${field.title}`} style={{ width: '100%' }} />
        </Form.Item>
      )
    }

    if (field.type === 'array' || field.type === 'object' || field.type === 'json') {
      return (
        <Form.Item
          key={field.name}
          extra={field.description || undefined}
          label={field.title}
          name={field.name}
          rules={field.required ? [{ required: true, message: `Please enter ${field.title}.` }] : undefined}
        >
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder={`JSON for ${field.title}`} />
        </Form.Item>
      )
    }

    return (
      <Form.Item
        key={field.name}
        extra={field.description || undefined}
        label={field.title}
        name={field.name}
        rules={field.required ? [{ required: true, message: `Please enter ${field.title}.` }] : undefined}
      >
        <Input placeholder={`Enter ${field.title}`} />
      </Form.Item>
    )
  }

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ icon: <CaretRightFilled />, loading: running }}
      okText="Run"
      open={open}
      title={tool ? `Run ${tool.title}` : 'Run tool'}
      width={860}
      onCancel={onClose}
      onOk={() => {
        void handleRunTool()
      }}
    >
      {contextHolder}
      <Flex gap={20} vertical>
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: 16,
            background: token.colorFillQuaternary
          }}
        >
          <Space direction="vertical" size={4}>
            <Typography.Text strong>{tool?.title ?? '-'}</Typography.Text>
            <Typography.Text style={{ color: token.colorTextSecondary }}>
              {server?.name ?? '-'}
            </Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0, color: token.colorTextSecondary }}>
              {tool?.description || 'This tool does not provide a description.'}
            </Typography.Paragraph>
          </Space>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${token.colorBorderSecondary}`,
              padding: 16
            }}
          >
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Arguments
            </Typography.Title>

            {toolFields.length === 0 ? (
              <Empty description="This tool does not require arguments." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Form form={form} layout="vertical">
                {toolFields.map((field) => renderField(field))}
              </Form>
            )}
          </div>

          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${token.colorBorderSecondary}`,
              padding: 16
            }}
          >
            <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
              <CodeOutlined />
              <Typography.Title level={5} style={{ margin: 0 }}>
                Result
              </Typography.Title>
            </Flex>

            {lastRun ? (
              <Flex gap={12} vertical>
                <Space size={12} wrap>
                  <Typography.Text strong>Status:</Typography.Text>
                  <Typography.Text style={{ color: lastRun.status === 'success' ? token.colorSuccess : token.colorError }}>
                    {lastRun.status}
                  </Typography.Text>
                  <Typography.Text strong>Duration:</Typography.Text>
                  <Typography.Text>{lastRun.durationMs} ms</Typography.Text>
                </Space>

                <JsonResultViewer
                  data={lastRun.status === 'success' ? lastRun.result : { error: lastRun.error }}
                  minHeight={320}
                  rootName="result"
                />
              </Flex>
            ) : (
              <Empty description="Run the tool to inspect its response." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </div>
      </Flex>
    </Modal>
  )
}

export default McpToolRunnerModal
