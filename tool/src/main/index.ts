import { app, shell, BrowserWindow, ipcMain, net, session } from 'electron'
import { dirname, join } from 'path'
import {
  arch,
  cpus,
  homedir,
  hostname,
  networkInterfaces,
  platform as osPlatform,
  release as osRelease,
  type as osType,
  userInfo,
  version as osVersion
} from 'os'
import { promises as fs } from 'fs'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  deleteScriptFromDb,
  insertScriptToDb,
  listScriptsFromDb,
  reorderScriptsInDb,
  readApiWorkspaceFromDb,
  readAppSettingsFromDb,
  readJiraSettingsFromDb,
  readUserEnvironmentManifestFromDb,
  updateScriptInDb,
  writeApiWorkspaceToDb,
  writeAppSettingsToDb,
  writeJiraSettingsToDb,
  writeUserEnvironmentManifestToDb
} from './db'
import { createMcpService, type McpCallToolPayload, type McpServerDraft } from './mcp'

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

type ScriptManifestEntry = {
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

type UserEnvironmentManifestEntry = {
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

const execFileAsync = promisify(execFile)
const USER_ENVIRONMENT_REGISTRY_KEY = 'HKCU\\Environment'
const API_RETRY_COUNT = 2
const PROXY_SESSION_PARTITION = 'tool-api-proxy-session'
let hostToolVersionsPromise: Promise<HostToolVersions> | null = null
let scriptShellOptionsPromise: Promise<ScriptShellOption[]> | null = null

async function getSkillMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        return getSkillMarkdownFiles(fullPath)
      }

      return entry.isFile() && entry.name === 'SKILL.md' ? [fullPath] : []
    })
  )

  return results.flat()
}

function parseFrontMatterValue(frontMatter: string, field: 'name' | 'description'): string {
  const match = frontMatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))

  if (!match) {
    return ''
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

function humanizeSkillName(rawName: string, fallbackPath: string): string {
  const source = rawName || fallbackPath.split(/[\\/]/).slice(-2, -1)[0] || 'Unnamed Skill'

  return source
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => {
      const lower = segment.toLowerCase()

      if (lower === 'api') return 'API'
      if (lower === 'mcp') return 'MCP'
      if (lower === 'openai') return 'OpenAI'
      if (lower === 'figma') return 'Figma'
      if (lower === 'codex') return 'Codex'

      return segment.charAt(0).toUpperCase() + segment.slice(1)
    })
    .join(' ')
}

async function readSkill(filePath: string, category: CodexSkill['category']): Promise<CodexSkill> {
  const content = await fs.readFile(filePath, 'utf8')
  const frontMatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const frontMatter = frontMatterMatch?.[1] ?? ''
  const rawName = parseFrontMatterValue(frontMatter, 'name')
  const description = parseFrontMatterValue(frontMatter, 'description')

  return {
    id: filePath.toLowerCase(),
    name: humanizeSkillName(rawName, filePath),
    description,
    category,
    path: filePath
  }
}

async function listCodexSkills(): Promise<CodexSkill[]> {
  const codexRoot = join(homedir(), '.codex')
  const sources: Array<{ dir: string; category: CodexSkill['category'] }> = [
    { dir: join(codexRoot, 'skills'), category: 'custom' },
    { dir: join(codexRoot, 'superpowers', 'skills'), category: 'superpower' }
  ]

  const skillGroups = await Promise.all(
    sources.map(async ({ dir, category }) => {
      try {
        const files = await getSkillMarkdownFiles(dir)
        const parsed = await Promise.all(
          files.map((filePath) =>
            readSkill(filePath, filePath.includes(`${join('skills', '.system')}`) ? 'system' : category)
          )
        )

        return parsed
      } catch {
        return []
      }
    })
  )

  return skillGroups
    .flat()
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

function normalizeScriptName(scriptName: string): string {
  return scriptName.trim().toLowerCase()
}

function normalizeOptionalType(typeValue: string | undefined): string {
  return typeof typeValue === 'string' ? typeValue.trim() : ''
}

function validateScriptName(scriptName: string): string {
  const normalized = scriptName.trim()

  if (!normalized) {
    throw new Error('Script Name is required.')
  }

  if (/[\\/\r\n]/.test(normalized)) {
    throw new Error('Script Name cannot contain path separators or line breaks.')
  }

  if (normalized.toLowerCase() === 'scripts.json') {
    throw new Error('scripts.json is reserved.')
  }

  return normalized
}

function extractScriptDescription(content: string): string {
  const firstMeaningfulLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstMeaningfulLine) {
    return 'No description available.'
  }

  return firstMeaningfulLine.length > 120
    ? `${firstMeaningfulLine.slice(0, 117)}...`
    : firstMeaningfulLine
}

