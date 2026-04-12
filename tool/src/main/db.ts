import { promises as fs } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'

export type ScriptRecord = {
  id: string
  scriptName: string
  description: string
  content: string
  type: string
}

export type UserEnvironmentManifestRecord = {
  name: string
  type: string
  value: string
  status: 'enabled' | 'disabled'
}

export type AppSettingsRecord = {
  httpProxy: string
}

export type JiraSettingsRecord = {
  apiPrefix: string
  token: string
}

export type ApiHttpMethod = 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE'
export type ApiBodyMode = 'json' | 'none' | 'text'

export type ApiKeyValueRecord = {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type ApiResponseRecord = {
  status: number | null
  statusText: string
  durationMs: number
  headers: ApiKeyValueRecord[]
  bodyText: string
  bodyJson: unknown | null
  requestedAt: string
  ok: boolean
  error: string | null
}

export type ApiRequestSnapshotRecord = {
  method: ApiHttpMethod
  url: string
  params: ApiKeyValueRecord[]
  headers: ApiKeyValueRecord[]
  bodyMode: ApiBodyMode
  bodyText: string
}

export type ApiHistoryRecord = {
  id: string
  type: 'history'
  name: string
  request: ApiRequestSnapshotRecord
  response: ApiResponseRecord
}

export type ApiRequestRecord = {
  id: string
  type: 'request'
  name: string
  method: ApiHttpMethod
  url: string
  params: ApiKeyValueRecord[]
  headers: ApiKeyValueRecord[]
  bodyMode: ApiBodyMode
  bodyText: string
  response: ApiResponseRecord | null
  histories: ApiHistoryRecord[]
}

export type ApiFolderRecord = {
  id: string
  type: 'folder'
  name: string
  children: ApiTreeNodeRecord[]
}

export type ApiTreeNodeRecord = ApiFolderRecord | ApiRequestRecord

export type ApiWorkspaceRecord = {
  nodes: ApiTreeNodeRecord[]
}

export type McpServerStoredRecord = {
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
  status: 'error' | 'online' | 'untested'
  toolCount: number
  transport: 'streamable-http' | 'stdio'
  url: string
}

export type McpRunStoredRecord = {
  arguments: Record<string, unknown>
  durationMs: number
  error: string | null
  id: string
  preview: string
  result: unknown
  serverId: string
  serverName: string
  startedAt: string
  status: 'error' | 'success'
  toolName: string
}

let cachedDatabase: DatabaseSync | null = null
let databaseInitPromise: Promise<DatabaseSync> | null = null

function getDataDirectory(root: string): string {
  return join(root, 'data')
}

function getDatabasePath(root: string): string {
  return join(getDataDirectory(root), 'tool.db')
}

function parseJsonValue<T>(value: string | null, fallbackValue: T): T {
  if (!value) {
    return fallbackValue
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallbackValue
  }
}

function serializeJsonValue(value: unknown): string {
  return JSON.stringify(value ?? null)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeApiHttpMethod(value: unknown): ApiHttpMethod {
  if (
    value === 'POST' ||
    value === 'PUT' ||
    value === 'PATCH' ||
    value === 'DELETE' ||
    value === 'HEAD' ||
    value === 'OPTIONS' ||
    value === 'TRACE' ||
    value === 'CONNECT'
  ) {
    return value
  }

  return 'GET'
}

function normalizeApiBodyMode(value: unknown): ApiBodyMode {
  if (value === 'json' || value === 'text') {
    return value
  }

  return 'none'
}

function normalizeApiKeyValueRecord(entry: unknown): ApiKeyValueRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const source = entry as Partial<ApiKeyValueRecord>

  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID(),
    key: typeof source.key === 'string' ? source.key : '',
    value: typeof source.value === 'string' ? source.value : '',
    enabled: source.enabled !== false
  }
}

function normalizeApiResponseRecord(entry: unknown): ApiResponseRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const source = entry as Partial<ApiResponseRecord>

  return {
    status: typeof source.status === 'number' ? source.status : null,
    statusText: typeof source.statusText === 'string' ? source.statusText : '',
    durationMs: typeof source.durationMs === 'number' ? source.durationMs : 0,
    headers: Array.isArray(source.headers)
      ? source.headers
          .map((item) => normalizeApiKeyValueRecord(item))
          .filter((item): item is ApiKeyValueRecord => Boolean(item))
      : [],
    bodyText: typeof source.bodyText === 'string' ? source.bodyText : '',
    bodyJson: typeof source.bodyJson === 'undefined' ? null : source.bodyJson ?? null,
    requestedAt: typeof source.requestedAt === 'string' ? source.requestedAt : new Date().toISOString(),
    ok: source.ok === true,
    error: typeof source.error === 'string' ? source.error : null
  }
}

