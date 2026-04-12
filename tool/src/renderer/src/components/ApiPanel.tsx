import {
  CaretDownOutlined,
  CaretRightOutlined,
  EditOutlined,
  DeleteOutlined,
  DownOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined
} from '@ant-design/icons'
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  MenuProps,
  Select,
  Splitter,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
  message,
  theme
} from 'antd'
import type { TableColumnsType, TreeDataNode } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import JsonResultViewer from './mcp/JsonResultViewer'

type ApiHttpMethod = 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE'
type ApiBodyMode = 'json' | 'none' | 'text'
type ApiPanelSectionKey = 'request' | 'response'

type ApiKeyValueEntry = {
  id: string
  key: string
  value: string
  enabled: boolean
}

type ApiResponseSnapshot = {
  status: number | null
  statusText: string
  durationMs: number
  headers: ApiKeyValueEntry[]
  bodyText: string
  bodyJson: unknown | null
  requestedAt: string
  ok: boolean
  error: string | null
}

type ApiRequestSnapshot = {
  method: ApiHttpMethod
  url: string
  params: ApiKeyValueEntry[]
  headers: ApiKeyValueEntry[]
  bodyMode: ApiBodyMode
  bodyText: string
}

type ApiRequestHistoryEntry = {
  id: string
  type: 'history'
  name: string
  request: ApiRequestSnapshot
  response: ApiResponseSnapshot
}

type ApiRequestEntry = {
  id: string
  type: 'request'
  name: string
  method: ApiHttpMethod
  url: string
  params: ApiKeyValueEntry[]
  headers: ApiKeyValueEntry[]
  bodyMode: ApiBodyMode
  bodyText: string
  response: ApiResponseSnapshot | null
  histories: ApiRequestHistoryEntry[]
}

type ApiFolderEntry = {
  id: string
  type: 'folder'
  name: string
  children: ApiTreeNode[]
}

type ApiTreeNode = ApiFolderEntry | ApiRequestEntry

type ApiWorkspace = {
  nodes: ApiTreeNode[]
}

type ApiSelectionContext = {
  history: ApiRequestHistoryEntry | null
  request: ApiRequestEntry
}

type EditableSection = 'headers' | 'params'

const API_MAIN_SPLITTER_STORAGE_KEY = 'tool.api.splitter.main'
const API_DETAIL_SPLITTER_STORAGE_KEY = 'tool.api.splitter.detail'
const DEFAULT_MAIN_SPLITTER_SIZES = [320, 960]
const DEFAULT_DETAIL_SPLITTER_SIZES = [320, 520]

const API_METHOD_OPTIONS: ApiHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT']

function createEmptyEntry(): ApiKeyValueEntry {
  return {
    id: crypto.randomUUID(),
    key: '',
    value: '',
    enabled: true
  }
}

function createDefaultRequest(name = 'New Request'): ApiRequestEntry {
  return {
    id: crypto.randomUUID(),
    type: 'request',
    name,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    bodyMode: 'none',
    bodyText: '',
    response: null,
    histories: []
  }
}

function createDefaultFolder(name = 'New Folder'): ApiFolderEntry {
  return {
    id: crypto.randomUUID(),
    type: 'folder',
    name,
    children: []
  }
}

// 读取本地持久化的 Splitter 尺寸，保证重启后仍能恢复用户上次的工作区布局。
function readStoredSplitterSizes(storageKey: string, fallbackSizes: number[]): number[] {
  try {
    const rawValue = window.localStorage.getItem(storageKey)

    if (!rawValue) {
      return fallbackSizes
    }

    const parsedValue = JSON.parse(rawValue)

    if (
      Array.isArray(parsedValue) &&
      parsedValue.length === fallbackSizes.length &&
      parsedValue.every((item) => typeof item === 'number' && Number.isFinite(item) && item > 0)
    ) {
      return parsedValue
    }
  } catch {
    return fallbackSizes
  }

  return fallbackSizes
}

// 用户拖拽完成后把 Splitter 尺寸写入 localStorage，方便下次打开时直接复用。
function storeSplitterSizes(storageKey: string, sizes: number[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(sizes))
  } catch {
    return
  }
}

function findFirstRequestId(nodes: ApiTreeNode[]): string {
  for (const node of nodes) {
    if (node.type === 'request') {
      return node.id
    }

    const childRequestId = findFirstRequestId(node.children)

    if (childRequestId) {
      return childRequestId
    }
  }

  return ''
}

function updateRequestById(
  nodes: ApiTreeNode[],
  requestId: string,
  updater: (request: ApiRequestEntry) => ApiRequestEntry
): ApiTreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'request') {
      return node.id === requestId ? updater(node) : node
    }

    return {
      ...node,
      children: updateRequestById(node.children, requestId, updater)
    }
  })
}

function updateHistoryById(
  nodes: ApiTreeNode[],
  historyId: string,
  updater: (history: ApiRequestHistoryEntry) => ApiRequestHistoryEntry
): ApiTreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'request') {
      return {
        ...node,
        histories: node.histories.map((history) => (history.id === historyId ? updater(history) : history))
      }
    }

    return {
      ...node,
      children: updateHistoryById(node.children, historyId, updater)
    }
  })
}

