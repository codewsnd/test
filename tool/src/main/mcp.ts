import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { readMcpRunsFromDb, readMcpServersFromDb, writeMcpRunsToDb, writeMcpServersToDb } from './db'

export type McpServerTransport = 'streamable-http' | 'stdio'
export type McpServerStatus = 'error' | 'online' | 'untested'
export type McpRunStatus = 'error' | 'success'

export type McpServerDraft = {
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
  args?: string[]
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

export type McpCallToolPayload = {
  arguments?: Record<string, unknown>
  serverId: string
  toolName: string
}

type CreateMcpServiceOptions = {
  dataRoot: string
  fetchWithRetry: (input: string, init: RequestInit | undefined, label: string) => Promise<Response>
  getAppVersion: () => string
}

type McpConnection = {
  client: Client
  close: () => Promise<void>
}

type ActiveMcpConnection = McpConnection & {
  serverId: string
  serverLabel: string | null
}

type StoredMcpData = {
  runs: McpRunRecord[]
  servers: McpServerRecord[]
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (typeof key !== 'string' || typeof entryValue !== 'string') {
        return []
      }

      const normalizedKey = key.trim()

      if (!normalizedKey) {
        return []
      }

      return [[normalizedKey, entryValue]]
    })
  )
}

function validateHttpUrl(value: string): string {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error('MCP server URL must be a valid URL.')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('MCP server URL must use http or https.')
  }

  parsedUrl.hash = ''
  return parsedUrl.toString()
}

function normalizeServerDraft(draft: McpServerDraft): McpServerRecord {
  const name = normalizeString(draft.name)

  if (!name) {
    throw new Error('Server name is required.')
  }

  if (draft.transport !== 'streamable-http' && draft.transport !== 'stdio') {
    throw new Error('MCP transport must be streamable-http or stdio.')
  }

  const description = normalizeString(draft.description)
  const enabled = draft.enabled !== false
  const id = normalizeString(draft.id) || crypto.randomUUID()

  if (draft.transport === 'streamable-http') {
    const url = validateHttpUrl(normalizeString(draft.url))

    return {
      args: [],
      command: '',
      cwd: '',
      description,
      enabled,
      env: {},
      headers: normalizeStringRecord(draft.headers),
      id,
      lastCheckedAt: null,
      lastError: null,
      name,
      serverLabel: null,
      status: 'untested',
      toolCount: 0,
      transport: 'streamable-http',
      url
    }
  }

  const command = normalizeString(draft.command)

  if (!command) {
    throw new Error('Command is required for stdio transport.')
  }

  return {
    args: normalizeStringArray(draft.args),
    command,
    cwd: normalizeString(draft.cwd),
    description,
    enabled,
    env: normalizeStringRecord(draft.env),
    headers: {},
    id,
    lastCheckedAt: null,
    lastError: null,
    name,
    serverLabel: null,
    status: 'untested',
    toolCount: 0,
    transport: 'stdio',
    url: ''
  }
}

function normalizeJsonValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return typeof value === 'undefined' ? null : String(value)
  }
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return normalizeJsonValue(value) as Record<string, unknown>
}

function buildServerLabel(name: string | undefined, version: string | undefined): string | null {
  const normalizedName = normalizeString(name)
  const normalizedVersion = normalizeString(version)

  if (!normalizedName && !normalizedVersion) {
    return null
  }

  if (!normalizedVersion) {
    return normalizedName
  }

  return `${normalizedName || 'Server'} ${normalizedVersion}`
}

function buildRunPreview(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return typeof result === 'undefined' ? '' : String(result)
  }

  const payload = result as {
    content?: Array<{ text?: string; type?: string }>
    structuredContent?: unknown
    toolResult?: unknown
  }

  const textContent = payload.content
    ?.filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text?.trim())
    .filter((item): item is string => Boolean(item))
    .join(' ')

  if (textContent) {
    return textContent.slice(0, 220)
  }

  if (payload.structuredContent) {
    return JSON.stringify(payload.structuredContent).slice(0, 220)
  }

  if (typeof payload.toolResult !== 'undefined') {
    return JSON.stringify(payload.toolResult).slice(0, 220)
  }

  return JSON.stringify(payload).slice(0, 220)
}

