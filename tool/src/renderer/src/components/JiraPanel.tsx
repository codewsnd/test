import {
  ApiOutlined,
  CheckCircleFilled,
  ExportOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { Button, Empty, Flex, Form, Input, Spin, Table, Tag, Typography, message, theme } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import useDebouncedValue from '../hooks/useDebouncedValue'
import getStripedTableRowClassName from '../utils/getStripedTableRowClassName'

type JiraSettings = {
  apiPrefix: string
  token: string
}

type JiraIssue = {
  id: string
  key: string
  project: string
  summary: string
  type: string
  status: string
  assignee: string
  reporter: string
  created: string
  updated: string
  url: string
}

type JiraIssueQuery = {
  keyword?: string
  page: number
  pageSize: number
  project?: string
  sortField?: 'created' | 'updated'
  sortOrder?: 'ascend' | 'descend'
  status?: string
  type?: string
}

function formatJiraDateTime(value: string): string {
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

function JiraPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [form] = Form.useForm<JiraSettings>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [verified, setVerified] = useState(false)
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [issuesError, setIssuesError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [keywordInput, setKeywordInput] = useState('')
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [sortField, setSortField] = useState<'created' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('descend')
  const [currentPage, setCurrentPage] = useState(1)
  const [verifiedSettings, setVerifiedSettings] = useState<JiraSettings | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const debouncedKeyword = useDebouncedValue(keywordInput, 300)
  const debouncedProjectFilter = useDebouncedValue(projectFilter, 200)
  const debouncedTypeFilter = useDebouncedValue(typeFilter, 200)
  const debouncedStatusFilter = useDebouncedValue(statusFilter, 200)

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

  const formCardStyle = useMemo(
    () => ({
      maxWidth: 560,
      padding: 24,
      borderRadius: 18,
      border: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorFillQuaternary
    }),
    [token.colorBorderSecondary, token.colorFillQuaternary]
  )

  useEffect(() => {
    let disposed = false

    // 面板打开时先读取本地保存的 Jira 配置，便于继续使用已有连接。
    const bootstrap = async (): Promise<void> => {
      try {
        const savedSettings = await window.api.getJiraSettings()

        if (!disposed && savedSettings) {
          form.setFieldsValue(savedSettings)
          // 只要本地已有成功保存过的 Jira 配置，面板重新打开时直接恢复到 issues 视图。
          setVerified(true)
          setVerifiedSettings(savedSettings)
        }
      } catch (loadError) {
        if (!disposed) {
          messageApi.error(loadError instanceof Error ? loadError.message : 'Failed to load Jira settings.')
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      disposed = true
    }
  }, [form, messageApi])

  // Jira issue 列表改为服务端分页，请求参数会跟随表格页码、筛选和排序状态一起变化。
  const loadIssues = async (settings: JiraSettings, query: JiraIssueQuery): Promise<void> => {
    try {
      setIssuesLoading(true)
      setIssuesError(null)
      const result = await window.api.listJiraIssues({ query, settings })
      setIssues(result.items)
      setTotal(result.total)
    } catch (loadError) {
      const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load Jira issues.'
      setIssues([])
      setTotal(0)
      setIssuesError(errorMessage)
      messageApi.error(errorMessage)
    } finally {
      setIssuesLoading(false)
    }
  }

  // 验证成功后会把 Jira API Prefix 和 token 持久化到 `data/jira/jira.json`，并按第一页初始化 issue 列表。
  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await window.api.validateJiraSettings(values)
      setVerified(true)
      setVerifiedSettings(values)
      setCurrentPage(1)
      messageApi.success('Jira connection verified.')
    } catch (submitError) {
      setVerified(false)
      setVerifiedSettings(null)
      if (submitError instanceof Error) {
        messageApi.error(submitError.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!verified || !verifiedSettings) {
      return
    }

    void loadIssues(verifiedSettings, {
      keyword: debouncedKeyword || undefined,
      page: currentPage,
      pageSize: 20,
      project: debouncedProjectFilter,
      sortField,
      sortOrder,
      status: debouncedStatusFilter,
      type: debouncedTypeFilter
    })
  }, [
    currentPage,
    debouncedKeyword,
    debouncedProjectFilter,
    debouncedStatusFilter,
    debouncedTypeFilter,
    sortField,
    sortOrder,
    verified,
    verifiedSettings
  ])

  // 刷新动作始终复用当前查询条件，避免和表格状态发生偏差。
  const handleRefreshIssues = async (): Promise<void> => {
    if (!verifiedSettings) {
      return
    }

    await loadIssues(verifiedSettings, {
      keyword: debouncedKeyword || undefined,
      page: currentPage,
      pageSize: 20,
      project: debouncedProjectFilter,
      sortField,
      sortOrder,
      status: debouncedStatusFilter,
      type: debouncedTypeFilter
    })
  }

  // 点击设置图标后回退到 Jira Connection 面板，但保留已填写的配置，方便再次验证。
  const handleBackToConnection = (): void => {
    setVerified(false)
    setIssuesError(null)
  }

  const projectOptions = useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.project))).sort((left, right) => left.localeCompare(right, 'en')),
    [issues]
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.type))).sort((left, right) => left.localeCompare(right, 'en')),
    [issues]
  )
  const statusOptions = useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.status))).sort((left, right) => left.localeCompare(right, 'en')),
    [issues]
  )

  const columns = useMemo<TableColumnsType<JiraIssue>>(
    () => [
      {
        title: 'Key',
        dataIndex: 'key',
        key: 'key',
        width: '6%',
        render: (_, record) => (
          <Typography.Text code strong>
            {record.key}
          </Typography.Text>
        )
      },
      {
        title: 'Project',
        dataIndex: 'project',
        key: 'project',
        width: '12%',
        filteredValue: projectFilter ? [projectFilter] : null,
        filters: projectOptions.map((value) => ({ text: value, value })),
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.project}
          </Typography.Text>
        )
      },
      {
        title: 'Summary',
        dataIndex: 'summary',
        key: 'summary',
        width: '16%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.summary}
          </Typography.Text>
        )
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: '8%',
        filteredValue: typeFilter ? [typeFilter] : null,
        filters: typeOptions.map((value) => ({ text: value, value })),
        // 根据 Jira issue type 做颜色区分，方便在表格里快速识别不同工作项。
        render: (_, record) => (
          <Tag
            color={
              record.type.toLowerCase() === 'bug'
                ? 'red'
                : record.type.toLowerCase() === 'story'
                  ? 'green'
                  : record.type.toLowerCase().includes('task')
                    ? 'blue'
                    : 'default'
            }
            style={{ margin: 0 }}
          >
            {record.type}
          </Tag>
        )
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: '8%',
        filteredValue: statusFilter ? [statusFilter] : null,
        filters: statusOptions.map((value) => ({ text: value, value })),
        render: (_, record) => <Typography.Text>{record.status}</Typography.Text>
      },
      {
        title: 'Assignee',
        dataIndex: 'assignee',
        key: 'assignee',
        width: '8%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.assignee}
          </Typography.Text>
        )
      },
      {
        title: 'Reporter',
        dataIndex: 'reporter',
        key: 'reporter',
        width: '8%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            {record.reporter}
          </Typography.Text>
        )
      },
      {
        title: 'Created',
        dataIndex: 'created',
        key: 'created',
        width: '14%',
        showSorterTooltip: { target: 'full-header' },
        sorter: true,
        sortOrder: sortField === 'created' ? sortOrder : null,
        render: (_, record) => (
          <Typography.Text style={{ whiteSpace: 'nowrap', color: token.colorTextSecondary }}>
            {formatJiraDateTime(record.created)}
          </Typography.Text>
        )
      },
      {
        title: 'Updated',
        dataIndex: 'updated',
        key: 'updated',
        width: '14%',
        showSorterTooltip: { target: 'full-header' },
        sorter: true,
        sortOrder: sortField === 'updated' ? sortOrder : null,
        render: (_, record) => (
          <Typography.Text style={{ whiteSpace: 'nowrap', color: token.colorTextSecondary }}>
            {formatJiraDateTime(record.updated)}
          </Typography.Text>
        )
      },
      {
        title: 'Action',
        key: 'action',
        width: '6%',
        render: (_, record) => (
          <Button
            aria-label={`Open ${record.key} in Jira`}
            icon={<ExportOutlined />}
            shape="circle"
            size="small"
            type="text"
            onClick={() => {
              // Action 直接打开当前 Jira 实例中的 issue 链接。
              window.open(record.url, '_blank', 'noopener,noreferrer')
            }}
          />
        )
      }
    ],
    [projectFilter, projectOptions, sortField, sortOrder, statusFilter, statusOptions, token.colorTextSecondary, typeFilter, typeOptions]
  )

  const handleTableChange: TableProps<JiraIssue>['onChange'] = (pagination, filters, sorter, extra) => {
    if (extra.action === 'paginate') {
      setCurrentPage(pagination.current ?? 1)
      return
    }

    if (extra.action === 'filter') {
      setCurrentPage(1)
      setProjectFilter(typeof filters.project?.[0] === 'string' ? filters.project[0] : undefined)
      setTypeFilter(typeof filters.type?.[0] === 'string' ? filters.type[0] : undefined)
      setStatusFilter(typeof filters.status?.[0] === 'string' ? filters.status[0] : undefined)
      return
    }

    if (extra.action === 'sort') {
      setCurrentPage(1)
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter
      if (nextSorter?.field === 'created' || nextSorter?.field === 'updated') {
        setSortField(nextSorter.field)
        setSortOrder(nextSorter.order === 'ascend' ? 'ascend' : 'descend')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center" style={panelStyle}>
        <Flex align="center" gap="middle" vertical>
          <Spin size="large" />
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            Loading Jira settings...
          </Typography.Text>
        </Flex>
      </div>
    )
  }

  if (!verified) {
    return (
      <div style={panelStyle}>
        {contextHolder}
        <div className="flex h-full min-h-0 items-center justify-center">
          <div style={formCardStyle}>
            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
              Jira Connection
            </Typography.Title>
            <Typography.Paragraph style={{ marginTop: 0, color: token.colorTextSecondary }}>
              Enter your Jira API Prefix and token. Validation uses the documented GET /rest/api/2/myself endpoint.
            </Typography.Paragraph>

            <Form form={form} layout="vertical">
              <Form.Item
                label={
                  <Flex align="center" gap={8}>
                    <LinkOutlined />
                    <span>Jira API Prefix</span>
                  </Flex>
                }
                name="apiPrefix"
                rules={[
                  { required: true, message: 'Please enter a Jira API Prefix.' },
                  { type: 'url', message: 'Please enter a valid URL.' }
                ]}
              >
                <Input placeholder="https://your-jira.example.com/rest/api/2" />
              </Form.Item>

              <Form.Item
                label={
                  <Flex align="center" gap={8}>
                    <SafetyCertificateOutlined />
                    <span>Token</span>
                  </Flex>
                }
                name="token"
                rules={[{ required: true, message: 'Please enter a token.' }]}
              >
                <Input.Password placeholder="Jira personal access token" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Flex align="center" gap="middle" justify="space-between" wrap>
                  <Button
                    icon={<ApiOutlined />}
                    loading={submitting}
                    size="large"
                    type="primary"
                    onClick={() => {
                      void handleSubmit()
                    }}
                  >
                    Verify
                  </Button>

                  <Typography.Text style={{ color: token.colorTextSecondary }}>
                    <CheckCircleFilled style={{ marginRight: 8 }} />
                    Verify to load issues
                  </Typography.Text>
                </Flex>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {contextHolder}
      <Flex align="center" gap={8}>
        <Input
          allowClear
          placeholder="Search Jira issues"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          size="large"
          style={{ flex: 1 }}
          value={keywordInput}
          onChange={(event) => {
            setCurrentPage(1)
            setKeywordInput(event.target.value)
          }}
        />
        <Flex align="center" gap={4}>
          <Button
            aria-label="Return to Jira connection"
            icon={<SafetyCertificateOutlined />}
            shape="circle"
            size="middle"
            type="text"
            onClick={handleBackToConnection}
          />
          <Button
            aria-label="Refresh Jira issues"
            icon={<ReloadOutlined />}
            loading={issuesLoading}
            shape="circle"
            size="middle"
            type="text"
            onClick={() => {
              void handleRefreshIssues()
            }}
          />
        </Flex>
      </Flex>

      <div
        className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary
        }}
      >
        <Table<JiraIssue>
          className="tool-fill-table"
          columns={columns}
          dataSource={issues}
          loading={issuesLoading}
          onChange={handleTableChange}
          size="small"
          rowClassName={getStripedTableRowClassName}
          pagination={{
            current: currentPage,
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (itemsTotal, range) => `${range[0]}-${range[1]} of ${itemsTotal}`,
            total
          }}
          rowKey="id"
          tableLayout="fixed"
          showSorterTooltip={{ target: 'sorter-icon' }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Typography.Text style={{ color: token.colorTextSecondary }}>
                    {issuesError ?? 'No Jira issues found'}
                  </Typography.Text>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </div>
    </div>
  )
}

export default JiraPanel
