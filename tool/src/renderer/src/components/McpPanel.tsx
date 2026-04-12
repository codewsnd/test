import {
  ApiOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import {
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  theme
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import useDebouncedValue from '../hooks/useDebouncedValue'
import useTableScrollY from '../hooks/useTableScrollY'
import getStripedTableRowClassName from '../utils/getStripedTableRowClassName'
import JsonResultViewer from './mcp/JsonResultViewer'
import McpToolRunnerModal from './mcp/McpToolRunnerModal'
import type {
  McpRunRecord,
  McpServerDraft,
  McpServerRecord,
  McpServerTransport,
  McpToolRecord,
  McpViewKey
} from './mcp/mcpTypes'

type ServerFormValues = {
  argsText: string
  command: string
  cwd: string
  description: string
  enabled: boolean
  envText: string
  headersText: string
  name: string
  transport: McpServerTransport
  url: string
}

const MCP_VIEW_OPTIONS: Array<{ label: string; value: McpViewKey }> = [
  { label: 'Servers', value: 'servers' },
  { label: 'Tools', value: 'tools' },
  { label: 'Runs', value: 'runs' }
]

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildServerTarget(server: McpServerRecord): string {
  if (server.transport === 'streamable-http') {
    return server.url
  }

  return [server.command, ...server.args].join(' ')
}

function buildToolSummary(tool: McpToolRecord): string {
  const properties = tool.inputSchema.properties
  const required = Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required.length : 0

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return 'No arguments'
  }

  const total = Object.keys(properties).length

  if (total === 0) {
    return 'No arguments'
  }

  return `${total} props / ${required} required`
}

function getServerStatusLabel(server: McpServerRecord): string {
  if (!server.enabled) {
    return 'Stopped'
  }

  if (server.status === 'online') {
    return 'Running'
  }

  if (server.status === 'error') {
    return 'Error'
  }

  return 'Starting'
}

function getServerStatusColor(server: McpServerRecord): 'blue' | 'default' | 'green' | 'red' {
  if (!server.enabled) {
    return 'default'
  }

  if (server.status === 'online') {
    return 'green'
  }

  if (server.status === 'error') {
    return 'red'
  }

  return 'blue'
}

function buildServerFormValues(server: McpServerRecord | null): ServerFormValues {
  if (!server) {
    return {
      argsText: '[]',
      command: '',
      cwd: '',
      description: '',
      enabled: true,
      envText: '{}',
      headersText: '{}',
      name: '',
      transport: 'streamable-http',
      url: ''
    }
  }

  return {
    argsText: JSON.stringify(server.args, null, 2),
    command: server.command,
    cwd: server.cwd,
    description: server.description,
    enabled: server.enabled,
    envText: JSON.stringify(server.env, null, 2),
    headersText: JSON.stringify(server.headers, null, 2),
    name: server.name,
    transport: server.transport,
    url: server.url
  }
}

function parseJsonObjectText(value: string, label: string): Record<string, string> {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return {}
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(normalizedValue)
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }

  const invalidEntry = Object.entries(parsed).find(([, entryValue]) => typeof entryValue !== 'string')

  if (invalidEntry) {
    throw new Error(`${label} values must be strings.`)
  }

  return parsed as Record<string, string>
}