function mergeServerRecord(existing: McpServerRecord | undefined, nextServer: McpServerRecord): McpServerRecord {
  return {
    ...nextServer,
    lastCheckedAt: existing?.lastCheckedAt ?? nextServer.lastCheckedAt,
    lastError: existing?.lastError ?? nextServer.lastError,
    serverLabel: existing?.serverLabel ?? nextServer.serverLabel,
    status: existing?.status ?? nextServer.status,
    toolCount: existing?.toolCount ?? nextServer.toolCount
  }
}

function buildToolSummary(schema: Record<string, unknown>): string {
  const properties = schema.properties
  const required = Array.isArray(schema.required) ? schema.required : []

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return 'No structured arguments'
  }

  const propertyCount = Object.keys(properties).length

  if (propertyCount === 0) {
    return 'No arguments'
  }

  return `${propertyCount} props / ${required.length} required`
}

function coerceEnvironment(env: Record<string, string>): Record<string, string> | undefined {
  if (Object.keys(env).length === 0) {
    return undefined
  }

  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : []))
  )

  return {
    ...inheritedEnvironment,
    ...env
  }
}

function resolveWindowsCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command
  }

  const normalized = command.trim().toLowerCase()

  if (!normalized) {
    return command
  }

  if (normalized.endsWith('.cmd') || normalized.endsWith('.exe') || normalized.endsWith('.bat')) {
    return command
  }

  if (normalized === 'npx' || normalized === 'npm' || normalized === 'pnpm') {
    return `${command}.cmd`
  }

  return command
}