function updateFolderById(
  nodes: ApiTreeNode[],
  folderId: string,
  updater: (folder: ApiFolderEntry) => ApiFolderEntry
): ApiTreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      if (node.id === folderId) {
        return updater(node)
      }

      return {
        ...node,
        children: updateFolderById(node.children, folderId, updater)
      }
    }

    return node
  })
}

function insertRequestIntoFolder(nodes: ApiTreeNode[], folderId: string, request: ApiRequestEntry): ApiTreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      if (node.id === folderId) {
        return {
          ...node,
          children: [request, ...node.children]
        }
      }

      return {
        ...node,
        children: insertRequestIntoFolder(node.children, folderId, request)
      }
    }

    return node
  })
}

function formatRequestedAt(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function getMethodColor(method: ApiHttpMethod): string {
  switch (method) {
    case 'GET':
      return '#389e0d'
    case 'POST':
      return '#d46b08'
    case 'PUT':
      return '#1d39c4'
    case 'PATCH':
      return '#722ed1'
    case 'DELETE':
      return '#cf1322'
    case 'HEAD':
      return '#08979c'
    case 'OPTIONS':
      return '#1677ff'
    case 'TRACE':
      return '#eb2f96'
    case 'CONNECT':
      return '#13a8a8'
    default:
      return '#8c8c8c'
  }
}

function buildTreeData(
  nodes: ApiTreeNode[],
  editingKey: string | null,
  editingTitle: string,
  onChangeEditingTitle: (nextValue: string) => void,
  onCreateRequestInFolder: (folderId: string) => void,
  onDeleteFolder: (folderId: string) => void,
  onDeleteRequest: (requestId: string) => void,
  onDeleteHistory: (requestId: string, historyId: string) => void,
  onRenameFolder: (folderId: string, nextTitle: string) => void,
  onRenameHistory: (historyId: string, nextTitle: string) => void,
  onRenameRequest: (requestId: string, nextTitle: string) => void,
  onStartEditing: (editingNodeKey: string, initialTitle: string) => void,
  onSubmitEditing: () => void,
  colorTextSecondary: string,
  colorTextTertiary: string,
  methodColorMap: Record<ApiHttpMethod, string>
): TreeDataNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      const editingNodeKey = buildTreeEditableKey('folder', node.id)
      const isEditing = editingKey === editingNodeKey

      return {
        key: node.id,
        title: (
          <Flex align="center" justify="space-between" style={{ width: '100%', paddingLeft: 0, gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditing ? (
                <Input
                  autoFocus
                  size="small"
                  value={editingTitle}
                  onBlur={onSubmitEditing}
                  onChange={(event) => onChangeEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onSubmitEditing()
                    }
                  }}
                />
              ) : (
                <Typography.Text ellipsis strong style={{ display: 'block', fontSize: 13 }}>
                  {node.name}
                </Typography.Text>
              )}
            </div>
            <Space size={0}>
              <Button
                aria-label={`Create request in ${node.name}`}
                icon={<FileAddOutlined />}
                shape="circle"
                size="small"
                type="text"
                onClick={(event) => {
                  event.stopPropagation()
                  onCreateRequestInFolder(node.id)
                }}
              />
              <Button
                aria-label={`Edit ${node.name}`}
                icon={<EditOutlined />}
                shape="circle"
                size="small"
                type="text"
                onClick={(event) => {
                  event.stopPropagation()
                  onStartEditing(editingNodeKey, node.name)
                }}
              />
              <Button
                aria-label={`Delete ${node.name}`}
                danger
                icon={<DeleteOutlined />}
                shape="circle"
                size="small"
                type="text"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteFolder(node.id)
                }}
              />
            </Space>
          </Flex>
        ),
        children: buildTreeData(
          node.children,
          editingKey,
          editingTitle,
          onChangeEditingTitle,
          onCreateRequestInFolder,
          onDeleteFolder,
          onDeleteRequest,
          onDeleteHistory,
          onRenameFolder,
          onRenameHistory,
          onRenameRequest,
          onStartEditing,
          onSubmitEditing,
          colorTextSecondary,
          colorTextTertiary,
          methodColorMap
        )
      }
    }

    const requestEditingKey = buildTreeEditableKey('request', node.id)
    const isRequestEditing = editingKey === requestEditingKey

    return {
      key: node.id,
      title: (
        <Flex align="center" justify="space-between" style={{ width: '100%', paddingLeft: 0, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <Typography.Text
              style={{
                minWidth: 44,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: methodColorMap[node.method]
              }}
            >
              {node.method}
            </Typography.Text>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isRequestEditing ? (
                <Input
                  autoFocus
                  size="small"
                  value={editingTitle}
                  onBlur={onSubmitEditing}
                  onChange={(event) => onChangeEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onSubmitEditing()
                    }
                  }}
                />
              ) : (
                <Typography.Text ellipsis style={{ display: 'block', color: colorTextSecondary }}>
                  {node.name}
                </Typography.Text>
              )}
            </div>
          </div>
          <Space size={0}>
            <Button
              aria-label={`Edit ${node.name}`}
              icon={<EditOutlined />}
              shape="circle"
              size="small"
              type="text"
              onClick={(event) => {
                event.stopPropagation()
                onStartEditing(requestEditingKey, node.name)
              }}
            />
            <Button
              aria-label={`Delete ${node.name}`}
              danger
              icon={<DeleteOutlined />}
              shape="circle"
              size="small"
              type="text"
              onClick={(event) => {
                event.stopPropagation()
                onDeleteRequest(node.id)
              }}
            />
          </Space>
        </Flex>
      ),
      children: node.histories.map((history) => ({
        key: history.id,
        title: (
          <Flex align="center" justify="space-between" style={{ width: '100%', paddingLeft: 0, gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingKey === buildTreeEditableKey('history', history.id) ? (
                <Input
                  autoFocus
                  size="small"
                  value={editingTitle}
                  onBlur={onSubmitEditing}
                  onChange={(event) => onChangeEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onSubmitEditing()
                    }
                  }}
                />
              ) : (
                <Typography.Text ellipsis style={{ display: 'block', fontSize: 12, color: colorTextTertiary }}>
                  {history.name}
                </Typography.Text>
              )}
            </div>
            <Space size={0}>
              <Button
                aria-label={`Edit ${history.name}`}
                icon={<EditOutlined />}
                shape="circle"
                size="small"
                type="text"
                onClick={(event) => {
                  event.stopPropagation()
                  onStartEditing(buildTreeEditableKey('history', history.id), history.name)
                }}
              />
              <Button
                aria-label={`Delete ${history.name}`}
                danger
                icon={<DeleteOutlined />}
                shape="circle"
                size="small"
                type="text"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteHistory(node.id, history.id)
                }}
              />
            </Space>
          </Flex>
        )
      }))
    }
  })
}