function formatScriptTimestamp(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

function buildTimestampedScriptName(scriptName: string, timestamp: string, attempt: number): string {
  const extensionIndex = scriptName.lastIndexOf('.')
  const hasExtension = extensionIndex > 0
  const baseName = hasExtension ? scriptName.slice(0, extensionIndex) : scriptName
  const extension = hasExtension ? scriptName.slice(extensionIndex) : ''
  const suffix = attempt === 0 ? `-${timestamp}` : `-${timestamp}-${attempt + 1}`

  return `${baseName}${suffix}${extension}`
}

function ensureUniqueScriptName(
  entries: ScriptManifestEntry[],
  requestedScriptName: string,
  options?: {
    autoRenameOnConflict?: boolean
    excludeId?: string
  }
): string {
  const hasDuplicate = (candidateName: string): boolean =>
    entries.some(
      (entry) =>
        entry.id !== options?.excludeId && normalizeScriptName(entry.scriptName) === normalizeScriptName(candidateName)
    )

  if (!hasDuplicate(requestedScriptName)) {
    return requestedScriptName
  }

  if (!options?.autoRenameOnConflict) {
    throw new Error('A script with the same Script Name already exists.')
  }

  const timestamp = formatScriptTimestamp(new Date())
  let attempt = 0

  while (attempt < 50) {
    const candidateName = buildTimestampedScriptName(requestedScriptName, timestamp, attempt)

    if (!hasDuplicate(candidateName)) {
      return candidateName
    }

    attempt += 1
  }

  throw new Error('Failed to generate a unique Script Name.')
}

async function listScriptFiles(): Promise<ScriptFile[]> {
  const manifestEntries = await listScriptsFromDb(process.cwd())

  return manifestEntries.map((entry) => ({
    id: entry.id,
    scriptName: entry.scriptName,
    description: entry.description,
    content: entry.content,
    type: entry.type
  }))
}

async function createScriptEntry(payload: CreateScriptPayload): Promise<ScriptFile> {
  const manifestEntries = await listScriptsFromDb(process.cwd())
  const requestedScriptName = validateScriptName(payload.scriptName)
  const scriptName = ensureUniqueScriptName(manifestEntries, requestedScriptName, {
    autoRenameOnConflict: payload.autoRenameOnConflict === true
  })
  const content = payload.content ?? ''
  const description = payload.description.trim() || extractScriptDescription(content)
  const type = normalizeOptionalType(payload.type)
  const createdEntry: ScriptManifestEntry = {
    id: crypto.randomUUID(),
    scriptName,
    description,
    content,
    type
  }

  await insertScriptToDb(process.cwd(), createdEntry)

  return {
    id: createdEntry.id,
    scriptName,
    description,
    content,
    type
  }
}

async function updateScriptEntry(payload: UpdateScriptPayload): Promise<ScriptFile> {
  const manifestEntries = await listScriptsFromDb(process.cwd())
  const currentEntry = manifestEntries.find((entry) => entry.id === payload.id)

  if (!currentEntry) {
    throw new Error('Script was not found.')
  }

  const scriptName = ensureUniqueScriptName(manifestEntries, validateScriptName(payload.scriptName), {
    excludeId: payload.id
  })
  const content = payload.content ?? ''
  const description = payload.description.trim() || extractScriptDescription(content)
  const type = normalizeOptionalType(payload.type)
  const updatedEntry: ScriptManifestEntry = {
    id: currentEntry.id,
    scriptName,
    description,
    content,
    type
  }

  await updateScriptInDb(process.cwd(), updatedEntry)

  return {
    id: updatedEntry.id,
    scriptName,
    description,
    content,
    type
  }
}

async function deleteScriptEntry(scriptId: string): Promise<void> {
  await deleteScriptFromDb(process.cwd(), scriptId)
}

async function reorderScriptEntries(scriptIds: string[]): Promise<ScriptFile[]> {
  await reorderScriptsInDb(process.cwd(), scriptIds)
  return listScriptFiles()
}

function sanitizeRunnerName(scriptName: string): string {
  return scriptName.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'script'
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

async function ensureScriptRunnerDirectory(): Promise<string> {
  const directory = join(app.getPath('temp'), 'tool-script-runners')
  await fs.mkdir(directory, { recursive: true })
  return directory
}

async function commandExists(candidates: Array<{ command: string; args: string[] }>): Promise<boolean> {
  for (const candidate of candidates) {
    const output = await readCommandVersion(candidate.command, candidate.args)

    if (output !== null) {
      return true
    }
  }

  return false
}

async function readScriptShellOptions(): Promise<ScriptShellOption[]> {
  const [hasPowerShell7, hasWindowsPowerShell] = await Promise.all([
    commandExists([
      { command: 'cmd', args: ['/d', '/c', 'where pwsh'] },
      { command: 'pwsh.exe', args: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'] },
      { command: 'pwsh', args: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'] }
    ]),
    commandExists([
      { command: 'cmd', args: ['/d', '/c', 'where powershell'] },
      {
        command: 'powershell.exe',
        args: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']
      }
    ])
  ])

  return [
    { key: 'powershell7', label: 'PowerShell 7', available: hasPowerShell7 },
    { key: 'powershell', label: 'PowerShell', available: hasWindowsPowerShell },
    { key: 'cmd', label: 'CMD', available: process.platform === 'win32' }
  ]
}

function getCachedScriptShellOptions(): Promise<ScriptShellOption[]> {
  if (!scriptShellOptionsPromise) {
    // Shell 可用性属于静态环境信息，初始化后缓存即可，避免每次打开 Script 面板重复探测。
    scriptShellOptionsPromise = readScriptShellOptions()
  }

  return scriptShellOptionsPromise
}

function buildRunnerScriptContent(payload: RunScriptCommandPayload): string {
  if (payload.shell === 'cmd') {
    return [
      '@echo off',
      `title Tool Script - ${payload.scriptName}`,
      `cd /d "${process.cwd()}"`,
      'echo Running command...',
      'echo.',
      payload.command,
      'echo.',
      'echo Exit code: %ERRORLEVEL%',
      'echo.',
      'pause'
    ].join('\r\n')
  }

  return [
    `$Host.UI.RawUI.WindowTitle = 'Tool Script - ${escapePowerShellLiteral(payload.scriptName)}'`,
    `Set-Location -LiteralPath '${escapePowerShellLiteral(process.cwd())}'`,
    '',
    payload.command,
    '',
    "Write-Host ''",
    "Write-Host ('Exit code: ' + $LASTEXITCODE)",
    "Read-Host 'Press Enter to exit' | Out-Null"
  ].join('\r\n')
}

function launchDetachedProcess(command: string, args: string[]): void {
  const childProcess = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  childProcess.unref()
}

async function runScriptCommand(payload: RunScriptCommandPayload): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Script execution is only supported on Windows.')
  }

  const availableShells = await getCachedScriptShellOptions()
  const selectedShell = availableShells.find((shell) => shell.key === payload.shell)

  if (!selectedShell?.available) {
    throw new Error(`${selectedShell?.label ?? 'Selected shell'} is not available on this machine.`)
  }

  const command = payload.command.trim()

  if (!command) {
    throw new Error('Command is required.')
  }

  const runnerDirectory = await ensureScriptRunnerDirectory()
  const fileExtension = payload.shell === 'cmd' ? 'cmd' : 'ps1'
  const runnerPath = join(runnerDirectory, `${Date.now()}-${sanitizeRunnerName(payload.scriptName)}.${fileExtension}`)

  // 运行脚本时先把命令写入临时文件，再显式打开目标终端窗口，避免复杂命令的转义问题。
  await fs.writeFile(runnerPath, buildRunnerScriptContent(payload), 'utf8')

  if (payload.shell === 'cmd') {
    launchDetachedProcess('cmd.exe', ['/d', '/c', 'start', '', 'cmd.exe', '/k', runnerPath])
    return
  }

  const shellExecutable = payload.shell === 'powershell7' ? 'pwsh.exe' : 'powershell.exe'
  launchDetachedProcess('cmd.exe', [
    '/d',
    '/c',
    'start',
    '',
    shellExecutable,
    '-NoExit',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    runnerPath
  ])
}

function createApiKeyValueEntry(key: string, value: string, enabled = true): ApiKeyValueEntry {
  return {
    id: crypto.randomUUID(),
    key,
    value,
    enabled
  }
}

function isLegacyMockApiWorkspace(workspace: ApiWorkspace): boolean {
  const legacyIds = new Set([
    'folder-public-apis',
    'request-open-meteo-current',
    'request-httpbin-post',
    'folder-internal-mock',
    'request-postman-style-demo'
  ])
  const discoveredIds: string[] = []

  const collectNodeIds = (nodes: ApiTreeNode[]): void => {
    nodes.forEach((node) => {
      discoveredIds.push(node.id)

      if (node.type === 'folder') {
        collectNodeIds(node.children)
      }
    })
  }

  collectNodeIds(workspace.nodes)

  return discoveredIds.length > 0 && discoveredIds.every((id) => legacyIds.has(id))
}

async function readApiWorkspace(): Promise<ApiWorkspace> {
  const workspace = await readApiWorkspaceFromDb(process.cwd())

  if (workspace && !isLegacyMockApiWorkspace(workspace)) {
    return workspace
  }

  const emptyWorkspace: ApiWorkspace = { nodes: [] }
  await writeApiWorkspaceToDb(process.cwd(), emptyWorkspace)
  return emptyWorkspace
}

async function writeApiWorkspace(workspace: ApiWorkspace): Promise<ApiWorkspace> {
  return writeApiWorkspaceToDb(process.cwd(), workspace)
}

function buildApiUrlWithParams(urlValue: string, params: ApiKeyValueEntry[]): URL {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(urlValue)
  } catch {
    throw new Error('API URL must be a valid URL.')
  }

  params
    .filter((entry) => entry.enabled && entry.key.trim() && entry.value.trim())
    .forEach((entry) => {
      parsedUrl.searchParams.set(entry.key, entry.value)
    })

  return parsedUrl
}

function buildApiHeaders(headers: ApiKeyValueEntry[], bodyMode: ApiBodyMode): Record<string, string> {
  const normalizedHeaders = Object.fromEntries(
    headers
      .filter((entry) => entry.enabled && entry.key.trim())
      .map((entry) => [entry.key.trim(), entry.value])
  )

  if (bodyMode === 'json' && !Object.keys(normalizedHeaders).some((key) => key.toLowerCase() === 'content-type')) {
    normalizedHeaders['Content-Type'] = 'application/json'
  }

  return normalizedHeaders
}

async function sendApiRequest(request: ApiRequestEntry): Promise<ApiResponseSnapshot> {
  const url = buildApiUrlWithParams(request.url, request.params)
  const headers = buildApiHeaders(request.headers, request.bodyMode)
  const startedAt = Date.now()

  let body: string | undefined

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.bodyMode !== 'none') {
    if (request.bodyMode === 'json') {
      if (!request.bodyText.trim()) {
        body = ''
      } else {
        try {
          body = JSON.stringify(JSON.parse(request.bodyText))
        } catch {
          throw new Error('Body must be valid JSON when Body mode is JSON.')
        }
      }
    } else {
      body = request.bodyText
    }
  }

  try {
    const response = await callApiWithRetryAndOptionalProxy(
      url.toString(),
      {
        method: request.method,
        headers,
        body
      },
      {
        label: 'API request',
        requireOk: false
      }
    )
    const bodyText = await response.text()
    const contentType = response.headers.get('content-type') ?? ''
    let bodyJson: unknown | null = null

    if (bodyText.trim()) {
      if (contentType.includes('application/json')) {
        try {
          bodyJson = JSON.parse(bodyText)
        } catch {
          bodyJson = null
        }
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
      headers: Array.from(response.headers.entries()).map(([key, value]) => createApiKeyValueEntry(key, value)),
      bodyText,
      bodyJson,
      requestedAt: new Date().toISOString(),
      ok: response.ok,
      error: null
    }
  } catch (error) {
    return {
      status: null,
      statusText: '',
      durationMs: Date.now() - startedAt,
      headers: [],
      bodyText: '',
      bodyJson: null,
      requestedAt: new Date().toISOString(),
      ok: false,
      error: error instanceof Error ? error.message : 'API request failed.'
    }
  }
}

async function readUserEnvironmentManifest(): Promise<UserEnvironmentManifestEntry[]> {
  return readUserEnvironmentManifestFromDb(process.cwd())
}

async function writeUserEnvironmentManifest(entries: UserEnvironmentManifestEntry[]): Promise<void> {
  await writeUserEnvironmentManifestToDb(process.cwd(), entries)
}

function normalizeVariableName(name: string): string {
  return name.trim().toLowerCase()
}

function validateUserEnvironmentName(name: string): string {
  const normalized = name.trim()

  if (!normalized) {
    throw new Error('Variable name is required.')
  }

  if (normalized.toLowerCase() === 'path') {
    throw new Error('Path is excluded from this panel.')
  }

  if (/[=\u0000]/.test(normalized)) {
    throw new Error('Variable name cannot contain "=" or null characters.')
  }

  return normalized
}

async function runRegCommand(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('reg', args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024
  })

  if (stderr?.trim()) {
    throw new Error(stderr.trim())
  }

  return stdout.trim()
}

