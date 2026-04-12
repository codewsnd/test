import {
  CaretRightFilled,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FileTextOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { Button, Empty, Flex, Form, Input, Modal, Popconfirm, Table, Typography, message, theme } from 'antd'
import type { TableColumnsType } from 'antd'
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import useTableScrollY from '../hooks/useTableScrollY'
import getStripedTableRowClassName from '../utils/getStripedTableRowClassName'

type ScriptFile = {
  id: string
  scriptName: string
  description: string
  content: string
  type: string
}

type ScriptFormValues = {
  scriptName: string
  description: string
  content: string
  type?: string
}

type ScriptShellKey = 'powershell7' | 'powershell' | 'cmd'

type ScriptShellOption = {
  available: boolean
  key: ScriptShellKey
  label: string
}

function ShellIcon({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        minWidth: 18,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.02em'
      }}
    >
      {label}
    </span>
  )
}

function normalizeScriptName(scriptName: string): string {
  return scriptName.trim().toLowerCase()
}

function moveScriptRecord(items: ScriptFile[], draggedId: string, targetId: string): ScriptFile[] {
  const draggedIndex = items.findIndex((item) => item.id === draggedId)
  const targetIndex = items.findIndex((item) => item.id === targetId)

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return items
  }

  const nextItems = [...items]
  const [draggedItem] = nextItems.splice(draggedIndex, 1)
  nextItems.splice(targetIndex, 0, draggedItem)

  return nextItems
}

function ScriptPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [form] = Form.useForm<ScriptFormValues>()
  const [scripts, setScripts] = useState<ScriptFile[]>([])
  const [shellOptions, setShellOptions] = useState<ScriptShellOption[]>([])
  const [selectedShell, setSelectedShell] = useState<ScriptShellKey>('cmd')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [runningScriptId, setRunningScriptId] = useState<string | null>(null)
  const [deletingScriptId, setDeletingScriptId] = useState<string | null>(null)
  const [isDropActive, setIsDropActive] = useState(false)
  const [editingScript, setEditingScript] = useState<ScriptFile | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draggingScriptId, setDraggingScriptId] = useState<string | null>(null)
  const [dragOverScriptId, setDragOverScriptId] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const dragDepthRef = useRef(0)
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

  const loadScripts = async (): Promise<void> => {
    const items = await window.api.listScripts()
    setScripts(items)
  }

  useEffect(() => {
    let disposed = false

    const bootstrap = async (): Promise<void> => {
      try {
        const [items, nextShellOptions] = await Promise.all([window.api.listScripts(), window.api.listScriptShellOptions()])

        if (disposed) {
          return
        }

        setScripts(items)
        setShellOptions(nextShellOptions)

        const defaultShell =
          nextShellOptions.find((option) => option.key === 'powershell7' && option.available) ??
          nextShellOptions.find((option) => option.key === 'powershell' && option.available) ??
          nextShellOptions.find((option) => option.key === 'cmd' && option.available)

        if (defaultShell) {
          setSelectedShell(defaultShell.key)
        }
      } catch (loadError) {
        messageApi.error(loadError instanceof Error ? loadError.message : 'Failed to load scripts.')
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
  }, [messageApi])

  const filteredScripts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return scripts
    }

    return scripts.filter((script) =>
      `${script.scriptName} ${script.description} ${script.content} ${script.type}`.toLowerCase().includes(normalizedKeyword)
    )
  }, [keyword, scripts])

  const visibleShellOptions = useMemo(() => shellOptions.filter((option) => option.available), [shellOptions])
  const scriptTypeFilters = useMemo(
    () =>
      Array.from(new Set(scripts.map((script) => script.type.trim()).filter(Boolean)))
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map((type) => ({
          text: type,
          value: type
        })),
    [scripts]
  )
  const isDragSortingEnabled = keyword.trim().length === 0 && !loading && !isDropActive

  // 新增和编辑共用一套表单，避免 Script 面板出现两套不一致的维护入口。
  const openScriptEditor = (script: ScriptFile | null): void => {
    setEditingScript(script)
    setEditorOpen(true)
    form.setFieldsValue(
      script
        ? {
            scriptName: script.scriptName,
            description: script.description,
            content: script.content,
            type: script.type
          }
        : {
            scriptName: '',
            description: '',
            content: '',
            type: ''
          }
    )
  }

  const closeScriptEditor = (): void => {
    setEditorOpen(false)
    setEditingScript(null)
    form.resetFields()
  }

  const handleSubmitScript = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (editingScript) {
        const updated = await window.api.updateScript({
          id: editingScript.id,
          scriptName: values.scriptName.trim(),
          description: values.description.trim(),
          content: values.content,
          type: values.type
        })
        messageApi.success(`Saved ${updated.scriptName}`)
      } else {
        const created = await window.api.createScript({
          scriptName: values.scriptName.trim(),
          description: values.description.trim(),
          content: values.content,
          type: values.type
        })
        messageApi.success(`Created ${created.scriptName}`)
      }

      closeScriptEditor()
      await loadScripts()
    } catch (submitError) {
      if (submitError instanceof Error) {
        messageApi.error(submitError.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRunScript = async (script: ScriptFile): Promise<void> => {
    try {
      setRunningScriptId(script.id)
      await window.api.runScriptCommand({
        command: script.content,
        scriptName: script.scriptName,
        shell: selectedShell
      })
      messageApi.success(`Started ${script.scriptName}`)
    } catch (runError) {
      if (runError instanceof Error) {
        messageApi.error(runError.message)
      }
    } finally {
      setRunningScriptId(null)
    }
  }

  const handleDeleteScript = async (script: ScriptFile): Promise<void> => {
    try {
      setDeletingScriptId(script.id)
      await window.api.deleteScript(script.id)
      messageApi.success(`Deleted ${script.scriptName}`)
      await loadScripts()
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        messageApi.error(deleteError.message)
      }
    } finally {
      setDeletingScriptId(null)
    }
  }

  const handleReorderScripts = async (draggedId: string, targetId: string): Promise<void> => {
    const reorderedScripts = moveScriptRecord(scripts, draggedId, targetId)

    if (reorderedScripts === scripts) {
      return
    }

    const previousScripts = scripts

    try {
      // 表格拖拽只在未搜索时启用，确保拖拽顺序和完整脚本列表一一对应。
      setScripts(reorderedScripts)
      const updatedScripts = await window.api.reorderScripts(reorderedScripts.map((script) => script.id))
      setScripts(updatedScripts)
    } catch (reorderError) {
      setScripts(previousScripts)
      messageApi.error(reorderError instanceof Error ? reorderError.message : 'Failed to reorder scripts.')
    } finally {
      setDraggingScriptId(null)
      setDragOverScriptId(null)
    }
  }

  const handleRowDragStart = (event: DragEvent<HTMLTableRowElement>, scriptId: string): void => {
    if (!isDragSortingEnabled) {
      event.preventDefault()
      return
    }

    setDraggingScriptId(scriptId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/script-row-id', scriptId)
  }

  const handleRowDragOver = (event: DragEvent<HTMLTableRowElement>, scriptId: string): void => {
    if (!isDragSortingEnabled || draggingScriptId === null || draggingScriptId === scriptId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (dragOverScriptId !== scriptId) {
      setDragOverScriptId(scriptId)
    }
  }

  const handleRowDrop = (event: DragEvent<HTMLTableRowElement>, targetId: string): void => {
    if (!isDragSortingEnabled) {
      return
    }

    event.preventDefault()
    const draggedId = event.dataTransfer.getData('text/script-row-id') || draggingScriptId

    if (!draggedId || draggedId === targetId) {
      setDraggingScriptId(null)
      setDragOverScriptId(null)
      return
    }

    void handleReorderScripts(draggedId, targetId)
  }

  const handleRowDragEnd = (): void => {
    setDraggingScriptId(null)
    setDragOverScriptId(null)
  }

  // 拖入文件时直接使用文件名作为 Description；若 Script Name 冲突则交给后端自动补时间戳。
  const handleImportedFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) {
      return
    }

    try {
      const createdScripts: ScriptFile[] = []

      for (const file of Array.from(files)) {
        const content = await file.text()
        const created = await window.api.createScript({
          scriptName: file.name,
          description: file.name,
          content,
          type: '',
          autoRenameOnConflict: true
        })

        createdScripts.push(created)
      }

      await loadScripts()

      if (createdScripts.length === 1) {
        messageApi.success(`Imported ${createdScripts[0].scriptName}`)
      } else {
        messageApi.success(`Imported ${createdScripts.length} scripts`)
      }
    } catch (importError) {
      messageApi.error(importError instanceof Error ? importError.message : 'Failed to import dropped files.')
    }
  }

  const columns = useMemo<TableColumnsType<ScriptFile>>(
    () => [
      {
        title: 'Name',
        dataIndex: 'scriptName',
        key: 'scriptName',
        width: '22%',
        render: (_, record) => (
          <Flex align="center" gap={10}>
            <div
              style={{
                display: 'flex',
                height: 32,
                width: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                background: token.colorFillTertiary,
                color: token.colorTextSecondary,
                flexShrink: 0
              }}
            >
              <FileTextOutlined />
            </div>
            <Typography.Text strong>{record.scriptName}</Typography.Text>
          </Flex>
        )
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: '20%',
        render: (_, record) => (
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, color: token.colorTextSecondary }}>
            {record.description}
          </Typography.Paragraph>
        )
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: '14%',
        filters: scriptTypeFilters,
        filterSearch: true,
        onFilter: (value, record) => record.type === value,
        render: (_, record) => (
          <Typography.Text style={{ color: record.type ? token.colorText : token.colorTextQuaternary }}>
            {record.type || '(none)'}
          </Typography.Text>
        )
      },
      {
        title: 'Command',
        dataIndex: 'content',
        key: 'content',
        width: '32%',
        render: (_, record) => (
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, color: token.colorTextSecondary }}>
            {record.content || '(empty)'}
          </Typography.Paragraph>
        )
      },
      {
        title: 'Action',
        key: 'action',
        width: '12%',
        render: (_, record) => (
          <Flex gap={4}>
            <Button
              aria-label={`Run ${record.scriptName}`}
              icon={<CaretRightFilled />}
              loading={runningScriptId === record.id}
              shape="circle"
              size="small"
              style={{ color: token.colorSuccess }}
              type="text"
              onClick={() => {
                void handleRunScript(record)
              }}
            />
            <Button
              aria-label={`Edit ${record.scriptName}`}
              icon={<EditOutlined />}
              shape="circle"
              size="small"
              type="text"
              onClick={() => openScriptEditor(record)}
            />
            <Popconfirm
              cancelText="Cancel"
              description={`Delete ${record.scriptName}?`}
              okText="Delete"
              title="Delete script"
              onConfirm={() => {
                void handleDeleteScript(record)
              }}
            >
              <Button
                aria-label={`Delete ${record.scriptName}`}
                danger
                icon={<DeleteOutlined />}
                loading={deletingScriptId === record.id}
                shape="circle"
                size="small"
                type="text"
              />
            </Popconfirm>
          </Flex>
        )
      }
    ],
    [
      deletingScriptId,
      runningScriptId,
      scriptTypeFilters,
      token.colorFillTertiary,
      token.colorSuccess,
      token.colorText,
      token.colorTextQuaternary,
      token.colorTextSecondary
    ]
  )

  return (
    <div style={panelStyle}>
      {contextHolder}
      <Modal
        cancelText="Cancel"
        okButtonProps={{ loading: submitting }}
        okText={editingScript ? 'Save' : 'Create'}
        open={editorOpen}
        title={editingScript ? 'Edit script' : 'Create script'}
        width={920}
        onCancel={closeScriptEditor}
        onOk={() => {
          void handleSubmitScript()
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Name"
            name="scriptName"
            rules={[
              { required: true, message: 'Please enter a name.' },
              {
                validator: async (_, value: string | undefined) => {
                  if (!value?.trim()) {
                    return
                  }

                  const duplicatedScript = scripts.find(
                    (script) =>
                      script.id !== editingScript?.id &&
                      normalizeScriptName(script.scriptName) === normalizeScriptName(value)
                  )

                  if (duplicatedScript) {
                    throw new Error('Name must be unique.')
                  }
                }
              }
            ]}
          >
            <Input placeholder="Deploy Script" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Please enter a description.' }]}
          >
            <Input placeholder="Short description of this script" />
          </Form.Item>

          <Form.Item label="Type" name="type">
            <Input placeholder="Optional script type" />
          </Form.Item>

          <Form.Item
            label="Command"
            name="content"
            rules={[{ required: true, message: 'Please enter a command.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea autoSize={{ minRows: 16, maxRows: 24 }} placeholder="Command to execute" />
          </Form.Item>
        </Form>
      </Modal>

      <Flex align="center" gap={8} wrap>
        <Input
          allowClear
          placeholder="Search by name, description, command, or type"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          size="large"
          style={{ flex: 1 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Flex align="center" gap={4}>
          {visibleShellOptions.map((option) => (
            <Button
              key={option.key}
              aria-label={`Use ${option.label}`}
              icon={
                option.key === 'powershell7' ? (
                  <ShellIcon label="PS7" />
                ) : option.key === 'powershell' ? (
                  <ShellIcon label="PS" />
                ) : (
                  <ShellIcon label="CMD" />
                )
              }
              shape="circle"
              size="middle"
              title={option.label}
              type={selectedShell === option.key ? 'primary' : 'text'}
              onClick={() => setSelectedShell(option.key)}
            />
          ))}
          <Button
            aria-label="Create script"
            icon={<FileAddOutlined />}
            shape="circle"
            size="middle"
            type="text"
            onClick={() => openScriptEditor(null)}
          />
        </Flex>
      </Flex>

      <div
        ref={containerRef}
        className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
        style={{
          position: 'relative',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary
        }}
        onDragEnter={(event) => {
          if (!Array.from(event.dataTransfer.types).includes('Files')) {
            return
          }

          dragDepthRef.current += 1
          setIsDropActive(true)
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

          if (dragDepthRef.current === 0) {
            setIsDropActive(false)
          }
        }}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes('Files')) {
            return
          }

          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepthRef.current = 0
          setIsDropActive(false)
          void handleImportedFiles(event.dataTransfer.files)
        }}
      >
        {isDropActive ? (
          <div
            style={{
              position: 'absolute',
              inset: 12,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              border: `1px dashed ${token.colorPrimary}`,
              background: token.colorPrimaryBg
            }}
          >
            <Typography.Text strong style={{ color: token.colorPrimary }}>
              Drop files here to import scripts
            </Typography.Text>
          </div>
        ) : null}

        <Table<ScriptFile>
          className="tool-fill-table"
          columns={columns}
          dataSource={filteredScripts}
          loading={loading}
          onRow={(record) => ({
            draggable: isDragSortingEnabled,
            onDragStart: (event) => handleRowDragStart(event, record.id),
            onDragOver: (event) => handleRowDragOver(event, record.id),
            onDrop: (event) => handleRowDrop(event, record.id),
            onDragEnd: handleRowDragEnd
          })}
          pagination={
            filteredScripts.length > maxRowsWithoutPagination
              ? {
                  pageSize,
                  showSizeChanger: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                }
              : false
          }
          rowClassName={(record, index) =>
            [
              getStripedTableRowClassName(record, index),
              isDragSortingEnabled ? 'tool-table-row-draggable' : '',
              draggingScriptId === record.id ? 'tool-table-row-dragging' : '',
              dragOverScriptId === record.id ? 'tool-table-row-drop-target' : ''
            ]
              .filter(Boolean)
              .join(' ')
          }
          rowKey="id"
          size="small"
          tableLayout="fixed"
          locale={{
            emptyText: <Empty description="No scripts found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
        />
      </div>
    </div>
  )
}

export default ScriptPanel