function countApiRequests(nodes: ApiTreeNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === 'request') {
      return total + 1
    }

    return total + countApiRequests(node.children)
  }, 0)
}

function cloneApiKeyValueEntries(entries: ApiKeyValueEntry[]): ApiKeyValueEntry[] {
  return entries.map((entry) => ({ ...entry }))
}

function buildApiRequestSnapshot(request: ApiRequestEntry): ApiRequestSnapshot {
  return {
    method: request.method,
    url: request.url,
    params: cloneApiKeyValueEntries(request.params),
    headers: cloneApiKeyValueEntries(request.headers),
    bodyMode: request.bodyMode,
    bodyText: request.bodyText
  }
}

function formatHistoryLabel(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Request History'
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${month}-${day} ${hours}:${minutes}:${seconds}`
}

function findSelectionByKey(nodes: ApiTreeNode[], selectionKey: string): ApiSelectionContext | null {
  for (const node of nodes) {
    if (node.type === 'folder') {
      const nestedSelection = findSelectionByKey(node.children, selectionKey)

      if (nestedSelection) {
        return nestedSelection
      }

      continue
    }

    if (node.id === selectionKey) {
      return {
        request: node,
        history: null
      }
    }

    const matchedHistory = node.histories.find((history) => history.id === selectionKey)

    if (matchedHistory) {
      return {
        request: node,
        history: matchedHistory
      }
    }
  }

  return null
}

function removeHistoryById(nodes: ApiTreeNode[], historyId: string): ApiTreeNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      return {
        ...node,
        children: removeHistoryById(node.children, historyId)
      }
    }

    return {
      ...node,
      histories: node.histories.filter((history) => history.id !== historyId)
    }
  })
}

// 删除目录或请求时，直接从树结构中移除节点，请求下的历史会跟随请求一起被清理。
function removeNodeById(nodes: ApiTreeNode[], nodeId: string): ApiTreeNode[] {
  return nodes.reduce<ApiTreeNode[]>((nextNodes, node) => {
    if (node.id === nodeId) {
      return nextNodes
    }

    if (node.type === 'folder') {
      nextNodes.push({
        ...node,
        children: removeNodeById(node.children, nodeId)
      })
      return nextNodes
    }

    nextNodes.push(node)
    return nextNodes
  }, [])
}

function treeContainsSelectionKey(nodes: ApiTreeNode[], selectionKey: string): boolean {
  return nodes.some((node) => {
    if (node.id === selectionKey) {
      return true
    }

    if (node.type === 'folder') {
      return treeContainsSelectionKey(node.children, selectionKey)
    }

    return node.histories.some((history) => history.id === selectionKey)
  })
}

// 搜索时保留命中的请求和对应父级文件夹，便于用户继续在树中定位上下文。
function filterApiNodes(nodes: ApiTreeNode[], keyword: string): ApiTreeNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase()

  if (!normalizedKeyword) {
    return nodes
  }

  return nodes.reduce<ApiTreeNode[]>((filteredNodes, node) => {
    if (node.type === 'folder') {
      const matchedChildren = filterApiNodes(node.children, normalizedKeyword)
      const matchesFolder = node.name.toLowerCase().includes(normalizedKeyword)

      if (matchesFolder || matchedChildren.length > 0) {
        filteredNodes.push({
          ...node,
          children: matchedChildren
        })
      }

      return filteredNodes
    }

    const matchesRequest =
      node.name.toLowerCase().includes(normalizedKeyword) || node.url.toLowerCase().includes(normalizedKeyword)

    if (matchesRequest) {
      filteredNodes.push(node)
    }

    return filteredNodes
  }, [])
}

function buildResponsePayload(response: ApiResponseSnapshot | null): unknown {
  if (!response) {
    return null
  }

  if (response.error) {
    return {
      error: response.error
    }
  }

  if (response.bodyJson !== null) {
    return response.bodyJson
  }

  if (response.bodyText.trim()) {
    return {
      bodyText: response.bodyText
    }
  }

  return {
    message: 'Empty response body'
  }
}

function canUseParamEntry(entry: ApiKeyValueEntry): boolean {
  return Boolean(entry.key.trim() && entry.value.trim())
}

function buildTreeEditableKey(type: 'folder' | 'history' | 'request', id: string): string {
  return `${type}:${id}`
}

function ApiPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null)
  const [selectedTreeKey, setSelectedTreeKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<ApiBodyMode | EditableSection>('params')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<ApiPanelSectionKey[]>([])
  const [editingTreeNodeKey, setEditingTreeNodeKey] = useState<string | null>(null)
  const [editingTreeNodeTitle, setEditingTreeNodeTitle] = useState('')
  const [mainSplitterSizes, setMainSplitterSizes] = useState<number[]>(() =>
    readStoredSplitterSizes(API_MAIN_SPLITTER_STORAGE_KEY, DEFAULT_MAIN_SPLITTER_SIZES)
  )
  const [detailSplitterSizes, setDetailSplitterSizes] = useState<number[]>(() =>
    readStoredSplitterSizes(API_DETAIL_SPLITTER_STORAGE_KEY, DEFAULT_DETAIL_SPLITTER_SIZES)
  )
  const [messageApi, contextHolder] = message.useMessage()
  const hasLoadedRef = useRef(false)
  const dirtyRef = useRef(false)

  const selection = useMemo(
    () => (workspace ? findSelectionByKey(workspace.nodes, selectedTreeKey) : null),
    [selectedTreeKey, workspace]
  )

  const selectedRequest = selection?.request ?? null
  const selectedHistory = selection?.history ?? null
  const isHistorySelected = selectedHistory !== null

  const displayedRequest = useMemo<ApiRequestSnapshot | null>(
    () =>
      selectedHistory
        ? selectedHistory.request
        : selectedRequest
          ? buildApiRequestSnapshot(selectedRequest)
          : null,
    [selectedHistory, selectedRequest]
  )

  const displayedResponse = selectedHistory ? selectedHistory.response : selectedRequest?.response ?? null

  const filteredNodes = useMemo(
    () => (workspace ? filterApiNodes(workspace.nodes, searchKeyword) : []),
    [searchKeyword, workspace]
  )
  const visibleRequestCount = useMemo(() => countApiRequests(filteredNodes), [filteredNodes])

  const importMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'curl',
        label: 'Import cURL'
      },
      {
        key: 'folder',
        label: 'Import Folder'
      }
    ],
    []
  )

  const sectionCardStyle = useMemo(
    () => ({
      borderRadius: 18,
      border: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgContainer,
      boxShadow: token.boxShadowTertiary
    }),
    [token.boxShadowTertiary, token.colorBgContainer, token.colorBorderSecondary]
  )

  const requestConfigScrollStyle = useMemo(
    () => ({
      height: 214,
      overflow: 'auto' as const,
      paddingRight: 4
    }),
    []
  )

  const responseScrollStyle = useMemo(
    () => ({
      display: 'flex',
      flex: 1,
      minHeight: 0,
      overflow: 'auto' as const,
      paddingRight: 4
    }),
    []
  )
  const requestCollapsed = collapsedSections.includes('request')
  const responseCollapsed = collapsedSections.includes('response')
  const methodColorMap = useMemo(
    () =>
      Object.fromEntries(API_METHOD_OPTIONS.map((method) => [method, getMethodColor(method)])) as Record<ApiHttpMethod, string>,
    []
  )

  useEffect(() => {
    let disposed = false

    const bootstrap = async (): Promise<void> => {
      try {
        const nextWorkspace = await window.api.getApiWorkspace()

        if (disposed) {
          return
        }

        setWorkspace(nextWorkspace)
        setSelectedTreeKey(findFirstRequestId(nextWorkspace.nodes))
        hasLoadedRef.current = true
      } catch (loadError) {
        if (!disposed) {
          messageApi.error(loadError instanceof Error ? loadError.message : 'Failed to load API workspace.')
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
  }, [messageApi])

  // API 面板采用轻量自动保存，避免额外增加一个手动保存按钮打断调试流。
  useEffect(() => {
    if (!workspace || !hasLoadedRef.current || !dirtyRef.current) {
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        await window.api.saveApiWorkspace(workspace)
      } catch (saveError) {
        messageApi.error(saveError instanceof Error ? saveError.message : 'Failed to save API workspace.')
      } finally {
        dirtyRef.current = false
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [messageApi, workspace])

  const applyWorkspaceUpdate = (updater: (currentWorkspace: ApiWorkspace) => ApiWorkspace): void => {
    setWorkspace((currentWorkspace) => {
      if (!currentWorkspace) {
        return currentWorkspace
      }

      dirtyRef.current = true
      return updater(currentWorkspace)
    })
  }

  const updateSelectedRequest = (updater: (request: ApiRequestEntry) => ApiRequestEntry): void => {
    if (!selectedRequest || isHistorySelected) {
      return
    }

    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: updateRequestById(currentWorkspace.nodes, selectedRequest.id, updater)
    }))
  }

  const updateDisplayedRequest = (updater: (request: ApiRequestSnapshot) => ApiRequestSnapshot): void => {
    if (!selection) {
      return
    }

    if (selection.history) {
      applyWorkspaceUpdate((currentWorkspace) => ({
        nodes: updateHistoryById(currentWorkspace.nodes, selection.history!.id, (history) => ({
          ...history,
          request: updater(history.request)
        }))
      }))
      return
    }

    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: updateRequestById(currentWorkspace.nodes, selection.request.id, (request) => {
        const nextSnapshot = updater(buildApiRequestSnapshot(request))

        return {
          ...request,
          method: nextSnapshot.method,
          url: nextSnapshot.url,
          params: nextSnapshot.params,
          headers: nextSnapshot.headers,
          bodyMode: nextSnapshot.bodyMode,
          bodyText: nextSnapshot.bodyText
        }
      })
    }))
  }

  const normalizeNodeTitle = (value: string, fallbackValue: string): string => {
    const normalizedValue = value.trim()
    return normalizedValue || fallbackValue
  }

  const handleDeleteHistory = (requestId: string, historyId: string): void => {
    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: removeHistoryById(currentWorkspace.nodes, historyId)
    }))

    if (selectedTreeKey === historyId) {
      setSelectedTreeKey(requestId)
    }
  }

  const deleteTreeNode = (nodeId: string): void => {
    if (!workspace) {
      return
    }

    const nextNodes = removeNodeById(workspace.nodes, nodeId)

    setWorkspace({
      nodes: nextNodes
    })
    dirtyRef.current = true

    if (!treeContainsSelectionKey(nextNodes, selectedTreeKey)) {
      setSelectedTreeKey(findFirstRequestId(nextNodes))
    }
  }

  const handleDeleteFolder = (folderId: string): void => {
    deleteTreeNode(folderId)
  }

  const handleDeleteRequest = (requestId: string): void => {
    deleteTreeNode(requestId)
  }

  const handleCreateRootFolder = (): void => {
    const folder = createDefaultFolder()

    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: [folder, ...currentWorkspace.nodes]
    }))
  }

  const handleCreateRootRequest = (): void => {
    const request = createDefaultRequest()

    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: [request, ...currentWorkspace.nodes]
    }))
    setSelectedTreeKey(request.id)
  }

  const handleCreateRequestInFolder = (folderId: string): void => {
    const request = createDefaultRequest()

    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: insertRequestIntoFolder(currentWorkspace.nodes, folderId, request)
    }))
    setSelectedTreeKey(request.id)
  }

  const handleRenameFolder = (folderId: string, nextTitle: string): void => {
    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: updateFolderById(currentWorkspace.nodes, folderId, (folder) => ({
        ...folder,
        name: normalizeNodeTitle(nextTitle, folder.name)
      }))
    }))
  }

  const handleRenameRequest = (requestId: string, nextTitle: string): void => {
    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: updateRequestById(currentWorkspace.nodes, requestId, (request) => ({
        ...request,
        name: normalizeNodeTitle(nextTitle, request.name)
      }))
    }))
  }

  const handleRenameHistory = (historyId: string, nextTitle: string): void => {
    applyWorkspaceUpdate((currentWorkspace) => ({
      nodes: updateHistoryById(currentWorkspace.nodes, historyId, (history) => ({
        ...history,
        name: normalizeNodeTitle(nextTitle, history.name)
      }))
    }))
  }

  const handleStartTreeNodeEditing = (editingNodeKey: string, initialTitle: string): void => {
    setEditingTreeNodeKey(editingNodeKey)
    setEditingTreeNodeTitle(initialTitle)
  }

  const handleSubmitTreeNodeEditing = (): void => {
    if (!editingTreeNodeKey) {
      return
    }

    const [nodeType, nodeId] = editingTreeNodeKey.split(':')
    const nextTitle = editingTreeNodeTitle

    if (nodeType === 'folder') {
      handleRenameFolder(nodeId, nextTitle)
    } else if (nodeType === 'request') {
      handleRenameRequest(nodeId, nextTitle)
    } else if (nodeType === 'history') {
      handleRenameHistory(nodeId, nextTitle)
    }

    setEditingTreeNodeKey(null)
    setEditingTreeNodeTitle('')
  }

  const treeData = useMemo(
    () =>
      buildTreeData(
        filteredNodes,
        editingTreeNodeKey,
        editingTreeNodeTitle,
        setEditingTreeNodeTitle,
        handleCreateRequestInFolder,
        handleDeleteFolder,
        handleDeleteRequest,
        handleDeleteHistory,
        handleRenameFolder,
        handleRenameHistory,
        handleRenameRequest,
        handleStartTreeNodeEditing,
        handleSubmitTreeNodeEditing,
        token.colorTextSecondary,
        token.colorTextTertiary,
        methodColorMap
      ),
    [
      editingTreeNodeKey,
      editingTreeNodeTitle,
      filteredNodes,
      handleCreateRequestInFolder,
      handleDeleteFolder,
      handleDeleteHistory,
      handleDeleteRequest,
      handleRenameFolder,
      handleRenameHistory,
      handleRenameRequest,
      handleStartTreeNodeEditing,
      handleSubmitTreeNodeEditing,
      methodColorMap,
      token.colorTextSecondary,
      token.colorTextTertiary
    ]
  )

  const toggleSection = (sectionKey: ApiPanelSectionKey): void => {
    // 请求区和响应区都支持折叠，方便在较小窗口里把空间让给当前关注区域。
    setCollapsedSections((current) =>
      current.includes(sectionKey) ? current.filter((item) => item !== sectionKey) : [...current, sectionKey]
    )
  }

  const handleMainSplitterResizeEnd = (sizes: number[]): void => {
    setMainSplitterSizes(sizes)
    storeSplitterSizes(API_MAIN_SPLITTER_STORAGE_KEY, sizes)
  }

  const handleDetailSplitterResizeEnd = (sizes: number[]): void => {
    setDetailSplitterSizes(sizes)
    storeSplitterSizes(API_DETAIL_SPLITTER_STORAGE_KEY, sizes)
  }

  const updateKeyValueEntry = (
    section: EditableSection,
    entryId: string,
    field: keyof ApiKeyValueEntry,
    value: boolean | string
  ): void => {
    updateDisplayedRequest((request) => ({
      ...request,
      [section]: request[section].map((entry) => {
        if (entry.id !== entryId) {
          return entry
        }

        const nextEntry = {
          ...entry,
          [field]: value
        }

        if (section === 'params' && (field === 'key' || field === 'value')) {
          return {
            ...nextEntry,
            enabled: canUseParamEntry(nextEntry) ? nextEntry.enabled : false
          }
        }

        return nextEntry
      })
    }))
  }

  const appendKeyValueEntry = (section: EditableSection): void => {
    updateDisplayedRequest((request) => ({
      ...request,
      [section]: [...request[section], createEmptyEntry()]
    }))
  }

  const removeKeyValueEntry = (section: EditableSection, entryId: string): void => {
    updateDisplayedRequest((request) => ({
      ...request,
      [section]: request[section].filter((entry) => entry.id !== entryId)
    }))
  }

  const handleSendRequest = async (): Promise<void> => {
    if (!selectedRequest) {
      return
    }

    try {
      setSending(true)
      const response = await window.api.sendApiRequest(selectedRequest)
      const historyEntry: ApiRequestHistoryEntry = {
        id: crypto.randomUUID(),
        type: 'history',
        name: formatHistoryLabel(response.requestedAt),
        request: buildApiRequestSnapshot(selectedRequest),
        response
      }

      updateSelectedRequest((request) => ({
        ...request,
        response,
        histories: [historyEntry, ...request.histories]
      }))
      messageApi.success(response.error ? 'Request completed with an error response.' : 'Request sent.')
    } catch (sendError) {
      messageApi.error(sendError instanceof Error ? sendError.message : 'Failed to send request.')
    } finally {
      setSending(false)
    }
  }

  const buildKeyValueColumns = (section: EditableSection): TableColumnsType<ApiKeyValueEntry> => [
    {
      title: 'On',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 72,
      render: (_, record) => (
        <Switch
          checked={section === 'params' && !canUseParamEntry(record) ? false : record.enabled}
          disabled={section === 'params' && !canUseParamEntry(record)}
          size="small"
          onChange={(checked) => updateKeyValueEntry(section, record.id, 'enabled', checked)}
        />
      )
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: '42%',
      render: (_, record) => (
        <Input
          size="small"
          value={record.key}
          onChange={(event) => updateKeyValueEntry(section, record.id, 'key', event.target.value)}
        />
      )
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: '42%',
      render: (_, record) => (
        <Input
          size="small"
          value={record.value}
          onChange={(event) => updateKeyValueEntry(section, record.id, 'value', event.target.value)}
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 68,
      render: (_, record) => (
        <Button
          aria-label={`Delete ${section} row`}
          danger
          icon={<DeleteOutlined />}
          shape="circle"
          size="small"
          type="text"
          onClick={() => removeKeyValueEntry(section, record.id)}
        />
      )
    }
  ]

  const requestCard = (
    <div
      style={{
        ...sectionCardStyle,
        display: 'flex',
        height: '100%',
        minHeight: requestCollapsed ? 'auto' : 300,
        overflow: 'hidden',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: requestCollapsed ? 'none' : `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <Flex align="center" justify="space-between" gap={12}>
          <Typography.Text
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: token.colorTextTertiary
            }}
          >
            Request
          </Typography.Text>
          <Button
            aria-label={requestCollapsed ? 'Expand request section' : 'Collapse request section'}
            icon={requestCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
            shape="circle"
            size="small"
            type="text"
            onClick={() => toggleSection('request')}
          />
        </Flex>
      </div>

      {requestCollapsed || !displayedRequest ? null : (
        <>
          <div style={{ padding: '12px 14px 0' }}>
            <Flex align="center" gap={12} wrap>
              <Select<ApiHttpMethod>
                options={API_METHOD_OPTIONS.map((method) => ({
                  label: <span style={{ color: methodColorMap[method], fontWeight: 600 }}>{method}</span>,
                  value: method
                }))}
                size="large"
                style={{ width: 148 }}
                value={displayedRequest.method}
                onChange={(value) =>
                  updateDisplayedRequest((request) => ({
                    ...request,
                    method: value
                  }))
                }
              />
              <Input
                placeholder="https://api.example.com/resource"
                size="large"
                style={{ flex: 1 }}
                value={displayedRequest.url}
                onChange={(event) =>
                  updateDisplayedRequest((request) => ({
                    ...request,
                    url: event.target.value
                  }))
                }
              />
              <Button
                icon={<SendOutlined />}
                disabled={isHistorySelected}
                loading={sending}
                size="large"
                type="primary"
                onClick={() => {
                  void handleSendRequest()
                }}
              >
                Send
              </Button>
            </Flex>
          </div>
          <Tabs
            activeKey={activeTab}
            className="h-full"
            tabBarExtraContent={
              activeTab === 'params' ? (
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  type="text"
                  onClick={() => appendKeyValueEntry('params')}
                >
                  Add Param
                </Button>
              ) : activeTab === 'headers' ? (
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  type="text"
                  onClick={() => appendKeyValueEntry('headers')}
                >
                  Add Header
                </Button>
              ) : null
            }
            style={{ display: 'flex', flex: 1, minHeight: 0, padding: 12 }}
            items={[
              {
                key: 'params',
                label: 'Params',
                children: (
                  <div style={requestConfigScrollStyle}>
                    <Table<ApiKeyValueEntry>
                      columns={buildKeyValueColumns('params')}
                      dataSource={displayedRequest.params}
                      pagination={false}
                      rowKey="id"
                      size="small"
                    />
                  </div>
                )
              },
              {
                key: 'headers',
                label: 'Headers',
                children: (
                  <div style={requestConfigScrollStyle}>
                    <Table<ApiKeyValueEntry>
                      columns={buildKeyValueColumns('headers')}
                      dataSource={displayedRequest.headers}
                      pagination={false}
                      rowKey="id"
                      size="small"
                    />
                  </div>
                )
              },
              {
                key: 'body',
                label: 'Body',
                children: (
                  <div style={requestConfigScrollStyle}>
                    <Flex gap={12} vertical>
                      <Flex align="center" gap={12}>
                        <Typography.Text style={{ color: token.colorTextSecondary }}>Mode</Typography.Text>
                        <Select<ApiBodyMode>
                          options={[
                            { label: 'None', value: 'none' },
                            { label: 'JSON', value: 'json' },
                            { label: 'Text', value: 'text' }
                          ]}
                          style={{ width: 160 }}
                          value={displayedRequest.bodyMode}
                          onChange={(value) =>
                            updateDisplayedRequest((request) => ({
                              ...request,
                              bodyMode: value
                            }))
                          }
                        />
                      </Flex>

                      {displayedRequest.bodyMode === 'none' ? (
                        <Empty description="This request does not send a body." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        <Input.TextArea
                          autoSize={false}
                          placeholder={displayedRequest.bodyMode === 'json' ? 'JSON body' : 'Request body'}
                          style={{ minHeight: 260, resize: 'none' }}
                          value={displayedRequest.bodyText}
                          onChange={(event) =>
                            updateDisplayedRequest((request) => ({
                              ...request,
                              bodyText: event.target.value
                            }))
                          }
                        />
                      )}
                    </Flex>
                  </div>
                )
              }
            ]}
            onChange={(value) => setActiveTab(value as ApiBodyMode | EditableSection)}
          />
        </>
      )}
    </div>
  )

  const responseCard = (
    <div
      style={{
        ...sectionCardStyle,
        display: 'flex',
        height: '100%',
        minHeight: responseCollapsed ? 'auto' : 0,
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        gap={12}
        wrap
        style={{
          padding: '14px 16px',
          borderBottom: responseCollapsed ? 'none' : `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <Typography.Text
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: token.colorTextTertiary
          }}
        >
          Response
        </Typography.Text>
        <Space size={8} wrap>
          {displayedResponse ? (
            <>
              <Tag color={displayedResponse.ok ? 'green' : 'red'} style={{ margin: 0 }}>
                {displayedResponse.status ?? 'ERR'} {displayedResponse.statusText || ''}
              </Tag>
              <Tag style={{ margin: 0 }}>{displayedResponse.durationMs} ms</Tag>
              <Typography.Text style={{ color: token.colorTextSecondary }}>
                {formatRequestedAt(displayedResponse.requestedAt)}
              </Typography.Text>
            </>
          ) : null}
          <Button
            aria-label={responseCollapsed ? 'Expand response section' : 'Collapse response section'}
            icon={responseCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
            shape="circle"
            size="small"
            type="text"
            onClick={() => toggleSection('response')}
          />
        </Space>
      </Flex>

      {responseCollapsed ? null : displayedResponse ? (
        <div style={{ ...responseScrollStyle, padding: 16 }}>
          <div className="flex min-h-full w-full flex-col gap-3">
            <div className="min-h-0 flex-1">
              <JsonResultViewer data={buildResponsePayload(displayedResponse)} minHeight={280} rootName="response" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center">
          <Empty description="Send the request to inspect the response" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-1">
      {contextHolder}
      <Splitter
        className="h-full w-full"
        onResizeEnd={handleMainSplitterResizeEnd}
        style={{ height: '100%', width: '100%' }}
      >
        <Splitter.Panel min={260} size={mainSplitterSizes[0]}>
          <div
            style={{
              ...sectionCardStyle,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: `1px solid ${token.colorBorderSecondary}`
              }}
            >
              <Flex align="center" justify="space-between" gap={12}>
                <div>
                  <Typography.Text
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: token.colorTextTertiary
                    }}
                  >
                    Collections
                  </Typography.Text>
                  <Typography.Text style={{ color: token.colorTextTertiary, fontSize: 12 }}>
                    {visibleRequestCount} request{visibleRequestCount === 1 ? '' : 's'}
                  </Typography.Text>
                </div>

                <Dropdown
                  menu={{
                    items: importMenuItems,
                    onClick: () => {
                      messageApi.info('Import options are coming soon.')
                    }
                  }}
                  trigger={['click']}
                >
                  <Button icon={<ImportOutlined />} size="middle">
                    Import
                    <DownOutlined />
                  </Button>
                </Dropdown>
                <Button aria-label="Create folder" icon={<FolderAddOutlined />} onClick={handleCreateRootFolder} />
                <Button aria-label="Create request" icon={<FileAddOutlined />} onClick={handleCreateRootRequest} />
              </Flex>

              <Input
                allowClear
                placeholder="Search by endpoint, folder, or name"
                prefix={<SearchOutlined />}
                size="large"
                style={{ marginTop: 12 }}
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-2">
              {treeData.length > 0 ? (
                <Tree
                  blockNode
                  className="tool-api-tree"
                  defaultExpandAll
                  style={{ fontSize: 13 }}
                  selectedKeys={selectedTreeKey ? [selectedTreeKey] : []}
                  showIcon={false}
                  treeData={treeData}
                  onSelect={(keys) => {
                    const nextKey = typeof keys[0] === 'string' ? keys[0] : ''
                    setSelectedTreeKey(nextKey)
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Empty description="No matching API requests" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              )}
            </div>
          </div>
        </Splitter.Panel>
        <Splitter.Panel min={420} size={mainSplitterSizes[1]}>
          <div className="flex h-full min-h-0 flex-1 pl-5">
            {loading ? (
              <div
                style={{
                  ...sectionCardStyle,
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography.Text style={{ color: token.colorTextSecondary }}>Loading API workspace...</Typography.Text>
              </div>
            ) : !selectedRequest || !displayedRequest ? (
              <div
                style={{
                  ...sectionCardStyle,
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Empty description="Select an API request from the tree" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : !requestCollapsed && !responseCollapsed ? (
              <Splitter
                className="h-full w-full"
                onResizeEnd={handleDetailSplitterResizeEnd}
                orientation="vertical"
                style={{ height: '100%', width: '100%' }}
              >
                <Splitter.Panel min={300} size={detailSplitterSizes[0]}>
                  <div className="h-full min-h-0 pr-0 pb-1">{requestCard}</div>
                </Splitter.Panel>
                <Splitter.Panel min={220} size={detailSplitterSizes[1]}>
                  <div className="h-full min-h-0 pt-1">{responseCard}</div>
                </Splitter.Panel>
              </Splitter>
            ) : (
              <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
                <div style={{ flex: requestCollapsed ? '0 0 auto' : '0 0 300px', minHeight: requestCollapsed ? 'auto' : 300 }}>
                  {requestCard}
                </div>
                <div style={{ minHeight: responseCollapsed ? 'auto' : 0, flex: responseCollapsed ? '0 0 auto' : 1 }}>
                  {responseCard}
                </div>
              </div>
            )}
          </div>
        </Splitter.Panel>
      </Splitter>
    </div>
  )
}

export default ApiPanel
