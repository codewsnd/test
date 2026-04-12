import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  listCodexSkills: () => electronAPI.ipcRenderer.invoke('codex:list-skills'),
  listScripts: () => electronAPI.ipcRenderer.invoke('app:list-scripts'),
  createScript: (payload: {
    scriptName: string
    description: string
    content: string
    type?: string
    autoRenameOnConflict?: boolean
  }) =>
    electronAPI.ipcRenderer.invoke('app:create-script', payload),
  updateScript: (payload: { id: string; scriptName: string; description: string; content: string; type?: string }) =>
    electronAPI.ipcRenderer.invoke('app:update-script', payload),
  deleteScript: (scriptId: string) => electronAPI.ipcRenderer.invoke('app:delete-script', scriptId),
  reorderScripts: (scriptIds: string[]) => electronAPI.ipcRenderer.invoke('app:reorder-scripts', scriptIds),
  listScriptShellOptions: () => electronAPI.ipcRenderer.invoke('app:list-script-shell-options'),
  runScriptCommand: (payload: {
    command: string
    scriptName: string
    shell: 'powershell7' | 'powershell' | 'cmd'
  }) =>
    electronAPI.ipcRenderer.invoke('app:run-script-command', payload),
  getApiWorkspace: () => electronAPI.ipcRenderer.invoke('app:get-api-workspace'),
  saveApiWorkspace: (workspace: {
    nodes: Array<
      | {
          id: string
          type: 'folder'
          name: string
          children: unknown[]
        }
      | {
          id: string
          type: 'request'
          name: string
          method: 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE'
          url: string
          params: Array<{ id: string; key: string; value: string; enabled: boolean }>
          headers: Array<{ id: string; key: string; value: string; enabled: boolean }>
          bodyMode: 'json' | 'none' | 'text'
          bodyText: string
          response: unknown
          histories: Array<{
            id: string
            type: 'history'
            name: string
            request: {
              method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
              url: string
              params: Array<{ id: string; key: string; value: string; enabled: boolean }>
              headers: Array<{ id: string; key: string; value: string; enabled: boolean }>
              bodyMode: 'json' | 'none' | 'text'
              bodyText: string
            }
            response: unknown
          }>
        }
    >
  }) => electronAPI.ipcRenderer.invoke('app:save-api-workspace', workspace),
  sendApiRequest: (request: {
    id: string
    type: 'request'
    name: string
    method: 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE'
    url: string
    params: Array<{ id: string; key: string; value: string; enabled: boolean }>
    headers: Array<{ id: string; key: string; value: string; enabled: boolean }>
    bodyMode: 'json' | 'none' | 'text'
    bodyText: string
    response: unknown
    histories: Array<{
      id: string
      type: 'history'
      name: string
      request: {
        method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
        url: string
        params: Array<{ id: string; key: string; value: string; enabled: boolean }>
        headers: Array<{ id: string; key: string; value: string; enabled: boolean }>
        bodyMode: 'json' | 'none' | 'text'
        bodyText: string
      }
      response: unknown
    }>
  }) => electronAPI.ipcRenderer.invoke('app:send-api-request', request),
  listUserEnvironmentVariables: () => electronAPI.ipcRenderer.invoke('app:list-user-environment'),
  createUserEnvironmentVariable: (payload: { name: string; type?: string; value: string }) =>
    electronAPI.ipcRenderer.invoke('app:create-user-environment', payload),
  updateUserEnvironmentVariable: (payload: { name: string; originalName: string; type?: string; value: string }) =>
    electronAPI.ipcRenderer.invoke('app:update-user-environment', payload),
  enableUserEnvironmentVariable: (name: string) => electronAPI.ipcRenderer.invoke('app:enable-user-environment', name),
  disableUserEnvironmentVariable: (name: string) => electronAPI.ipcRenderer.invoke('app:disable-user-environment', name),
  deleteUserEnvironmentVariable: (name: string) => electronAPI.ipcRenderer.invoke('app:delete-user-environment', name),
  getAppUsageMetrics: () => electronAPI.ipcRenderer.invoke('app:get-usage-metrics'),
  getHostOverview: () => electronAPI.ipcRenderer.invoke('app:get-host-overview'),
  getJiraSettings: () => electronAPI.ipcRenderer.invoke('app:get-jira-settings'),
  validateJiraSettings: (settings: { apiPrefix: string; token: string }) =>
    electronAPI.ipcRenderer.invoke('app:validate-jira-settings', settings),
  listJiraIssues: (payload: {
    query: {
      keyword?: string
      page: number
      pageSize: number
      project?: string
      sortField?: 'created' | 'updated'
      sortOrder?: 'ascend' | 'descend'
      status?: string
      type?: string
    }
    settings: { apiPrefix: string; token: string }
  }) => electronAPI.ipcRenderer.invoke('app:list-jira-issues', payload),
  getCurrentUsername: () => electronAPI.ipcRenderer.invoke('app:get-current-username'),
  getAppSettings: () => electronAPI.ipcRenderer.invoke('app:get-settings'),
  saveAppSettings: (settings: { httpProxy: string }) => electronAPI.ipcRenderer.invoke('app:save-settings', settings),
  listMcpServers: () => electronAPI.ipcRenderer.invoke('app:list-mcp-servers'),
  saveMcpServer: (draft: {
    id?: string
    name: string
    description?: string
    transport: 'streamable-http' | 'stdio'
    enabled?: boolean
    url?: string
    command?: string
    args?: string[]
    cwd?: string
    headers?: Record<string, string>
    env?: Record<string, string>
  }) => electronAPI.ipcRenderer.invoke('app:save-mcp-server', draft),
  deleteMcpServer: (serverId: string) => electronAPI.ipcRenderer.invoke('app:delete-mcp-server', serverId),
  testMcpServer: (serverId: string) => electronAPI.ipcRenderer.invoke('app:test-mcp-server', serverId),
  listMcpTools: (serverId: string) => electronAPI.ipcRenderer.invoke('app:list-mcp-tools', serverId),
  callMcpTool: (payload: {
    serverId: string
    toolName: string
    arguments?: Record<string, unknown>
  }) => electronAPI.ipcRenderer.invoke('app:call-mcp-tool', payload),
  listMcpRuns: () => electronAPI.ipcRenderer.invoke('app:list-mcp-runs'),
  openSkillFolder: (skillPath: string) => electronAPI.ipcRenderer.invoke('codex:open-skill-folder', skillPath),
  deleteSkillFolder: (skillPath: string) => electronAPI.ipcRenderer.invoke('codex:delete-skill-folder', skillPath)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