export function createMcpService(options: CreateMcpServiceOptions) {
  const activeConnections = new Map<string, ActiveMcpConnection>()
  const startupLocks = new Map<string, Promise<ActiveMcpConnection>>()

  async function readStoredData(): Promise<StoredMcpData> {
    return {
      runs: await readMcpRunsFromDb(options.dataRoot),
      servers: await readMcpServersFromDb(options.dataRoot)
    }
  }

  async function writeServers(servers: McpServerRecord[]): Promise<void> {
    await writeMcpServersToDb(options.dataRoot, servers)
  }

  async function writeRuns(runs: McpRunRecord[]): Promise<void> {
    await writeMcpRunsToDb(options.dataRoot, runs)
  }

  async function listServers(): Promise<McpServerRecord[]> {
    return (await readStoredData()).servers
  }

  async function listRuns(): Promise<McpRunRecord[]> {
    return (await readStoredData()).runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt, 'en'))
  }

  async function closeActiveConnection(serverId: string): Promise<void> {
    const handledConnections = new Set<ActiveMcpConnection>()
    const pendingConnection = startupLocks.get(serverId)

    if (pendingConnection) {
      try {
        const resolvedConnection = await pendingConnection
        handledConnections.add(resolvedConnection)
        if (activeConnections.get(serverId) === resolvedConnection) {
          activeConnections.delete(serverId)
        }
        await resolvedConnection.close()
      } catch {
        // 启动失败时没有连接可关闭，这里直接忽略即可。
      }
    }

    startupLocks.delete(serverId)

    const activeConnection = activeConnections.get(serverId)

    if (activeConnection) {
      activeConnections.delete(serverId)

      if (!handledConnections.has(activeConnection)) {
        await activeConnection.close()
      }
    }
  }

  async function saveServer(draft: McpServerDraft): Promise<McpServerRecord> {
    const storedData = await readStoredData()
    const existingServer = storedData.servers.find((server) => server.id === draft.id)
    const normalizedServer = normalizeServerDraft(draft)
    const mergedServer = mergeServerRecord(existingServer, normalizedServer)
    const shouldResetLifecycle = existingServer
      ? existingServer.transport !== mergedServer.transport ||
        existingServer.command !== mergedServer.command ||
        existingServer.cwd !== mergedServer.cwd ||
        existingServer.url !== mergedServer.url ||
        JSON.stringify(existingServer.args) !== JSON.stringify(mergedServer.args) ||
        JSON.stringify(existingServer.env) !== JSON.stringify(mergedServer.env) ||
        JSON.stringify(existingServer.headers) !== JSON.stringify(mergedServer.headers)
      : false
    const nextServers = [
      ...storedData.servers.filter((server) => server.id !== mergedServer.id),
      mergedServer
    ].sort((left, right) => left.name.localeCompare(right.name, 'en'))

    await writeServers(nextServers)

    if (!mergedServer.enabled) {
      return stopServer(mergedServer.id)
    }

    if (shouldResetLifecycle) {
      await closeActiveConnection(mergedServer.id)
    }

    return startServer(mergedServer.id)
  }

  async function updateServerRecord(serverId: string, updater: (server: McpServerRecord) => McpServerRecord): Promise<McpServerRecord> {
    const storedData = await readStoredData()
    const currentServer = storedData.servers.find((server) => server.id === serverId)

    if (!currentServer) {
      throw new Error('MCP server was not found.')
    }

    const nextServer = updater(currentServer)
    const nextServers = storedData.servers
      .map((server) => (server.id === serverId ? nextServer : server))
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))

    await writeServers(nextServers)
    return nextServer
  }

  async function deleteServer(serverId: string): Promise<void> {
    await closeActiveConnection(serverId)
    const storedData = await readStoredData()
    const nextServers = storedData.servers.filter((server) => server.id !== serverId)

    await writeServers(nextServers)
  }

  function createProxyAwareFetch(serverName: string) {
    // 所有 MCP HTTP 请求统一复用主进程已有的重试和 HTTP Proxy 能力。
    return async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof URL ? input.toString() : input
      return options.fetchWithRetry(url, init, `MCP request for ${serverName}`)
    }
  }

  async function createActiveConnection(server: McpServerRecord): Promise<ActiveMcpConnection> {
    const connection = await createConnection(server)

    return {
      ...connection,
      serverId: server.id,
      serverLabel: buildServerLabel(
        connection.client.getServerVersion()?.name,
        connection.client.getServerVersion()?.version
      )
    }
  }

  async function createConnection(server: McpServerRecord): Promise<McpConnection> {
    const client = new Client({
      name: 'tool-workspace',
      version: options.getAppVersion()
    })

    let stderrOutput = ''
    let activeTransport:
      | InstanceType<typeof StreamableHTTPClientTransport>
      | InstanceType<typeof SSEClientTransport>
      | InstanceType<typeof StdioClientTransport>
      | null = null

    try {
      if (server.transport === 'stdio') {
        const transport = new StdioClientTransport({
          args: server.args,
          // Windows 下 npm/pnpm/npx 通常通过 .cmd 暴露，这里自动补齐避免 stdio server 启动失败。
          command: resolveWindowsCommand(server.command),
          cwd: server.cwd || undefined,
          env: coerceEnvironment(server.env),
          stderr: 'pipe'
        })

        transport.stderr?.on('data', (chunk) => {
          stderrOutput = `${stderrOutput}${chunk.toString()}`
          stderrOutput = stderrOutput.slice(-4000)
        })

        activeTransport = transport
        await client.connect(transport)
      } else {
        const fetch = createProxyAwareFetch(server.name)
        const requestInit: RequestInit | undefined =
          Object.keys(server.headers).length > 0 ? { headers: server.headers } : undefined

        try {
          const transport = new StreamableHTTPClientTransport(new URL(server.url), {
            fetch,
            requestInit
          })

          activeTransport = transport
          await client.connect(transport)
        } catch (streamableError) {
          const fallbackTransport = new SSEClientTransport(new URL(server.url), {
            eventSourceInit: { fetch },
            fetch,
            requestInit
          })

          activeTransport = fallbackTransport

          try {
            await client.connect(fallbackTransport)
          } catch (sseError) {
            const combinedMessage =
              sseError instanceof Error
                ? `${streamableError instanceof Error ? streamableError.message : 'Streamable HTTP failed.'} ${sseError.message}`
                : streamableError instanceof Error
                  ? streamableError.message
                  : 'Failed to connect to MCP server.'

            throw new Error(combinedMessage.trim())
          }
        }
      }

      return {
        client,
        close: async () => {
          if (!activeTransport) {
            return
          }

          try {
            await activeTransport.close()
          } catch {
            // 连接关闭失败不影响主流程，这里直接吞掉即可。
          }
        }
      }
    } catch (error) {
      if (activeTransport) {
        try {
          await activeTransport.close()
        } catch {
          // 失败时尽量关闭 transport，避免子进程或连接残留。
        }
      }

      const baseMessage = error instanceof Error ? error.message : 'Failed to connect to MCP server.'
      const stderrMessage = stderrOutput.trim()

      if (stderrMessage) {
        throw new Error(`${baseMessage} ${stderrMessage}`)
      }

      throw new Error(baseMessage)
    }
  }

  async function collectTools(client: Client, server: McpServerRecord): Promise<McpToolRecord[]> {
    const tools: McpToolRecord[] = []
    let cursor: string | undefined

    do {
      const response = await client.listTools(cursor ? { cursor } : undefined)

      tools.push(
        ...response.tools.map((tool) => ({
          description: normalizeString(tool.description),
          destructive: tool.annotations?.destructiveHint === true,
          executionMode: tool.execution?.taskSupport ?? null,
          id: `${server.id}:${tool.name}`,
          inputSchema: normalizeJsonObject(tool.inputSchema),
          name: tool.name,
          openWorld: tool.annotations?.openWorldHint === true,
          outputSchema: tool.outputSchema ? normalizeJsonObject(tool.outputSchema) : null,
          readOnly: tool.annotations?.readOnlyHint === true,
          serverId: server.id,
          serverName: server.name,
          title: normalizeString(tool.title) || tool.name
        }))
      )

      cursor = typeof response.nextCursor === 'string' ? response.nextCursor : undefined
    } while (cursor)

    return tools
  }

  async function inspectServer(server: McpServerRecord): Promise<{ serverLabel: string | null; tools: McpToolRecord[] }> {
    const connection = await createConnection(server)

    try {
      return {
        serverLabel: buildServerLabel(
          connection.client.getServerVersion()?.name,
          connection.client.getServerVersion()?.version
        ),
        tools: await collectTools(connection.client, server)
      }
    } finally {
      await connection.close()
    }
  }

  async function markServerHealthy(serverId: string, toolCount: number, serverLabel: string | null): Promise<McpServerRecord> {
    return updateServerRecord(serverId, (server) => ({
      ...server,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      serverLabel,
      status: 'online',
      toolCount
    }))
  }

  async function markServerFailed(serverId: string, errorMessage: string): Promise<McpServerRecord> {
    return updateServerRecord(serverId, (server) => ({
      ...server,
      lastCheckedAt: new Date().toISOString(),
      lastError: errorMessage,
      status: 'error'
    }))
  }

  async function markServerStopped(serverId: string): Promise<McpServerRecord> {
    return updateServerRecord(serverId, (server) => ({
      ...server,
      lastError: null,
      status: 'untested'
    }))
  }

  async function ensurePersistentConnection(server: McpServerRecord): Promise<ActiveMcpConnection> {
    if (!server.enabled) {
      throw new Error('Enable the MCP server before loading tools or running actions.')
    }

    const activeConnection = activeConnections.get(server.id)

    if (activeConnection) {
      return activeConnection
    }

    const pendingConnection = startupLocks.get(server.id)

    if (pendingConnection) {
      return pendingConnection
    }

    const startupPromise = (async () => {
      const nextConnection = await createActiveConnection(server)
      activeConnections.set(server.id, nextConnection)
      return nextConnection
    })()

    startupLocks.set(server.id, startupPromise)

    try {
      const connection = await startupPromise
      startupLocks.delete(server.id)
      return connection
    } catch (error) {
      startupLocks.delete(server.id)
      throw error
    }
  }

  async function startServer(serverId: string): Promise<McpServerRecord> {
    const servers = await listServers()
    const server = servers.find((item) => item.id === serverId)

    if (!server) {
      throw new Error('MCP server was not found.')
    }

    if (!server.enabled) {
      throw new Error('Enable the MCP server before starting it.')
    }

    try {
      const connection = await ensurePersistentConnection(server)
      const tools = await collectTools(connection.client, server)
      return markServerHealthy(server.id, tools.length, connection.serverLabel)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start MCP server.'
      await closeActiveConnection(server.id)
      await markServerFailed(server.id, message)
      throw new Error(message)
    }
  }

  async function stopServer(serverId: string): Promise<McpServerRecord> {
    await closeActiveConnection(serverId)
    return markServerStopped(serverId)
  }

  async function testServer(serverId: string): Promise<McpServerRecord> {
    const servers = await listServers()
    const server = servers.find((item) => item.id === serverId)

    if (!server) {
      throw new Error('MCP server was not found.')
    }

    try {
      if (server.enabled) {
        await closeActiveConnection(server.id)
        return startServer(server.id)
      }

      const inspection = await inspectServer(server)
      return markServerHealthy(server.id, inspection.tools.length, inspection.serverLabel)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to test MCP server.'
      await markServerFailed(server.id, message)
      throw new Error(message)
    }
  }

  async function listTools(serverId: string): Promise<McpToolRecord[]> {
    const servers = await listServers()
    const server = servers.find((item) => item.id === serverId)

    if (!server) {
      throw new Error('MCP server was not found.')
    }

    if (!server.enabled) {
      throw new Error('Enable the MCP server before loading tools.')
    }

    try {
      const connection = await ensurePersistentConnection(server)
      const tools = await collectTools(connection.client, server)
      await markServerHealthy(server.id, tools.length, connection.serverLabel)
      return tools.sort((left, right) => left.title.localeCompare(right.title, 'en'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load MCP tools.'
      await closeActiveConnection(server.id)
      await markServerFailed(server.id, message)
      throw new Error(message)
    }
  }

  async function appendRun(run: McpRunRecord): Promise<void> {
    const storedData = await readStoredData()
    const nextRuns = [run, ...storedData.runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt, 'en'))

    await writeRuns(nextRuns.slice(0, 100))
  }

  async function callTool(payload: McpCallToolPayload): Promise<McpRunRecord> {
    const servers = await listServers()
    const server = servers.find((item) => item.id === payload.serverId)

    if (!server) {
      throw new Error('MCP server was not found.')
    }

    if (!server.enabled) {
      throw new Error('Enable the MCP server before running tools.')
    }

    const startedAt = new Date().toISOString()
    const startedTime = Date.now()

    try {
      const connection = await ensurePersistentConnection(server)
      const result = await connection.client.callTool({
        arguments: normalizeJsonObject(payload.arguments),
        name: payload.toolName
      })

      const runRecord: McpRunRecord = {
        arguments: normalizeJsonObject(payload.arguments),
        durationMs: Date.now() - startedTime,
        error: null,
        id: crypto.randomUUID(),
        preview: buildRunPreview(result),
        result: normalizeJsonValue(result),
        serverId: server.id,
        serverName: server.name,
        startedAt,
        status: 'success',
        toolName: payload.toolName
      }

      await appendRun(runRecord)
      await markServerHealthy(server.id, server.toolCount, connection.serverLabel)

      return runRecord
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run MCP tool.'
      const runRecord: McpRunRecord = {
        arguments: normalizeJsonObject(payload.arguments),
        durationMs: Date.now() - startedTime,
        error: message,
        id: crypto.randomUUID(),
        preview: message,
        result: null,
        serverId: server.id,
        serverName: server.name,
        startedAt,
        status: 'error',
        toolName: payload.toolName
      }

      await appendRun(runRecord)
      await closeActiveConnection(server.id)
      await markServerFailed(server.id, message)
      throw new Error(message)
    }
  }

  async function bootstrapEnabledServers(): Promise<void> {
    const servers = await listServers()
    const enabledServers = servers.filter((server) => server.enabled)

    await Promise.allSettled(
      enabledServers.map(async (server) => {
        try {
          await startServer(server.id)
        } catch {
          // 启动阶段的错误会被写回状态；这里不阻断应用继续启动。
        }
      })
    )
  }

  async function shutdown(): Promise<void> {
    const connectionIds = new Set<string>([...activeConnections.keys(), ...startupLocks.keys()])

    await Promise.allSettled(Array.from(connectionIds).map((serverId) => closeActiveConnection(serverId)))
  }

  return {
    bootstrapEnabledServers,
    buildToolSummary,
    callTool,
    deleteServer,
    listRuns,
    listServers,
    listTools,
    saveServer,
    shutdown,
    testServer
  }
}
