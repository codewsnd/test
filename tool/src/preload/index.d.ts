import { ElectronAPI } from '@electron-toolkit/preload'

type CodexSkill = {
  id: string
  name: string
  description: string
  category: 'system' | 'custom' | 'superpower'
  path: string
}

type ScriptFile = {
  id: string
  scriptName: string
  description: string
  content: string
  type: string
}

type CreateScriptPayload = {
  scriptName: string
  description: string
  content: string
  type?: string
  autoRenameOnConflict?: boolean
}

type UpdateScriptPayload = {
  id: string
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

type RunScriptCommandPayload = {
  command: string
  scriptName: string
  shell: ScriptShellKey
}

type ApiHttpMethod = 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE'
type ApiBodyMode = 'json' | 'none' | 'text'

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

type UpdateUserEnvironmentPayload = {
  name: string
  originalName: string
  type?: string
  value: string
}

type AppUsageMetrics = {
  cpuPercent: number
  memoryMB: number
}

type HostToolVersions = {
  git: string
  java: string
  npm: string
  pnpm: string
  powershell: string
  python: string
}

type HostOverview = {
  hardware: {
    cpuCores: number
    cpuModel: string
  }
  network: {
    interfaceCount: number
    ipv4: string[]
    ipv6: string[]
  }
  runtime: {
    appVersion: string
    chrome: string
    electron: string
    node: string
    v8: string
  }
  system: {
    architecture: string
    hostname: string
    locale: string
    osType: string
    osVersion: string
    platform: string
    release: string
    timezone: string
  }
  tools: HostToolVersions
  user: {
    username: string
  }
}

type JiraSettings = {
  apiPrefix: string
  token: string
}

type JiraValidationResult = {
  ok: boolean
  status: number
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

type JiraIssueListResult = {
  items: JiraIssue[]
  page: number
  pageSize: number
  total: number
}

type AppSettings = {
  httpProxy: string
}

type McpServerTransport = 'streamable-http' | 'stdio'
type McpServerStatus = 'error' | 'online' | 'untested'
type McpRunStatus = 'error' | 'success'

type McpServerDraft = {
  id?: string
  name: string
  description?: string
  transport: McpServerTransport
  enabled?: boolean
  url?: string
  command?: string
  args?: string[]
  cwd?: string
  headers?: Record<string, string>
  env?: Record<string, string>
}

type McpServerRecord = {
  id: string
  name: string
  description: string
  transport: McpServerTransport
  enabled: boolean
  url: string
  command: string
  args: string[]
  cwd: string
  headers: Record<string, string>
  env: Record<string, string>
  status: McpServerStatus
  lastCheckedAt: string | null
  lastError: string | null
  toolCount: number
  serverLabel: string | null
}

type McpToolRecord = {
  id: string
  serverId: string
  serverName: string
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown> | null
  readOnly: boolean
  destructive: boolean
  openWorld: boolean
  executionMode: 'forbidden' | 'optional' | 'required' | null
}

type McpRunRecord = {
  id: string
  serverId: string
  serverName: string
  toolName: string
  status: McpRunStatus
  startedAt: string
  durationMs: number
  preview: string
  arguments: Record<string, unknown>
  result: unknown
  error: string | null
}

interface ToolApi {
  listCodexSkills: () => Promise<CodexSkill[]>
  listScripts: () => Promise<ScriptFile[]>
  createScript: (payload: CreateScriptPayload) => Promise<ScriptFile>
  updateScript: (payload: UpdateScriptPayload) => Promise<ScriptFile>
  deleteScript: (scriptId: string) => Promise<void>
  reorderScripts: (scriptIds: string[]) => Promise<ScriptFile[]>
  listScriptShellOptions: () => Promise<ScriptShellOption[]>
  runScriptCommand: (payload: RunScriptCommandPayload) => Promise<void>
  getApiWorkspace: () => Promise<ApiWorkspace>
  saveApiWorkspace: (workspace: ApiWorkspace) => Promise<ApiWorkspace>
  sendApiRequest: (request: ApiRequestEntry) => Promise<ApiResponseSnapshot>
  listUserEnvironmentVariables: () => Promise<UserEnvironmentVariable[]>
  createUserEnvironmentVariable: (payload: CreateUserEnvironmentPayload) => Promise<UserEnvironmentVariable>
  updateUserEnvironmentVariable: (payload: UpdateUserEnvironmentPayload) => Promise<UserEnvironmentVariable>
  enableUserEnvironmentVariable: (name: string) => Promise<void>
  disableUserEnvironmentVariable: (name: string) => Promise<void>
  deleteUserEnvironmentVariable: (name: string) => Promise<void>
  getAppUsageMetrics: () => Promise<AppUsageMetrics>
  getHostOverview: () => Promise<HostOverview>
  getJiraSettings: () => Promise<JiraSettings | null>
  validateJiraSettings: (settings: JiraSettings) => Promise<JiraValidationResult>
  listJiraIssues: (payload: { query: JiraIssueQuery; settings: JiraSettings }) => Promise<JiraIssueListResult>
  getCurrentUsername: () => Promise<string>
  getAppSettings: () => Promise<AppSettings>
  saveAppSettings: (settings: AppSettings) => Promise<AppSettings>
  listMcpServers: () => Promise<McpServerRecord[]>
  saveMcpServer: (draft: McpServerDraft) => Promise<McpServerRecord>
  deleteMcpServer: (serverId: string) => Promise<void>
  testMcpServer: (serverId: string) => Promise<McpServerRecord>
  listMcpTools: (serverId: string) => Promise<McpToolRecord[]>
  callMcpTool: (payload: { serverId: string; toolName: string; arguments?: Record<string, unknown> }) => Promise<McpRunRecord>
  listMcpRuns: () => Promise<McpRunRecord[]>
  openSkillFolder: (skillPath: string) => Promise<void>
  deleteSkillFolder: (skillPath: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ToolApi
  }
}