function parseJsonArrayText(value: string, label: string): string[] {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(normalizedValue)
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a JSON string array.`)
  }

  return parsed
}

function McpPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [serverForm] = Form.useForm<ServerFormValues>()
  const [servers, setServers] = useState<McpServerRecord[]>([])
  const [tools, setTools] = useState<McpToolRecord[]>([])
  const [runs, setRuns] = useState<McpRunRecord[]>([])
  const [view, setView] = useState<McpViewKey>('servers')
  const [selectedServerId, setSelectedServerId] = useState('')
  const [serverKeyword, setServerKeyword] = useState('')
  const [toolKeyword, setToolKeyword] = useState('')
  const [runKeyword, setRunKeyword] = useState('')
  const [serversLoading, setServersLoading] = useState(true)
  const [toolsLoading, setToolsLoading] = useState(false)
  const [runsLoading, setRunsLoading] = useState(true)
  const [editingServer, setEditingServer] = useState<McpServerRecord | null>(null)
  const [serverModalOpen, setServerModalOpen] = useState(false)
  const [savingServer, setSavingServer] = useState(false)
  const [actingServerId, setActingServerId] = useState<string | null>(null)
  const [runnerTool, setRunnerTool] = useState<McpToolRecord | null>(null)
  const [runnerOpen, setRunnerOpen] = useState(false)
  const [previewRun, setPreviewRun] = useState<McpRunRecord | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const debouncedServerKeyword = useDebouncedValue(serverKeyword, 200)
  const debouncedToolKeyword = useDebouncedValue(toolKeyword, 200)
  const debouncedRunKeyword = useDebouncedValue(runKeyword, 200)
  const { containerRef: serverContainerRef, pageSize: serverPageSize, maxRowsWithoutPagination: serverMaxRows } =
    useTableScrollY({ rowHeight: 56, minPageSize: 6 })
  const { containerRef: toolContainerRef, pageSize: toolPageSize, maxRowsWithoutPagination: toolMaxRows } =
    useTableScrollY({ rowHeight: 56, minPageSize: 6 })
  const { containerRef: runContainerRef, pageSize: runPageSize, maxRowsWithoutPagination: runMaxRows } =
    useTableScrollY({ rowHeight: 56, minPageSize: 6 })

  const activeServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [selectedServerId, servers]
  )

  const transportValue = Form.useWatch('transport', serverForm) ?? 'streamable-http'

  const panelStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      height: '100%'
    }),
    []
  )

  const segmentedStyle = useMemo(
    () => ({
      width: 320
    }),
    []
  )

  const sectionCardStyle = useMemo(
    () => ({
      borderRadius: 18,
      border: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorFillQuaternary
    }),
    [token.colorBorderSecondary, token.colorFillQuaternary]
  )

  const loadServers = async (): Promise<McpServerRecord[]> => {
    const nextServers = await window.api.listMcpServers()
    setServers(nextServers)

    if (nextServers.length > 0) {
      const currentSelectionExists = nextServers.some((server) => server.id === selectedServerId)
      const preferredServer = nextServers.find((server) => server.enabled) ?? nextServers[0]

      if (!currentSelectionExists && preferredServer) {
        setSelectedServerId(preferredServer.id)
      }
    } else if (selectedServerId) {
      setSelectedServerId('')
    }

    return nextServers
  }

  const loadRuns = async (): Promise<void> => {
    const nextRuns = await window.api.listMcpRuns()
    setRuns(nextRuns)
  }

  const loadTools = async (serverId: string): Promise<void> => {
    if (!serverId) {
      setTools([])
      return
    }

    setToolsLoading(true)

    try {
      const nextTools = await window.api.listMcpTools(serverId)
      setTools(nextTools)
      await loadServers()
    } catch (loadError) {
      setTools([])
      if (loadError instanceof Error) {
        messageApi.error(loadError.message)
      }
    } finally {
      setToolsLoading(false)
    }
  }

  useEffect(() => {
    let disposed = false

    // MCP 面板初始化时同时加载 server 配置和历史运行记录。
    const bootstrap = async (): Promise<void> => {
      try {
        const [nextServers, nextRuns] = await Promise.all([window.api.listMcpServers(), window.api.listMcpRuns()])

        if (disposed) {
          return
        }

        setServers(nextServers)
        setRuns(nextRuns)

        const preferredServer = nextServers.find((server) => server.enabled) ?? nextServers[0]

        if (preferredServer) {
          setSelectedServerId(preferredServer.id)
        }
      } catch (loadError) {
        if (!disposed && loadError instanceof Error) {
          messageApi.error(loadError.message)
        }
      } finally {
        if (!disposed) {
          setServersLoading(false)
          setRunsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      disposed = true
    }
  }, [messageApi])

  useEffect(() => {
    if (view !== 'tools' || !selectedServerId) {
      return
    }

    if (!activeServer || !activeServer.enabled) {
      setTools([])
      return
    }

    void loadTools(selectedServerId)
  }, [activeServer?.enabled, selectedServerId, view])

  const filteredServers = useMemo(() => {
    const keyword = debouncedServerKeyword.trim().toLowerCase()

    if (!keyword) {
      return servers
    }

    return servers.filter((server) =>
      `${server.name} ${server.description} ${buildServerTarget(server)} ${server.serverLabel ?? ''}`
        .toLowerCase()
        .includes(keyword)
    )
  }, [debouncedServerKeyword, servers])

  const filteredTools = useMemo(() => {
    const keyword = debouncedToolKeyword.trim().toLowerCase()

    if (!keyword) {
      return tools
    }

    return tools.filter((tool) =>
      `${tool.title} ${tool.name} ${tool.description} ${buildToolSummary(tool)}`.toLowerCase().includes(keyword)
    )
  }, [debouncedToolKeyword, tools])

  const filteredRuns = useMemo(() => {
    const keyword = debouncedRunKeyword.trim().toLowerCase()

    if (!keyword) {
      return runs
    }

    return runs.filter((run) =>
      `${run.serverName} ${run.toolName} ${run.preview} ${run.status}`.toLowerCase().includes(keyword)
    )
  }, [debouncedRunKeyword, runs])

  // 保存 server 时会把表单里的 JSON 文本还原成真正的 headers/env/args 结构。
  const handleSaveServer = async (): Promise<void> => {
    try {
      const values = await serverForm.validateFields()
      setSavingServer(true)

      const payload: McpServerDraft = {
        description: values.description.trim(),
        enabled: values.enabled,
        id: editingServer?.id,
        name: values.name.trim(),
        transport: values.transport
      }

      if (values.transport === 'streamable-http') {
        payload.url = values.url.trim()
        payload.headers = parseJsonObjectText(values.headersText, 'Headers')
      } else {
        payload.command = values.command.trim()
        payload.args = parseJsonArrayText(values.argsText, 'Arguments')
        payload.cwd = values.cwd.trim()
        payload.env = parseJsonObjectText(values.envText, 'Environment')
      }

      const savedServer = await window.api.saveMcpServer(payload)
      await loadServers()
      setSelectedServerId(savedServer.id)
      setServerModalOpen(false)
      setEditingServer(null)
      messageApi.success(`Saved ${savedServer.name}`)
    } catch (saveError) {
      await loadServers()
      if (saveError instanceof Error) {
        messageApi.error(saveError.message)
      }
    } finally {
      setSavingServer(false)
    }
  }

  const openCreateServerModal = (): void => {
    setEditingServer(null)
    setServerModalOpen(true)
    serverForm.setFieldsValue(buildServerFormValues(null))
  }

  const openEditServerModal = (server: McpServerRecord): void => {
    setEditingServer(server)
    setServerModalOpen(true)
    serverForm.setFieldsValue(buildServerFormValues(server))
  }

  const handleTestServer = async (serverId: string): Promise<void> => {
    try {
      setActingServerId(serverId)
      const testedServer = await window.api.testMcpServer(serverId)
      await loadServers()
      messageApi.success(`${testedServer.name} is online.`)
    } catch (testError) {
      if (testError instanceof Error) {
        messageApi.error(testError.message)
      }
    } finally {
      setActingServerId(null)
    }
  }

  const handleDeleteServer = (server: McpServerRecord): void => {
    Modal.confirm({
      cancelText: 'Cancel',
      content: `Delete ${server.name}? Existing run history will be kept.`,
      okButtonProps: { danger: true },
      okText: 'Delete',
      title: 'Delete MCP server',
      onOk: async () => {
        await window.api.deleteMcpServer(server.id)
        await loadServers()
        messageApi.success(`Deleted ${server.name}`)
      }
    })
  }

  const handleToggleServerEnabled = async (server: McpServerRecord, enabled: boolean): Promise<void> => {
    try {
      setActingServerId(server.id)
      const updatedServer = await window.api.saveMcpServer({
        ...server,
        enabled
      })
      await loadServers()
      messageApi.success(`${updatedServer.name} ${enabled ? 'started' : 'stopped'}.`)
    } catch (toggleError) {
      await loadServers()
      if (toggleError instanceof Error) {
        messageApi.error(toggleError.message)
      }
    } finally {
      setActingServerId(null)
    }
  }

  const handleOpenTools = async (server: McpServerRecord): Promise<void> => {
    setSelectedServerId(server.id)
    setView('tools')
    await loadTools(server.id)
  }

  const handleRefreshRuns = async (): Promise<void> => {
    try {
      setRunsLoading(true)
      await loadRuns()
    } catch (loadError) {
      if (loadError instanceof Error) {
        messageApi.error(loadError.message)
      }
    } finally {
      setRunsLoading(false)
    }
  }

  const serverColumns = useMemo<TableColumnsType<McpServerRecord>>(
    () => [
      {
        title: 'Server',
        dataIndex: 'name',
        key: 'name',
        width: '22%',
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{record.name}</Typography.Text>
            <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
              {record.description || 'No description provided.'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: 'Transport',
        dataIndex: 'transport',
        key: 'transport',
        width: '10%',
        render: (_, record) => <Tag style={{ margin: 0 }}>{record.transport === 'stdio' ? 'STDIO' : 'HTTP'}</Tag>
      },
      {
        title: 'Target',
        dataIndex: 'target',
        key: 'target',
        width: '26%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {buildServerTarget(record)}
          </Typography.Text>
        )
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: '20%',
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Tag color={getServerStatusColor(record)} style={{ margin: 0 }}>
              {getServerStatusLabel(record)}
            </Tag>
            <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
              {record.lastError ?? record.serverLabel ?? '-'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: 'Tools',
        dataIndex: 'toolCount',
        key: 'toolCount',
        width: '10%',
        render: (_, record) => <Typography.Text>{record.toolCount}</Typography.Text>
      },
      {
        title: 'Enabled',
        dataIndex: 'enabled',
        key: 'enabled',
        width: '8%',
        render: (_, record) => (
          <Switch
            checked={record.enabled}
            disabled={actingServerId === record.id}
            size="small"
            onChange={(checked) => {
              void handleToggleServerEnabled(record, checked)
            }}
          />
        )
      },
      {
        title: 'Action',
        key: 'action',
        width: '10%',
        render: (_, record) => (
          <Flex gap={2}>
            <Button
              aria-label={`Test ${record.name}`}
              icon={<ApiOutlined />}
              loading={actingServerId === record.id}
              shape="circle"
              size="small"
              type="text"
              onClick={() => {
                void handleTestServer(record.id)
              }}
            />
            <Button
              aria-label={`View tools for ${record.name}`}
              icon={<AppstoreOutlined />}
              loading={toolsLoading && selectedServerId === record.id && view === 'tools'}
              shape="circle"
              size="small"
              type="text"
              onClick={() => {
                void handleOpenTools(record)
              }}
            />
            <Button
              aria-label={`Edit ${record.name}`}
              icon={<EditOutlined />}
              shape="circle"
              size="small"
              type="text"
              onClick={() => openEditServerModal(record)}
            />
            <Button
              aria-label={`Delete ${record.name}`}
              icon={<DeleteOutlined />}
              shape="circle"
              size="small"
              type="text"
              danger
              onClick={() => handleDeleteServer(record)}
            />
          </Flex>
        )
      }
    ],
    [actingServerId, selectedServerId, token.colorTextSecondary, toolsLoading, view]
  )

  const toolColumns = useMemo<TableColumnsType<McpToolRecord>>(
    () => [
      {
        title: 'Tool',
        dataIndex: 'title',
        key: 'title',
        width: '24%',
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{record.title}</Typography.Text>
            <Typography.Text style={{ color: token.colorTextSecondary }}>{record.name}</Typography.Text>
          </Space>
        )
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: '40%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.description || 'No description provided.'}
          </Typography.Text>
        )
      },
      {
        title: 'Input',
        dataIndex: 'inputSchema',
        key: 'inputSchema',
        width: '14%',
        render: (_, record) => <Typography.Text>{buildToolSummary(record)}</Typography.Text>
      },
      {
        title: 'Hints',
        key: 'hints',
        width: '12%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.readOnly ? 'Read-only' : record.destructive ? 'Destructive' : record.executionMode ?? 'Standard'}
          </Typography.Text>
        )
      },
      {
        title: 'Action',
        key: 'action',
        width: '10%',
        render: (_, record) => (
          <Button
            aria-label={`Run ${record.title}`}
            icon={<ApiOutlined />}
            shape="circle"
            size="small"
            type="text"
            onClick={() => {
              setRunnerTool(record)
              setRunnerOpen(true)
            }}
          />
        )
      }
    ],
    [token.colorTextSecondary]
  )

  const runColumns = useMemo<TableColumnsType<McpRunRecord>>(
    () => [
      {
        title: 'Started',
        dataIndex: 'startedAt',
        key: 'startedAt',
        width: '18%',
        render: (_, record) => <Typography.Text>{formatDateTime(record.startedAt)}</Typography.Text>
      },
      {
        title: 'Server',
        dataIndex: 'serverName',
        key: 'serverName',
        width: '18%',
        render: (_, record) => <Typography.Text ellipsis>{record.serverName}</Typography.Text>
      },
      {
        title: 'Tool',
        dataIndex: 'toolName',
        key: 'toolName',
        width: '18%',
        render: (_, record) => <Typography.Text ellipsis>{record.toolName}</Typography.Text>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: '10%',
        render: (_, record) => (
          <Tag color={record.status === 'success' ? 'green' : 'red'} style={{ margin: 0 }}>
            {record.status}
          </Tag>
        )
      },
      {
        title: 'Duration',
        dataIndex: 'durationMs',
        key: 'durationMs',
        width: '10%',
        render: (_, record) => <Typography.Text>{record.durationMs} ms</Typography.Text>
      },
      {
        title: 'Preview',
        dataIndex: 'preview',
        key: 'preview',
        width: '20%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.preview || record.error || '-'}
          </Typography.Text>
        )
      },
      {
        title: 'Action',
        key: 'action',
        width: '6%',
        render: (_, record) => (
          <Button
            aria-label={`Inspect ${record.toolName}`}
            icon={<EyeOutlined />}
            shape="circle"
            size="small"
            type="text"
            onClick={() => setPreviewRun(record)}
          />
        )
      }
    ],
    [token.colorTextSecondary]
  )

  return (
    <div style={panelStyle}>
      {contextHolder}
      <McpToolRunnerModal
        open={runnerOpen}
        server={activeServer}
        tool={runnerTool}
        onClose={() => {
          setRunnerOpen(false)
          setRunnerTool(null)
        }}
        onFinished={async () => {
          await loadRuns()
        }}
      />

      <Modal
        cancelText="Cancel"
        okButtonProps={{ loading: savingServer }}
        okText="Save"
        open={serverModalOpen}
        title={editingServer ? 'Edit MCP server' : 'Create MCP server'}
        width={760}
        onCancel={() => {
          setServerModalOpen(false)
          setEditingServer(null)
        }}
        onOk={() => {
          void handleSaveServer()
        }}
      >
        <Form
          form={serverForm}
          initialValues={buildServerFormValues(editingServer)}
          layout="vertical"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter a server name.' }]}>
              <Input placeholder="Filesystem Server" />
            </Form.Item>

            <Form.Item label="Transport" name="transport" rules={[{ required: true, message: 'Please choose a transport.' }]}>
              <Segmented
                block
                options={[
                  { label: 'HTTP', value: 'streamable-http' },
                  { label: 'STDIO', value: 'stdio' }
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item label="Description" name="description">
            <Input placeholder="Optional description for this server" />
          </Form.Item>

          <Form.Item label="Enabled" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          {transportValue === 'streamable-http' ? (
            <div className="grid grid-cols-1 gap-4">
              <Form.Item
                label="Server URL"
                name="url"
                rules={[{ required: true, message: 'Please enter the MCP server URL.' }]}
              >
                <Input placeholder="https://example.com/mcp" />
              </Form.Item>

              <Form.Item
                extra="Use a JSON object with string values."
                label="Headers JSON"
                name="headersText"
              >
                <Input.TextArea autoSize={{ minRows: 6, maxRows: 10 }} placeholder='{"Authorization":"Bearer token"}' />
              </Form.Item>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <Form.Item
                label="Command"
                name="command"
                rules={[{ required: true, message: 'Please enter the command.' }]}
              >
                <Input placeholder="npx" />
              </Form.Item>

              <Form.Item extra="Use a JSON array of strings." label="Arguments JSON" name="argsText">
                <Input.TextArea
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  placeholder='["-y", "@modelcontextprotocol/server-filesystem", "D:/github"]'
                />
              </Form.Item>

              <Form.Item label="Working Directory" name="cwd">
                <Input placeholder="D:/github" />
              </Form.Item>

              <Form.Item extra="Use a JSON object with string values." label="Environment JSON" name="envText">
                <Input.TextArea autoSize={{ minRows: 6, maxRows: 10 }} placeholder='{"API_KEY":"value"}' />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        footer={null}
        open={Boolean(previewRun)}
        title={previewRun ? `${previewRun.toolName} run` : 'Run detail'}
        width={960}
        onCancel={() => setPreviewRun(null)}
      >
        <JsonResultViewer
          data={
            previewRun
              ? {
                  arguments: previewRun.arguments,
                  durationMs: previewRun.durationMs,
                  error: previewRun.error,
                  result: previewRun.result,
                  serverName: previewRun.serverName,
                  startedAt: previewRun.startedAt,
                  status: previewRun.status,
                  toolName: previewRun.toolName
                }
              : null
          }
          minHeight={420}
          rootName="run"
        />
      </Modal>

      <Flex justify="space-between" wrap gap={12}>
        <Segmented
          options={MCP_VIEW_OPTIONS}
          style={segmentedStyle}
          value={view}
          onChange={(value) => setView(value as McpViewKey)}
        />

        {view === 'tools' && activeServer ? (
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            {activeServer.name}
          </Typography.Text>
        ) : view === 'runs' ? (
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            Stored in data/mcp/runs.json
          </Typography.Text>
        ) : (
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            Stored in data/mcp/servers.json
          </Typography.Text>
        )}
      </Flex>

      {view === 'servers' ? (
        <>
          <Flex align="center" className="mt-5" gap={8} wrap>
            <Input
              allowClear
              placeholder="Search MCP servers"
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              size="large"
              style={{ flex: 1 }}
              value={serverKeyword}
              onChange={(event) => setServerKeyword(event.target.value)}
            />
            <Flex align="center" gap={4}>
              <Button
                aria-label="Refresh MCP servers"
                icon={<ReloadOutlined />}
                loading={serversLoading}
                shape="circle"
                size="middle"
                type="text"
                onClick={() => {
                  void loadServers()
                }}
              />
              <Button
                aria-label="Create MCP server"
                icon={<PlusOutlined />}
                shape="circle"
                size="middle"
                type="text"
                onClick={openCreateServerModal}
              />
            </Flex>
          </Flex>

          <div
            ref={serverContainerRef}
            className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
            style={sectionCardStyle}
          >
            <Table<McpServerRecord>
              className="tool-fill-table"
              columns={serverColumns}
              dataSource={filteredServers}
              loading={serversLoading}
              pagination={
                filteredServers.length > serverMaxRows
                  ? {
                      pageSize: serverPageSize,
                      showSizeChanger: false,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                    }
                  : false
              }
              rowClassName={getStripedTableRowClassName}
              rowKey="id"
              size="small"
              tableLayout="fixed"
              locale={{
                emptyText: <Empty description="No MCP servers configured yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              }}
            />
          </div>
        </>
      ) : view === 'tools' ? (
        <>
          <Flex align="center" className="mt-5" gap={8} wrap>
            <Input
              allowClear
              placeholder="Search MCP tools"
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              size="large"
              style={{ flex: 1 }}
              value={toolKeyword}
              onChange={(event) => setToolKeyword(event.target.value)}
            />
            <Select
              options={servers.map((server) => ({
                label: server.name,
                value: server.id
              }))}
              placeholder="Select server"
              size="large"
              style={{ minWidth: 220 }}
              value={selectedServerId || undefined}
              onChange={(value) => setSelectedServerId(value)}
            />
            <Flex align="center" gap={4}>
              <Button
                aria-label="Refresh MCP tools"
                icon={<ReloadOutlined />}
                loading={toolsLoading}
                shape="circle"
                size="middle"
                type="text"
                onClick={() => {
                  if (selectedServerId) {
                    void loadTools(selectedServerId)
                  }
                }}
              />
            </Flex>
          </Flex>

          <div
            ref={toolContainerRef}
            className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
            style={sectionCardStyle}
          >
            {!activeServer ? (
              <div className="flex h-full items-center justify-center">
                <Empty description="Select an MCP server to load tools" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : !activeServer.enabled ? (
              <div className="flex h-full items-center justify-center">
                <Empty description="Enable the selected server before loading tools" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              <Table<McpToolRecord>
                className="tool-fill-table"
                columns={toolColumns}
                dataSource={filteredTools}
                loading={toolsLoading}
                pagination={
                  filteredTools.length > toolMaxRows
                    ? {
                        pageSize: toolPageSize,
                        showSizeChanger: false,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                      }
                    : false
                }
                rowClassName={getStripedTableRowClassName}
                rowKey="id"
                size="small"
                tableLayout="fixed"
                locale={{
                  emptyText: <Empty description="No tools available from this server" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                }}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <Flex align="center" className="mt-5" gap={8} wrap>
            <Input
              allowClear
              placeholder="Search MCP runs"
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              size="large"
              style={{ flex: 1 }}
              value={runKeyword}
              onChange={(event) => setRunKeyword(event.target.value)}
            />
            <Flex align="center" gap={4}>
              <Button
                aria-label="Refresh MCP runs"
                icon={<ReloadOutlined />}
                loading={runsLoading}
                shape="circle"
                size="middle"
                type="text"
                onClick={() => {
                  void handleRefreshRuns()
                }}
              />
            </Flex>
          </Flex>

          <div
            ref={runContainerRef}
            className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
            style={sectionCardStyle}
          >
            <Table<McpRunRecord>
              className="tool-fill-table"
              columns={runColumns}
              dataSource={filteredRuns}
              loading={runsLoading}
              pagination={
                filteredRuns.length > runMaxRows
                  ? {
                      pageSize: runPageSize,
                      showSizeChanger: false,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                    }
                  : false
              }
              rowClassName={getStripedTableRowClassName}
              rowKey="id"
              size="small"
              tableLayout="fixed"
              locale={{
                emptyText: <Empty description="No MCP runs recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default McpPanel
