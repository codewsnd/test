export type McpViewKey = 'runs' | 'servers' | 'tools'

export type McpServerTransport = 'streamable-http' | 'stdio'
export type McpServerStatus = 'error' | 'online' | 'untested'
export type McpRunStatus = 'error' | 'success'

export type McpServerDraft = {
  args?: string[]
  command?: string
  cwd?: string
  description?: string
  enabled?: boolean
  env?: Record<string, string>
  headers?: Record<string, string>
  id?: string
  name: string
  transport: McpServerTransport
  url?: string
}

export type McpServerRecord = {
  args: string[]
  command: string
  cwd: string
  description: string
  enabled: boolean
  env: Record<string, string>
  headers: Record<string, string>
  id: string
  lastCheckedAt: string | null
  lastError: string | null
  name: string
  serverLabel: string | null
  status: McpServerStatus
  toolCount: number
  transport: McpServerTransport
  url: string
}

export type McpToolRecord = {
  description: string
  destructive: boolean
  executionMode: 'forbidden' | 'optional' | 'required' | null
  id: string
  inputSchema: Record<string, unknown>
  name: string
  openWorld: boolean
  outputSchema: Record<string, unknown> | null
  readOnly: boolean
  serverId: string
  serverName: string
  title: string
}

export type McpRunRecord = {
  arguments: Record<string, unknown>
  durationMs: number
  error: string | null
  id: string
  preview: string
  result: unknown
  serverId: string
  serverName: string
  startedAt: string
  status: McpRunStatus
  toolName: string
}
