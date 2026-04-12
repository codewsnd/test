/* eslint-disable react-refresh/only-export-components */
import toolProviderConfluenceIcon from '@/assets/toolProviderConfluence.svg'
import toolProviderDefaultIcon from '@/assets/toolProviderDefault.svg'
import toolProviderInternalIcon from '@/assets/toolProviderInternal.svg'
import toolProviderJiraIcon from '@/assets/toolProviderJira.svg'
import toolProviderPythonIcon from '@/assets/toolProviderPython.svg'
import toolProviderWebIcon from '@/assets/toolProviderWeb.svg'

export const TOOL_ICON_CONFIG: Record<string, string> = {
  default: toolProviderDefaultIcon,
  python: toolProviderPythonIcon,
  web: toolProviderWebIcon,
  confluence: toolProviderConfluenceIcon,
  jira: toolProviderJiraIcon,
  internal: toolProviderInternalIcon,
}

export const DEFAULT_TOOL_ICON = toolProviderDefaultIcon

export const normalizeToolIcon = (icon?: string) => icon?.trim().toLowerCase()

export const getToolIcon = (icon?: string) => {
  const normalizedIcon = normalizeToolIcon(icon)

  if (!normalizedIcon) {
    return DEFAULT_TOOL_ICON
  }

  return TOOL_ICON_CONFIG[normalizedIcon] ?? DEFAULT_TOOL_ICON
}