async function readActualUserEnvironmentVariables(): Promise<Array<{ name: string; value: string }>> {
  if (process.platform !== 'win32') {
    throw new Error('User environment scanning is only supported on Windows.')
  }

  let output = ''

  try {
    output = await runRegCommand(['query', USER_ENVIRONMENT_REGISTRY_KEY])
  } catch (error) {
    if (error instanceof Error && /unable to find/i.test(error.message)) {
      return []
    }

    throw error
  }

  if (!output) {
    return []
  }

  // 注册表查询结果按行解析，只读取当前用户的 HKCU\Environment，不触碰系统变量。
  const items = output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s+(.+?)\s{2,}(REG_[A-Z_]+)\s{2,}(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      name: match[1].trim(),
      value: match[3] ?? ''
    }))
    .filter((item) => normalizeVariableName(item.name) !== 'path')

  return items.sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

async function setUserEnvironmentVariable(name: string, value: string | null): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('User environment management is only supported on Windows.')
  }

  if (value === null) {
    try {
      await runRegCommand(['delete', USER_ENVIRONMENT_REGISTRY_KEY, '/v', name, '/f'])
    } catch (error) {
      if (error instanceof Error && /unable to find/i.test(error.message)) {
        return
      }

      throw error
    }

    return
  }

  const registryType = /%[^%]+%/.test(value) ? 'REG_EXPAND_SZ' : 'REG_SZ'
  await runRegCommand(['add', USER_ENVIRONMENT_REGISTRY_KEY, '/v', name, '/t', registryType, '/d', value, '/f'])
}