function normalizeApiRequestSnapshotRecord(entry: unknown): ApiRequestSnapshotRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const source = entry as Partial<ApiRequestSnapshotRecord>

  return {
    method: normalizeApiHttpMethod(source.method),
    url: typeof source.url === 'string' ? source.url : '',
    params: Array.isArray(source.params)
      ? source.params
          .map((item) => normalizeApiKeyValueRecord(item))
          .filter((item): item is ApiKeyValueRecord => Boolean(item))
      : [],
    headers: Array.isArray(source.headers)
      ? source.headers
          .map((item) => normalizeApiKeyValueRecord(item))
          .filter((item): item is ApiKeyValueRecord => Boolean(item))
      : [],
    bodyMode: normalizeApiBodyMode(source.bodyMode),
    bodyText: typeof source.bodyText === 'string' ? source.bodyText : ''
  }
}

function normalizeApiHistoryRecord(entry: unknown): ApiHistoryRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const source = entry as Partial<ApiHistoryRecord>
  const request = normalizeApiRequestSnapshotRecord(source.request)
  const response = normalizeApiResponseRecord(source.response)

  if (!request || !response) {
    return null
  }

  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID(),
    type: 'history',
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Request History',
    request,
    response
  }
}

function normalizeApiTreeNodeRecord(entry: unknown): ApiTreeNodeRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const source = entry as Partial<ApiFolderRecord> & Partial<ApiRequestRecord>

  if (source.type === 'folder') {
    return {
      id: typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID(),
      type: 'folder',
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Untitled Folder',
      children: Array.isArray(source.children)
        ? source.children
            .map((item) => normalizeApiTreeNodeRecord(item))
            .filter((item): item is ApiTreeNodeRecord => Boolean(item))
        : []
    }
  }

  if (source.type === 'request') {
    return {
      id: typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID(),
      type: 'request',
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Untitled Request',
      method: normalizeApiHttpMethod(source.method),
      url: typeof source.url === 'string' ? source.url : '',
      params: Array.isArray(source.params)
        ? source.params
            .map((item) => normalizeApiKeyValueRecord(item))
            .filter((item): item is ApiKeyValueRecord => Boolean(item))
        : [],
      headers: Array.isArray(source.headers)
        ? source.headers
            .map((item) => normalizeApiKeyValueRecord(item))
            .filter((item): item is ApiKeyValueRecord => Boolean(item))
        : [],
      bodyMode: normalizeApiBodyMode(source.bodyMode),
      bodyText: typeof source.bodyText === 'string' ? source.bodyText : '',
      response: normalizeApiResponseRecord(source.response),
      histories: Array.isArray(source.histories)
        ? source.histories
            .map((item) => normalizeApiHistoryRecord(item))
            .filter((item): item is ApiHistoryRecord => Boolean(item))
        : []
    }
  }

  return null
}

function createDatabaseSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      script_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_environment_manifest (
      name TEXT PRIMARY KEY COLLATE NOCASE,
      type TEXT NOT NULL DEFAULT '',
      value TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_folders (
      id TEXT PRIMARY KEY,
      parent_folder_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_requests (
      id TEXT PRIMARY KEY,
      parent_folder_id TEXT,
      name TEXT NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      body_mode TEXT NOT NULL,
      body_text TEXT NOT NULL,
      response_json TEXT,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_request_kv (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      section TEXT NOT NULL,
      key_name TEXT NOT NULL,
      value_text TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_request_histories (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      name TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL,
      description TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      url TEXT NOT NULL,
      args_json TEXT NOT NULL,
      env_json TEXT NOT NULL,
      headers_json TEXT NOT NULL,
      last_checked_at TEXT,
      last_error TEXT,
      server_label TEXT,
      status TEXT NOT NULL,
      tool_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_runs (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      arguments_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      preview TEXT NOT NULL,
      started_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      error TEXT,
      status TEXT NOT NULL
    );
  `)
}

function ensureScriptsTableShape(database: DatabaseSync): void {
  const columns = database.prepare(`PRAGMA table_info(scripts)`).all() as Array<{ name?: string }>
  const hasSortOrderColumn = columns.some((column) => column.name === 'sort_order')
  const hasTypeColumn = columns.some((column) => column.name === 'type')

  if (!hasTypeColumn) {
    database.exec(`ALTER TABLE scripts ADD COLUMN type TEXT NOT NULL DEFAULT ''`)
  }

  if (hasSortOrderColumn) {
    return
  }

  // 旧库升级时补齐 sort_order，并按现有名字顺序初始化，保证拖拽排序有稳定的初始基线。
  database.exec(`ALTER TABLE scripts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)

  const rows = database
    .prepare(`SELECT id FROM scripts ORDER BY script_name COLLATE NOCASE ASC, created_at ASC, id ASC`)
    .all() as Array<{ id: string }>
  const updateStatement = database.prepare(`UPDATE scripts SET sort_order = ? WHERE id = ?`)

  database.exec('BEGIN')

  try {
    rows.forEach((row, index) => {
      updateStatement.run(index, row.id)
    })
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

function ensureUserEnvironmentManifestTableShape(database: DatabaseSync): void {
  const columns = database.prepare(`PRAGMA table_info(user_environment_manifest)`).all() as Array<{ name?: string }>
  const hasTypeColumn = columns.some((column) => column.name === 'type')

  if (!hasTypeColumn) {
    database.exec(`ALTER TABLE user_environment_manifest ADD COLUMN type TEXT NOT NULL DEFAULT ''`)
  }
}

function getRowCount(database: DatabaseSync, tableName: string): number {
  const statement = database.prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
  const row = statement.get() as { count?: number }
  return typeof row.count === 'number' ? row.count : 0
}

function writeKvValue(database: DatabaseSync, key: string, value: unknown): void {
  const statement = database.prepare(`
    INSERT INTO kv_store (key, value_json)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `)

  statement.run(key, serializeJsonValue(value))
}

function readKvValue<T>(database: DatabaseSync, key: string): T | null {
  const statement = database.prepare('SELECT value_json FROM kv_store WHERE key = ?')
  const row = statement.get(key) as { value_json?: string } | undefined

  if (!row || typeof row.value_json !== 'string') {
    return null
  }

  return parseJsonValue<T | null>(row.value_json, null)
}

function writeApiWorkspaceSync(database: DatabaseSync, workspace: ApiWorkspaceRecord): ApiWorkspaceRecord {
  const normalizedWorkspace = {
    nodes: workspace.nodes
      .map((node) => normalizeApiTreeNodeRecord(node))
      .filter((node): node is ApiTreeNodeRecord => Boolean(node))
  }

  database.exec('BEGIN')

  try {
    database.exec(`
      DELETE FROM api_request_histories;
      DELETE FROM api_request_kv;
      DELETE FROM api_requests;
      DELETE FROM api_folders;
    `)

    const insertFolder = database.prepare(`
      INSERT INTO api_folders (id, parent_folder_id, name, sort_order)
      VALUES (?, ?, ?, ?)
    `)
    const insertRequest = database.prepare(`
      INSERT INTO api_requests (id, parent_folder_id, name, method, url, body_mode, body_text, response_json, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertKv = database.prepare(`
      INSERT INTO api_request_kv (id, request_id, section, key_name, value_text, enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertHistory = database.prepare(`
      INSERT INTO api_request_histories (id, request_id, name, request_json, response_json, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const persistNodes = (nodes: ApiTreeNodeRecord[], parentFolderId: string | null): void => {
      nodes.forEach((node, index) => {
        if (node.type === 'folder') {
          insertFolder.run(node.id, parentFolderId, node.name, index)
          persistNodes(node.children, node.id)
          return
        }

        insertRequest.run(
          node.id,
          parentFolderId,
          node.name,
          node.method,
          node.url,
          node.bodyMode,
          node.bodyText,
          node.response ? serializeJsonValue(node.response) : null,
          index
        )

        node.params.forEach((entry, entryIndex) => {
          insertKv.run(entry.id, node.id, 'params', entry.key, entry.value, entry.enabled ? 1 : 0, entryIndex)
        })

        node.headers.forEach((entry, entryIndex) => {
          insertKv.run(entry.id, node.id, 'headers', entry.key, entry.value, entry.enabled ? 1 : 0, entryIndex)
        })

        node.histories.forEach((entry, entryIndex) => {
          insertHistory.run(
            entry.id,
            node.id,
            entry.name,
            serializeJsonValue(entry.request),
            serializeJsonValue(entry.response),
            entryIndex
          )
        })
      })
    }

    persistNodes(normalizedWorkspace.nodes, null)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return normalizedWorkspace
}

function readApiWorkspaceSync(database: DatabaseSync): ApiWorkspaceRecord | null {
  const folderRows = database
    .prepare('SELECT id, parent_folder_id, name, sort_order FROM api_folders ORDER BY sort_order ASC')
    .all() as Array<{ id: string; parent_folder_id: string | null; name: string; sort_order: number }>
  const requestRows = database
    .prepare(
      'SELECT id, parent_folder_id, name, method, url, body_mode, body_text, response_json, sort_order FROM api_requests ORDER BY sort_order ASC'
    )
    .all() as Array<{
      id: string
      parent_folder_id: string | null
      name: string
      method: ApiHttpMethod
      url: string
      body_mode: ApiBodyMode
      body_text: string
      response_json: string | null
      sort_order: number
    }>

  if (folderRows.length === 0 && requestRows.length === 0) {
    return null
  }

  const kvRows = database
    .prepare(
      'SELECT id, request_id, section, key_name, value_text, enabled, sort_order FROM api_request_kv ORDER BY sort_order ASC'
    )
    .all() as Array<{
      id: string
      request_id: string
      section: 'headers' | 'params'
      key_name: string
      value_text: string
      enabled: number
      sort_order: number
    }>

  const historyRows = database
    .prepare(
      'SELECT id, request_id, name, request_json, response_json, sort_order FROM api_request_histories ORDER BY sort_order ASC'
    )
    .all() as Array<{
      id: string
      request_id: string
      name: string
      request_json: string
      response_json: string
      sort_order: number
    }>

  const kvByRequest = new Map<string, { headers: ApiKeyValueRecord[]; params: ApiKeyValueRecord[] }>()

  kvRows.forEach((row) => {
    const currentGroup = kvByRequest.get(row.request_id) ?? { headers: [], params: [] }
    const record: ApiKeyValueRecord = {
      id: row.id,
      key: row.key_name,
      value: row.value_text,
      enabled: row.enabled === 1
    }

    currentGroup[row.section].push(record)
    kvByRequest.set(row.request_id, currentGroup)
  })

  const historiesByRequest = new Map<string, ApiHistoryRecord[]>()

  historyRows.forEach((row) => {
    const currentGroup = historiesByRequest.get(row.request_id) ?? []
    const request = normalizeApiRequestSnapshotRecord(parseJsonValue(row.request_json, null))
    const response = normalizeApiResponseRecord(parseJsonValue(row.response_json, null))

    if (!request || !response) {
      return
    }

    currentGroup.push({
      id: row.id,
      type: 'history',
      name: row.name,
      request,
      response
    })

    historiesByRequest.set(row.request_id, currentGroup)
  })

  const folderChildren = new Map<string | null, Array<{ sortOrder: number; node: ApiTreeNodeRecord }>>()

  const appendNode = (parentFolderId: string | null, sortOrder: number, node: ApiTreeNodeRecord): void => {
    const currentNodes = folderChildren.get(parentFolderId) ?? []
    currentNodes.push({ sortOrder, node })
    folderChildren.set(parentFolderId, currentNodes)
  }

  folderRows.forEach((row) => {
    appendNode(row.parent_folder_id, row.sort_order, {
      id: row.id,
      type: 'folder',
      name: row.name,
      children: []
    })
  })

  requestRows.forEach((row) => {
    const kvGroup = kvByRequest.get(row.id) ?? { headers: [], params: [] }
    appendNode(row.parent_folder_id, row.sort_order, {
      id: row.id,
      type: 'request',
      name: row.name,
      method: normalizeApiHttpMethod(row.method),
      url: row.url,
      params: kvGroup.params,
      headers: kvGroup.headers,
      bodyMode: normalizeApiBodyMode(row.body_mode),
      bodyText: row.body_text,
      response: normalizeApiResponseRecord(parseJsonValue(row.response_json, null)),
      histories: historiesByRequest.get(row.id) ?? []
    })
  })

  const buildNodes = (parentFolderId: string | null): ApiTreeNodeRecord[] => {
    const currentNodes = folderChildren.get(parentFolderId) ?? []

    return currentNodes
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => {
        if (entry.node.type === 'folder') {
          return {
            ...entry.node,
            children: buildNodes(entry.node.id)
          }
        }

        return entry.node
      })
  }

  return {
    nodes: buildNodes(null)
  }
}

async function migrateScriptsIfNeeded(root: string, database: DatabaseSync): Promise<void> {
  if (getRowCount(database, 'scripts') > 0) {
    return
  }

  const filePath = join(root, 'data', 'script', 'scripts.json')
  const rawEntries = await readJsonFile<unknown[]>(filePath)

  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return
  }

  const insertStatement = database.prepare(`
    INSERT OR REPLACE INTO scripts (id, script_name, description, content, type, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const timestamp = new Date().toISOString()

  database.exec('BEGIN')

  try {
    rawEntries.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return
      }

      const source = entry as Partial<ScriptRecord>
      const scriptName = typeof source.scriptName === 'string' ? source.scriptName.trim() : ''

      if (!scriptName) {
        return
      }

      insertStatement.run(
        typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID(),
        scriptName,
        typeof source.description === 'string' ? source.description : '',
        typeof source.content === 'string' ? source.content : '',
        typeof source.type === 'string' ? source.type : '',
        index,
        timestamp,
        timestamp
      )
    })

    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

async function migrateUserEnvironmentIfNeeded(root: string, database: DatabaseSync): Promise<void> {
  if (getRowCount(database, 'user_environment_manifest') > 0) {
    return
  }

  const filePath = join(root, 'data', 'userEnvrioment', 'variables.json')
  const rawEntries = await readJsonFile<unknown[]>(filePath)

  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return
  }

  const insertStatement = database.prepare(`
    INSERT OR REPLACE INTO user_environment_manifest (name, type, value, status)
    VALUES (?, ?, ?, ?)
  `)

  database.exec('BEGIN')

  try {
    rawEntries.forEach((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return
      }

      const source = entry as Partial<UserEnvironmentManifestRecord>
      const name = typeof source.name === 'string' ? source.name.trim() : ''

      if (!name) {
        return
      }

      insertStatement.run(
        name,
        typeof source.type === 'string' ? source.type : '',
        typeof source.value === 'string' ? source.value : '',
        source.status === 'enabled' ? 'enabled' : 'disabled'
      )
    })

    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

async function migrateKvStoreIfNeeded(root: string, database: DatabaseSync): Promise<void> {
  const hasAppSettings = readKvValue<AppSettingsRecord>(database, 'app_settings')
  const hasJiraSettings = readKvValue<JiraSettingsRecord>(database, 'jira_settings')

  if (!hasAppSettings) {
    const settingsFile = join(root, 'data', 'setting', 'settings.json')
    const rawSettings = await readJsonFile<Partial<AppSettingsRecord>>(settingsFile)
    writeKvValue(database, 'app_settings', {
      httpProxy: typeof rawSettings?.httpProxy === 'string' ? rawSettings.httpProxy : ''
    })
  }

  if (!hasJiraSettings) {
    const jiraFile = join(root, 'data', 'jira', 'jira.json')
    const rawSettings = await readJsonFile<Partial<JiraSettingsRecord> & { apiUrl?: string }>(jiraFile)
    const apiPrefix = typeof rawSettings?.apiPrefix === 'string' ? rawSettings.apiPrefix : rawSettings?.apiUrl

    if (typeof apiPrefix === 'string' && typeof rawSettings?.token === 'string') {
      writeKvValue(database, 'jira_settings', {
        apiPrefix,
        token: rawSettings.token
      })
    }
  }
}

async function migrateApiWorkspaceIfNeeded(root: string, database: DatabaseSync): Promise<void> {
  if (getRowCount(database, 'api_folders') > 0 || getRowCount(database, 'api_requests') > 0) {
    return
  }

  const filePath = join(root, 'data', 'api', 'apis.json')
  const rawWorkspace = await readJsonFile<Partial<ApiWorkspaceRecord>>(filePath)

  if (!rawWorkspace || !Array.isArray(rawWorkspace.nodes)) {
    return
  }

  const normalizedWorkspace = {
    nodes: rawWorkspace.nodes
      .map((node) => normalizeApiTreeNodeRecord(node))
      .filter((node): node is ApiTreeNodeRecord => Boolean(node))
  }

  if (normalizedWorkspace.nodes.length === 0) {
    return
  }

  writeApiWorkspaceSync(database, normalizedWorkspace)
}

async function migrateMcpDataIfNeeded(root: string, database: DatabaseSync): Promise<void> {
  if (getRowCount(database, 'mcp_servers') === 0) {
    const serversFile = join(root, 'data', 'mcp', 'servers.json')
    const rawServers = await readJsonFile<unknown[]>(serversFile)

    if (Array.isArray(rawServers)) {
      const insertStatement = database.prepare(`
        INSERT OR REPLACE INTO mcp_servers (
          id, name, transport, description, enabled, command, cwd, url,
          args_json, env_json, headers_json, last_checked_at, last_error,
          server_label, status, tool_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      database.exec('BEGIN')

      try {
        rawServers.forEach((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return
          }

          const source = entry as Partial<McpServerStoredRecord>
          const id = typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID()
          const name = typeof source.name === 'string' ? source.name.trim() : ''

          if (!name) {
            return
          }

          insertStatement.run(
            id,
            name,
            source.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
            typeof source.description === 'string' ? source.description : '',
            source.enabled === false ? 0 : 1,
            typeof source.command === 'string' ? source.command : '',
            typeof source.cwd === 'string' ? source.cwd : '',
            typeof source.url === 'string' ? source.url : '',
            serializeJsonValue(Array.isArray(source.args) ? source.args : []),
            serializeJsonValue(source.env && typeof source.env === 'object' ? source.env : {}),
            serializeJsonValue(source.headers && typeof source.headers === 'object' ? source.headers : {}),
            typeof source.lastCheckedAt === 'string' ? source.lastCheckedAt : null,
            typeof source.lastError === 'string' ? source.lastError : null,
            typeof source.serverLabel === 'string' ? source.serverLabel : null,
            source.status === 'online' || source.status === 'error' ? source.status : 'untested',
            typeof source.toolCount === 'number' ? source.toolCount : 0
          )
        })

        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    }
  }

  if (getRowCount(database, 'mcp_runs') === 0) {
    const runsFile = join(root, 'data', 'mcp', 'runs.json')
    const rawRuns = await readJsonFile<unknown[]>(runsFile)

    if (Array.isArray(rawRuns)) {
      const insertStatement = database.prepare(`
        INSERT OR REPLACE INTO mcp_runs (
          id, server_id, server_name, tool_name, arguments_json, result_json,
          preview, started_at, duration_ms, error, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      database.exec('BEGIN')

      try {
        rawRuns.forEach((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return
          }

          const source = entry as Partial<McpRunStoredRecord>
          const id = typeof source.id === 'string' && source.id.trim() ? source.id : crypto.randomUUID()
          const serverId = typeof source.serverId === 'string' ? source.serverId : ''
          const serverName = typeof source.serverName === 'string' ? source.serverName : ''
          const toolName = typeof source.toolName === 'string' ? source.toolName : ''

          if (!serverId || !serverName || !toolName) {
            return
          }

          insertStatement.run(
            id,
            serverId,
            serverName,
            toolName,
            serializeJsonValue(source.arguments && typeof source.arguments === 'object' ? source.arguments : {}),
            serializeJsonValue(typeof source.result === 'undefined' ? null : source.result),
            typeof source.preview === 'string' ? source.preview : '',
            typeof source.startedAt === 'string' ? source.startedAt : new Date().toISOString(),
            typeof source.durationMs === 'number' ? source.durationMs : 0,
            typeof source.error === 'string' ? source.error : null,
            source.status === 'error' ? 'error' : 'success'
          )
        })

        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    }
  }
}

async function initializeDatabase(root: string): Promise<DatabaseSync> {
  await fs.mkdir(getDataDirectory(root), { recursive: true })
  const database = new DatabaseSync(getDatabasePath(root))

  createDatabaseSchema(database)
  ensureScriptsTableShape(database)
  ensureUserEnvironmentManifestTableShape(database)

  await migrateScriptsIfNeeded(root, database)
  await migrateUserEnvironmentIfNeeded(root, database)
  await migrateKvStoreIfNeeded(root, database)
  await migrateApiWorkspaceIfNeeded(root, database)
  await migrateMcpDataIfNeeded(root, database)

  return database
}

async function getDatabase(root: string): Promise<DatabaseSync> {
  if (cachedDatabase) {
    return cachedDatabase
  }

  if (!databaseInitPromise) {
    databaseInitPromise = initializeDatabase(root).then((database) => {
      cachedDatabase = database
      return database
    })
  }

  return databaseInitPromise
}

export async function listScriptsFromDb(root: string): Promise<ScriptRecord[]> {
  const database = await getDatabase(root)
  const rows = database
    .prepare(
      'SELECT id, script_name, description, content, type FROM scripts ORDER BY sort_order ASC, script_name COLLATE NOCASE ASC'
    )
    .all() as Array<{ id: string; script_name: string; description: string; content: string; type: string }>

  return rows.map((row) => ({
    id: row.id,
    scriptName: row.script_name,
    description: row.description,
    content: row.content,
    type: row.type
  }))
}

export async function insertScriptToDb(root: string, script: ScriptRecord): Promise<ScriptRecord> {
  const database = await getDatabase(root)
  const now = new Date().toISOString()
  const nextSortOrderRow = database.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM scripts').get() as {
    next_order?: number
  }
  const statement = database.prepare(`
    INSERT INTO scripts (id, script_name, description, content, type, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  statement.run(
    script.id,
    script.scriptName,
    script.description,
    script.content,
    script.type,
    typeof nextSortOrderRow.next_order === 'number' ? nextSortOrderRow.next_order : 0,
    now,
    now
  )
  return script
}

export async function updateScriptInDb(root: string, script: ScriptRecord): Promise<ScriptRecord> {
  const database = await getDatabase(root)
  const statement = database.prepare(`
    UPDATE scripts
    SET script_name = ?, description = ?, content = ?, type = ?, updated_at = ?
    WHERE id = ?
  `)

  const result = statement.run(
    script.scriptName,
    script.description,
    script.content,
    script.type,
    new Date().toISOString(),
    script.id
  ) as {
    changes?: number
  }

  if (!result.changes) {
    throw new Error('Script was not found.')
  }

  return script
}

export async function deleteScriptFromDb(root: string, scriptId: string): Promise<void> {
  const database = await getDatabase(root)
  const statement = database.prepare('DELETE FROM scripts WHERE id = ?')
  const result = statement.run(scriptId) as { changes?: number }

  if (!result.changes) {
    throw new Error('Script was not found.')
  }
}

export async function reorderScriptsInDb(root: string, orderedScriptIds: string[]): Promise<void> {
  const database = await getDatabase(root)
  const rows = database.prepare('SELECT id FROM scripts ORDER BY sort_order ASC, script_name COLLATE NOCASE ASC').all() as Array<{
    id: string
  }>
  const existingIds = rows.map((row) => row.id)

  if (existingIds.length !== orderedScriptIds.length) {
    throw new Error('Script reorder payload is invalid.')
  }

  const existingIdSet = new Set(existingIds)

  if (orderedScriptIds.some((scriptId) => !existingIdSet.has(scriptId))) {
    throw new Error('Script reorder payload contains an unknown script.')
  }

  const updateStatement = database.prepare('UPDATE scripts SET sort_order = ?, updated_at = ? WHERE id = ?')
  const timestamp = new Date().toISOString()

  // 拖拽排序只更新 sort_order，不改业务字段，避免保存顺序时覆盖其他内容。
  database.exec('BEGIN')

  try {
    orderedScriptIds.forEach((scriptId, index) => {
      updateStatement.run(index, timestamp, scriptId)
    })
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export async function readUserEnvironmentManifestFromDb(root: string): Promise<UserEnvironmentManifestRecord[]> {
  const database = await getDatabase(root)
  const rows = database
    .prepare('SELECT name, type, value, status FROM user_environment_manifest ORDER BY name COLLATE NOCASE ASC')
    .all() as Array<{ name: string; type: string; value: string; status: 'enabled' | 'disabled' }>

  return rows.map((row) => ({
    name: row.name,
    type: row.type,
    value: row.value,
    status: row.status === 'enabled' ? 'enabled' : 'disabled'
  }))
}

export async function writeUserEnvironmentManifestToDb(
  root: string,
  entries: UserEnvironmentManifestRecord[]
): Promise<UserEnvironmentManifestRecord[]> {
  const database = await getDatabase(root)
  const normalizedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name, 'en'))
  const insertStatement = database.prepare(`
    INSERT OR REPLACE INTO user_environment_manifest (name, type, value, status)
    VALUES (?, ?, ?, ?)
  `)

  database.exec('BEGIN')

  try {
    database.exec('DELETE FROM user_environment_manifest')
    normalizedEntries.forEach((entry) => {
      insertStatement.run(entry.name, entry.type, entry.value, entry.status)
    })
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return normalizedEntries
}

export async function readAppSettingsFromDb(root: string): Promise<AppSettingsRecord> {
  const database = await getDatabase(root)
  return readKvValue<AppSettingsRecord>(database, 'app_settings') ?? { httpProxy: '' }
}

export async function writeAppSettingsToDb(root: string, settings: AppSettingsRecord): Promise<AppSettingsRecord> {
  const database = await getDatabase(root)
  writeKvValue(database, 'app_settings', settings)
  return settings
}

export async function readJiraSettingsFromDb(root: string): Promise<JiraSettingsRecord | null> {
  const database = await getDatabase(root)
  return readKvValue<JiraSettingsRecord>(database, 'jira_settings')
}

export async function writeJiraSettingsToDb(root: string, settings: JiraSettingsRecord): Promise<void> {
  const database = await getDatabase(root)
  writeKvValue(database, 'jira_settings', settings)
}

export async function readApiWorkspaceFromDb(root: string): Promise<ApiWorkspaceRecord | null> {
  const database = await getDatabase(root)
  return readApiWorkspaceSync(database)
}

export async function writeApiWorkspaceToDb(root: string, workspace: ApiWorkspaceRecord): Promise<ApiWorkspaceRecord> {
  const database = await getDatabase(root)
  return writeApiWorkspaceSync(database, workspace)
}

export async function readMcpServersFromDb(root: string): Promise<McpServerStoredRecord[]> {
  const database = await getDatabase(root)
  const rows = database
    .prepare(`
      SELECT
        id, name, transport, description, enabled, command, cwd, url,
        args_json, env_json, headers_json, last_checked_at, last_error,
        server_label, status, tool_count
      FROM mcp_servers
      ORDER BY name COLLATE NOCASE ASC
    `)
    .all() as Array<{
      id: string
      name: string
      transport: 'streamable-http' | 'stdio'
      description: string
      enabled: number
      command: string
      cwd: string
      url: string
      args_json: string
      env_json: string
      headers_json: string
      last_checked_at: string | null
      last_error: string | null
      server_label: string | null
      status: 'error' | 'online' | 'untested'
      tool_count: number
    }>

  return rows.map((row) => ({
    args: parseJsonValue<string[]>(row.args_json, []),
    command: row.command,
    cwd: row.cwd,
    description: row.description,
    enabled: row.enabled === 1,
    env: parseJsonValue<Record<string, string>>(row.env_json, {}),
    headers: parseJsonValue<Record<string, string>>(row.headers_json, {}),
    id: row.id,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    name: row.name,
    serverLabel: row.server_label,
    status: row.status,
    toolCount: row.tool_count,
    transport: row.transport,
    url: row.url
  }))
}

export async function writeMcpServersToDb(root: string, servers: McpServerStoredRecord[]): Promise<void> {
  const database = await getDatabase(root)
  const insertStatement = database.prepare(`
    INSERT OR REPLACE INTO mcp_servers (
      id, name, transport, description, enabled, command, cwd, url,
      args_json, env_json, headers_json, last_checked_at, last_error,
      server_label, status, tool_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  database.exec('BEGIN')

  try {
    database.exec('DELETE FROM mcp_servers')
    servers.forEach((server) => {
      insertStatement.run(
        server.id,
        server.name,
        server.transport,
        server.description,
        server.enabled ? 1 : 0,
        server.command,
        server.cwd,
        server.url,
        serializeJsonValue(server.args),
        serializeJsonValue(server.env),
        serializeJsonValue(server.headers),
        server.lastCheckedAt,
        server.lastError,
        server.serverLabel,
        server.status,
        server.toolCount
      )
    })
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export async function readMcpRunsFromDb(root: string): Promise<McpRunStoredRecord[]> {
  const database = await getDatabase(root)
  const rows = database
    .prepare(`
      SELECT
        id, server_id, server_name, tool_name, arguments_json, result_json,
        preview, started_at, duration_ms, error, status
      FROM mcp_runs
      ORDER BY started_at DESC
    `)
    .all() as Array<{
      id: string
      server_id: string
      server_name: string
      tool_name: string
      arguments_json: string
      result_json: string
      preview: string
      started_at: string
      duration_ms: number
      error: string | null
      status: 'error' | 'success'
    }>

  return rows.map((row) => ({
    arguments: parseJsonValue<Record<string, unknown>>(row.arguments_json, {}),
    durationMs: row.duration_ms,
    error: row.error,
    id: row.id,
    preview: row.preview,
    result: parseJsonValue(row.result_json, null),
    serverId: row.server_id,
    serverName: row.server_name,
    startedAt: row.started_at,
    status: row.status,
    toolName: row.tool_name
  }))
}

export async function writeMcpRunsToDb(root: string, runs: McpRunStoredRecord[]): Promise<void> {
  const database = await getDatabase(root)
  const insertStatement = database.prepare(`
    INSERT OR REPLACE INTO mcp_runs (
      id, server_id, server_name, tool_name, arguments_json, result_json,
      preview, started_at, duration_ms, error, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  database.exec('BEGIN')

  try {
    database.exec('DELETE FROM mcp_runs')
    runs.forEach((run) => {
      insertStatement.run(
        run.id,
        run.serverId,
        run.serverName,
        run.toolName,
        serializeJsonValue(run.arguments),
        serializeJsonValue(run.result),
        run.preview,
        run.startedAt,
        run.durationMs,
        run.error,
        run.status
      )
    })
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}
