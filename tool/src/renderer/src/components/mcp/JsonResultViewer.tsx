import { CopyOutlined } from '@ant-design/icons'
import { Button, Flex, Input, Segmented, Typography, message, theme } from 'antd'
import { useMemo, useState } from 'react'
import { JsonEditor, githubDarkTheme, githubLightTheme } from 'json-edit-react'

type JsonResultViewerProps = {
  data: unknown
  minHeight?: number
  rootName: string
}

type ViewerMode = 'raw' | 'tree'

function parseRgbChannel(value: string): number {
  return Number.parseInt(value, 10)
}

function toHexColor(value: string): string | null {
  const normalizedValue = value.trim()

  if (normalizedValue.startsWith('#')) {
    if (normalizedValue.length === 4) {
      return `#${normalizedValue[1]}${normalizedValue[1]}${normalizedValue[2]}${normalizedValue[2]}${normalizedValue[3]}${normalizedValue[3]}`
    }

    return normalizedValue
  }

  const rgbMatch = normalizedValue.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)

  if (!rgbMatch) {
    return null
  }

  return `#${[rgbMatch[1], rgbMatch[2], rgbMatch[3]]
    .map((channel) => parseRgbChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function isDarkSurface(color: string): boolean {
  const hexColor = toHexColor(color)

  if (!hexColor) {
    return false
  }

  const red = Number.parseInt(hexColor.slice(1, 3), 16)
  const green = Number.parseInt(hexColor.slice(3, 5), 16)
  const blue = Number.parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance < 0.5
}

function normalizeEditorData(data: unknown): unknown {
  return typeof data === 'undefined' ? null : data
}

function safePrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function JsonResultViewer({ data, minHeight = 320, rootName }: JsonResultViewerProps): React.JSX.Element {
  const { token } = theme.useToken()
  const [mode, setMode] = useState<ViewerMode>('tree')
  const [messageApi, contextHolder] = message.useMessage()
  const darkSurface = isDarkSurface(token.colorBgContainer)
  const normalizedData = useMemo(() => normalizeEditorData(data), [data])
  const rawValue = useMemo(() => safePrettyJson(normalizedData), [normalizedData])

  // Result 查看器同时提供树形和原始 JSON 两种模式，方便切换不同排查习惯。
  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rawValue)
      messageApi.success('JSON copied.')
    } catch (copyError) {
      messageApi.error(copyError instanceof Error ? copyError.message : 'Failed to copy JSON.')
    }
  }

  return (
    <Flex gap={12} vertical>
      {contextHolder}
      <Flex align="center" justify="space-between" gap={12} wrap>
        <Segmented<ViewerMode>
          options={[
            { label: 'Tree', value: 'tree' },
            { label: 'Raw', value: 'raw' }
          ]}
          size="small"
          value={mode}
          onChange={(value) => setMode(value)}
        />
        <Button
          aria-label="Copy JSON"
          icon={<CopyOutlined />}
          shape="circle"
          size="small"
          type="text"
          onClick={() => {
            void handleCopy()
          }}
        />
      </Flex>

      <div
        style={{
          minHeight,
          maxHeight: '100%',
          overflow: 'auto',
          borderRadius: 12,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          padding: 12
        }}
      >
        {mode === 'tree' ? (
          // 查看模式下显式禁用新增、删除和编辑入口，避免结果面板出现插入按钮。
          <JsonEditor
            collapse={2}
            data={normalizedData}
            maxWidth="100%"
            restrictAdd
            restrictDelete
            restrictEdit
            rootName={rootName}
            showIconTooltips={false}
            stringTruncate={160}
            theme={darkSurface ? githubDarkTheme : githubLightTheme}
            viewOnly
          />
        ) : (
          <Flex gap={8} vertical>
            <Typography.Text style={{ color: token.colorTextSecondary }}>
              Raw JSON
            </Typography.Text>
            <Input.TextArea
              autoSize={false}
              readOnly
              style={{
                minHeight: Math.max(minHeight - 48, 120),
                fontFamily: 'Consolas, "SFMono-Regular", Menlo, Monaco, monospace',
                resize: 'none'
              }}
              value={rawValue}
            />
          </Flex>
        )}
      </div>
    </Flex>
  )
}

export default JsonResultViewer