async function listUserEnvironmentVariables(): Promise<UserEnvironmentVariable[]> {
  const [actualVariables, manifestEntries] = await Promise.all([
    readActualUserEnvironmentVariables(),
    readUserEnvironmentManifest()
  ])

  const actualMap = new Map(actualVariables.map((item) => [normalizeVariableName(item.name), item]))
  const manifestMap = new Map(manifestEntries.map((entry) => [normalizeVariableName(entry.name), entry]))
  const enabledItems: UserEnvironmentVariable[] = actualVariables.map((item) => ({
    id: `enabled:${normalizeVariableName(item.name)}`,
    name: item.name,
    type: manifestMap.get(normalizeVariableName(item.name))?.type ?? '',
    value: item.value,
    status: 'enabled'
  }))

  const disabledItems: UserEnvironmentVariable[] = manifestEntries
    .filter((entry) => entry.status === 'disabled' && !actualMap.has(normalizeVariableName(entry.name)))
    .map((entry) => ({
      id: `disabled:${normalizeVariableName(entry.name)}`,
      name: entry.name,
      type: entry.type,
      value: entry.value,
      status: 'disabled'
    }))

  return [...enabledItems, ...disabledItems].sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

async function createUserEnvironmentVariable(payload: CreateUserEnvironmentPayload): Promise<UserEnvironmentVariable> {
  const name = validateUserEnvironmentName(payload.name)
  const type = normalizeOptionalType(payload.type)
  const value = payload.value ?? ''
  const [actualVariables, manifestEntries] = await Promise.all([
    readActualUserEnvironmentVariables(),
    readUserEnvironmentManifest()
  ])

  const normalizedName = normalizeVariableName(name)

  if (actualVariables.some((item) => normalizeVariableName(item.name) === normalizedName)) {
    throw new Error('A variable with the same name already exists.')
  }

  if (manifestEntries.some((entry) => normalizeVariableName(entry.name) === normalizedName)) {
    throw new Error('A managed variable with the same name already exists.')
  }

  await setUserEnvironmentVariable(name, value)
  await writeUserEnvironmentManifest(
    [
      ...manifestEntries,
      { name, type, value, status: 'enabled' as const }
    ].sort((left, right) => left.name.localeCompare(right.name, 'en'))
  )

  return {
    id: `enabled:${normalizedName}`,
    name,
    type,
    value,
    status: 'enabled'
  }
}

async function updateUserEnvironmentVariable(payload: UpdateUserEnvironmentPayload): Promise<UserEnvironmentVariable> {
  const originalName = validateUserEnvironmentName(payload.originalName)
  const nextName = validateUserEnvironmentName(payload.name)
  const nextType = normalizeOptionalType(payload.type)
  const nextValue = payload.value ?? ''
  const normalizedOriginalName = normalizeVariableName(originalName)
  const normalizedNextName = normalizeVariableName(nextName)
  const [actualVariables, manifestEntries] = await Promise.all([
    readActualUserEnvironmentVariables(),
    readUserEnvironmentManifest()
  ])
  const actualVariable = actualVariables.find((item) => normalizeVariableName(item.name) === normalizedOriginalName)
  const manifestEntry = manifestEntries.find((entry) => normalizeVariableName(entry.name) === normalizedOriginalName)
  const status: UserEnvironmentVariable['status'] = actualVariable ? 'enabled' : manifestEntry?.status ?? 'disabled'

  if (!actualVariable && !manifestEntry) {
    throw new Error('The selected variable is no longer available.')
  }

  if (normalizedNextName !== normalizedOriginalName) {
    const hasActualConflict = actualVariables.some((item) => normalizeVariableName(item.name) === normalizedNextName)
    const hasManifestConflict = manifestEntries.some((entry) => normalizeVariableName(entry.name) === normalizedNextName)

    if (hasActualConflict || hasManifestConflict) {
      throw new Error('A variable with the same name already exists.')
    }
  }

  if (status === 'enabled') {
    await setUserEnvironmentVariable(nextName, nextValue)

    if (normalizedNextName !== normalizedOriginalName) {
      await setUserEnvironmentVariable(originalName, null)
    }
  }

  const nextManifestEntries = [
    ...manifestEntries.filter((entry) => normalizeVariableName(entry.name) !== normalizedOriginalName),
    { name: nextName, type: nextType, value: nextValue, status }
  ].sort((left, right) => left.name.localeCompare(right.name, 'en'))

  await writeUserEnvironmentManifest(nextManifestEntries)

  return {
    id: `${status}:${normalizedNextName}`,
    name: nextName,
    type: nextType,
    value: nextValue,
    status
  }
}

async function disableUserEnvironmentVariable(name: string): Promise<void> {
  const variableName = validateUserEnvironmentName(name)
  const [actualVariables, manifestEntries] = await Promise.all([
    readActualUserEnvironmentVariables(),
    readUserEnvironmentManifest()
  ])
  const normalizedName = normalizeVariableName(variableName)
  const target = actualVariables.find((item) => normalizeVariableName(item.name) === normalizedName)

  if (!target) {
    throw new Error('The selected variable is no longer available.')
  }

  const nextEntries = [
    ...manifestEntries.filter((entry) => normalizeVariableName(entry.name) !== normalizedName),
    { name: target.name, type: manifestEntries.find((entry) => normalizeVariableName(entry.name) === normalizedName)?.type ?? '', value: target.value, status: 'disabled' as const }
  ].sort((left, right) => left.name.localeCompare(right.name, 'en'))

  await setUserEnvironmentVariable(target.name, null)
  await writeUserEnvironmentManifest(nextEntries)
}

async function enableUserEnvironmentVariable(name: string): Promise<void> {
  const variableName = validateUserEnvironmentName(name)
  const [actualVariables, manifestEntries] = await Promise.all([
    readActualUserEnvironmentVariables(),
    readUserEnvironmentManifest()
  ])
  const normalizedName = normalizeVariableName(variableName)
  const manifestEntry = manifestEntries.find((entry) => normalizeVariableName(entry.name) === normalizedName)

  if (!manifestEntry) {
    throw new Error('The selected variable is no longer available.')
  }

  if (actualVariables.some((item) => normalizeVariableName(item.name) === normalizedName)) {
    throw new Error('An enabled variable with the same name already exists.')
  }

  await setUserEnvironmentVariable(manifestEntry.name, manifestEntry.value)
  await writeUserEnvironmentManifest([
    ...manifestEntries.filter((entry) => normalizeVariableName(entry.name) !== normalizedName),
    { ...manifestEntry, status: 'enabled' as const }
  ].sort((left, right) => left.name.localeCompare(right.name, 'en')))
}

async function deleteUserEnvironmentVariable(name: string): Promise<void> {
  const variableName = validateUserEnvironmentName(name)
  const [actualVariables, manifestEntries] = await Promise.all([
    readActualUserEnvironmentVariables(),
    readUserEnvironmentManifest()
  ])
  const normalizedName = normalizeVariableName(variableName)
  const target = actualVariables.find((item) => normalizeVariableName(item.name) === normalizedName)
  const hasDisabledEntry = manifestEntries.some((entry) => normalizeVariableName(entry.name) === normalizedName)

  if (!target && !hasDisabledEntry) {
    throw new Error('The selected variable is no longer available.')
  }

  if (target) {
    await setUserEnvironmentVariable(target.name, null)
  }

  await writeUserEnvironmentManifest(
    manifestEntries.filter((entry) => normalizeVariableName(entry.name) !== normalizedName)
  )
}

async function openSkillFolder(skillPath: string): Promise<void> {
  await fs.access(skillPath)
  const targetFolder = dirname(skillPath)

  // 在 Windows 上优先直接定位到 `SKILL.md`，比单纯打开目录更稳定也更直观。
  if (process.platform === 'win32') {
    shell.showItemInFolder(skillPath)
    return
  }

  const openResult = await shell.openPath(targetFolder)

  if (openResult) {
    throw new Error(openResult)
  }
}

async function deleteSkillFolder(skillPath: string): Promise<void> {
  const codexRoot = join(homedir(), '.codex')
  const targetFolder = dirname(skillPath)
  const normalizedCodexRoot = codexRoot.toLowerCase()
  const normalizedTargetFolder = targetFolder.toLowerCase()

  if (!normalizedTargetFolder.startsWith(normalizedCodexRoot)) {
    throw new Error('Deletion is only allowed inside the .codex directory.')
  }

  await fs.access(targetFolder)
  await fs.rm(targetFolder, { recursive: true, force: false })
}

function getAppUsageMetrics(): AppUsageMetrics {
  const metrics = app.getAppMetrics()
  const cpuPercent = metrics.reduce((total, item) => total + (item.cpu?.percentCPUUsage ?? 0), 0)
  const workingSetSize = metrics.reduce((total, item) => total + (item.memory?.workingSetSize ?? 0), 0)

  // Electron 返回的工作集大小按 KB 统计，这里统一换算成更易读的 MB。
  return {
    cpuPercent: Number(cpuPercent.toFixed(1)),
    memoryMB: Math.max(0, Math.round(workingSetSize / 1024))
  }
}

function getPrimaryOutputLine(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? ''
}

function extractVersionValue(output: string): string {
  const primaryLine = getPrimaryOutputLine(output)

  if (!primaryLine) {
    return 'Not installed'
  }

  const quotedMatch = primaryLine.match(/"([^"]+)"/)

  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const versionKeywordMatch = primaryLine.match(/version\s+([^\s]+)/i)

  if (versionKeywordMatch?.[1]) {
    return versionKeywordMatch[1]
  }

  const numericMatch = primaryLine.match(/\d+(?:\.\d+)+(?:[A-Za-z0-9.-]*)?/)

  return numericMatch?.[0] ?? primaryLine
}

