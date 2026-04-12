import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined
} from '@ant-design/icons'
import {
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Switch,
  Table,
  Typography,
  message,
  theme
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import useTableScrollY from '../hooks/useTableScrollY'
import getStripedTableRowClassName from '../utils/getStripedTableRowClassName'

type UserEnvironmentVariable = {
  id: string
  name: string
  type: string
  value: string
  status: 'enabled' | 'disabled'
}

type CreateUserEnvironmentPayload = {
  name: string
  type?: string
  value: string
}

type DraftVariable = {
  name: string
  type: string
  value: string
}

function UserEnvironmentPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [form] = Form.useForm<CreateUserEnvironmentPayload>()
  const [variables, setVariables] = useState<UserEnvironmentVariable[]>([])
  const [draftValues, setDraftValues] = useState<Record<string, DraftVariable>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [savingEdits, setSavingEdits] = useState(false)
  const [actingKey, setActingKey] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const { containerRef, pageSize, maxRowsWithoutPagination } = useTableScrollY({ rowHeight: 56, minPageSize: 7 })

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

  // 表格数据始终来自当前用户级环境变量，并额外合并被工具停用的变量。
  const loadVariables = async (mode: 'initial' | 'refresh' = 'initial'): Promise<void> => {
    try {
      if (mode === 'initial') {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      const items = await window.api.listUserEnvironmentVariables()
      setVariables(items)
      setDraftValues(
        Object.fromEntries(
          items.map((item) => [
            item.id,
            {
              name: item.name,
              type: item.type,
              value: item.value
            }
          ])
        )
      )
    } catch (loadError) {
      messageApi.error(loadError instanceof Error ? loadError.message : 'Failed to load user environment variables.')
    } finally {
      if (mode === 'initial') {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    void loadVariables('initial')
  }, [])

  // 搜索同时匹配变量名、值和状态，便于快速定位指定环境变量。
  const filteredVariables = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return variables
    }

    return variables.filter((item) =>
      `${item.name} ${item.type} ${item.value} ${item.status}`.toLowerCase().includes(normalizedKeyword)
    )
  }, [keyword, variables])

  const variableTypeFilters = useMemo(
    () =>
      Array.from(new Set(variables.map((item) => item.type.trim()).filter(Boolean)))
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map((type) => ({
          text: type,
          value: type
        })),
    [variables]
  )

  const hasPendingChanges = useMemo(
    () =>
      variables.some((item) => {
        const draft = draftValues[item.id]
        return Boolean(draft) && (draft.name.trim() !== item.name || draft.type.trim() !== item.type || draft.value !== item.value)
      }),
    [draftValues, variables]
  )

  const handleCreateVariable = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setCreating(true)
      const created = await window.api.createUserEnvironmentVariable(values)
      messageApi.success(`Created ${created.name}`)
      setCreateOpen(false)
      form.resetFields()
      await loadVariables('refresh')
    } catch (createError) {
      if (createError instanceof Error) {
        messageApi.error(createError.message)
      }
    } finally {
      setCreating(false)
    }
  }

  const updateDraftValue = (recordId: string, field: keyof DraftVariable, value: string): void => {
    setDraftValues((current) => ({
      ...current,
      [recordId]: {
        name: current[recordId]?.name ?? '',
        type: current[recordId]?.type ?? '',
        value: current[recordId]?.value ?? '',
        [field]: value
      }
    }))
  }

  // 编辑模式下的保存会批量提交所有已修改行，成功后退出编辑模式。
  const handleSaveEditedVariables = async (): Promise<void> => {
    const changedVariables = variables.filter((item) => {
      const draft = draftValues[item.id]
      return Boolean(draft) && (draft.name.trim() !== item.name || draft.type.trim() !== item.type || draft.value !== item.value)
    })

    if (changedVariables.length === 0) {
      setIsEditing(false)
      return
    }

    try {
      setSavingEdits(true)

      for (const item of changedVariables) {
        const draft = draftValues[item.id]

        if (!draft) {
          continue
        }

        await window.api.updateUserEnvironmentVariable({
          name: draft.name.trim(),
          originalName: item.name,
          type: draft.type,
          value: draft.value
        })
      }

      await loadVariables('refresh')
      setIsEditing(false)
      messageApi.success('User environment variables saved.')
    } catch (saveError) {
      messageApi.error(saveError instanceof Error ? saveError.message : 'Failed to save variables.')
    } finally {
      setSavingEdits(false)
    }
  }

  // 启用和停用会直接修改用户级环境变量，并刷新表格保持结果真实。
  const handleToggleStatus = async (record: UserEnvironmentVariable): Promise<void> => {
    try {
      setActingKey(`toggle:${record.name}`)

      if (record.status === 'enabled') {
        await window.api.disableUserEnvironmentVariable(record.name)
        messageApi.success(`Disabled ${record.name}`)
      } else {
        await window.api.enableUserEnvironmentVariable(record.name)
        messageApi.success(`Enabled ${record.name}`)
      }

      await loadVariables('refresh')
    } catch (toggleError) {
      messageApi.error(toggleError instanceof Error ? toggleError.message : 'Failed to update variable status.')
    } finally {
      setActingKey(null)
    }
  }

  // 删除会同时清理用户级环境变量和本地停用记录，避免残留无效条目。
  const handleDeleteVariable = async (record: UserEnvironmentVariable): Promise<void> => {
    try {
      setActingKey(`delete:${record.name}`)
      await window.api.deleteUserEnvironmentVariable(record.name)
      messageApi.success(`Deleted ${record.name}`)
      await loadVariables('refresh')
    } catch (deleteError) {
      messageApi.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete variable.')
    } finally {
      setActingKey(null)
    }
  }

  const columns = useMemo<TableColumnsType<UserEnvironmentVariable>>(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: '20%',
        render: (_, record) => (
          isEditing ? (
            <Input
              size="small"
              value={draftValues[record.id]?.name ?? record.name}
              onChange={(event) => updateDraftValue(record.id, 'name', event.target.value)}
            />
          ) : (
            <Typography.Text code strong>
              {record.name}
            </Typography.Text>
          )
        )
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: '16%',
        filters: variableTypeFilters,
        filterSearch: true,
        onFilter: (value, record) => record.type === value,
        render: (_, record) => (
          isEditing ? (
            <Input
              size="small"
              value={draftValues[record.id]?.type ?? record.type}
              onChange={(event) => updateDraftValue(record.id, 'type', event.target.value)}
            />
          ) : (
            <Typography.Text style={{ color: record.type ? token.colorText : token.colorTextQuaternary }}>
              {record.type || '(none)'}
            </Typography.Text>
          )
        )
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        width: '34%',
        render: (_, record) => (
          isEditing ? (
            <Input
              size="small"
              value={draftValues[record.id]?.value ?? record.value}
              onChange={(event) => updateDraftValue(record.id, 'value', event.target.value)}
            />
          ) : (
            <Typography.Text
              ellipsis
              style={{
                display: 'inline-block',
                maxWidth: '100%'
              }}
            >
              {record.value || '(empty)'}
            </Typography.Text>
          )
        )
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        // 状态列改为开关，直接在当前行切换启用和停用。
        render: (_, record) => (
          <Switch
            checked={record.status === 'enabled'}
            checkedChildren="On"
            disabled={isEditing || savingEdits}
            loading={actingKey === `toggle:${record.name}`}
            size="small"
            unCheckedChildren="Off"
            onChange={() => {
              void handleToggleStatus(record)
            }}
          />
        )
      },
      {
        title: 'Actions',
        key: 'actions',
        width: '18%',
        render: (_, record) => (
          <div>
            <Popconfirm
              cancelText="Cancel"
              okText="Delete"
              title="Delete variable"
              description={`Delete ${record.name} from the current user's environment?`}
              onConfirm={() => {
                void handleDeleteVariable(record)
              }}
            >
              <Button
                danger
                disabled={isEditing || savingEdits}
                icon={<DeleteOutlined />}
                loading={actingKey === `delete:${record.name}`}
                size="small"
                type="text"
              />
            </Popconfirm>
          </div>
        )
      }
    ],
    [actingKey, draftValues, isEditing, savingEdits, token.colorText, token.colorTextQuaternary, variableTypeFilters]
  )

  return (
    <div style={panelStyle}>
      {contextHolder}
      <Modal
        cancelText="Cancel"
        okButtonProps={{ loading: creating }}
        okText="Create"
        open={createOpen}
        title="Create variable"
        onCancel={() => {
          setCreateOpen(false)
          form.resetFields()
        }}
        onOk={() => {
          void handleCreateVariable()
        }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: '',
            type: '',
            value: ''
          }}
        >
          <Form.Item
            label="Variable Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter a variable name.' },
              {
                validator: async (_, value: string) => {
                  if (typeof value === 'string' && value.trim().toLowerCase() === 'path') {
                    throw new Error('Path is excluded from this panel.')
                  }
                }
              }
            ]}
          >
            <Input placeholder="MY_ENV_KEY" />
          </Form.Item>

          <Form.Item label="Type" name="type">
            <Input placeholder="Optional variable type" />
          </Form.Item>

          <Form.Item
            label="Value"
            name="value"
            rules={[{ required: true, message: 'Please enter a value.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="Environment variable value" />
          </Form.Item>
        </Form>
      </Modal>

      <Flex align="center" gap={8}>
        <Input
          allowClear
          placeholder="Search by name, type, value, or status"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          size="large"
          style={{ flex: 1 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <div className="flex items-center gap-1">
          <Button
            aria-label="Refresh user environment variables"
            disabled={isEditing || savingEdits}
            icon={<ReloadOutlined />}
            loading={refreshing}
            shape="circle"
            size="middle"
            type="text"
            onClick={() => {
              // 刷新只会重新扫描当前用户环境变量并重新合并 manifest，不会改动启停记录。
              void loadVariables('refresh')
            }}
          />
          <Button
            aria-label={isEditing ? 'Save edited variables' : 'Enable inline editing'}
            disabled={isEditing ? savingEdits || !hasPendingChanges : false}
            icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
            loading={savingEdits}
            shape="circle"
            size="middle"
            type={isEditing ? 'primary' : 'text'}
            onClick={() => {
              // Header 图标在编辑模式和保存模式之间切换，统一控制行内编辑生命周期。
              if (isEditing) {
                void handleSaveEditedVariables()
                return
              }

              setIsEditing(true)
            }}
          />
          <Button
            aria-label="Create user environment variable"
            disabled={isEditing || savingEdits}
            icon={<PlusOutlined />}
            shape="circle"
            size="middle"
            type="text"
            onClick={() => setCreateOpen(true)}
          />
        </div>
      </Flex>

      <div
        ref={containerRef}
        className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary
        }}
      >
        <Table<UserEnvironmentVariable>
          className="tool-fill-table"
          columns={columns}
          dataSource={filteredVariables}
          loading={loading}
          size="small"
          tableLayout="fixed"
          rowClassName={getStripedTableRowClassName}
          pagination={
            filteredVariables.length > maxRowsWithoutPagination
              ? {
                  pageSize,
                  showSizeChanger: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                }
              : false
          }
          rowKey="id"
          locale={{
            emptyText: <Empty description="No user environment variables found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
        />
      </div>
    </div>
  )
}

export default UserEnvironmentPanel