async function readCommandVersion(command: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024
    })
    const mergedOutput = `${stdout}\n${stderr}`.trim()
    return mergedOutput || null
  } catch {
    return null
  }
}

async function resolveCommandVersion(commands: Array<{ command: string; args: string[] }>): Promise<string> {
  for (const candidate of commands) {
    const output = await readCommandVersion(candidate.command, candidate.args)

    if (output) {
      return extractVersionValue(output)
    }
  }

  return 'Not installed'
}

async function readHostToolVersions(): Promise<HostToolVersions> {
  const [java, python, git, pnpm, npm, powershell] = await Promise.all([
    resolveCommandVersion([{ command: 'java', args: ['-version'] }]),
    resolveCommandVersion([
      { command: 'python', args: ['--version'] },
      { command: 'py', args: ['--version'] },
      { command: 'python3', args: ['--version'] }
    ]),
    resolveCommandVersion([{ command: 'git', args: ['--version'] }]),
    // Windows 下优先走 cmd/pnpm.cmd，避免 Electron 主进程直接 execFile('pnpm') 时误判未安装。
    resolveCommandVersion([
      { command: 'cmd', args: ['/d', '/c', 'pnpm --version'] },
      { command: 'pnpm.cmd', args: ['--version'] },
      { command: 'pnpm', args: ['--version'] },
      { command: 'corepack', args: ['pnpm', '--version'] }
    ]),
    resolveCommandVersion([
      { command: 'cmd', args: ['/d', '/c', 'npm --version'] },
      { command: 'npm.cmd', args: ['--version'] },
      { command: 'npm', args: ['--version'] }
    ]),
    resolveCommandVersion([
      { command: 'powershell', args: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'] },
      { command: 'pwsh', args: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'] }
    ])
  ])

  return {
    git,
    java,
    npm,
    pnpm,
    powershell,
    python
  }
}

function getCachedHostToolVersions(): Promise<HostToolVersions> {
  if (!hostToolVersionsPromise) {
    // 开发工具版本是静态信息，这里做一次缓存，避免 Host 面板刷新时重复执行命令。
    hostToolVersionsPromise = readHostToolVersions()
  }

  return hostToolVersionsPromise
}

async function getHostOverview(): Promise<HostOverview> {
  const cpuItems = cpus()
  const interfaceMap = networkInterfaces()
  const ipv4 = new Set<string>()
  const ipv6 = new Set<string>()
  let interfaceCount = 0

  Object.values(interfaceMap).forEach((items) => {
    const externalItems = (items ?? []).filter((item) => !item.internal)

    if (externalItems.length === 0) {
      return
    }

    interfaceCount += 1

    externalItems.forEach((item) => {
      const family = String(item.family)

      if (family === 'IPv4' || family === '4') {
        ipv4.add(item.address)
        return
      }

      if (family === 'IPv6' || family === '6') {
        ipv6.add(item.address)
      }
    })
  })
  const toolVersions = await getCachedHostToolVersions()

  // Host 面板按分类展示系统、运行时、路径和网络信息，便于用户集中查看本地环境。
  return {
    hardware: {
      cpuCores: cpuItems.length,
      cpuModel: cpuItems[0]?.model ?? 'Unknown CPU'
    },
    network: {
      interfaceCount,
      ipv4: Array.from(ipv4).sort((left, right) => left.localeCompare(right, 'en')),
      ipv6: Array.from(ipv6).sort((left, right) => left.localeCompare(right, 'en'))
    },
    runtime: {
      appVersion: app.getVersion(),
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node,
      v8: process.versions.v8
    },
    system: {
      architecture: arch(),
      hostname: hostname(),
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      osType: osType(),
      osVersion: osVersion(),
      platform: osPlatform(),
      release: osRelease(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    tools: toolVersions,
    user: {
      username: getCurrentUsername()
    }
  }
}

async function readJiraSettings(): Promise<JiraSettings | null> {
  return readJiraSettingsFromDb(process.cwd())
}

async function writeJiraSettings(settings: JiraSettings): Promise<void> {
  await writeJiraSettingsToDb(process.cwd(), settings)
}

function normalizeJiraSettings(settings: JiraSettings): JiraSettings {
  const apiPrefix = settings.apiPrefix.trim()
  const token = settings.token.trim()

  if (!apiPrefix) {
    throw new Error('Jira API Prefix is required.')
  }

  if (!token) {
    throw new Error('Token is required.')
  }

  let normalizedUrl: URL

  try {
    normalizedUrl = new URL(apiPrefix)
  } catch {
    throw new Error('Jira API Prefix must be a valid URL.')
  }

  const normalizedPath = normalizedUrl.pathname.replace(/\/+$/, '')

  // 只允许使用 Jira 9.17.0 文档里的 `rest/api/2` 资源前缀，避免请求任意未约束地址。
  if (normalizedPath.endsWith('/rest/api/2/myself')) {
    normalizedUrl.pathname = normalizedPath.replace(/\/myself$/, '')
  } else if (normalizedPath.endsWith('/rest/api/2')) {
    normalizedUrl.pathname = normalizedPath
  } else if (normalizedPath.endsWith('/rest/api')) {
    normalizedUrl.pathname = `${normalizedPath}/2`
  } else if (normalizedPath.includes('/rest/')) {
    throw new Error('Jira API Prefix must target the documented /rest/api/2 prefix.')
  } else {
    normalizedUrl.pathname = `${normalizedPath}/rest/api/2`.replace(/\/{2,}/g, '/')
  }

  normalizedUrl.search = ''
  normalizedUrl.hash = ''

  return { apiPrefix: normalizedUrl.toString().replace(/\/$/, ''), token }
}

async function validateJiraSettings(settings: JiraSettings): Promise<JiraValidationResult> {
  const normalizedSettings = normalizeJiraSettings(settings)
  const response = await fetchWithRetryAndOptionalProxy(
    `${normalizedSettings.apiPrefix}/myself`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizedSettings.token}`
      }
    },
    'Jira validation'
  )

  await writeJiraSettings(normalizedSettings)

  return {
    ok: true,
    status: response.status
  }
}

function escapeJiraJqlValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildJiraIssueJql(currentUsername: string, query: JiraIssueQuery): string {
  const clauses = [`(assignee = "${escapeJiraJqlValue(currentUsername)}" OR reporter = "${escapeJiraJqlValue(currentUsername)}")`]

  if (query.project) {
    clauses.push(`project = "${escapeJiraJqlValue(query.project)}"`)
  }

  if (query.type) {
    clauses.push(`issuetype = "${escapeJiraJqlValue(query.type)}"`)
  }

  if (query.status) {
    clauses.push(`status = "${escapeJiraJqlValue(query.status)}"`)
  }

  if (query.keyword?.trim()) {
    clauses.push(`summary ~ "${escapeJiraJqlValue(query.keyword.trim())}"`)
  }

  const sortField = query.sortField ?? 'updated'
  const sortDirection = query.sortOrder === 'ascend' ? 'ASC' : 'DESC'

  return `${clauses.join(' AND ')} ORDER BY ${sortField} ${sortDirection}`
}

async function listJiraIssues(settings: JiraSettings, query: JiraIssueQuery): Promise<JiraIssueListResult> {
  const normalizedSettings = normalizeJiraSettings(settings)
  const currentUsername = getCurrentUsername()
  const jiraBaseUrl = normalizedSettings.apiPrefix.replace(/\/rest\/api\/2$/, '')
  const page = Math.max(1, query.page || 1)
  // Jira issue 列表固定按每页 20 条请求，避免前后端页容量不一致。
  const pageSize = 20
  const searchParams = new URLSearchParams({
    jql: buildJiraIssueJql(currentUsername, query),
    startAt: String((page - 1) * pageSize),
    maxResults: String(pageSize),
    fields: 'project,summary,status,issuetype,assignee,reporter,created,updated'
  })
  const response = await fetchWithRetryAndOptionalProxy(
    `${normalizedSettings.apiPrefix}/search?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizedSettings.token}`
      }
    },
    'Jira issue query'
  )
  const payload = (await response.json()) as {
    total?: number
    issues?: Array<{
      id?: string
      key?: string
      fields?: {
        project?: { name?: string }
        summary?: string
        created?: string
        updated?: string
        status?: { name?: string }
        issuetype?: { name?: string }
        assignee?: { displayName?: string; name?: string }
        reporter?: { displayName?: string; name?: string }
      }
    }>
  }

  return {
    items: (payload.issues ?? []).map((issue) => ({
      id: issue.id ?? issue.key ?? crypto.randomUUID(),
      key: issue.key ?? 'Unknown',
      project: issue.fields?.project?.name ?? 'Unknown',
      summary: issue.fields?.summary ?? 'No summary',
      type: issue.fields?.issuetype?.name ?? 'Unknown',
      status: issue.fields?.status?.name ?? 'Unknown',
      assignee: issue.fields?.assignee?.displayName ?? issue.fields?.assignee?.name ?? 'Unassigned',
      reporter: issue.fields?.reporter?.displayName ?? issue.fields?.reporter?.name ?? 'Unknown',
      created: issue.fields?.created ?? '',
      updated: issue.fields?.updated ?? '',
      url: issue.key ? `${jiraBaseUrl}/browse/${issue.key}` : jiraBaseUrl
    })),
    page,
    pageSize,
    total: typeof payload.total === 'number' ? payload.total : 0
  }
}

async function readAppSettings(): Promise<AppSettings> {
  return readAppSettingsFromDb(process.cwd())
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  const httpProxy = settings.httpProxy.trim()

  if (!httpProxy) {
    return { httpProxy: '' }
  }

  try {
    const url = new URL(httpProxy)

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('HTTP Proxy must use http or https.')
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'HTTP Proxy must use http or https.') {
      throw error
    }

    throw new Error('HTTP Proxy must be a valid URL.')
  }

  return { httpProxy }
}

async function writeAppSettings(settings: AppSettings): Promise<AppSettings> {
  const normalizedSettings = normalizeAppSettings(settings)
  return writeAppSettingsToDb(process.cwd(), normalizedSettings)
}

function getCurrentUsername(): string {
  try {
    return userInfo().username || process.env.USERNAME || process.env.USER || 'Unknown User'
  } catch {
    return process.env.USERNAME || process.env.USER || 'Unknown User'
  }
}

async function ensureSuccessfulResponse(responsePromise: Promise<Response>, label: string): Promise<Response> {
  const response = await responsePromise

  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}.`)
  }

  return response
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function retryApiRequest(
  operation: (attempt: number) => Promise<Response>,
  retries: number
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error

      if (attempt < retries) {
        await delay(500)
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed.')
}

type CallApiOptions = {
  label: string
  requireOk: boolean
}

// 所有主进程网络请求统一走这里：先直连重试两次，失败后若配置了 HTTP Proxy，再切代理重试两次。
async function callApiWithRetryAndOptionalProxy(
  input: string,
  init: RequestInit | undefined,
  options: CallApiOptions
): Promise<Response> {
  const executeRequest = (fetcher: (input: string, init?: RequestInit) => Promise<Response>): Promise<Response> => {
    if (options.requireOk) {
      return ensureSuccessfulResponse(fetcher(input, init), options.label)
    }

    return fetcher(input, init)
  }

  try {
    return await retryApiRequest(() => executeRequest(net.fetch), API_RETRY_COUNT)
  } catch (directError) {
    const appSettings = await readAppSettings()

    if (!appSettings.httpProxy) {
      throw directError instanceof Error ? directError : new Error(`${options.label} failed.`)
    }

    const proxySession = session.fromPartition(PROXY_SESSION_PARTITION)
    await proxySession.setProxy({
      mode: 'fixed_servers',
      proxyRules: appSettings.httpProxy
    })
    await proxySession.forceReloadProxyConfig()

    try {
      return await retryApiRequest(() => executeRequest(proxySession.fetch.bind(proxySession)), API_RETRY_COUNT)
    } catch (proxyError) {
      throw proxyError instanceof Error ? proxyError : new Error(`${options.label} failed.`)
    }
  }
}

async function fetchWithRetryAndOptionalProxy(
  input: string,
  init: RequestInit | undefined,
  label: string
): Promise<Response> {
  return callApiWithRetryAndOptionalProxy(input, init, {
    label,
    requireOk: true
  })
}

const mcpService = createMcpService({
  dataRoot: process.cwd(),
  fetchWithRetry: fetchWithRetryAndOptionalProxy,
  // MCP 客户端初始化时需要带上当前桌面应用版本，便于远端服务识别调用方。
  getAppVersion: () => app.getVersion()
})

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('codex:list-skills', async () => {
    return listCodexSkills()
  })
  ipcMain.handle('app:list-scripts', async () => {
    return listScriptFiles()
  })
  ipcMain.handle('app:create-script', async (_, payload: CreateScriptPayload) => {
    return createScriptEntry(payload)
  })
  ipcMain.handle('app:update-script', async (_, payload: UpdateScriptPayload) => {
    return updateScriptEntry(payload)
  })
  ipcMain.handle('app:delete-script', async (_, scriptId: string) => {
    return deleteScriptEntry(scriptId)
  })
  ipcMain.handle('app:reorder-scripts', async (_, scriptIds: string[]) => {
    return reorderScriptEntries(scriptIds)
  })
  ipcMain.handle('app:list-script-shell-options', async () => {
    return getCachedScriptShellOptions()
  })
  ipcMain.handle('app:run-script-command', async (_, payload: RunScriptCommandPayload) => {
    return runScriptCommand(payload)
  })
  ipcMain.handle('app:get-api-workspace', async () => {
    return readApiWorkspace()
  })
  ipcMain.handle('app:save-api-workspace', async (_, workspace: ApiWorkspace) => {
    return writeApiWorkspace(workspace)
  })
  ipcMain.handle('app:send-api-request', async (_, request: ApiRequestEntry) => {
    return sendApiRequest(request)
  })
  ipcMain.handle('app:list-user-environment', async () => {
    return listUserEnvironmentVariables()
  })
  ipcMain.handle('app:create-user-environment', async (_, payload: CreateUserEnvironmentPayload) => {
    return createUserEnvironmentVariable(payload)
  })
  ipcMain.handle('app:update-user-environment', async (_, payload: UpdateUserEnvironmentPayload) => {
    return updateUserEnvironmentVariable(payload)
  })
  ipcMain.handle('app:enable-user-environment', async (_, name: string) => {
    return enableUserEnvironmentVariable(name)
  })
  ipcMain.handle('app:disable-user-environment', async (_, name: string) => {
    return disableUserEnvironmentVariable(name)
  })
  ipcMain.handle('app:delete-user-environment', async (_, name: string) => {
    return deleteUserEnvironmentVariable(name)
  })
  ipcMain.handle('app:get-usage-metrics', async () => {
    return getAppUsageMetrics()
  })
  ipcMain.handle('app:get-host-overview', async () => {
    return getHostOverview()
  })
  ipcMain.handle('app:get-jira-settings', async () => {
    return readJiraSettings()
  })
  ipcMain.handle('app:validate-jira-settings', async (_, settings: JiraSettings) => {
    return validateJiraSettings(settings)
  })
  ipcMain.handle('app:list-jira-issues', async (_, payload: { query: JiraIssueQuery; settings: JiraSettings }) => {
    return listJiraIssues(payload.settings, payload.query)
  })
  ipcMain.handle('app:get-current-username', async () => {
    return getCurrentUsername()
  })
  ipcMain.handle('app:get-settings', async () => {
    return readAppSettings()
  })
  ipcMain.handle('app:save-settings', async (_, settings: AppSettings) => {
    return writeAppSettings(settings)
  })
  ipcMain.handle('app:list-mcp-servers', async () => {
    return mcpService.listServers()
  })
  ipcMain.handle('app:save-mcp-server', async (_, draft: McpServerDraft) => {
    return mcpService.saveServer(draft)
  })
  ipcMain.handle('app:delete-mcp-server', async (_, serverId: string) => {
    return mcpService.deleteServer(serverId)
  })
  ipcMain.handle('app:test-mcp-server', async (_, serverId: string) => {
    return mcpService.testServer(serverId)
  })
  ipcMain.handle('app:list-mcp-tools', async (_, serverId: string) => {
    return mcpService.listTools(serverId)
  })
  ipcMain.handle('app:call-mcp-tool', async (_, payload: McpCallToolPayload) => {
    return mcpService.callTool(payload)
  })
  ipcMain.handle('app:list-mcp-runs', async () => {
    return mcpService.listRuns()
  })
  ipcMain.handle('codex:open-skill-folder', async (_, skillPath: string) => {
    return openSkillFolder(skillPath)
  })
  ipcMain.handle('codex:delete-skill-folder', async (_, skillPath: string) => {
    return deleteSkillFolder(skillPath)
  })

  void mcpService.bootstrapEnabledServers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void mcpService.shutdown()
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
