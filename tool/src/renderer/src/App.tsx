import {
  ApiOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  LaptopOutlined,
  MoonOutlined,
  ProfileOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Button, Card, ConfigProvider, Empty, Flex, Form, Input, Layout, Menu, Modal, Tag, Typography, message, theme } from 'antd'
import type { MenuProps, ThemeConfig } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import ApiPanel from './components/ApiPanel'
import HostPanel from './components/HostPanel'
import JiraPanel from './components/JiraPanel'
import McpPanel from './components/McpPanel'
import ScriptPanel from './components/ScriptPanel'
import SkillsPanel from './components/SkillsPanel'
import UserEnvironmentPanel from './components/UserEnvironmentPanel'
import WorldClockFooter from './components/WorldClockFooter'

const { Header, Content, Footer, Sider } = Layout
const { defaultAlgorithm, darkAlgorithm } = theme
const THEME_STORAGE_KEY = 'tool-theme-mode'

type SectionKey = 'skills' | 'script' | 'api' | 'user-environment' | 'jira' | 'mcp' | 'host'
type ThemeMode = 'light' | 'dark'

type SectionDefinition = {
  key: SectionKey
  title: string
  icon: React.ReactNode
}

type ShellProps = {
  activeSection: SectionKey
  currentSection: SectionDefinition
  setActiveSection: (value: SectionKey) => void
  themeMode: ThemeMode
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>
}

type AppSettings = {
  httpProxy: string
}

const SECTIONS: SectionDefinition[] = [
  {
    key: 'host',
    title: 'Host',
    icon: <LaptopOutlined />
  },
  {
    key: 'skills',
    title: 'Skills',
    icon: <AppstoreOutlined />
  },
  {
    key: 'script',
    title: 'Script',
    icon: <ProfileOutlined />
  },
  {
    key: 'api',
    title: 'API',
    icon: <ApiOutlined />
  },
  {
    key: 'user-environment',
    title: 'User Environment',
    icon: <UserOutlined />
  },
  {
    key: 'jira',
    title: 'Jira',
    icon: <DeploymentUnitOutlined />
  },
  {
    key: 'mcp',
    title: 'MCP',
    icon: <CloudServerOutlined />
  }
]

function AppShell({
  activeSection,
  currentSection,
  setActiveSection,
  themeMode,
  setThemeMode
}: ShellProps): React.JSX.Element {
  const { token } = theme.useToken()
  const [settingsForm] = Form.useForm<AppSettings>()
  const [currentUsername, setCurrentUsername] = useState('Loading...')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      SECTIONS.map((section) => ({
        key: section.key,
        icon: section.icon,
        label: (
          <div className="py-1 text-sm font-semibold leading-tight">
            {section.title}
          </div>
        )
      })),
    []
  )

  const appSurfaceStyle = useMemo(
    () => ({
      height: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      background: token.colorBgLayout,
      color: token.colorText
    }),
    [token.colorBgLayout, token.colorText]
  )

  const shellStyle = useMemo(
    () => ({
      display: 'flex',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      gap: 20,
      background: 'transparent'
    }),
    []
  )

  const headerStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flex: '0 0 auto',
      height: 40,
      paddingInline: 14,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgContainer
    }),
    [token.colorBgContainer, token.colorBorderSecondary]
  )

  const siderStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      minHeight: 0,
      paddingBlock: 16,
      background: token.colorBgContainer,
      borderRadius: 20,
      border: `1px solid ${token.colorBorderSecondary}`
    }),
    [token.colorBgContainer, token.colorBorderSecondary]
  )

  const contentStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      padding: 0,
      background: 'transparent'
    }),
    []
  )

  const panelCardStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
      borderRadius: 20,
      border: `1px solid ${token.colorBorderSecondary}`
    }),
    [token.colorBorderSecondary]
  )

  const placeholderStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      marginTop: 24,
      borderRadius: 18,
      border: `1px dashed ${token.colorBorder}`,
      background: token.colorFillQuaternary
    }),
    [token.colorBorder, token.colorFillQuaternary]
  )

  const subtleTagStyle = useMemo(
    () => ({
      margin: 0,
      paddingInline: 12,
      borderRadius: 999,
      background: token.colorFillTertiary,
      color: token.colorTextSecondary
    }),
    [token.colorFillTertiary, token.colorTextSecondary]
  )

  // 将主题 token 同步到页面根节点，确保窗口级背景也由 Ant Design 主题驱动。
  useEffect(() => {
    document.documentElement.style.colorScheme = themeMode
    document.documentElement.style.backgroundColor = token.colorBgLayout
    document.body.style.backgroundColor = token.colorBgLayout

    const root = document.getElementById('root')
    if (root) {
      root.style.backgroundColor = token.colorBgLayout
    }
  }, [themeMode, token.colorBgLayout])

  useEffect(() => {
    let disposed = false

    // Header 需要展示当前系统用户名，并回填已保存的 HTTP Proxy 配置。
    const bootstrap = async (): Promise<void> => {
      try {
        const [username, settings] = await Promise.all([window.api.getCurrentUsername(), window.api.getAppSettings()])

        if (disposed) {
          return
        }

        setCurrentUsername(username)
        settingsForm.setFieldsValue(settings)
      } catch (loadError) {
        if (!disposed) {
          messageApi.error(loadError instanceof Error ? loadError.message : 'Failed to load application settings.')
          setCurrentUsername('Unknown User')
        }
      }
    }

    void bootstrap()

    return () => {
      disposed = true
    }
  }, [messageApi, settingsForm])

  // Settings 弹窗保存到本地 `data/setting/settings.json`，供后续网络能力统一复用。
  const handleSaveSettings = async (): Promise<void> => {
    try {
      const values = await settingsForm.validateFields()
      setSavingSettings(true)
      const savedSettings = await window.api.saveAppSettings(values)
      settingsForm.setFieldsValue(savedSettings)
      setSettingsOpen(false)
      messageApi.success('Settings saved.')
    } catch (saveError) {
      if (saveError instanceof Error) {
        messageApi.error(saveError.message)
      }
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <Layout style={appSurfaceStyle}>
      {contextHolder}
      <Modal
        cancelText="Cancel"
        okButtonProps={{ loading: savingSettings }}
        okText="Save"
        open={settingsOpen}
        title="Settings"
        onCancel={() => setSettingsOpen(false)}
        onOk={() => {
          void handleSaveSettings()
        }}
      >
        <Form form={settingsForm} layout="vertical" initialValues={{ httpProxy: '' }}>
          <Form.Item
            label="HTTP Proxy"
            name="httpProxy"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  const normalizedValue = value?.trim()

                  if (!normalizedValue) {
                    return
                  }

                  try {
                    const url = new URL(normalizedValue)

                    if (!['http:', 'https:'].includes(url.protocol)) {
                      throw new Error('HTTP Proxy must use http or https.')
                    }
                  } catch (error) {
                    if (error instanceof Error && error.message === 'HTTP Proxy must use http or https.') {
                      throw error
                    }

                    throw new Error('Please enter a valid HTTP Proxy URL.')
                  }
                }
              }
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder="http://127.0.0.1:7890" />
          </Form.Item>
        </Form>
      </Modal>

      <Header style={headerStyle}>
        <Typography.Text
          strong
          style={{
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: token.colorTextSecondary
          }}
        >
          Tool Workspace
        </Typography.Text>

        <Flex align="center" gap="small">
          <Tag bordered={false} style={{ ...subtleTagStyle, paddingInline: 10, fontSize: 11 }}>
            {currentUsername}
          </Tag>
          <Button
            aria-label="Open settings"
            icon={<SettingOutlined />}
            shape="circle"
            type="default"
            onClick={() => setSettingsOpen(true)}
          />
          {/* 使用 Ant Design 主题状态切换明暗模式，不再依赖样式类控制配色。 */}
          <Button
            aria-label="Toggle theme"
            icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            shape="circle"
            type="default"
            onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
          />
        </Flex>
      </Header>

      {/* 中间区域独占剩余高度，超出内容仅在此区域内部滚动，不影响底部页脚。 */}
      <Content style={{ flex: '1 1 auto', minHeight: 0, padding: 16, background: 'transparent', overflow: 'hidden' }}>
        <Layout hasSider style={shellStyle}>
          <Sider breakpoint="lg" collapsedWidth={72} style={siderStyle} theme={themeMode} width={280}>
            <div className="mb-3 px-4">
              <Typography.Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.26em',
                  textTransform: 'uppercase',
                  color: token.colorTextTertiary
                }}
              >
                Sections
              </Typography.Text>
            </div>
            <Menu
              className="border-r-0 !bg-transparent px-2"
              style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
              items={menuItems}
              mode="inline"
              selectedKeys={[activeSection]}
              onClick={({ key }) => setActiveSection(key as SectionKey)}
            />
          </Sider>

          <Content style={contentStyle}>
            {/* 右侧统一收敛到一个 Card 容器里，避免重复的外层包裹影响内容高度。 */}
            <Card
              className="tool-panel-card"
              styles={{ body: { display: 'flex', flex: 1, minHeight: 0, padding: 20 } }}
              style={panelCardStyle}
            >
              {activeSection === 'skills' ? (
                <SkillsPanel />
              ) : activeSection === 'host' ? (
                <HostPanel />
              ) : activeSection === 'script' ? (
                <ScriptPanel />
              ) : activeSection === 'api' ? (
                <ApiPanel />
              ) : activeSection === 'user-environment' ? (
                <UserEnvironmentPanel />
              ) : activeSection === 'jira' ? (
                <JiraPanel />
              ) : activeSection === 'mcp' ? (
                <McpPanel />
              ) : (
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <Flex align="center" justify="space-between" gap="small" wrap>
                    <div>
                      <Typography.Text
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.3em',
                          textTransform: 'uppercase',
                          color: token.colorTextTertiary
                        }}
                      >
                        Active Panel
                      </Typography.Text>
                      <Typography.Title level={2} style={{ margin: '4px 0 0' }}>
                        {currentSection.title}
                      </Typography.Title>
                    </div>

                    <Tag bordered={false} style={subtleTagStyle}>
                      Placeholder
                    </Tag>
                  </Flex>

                  <div style={placeholderStyle}>
                    <Empty
                      description={
                        <Typography.Text style={{ color: token.colorTextSecondary }}>
                          {currentSection.title} content will appear here.
                        </Typography.Text>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  </div>
                </div>
              )}
            </Card>
          </Content>
        </Layout>
      </Content>

      <Footer style={{ flex: '0 0 auto', height: 40, padding: '0 16px', background: 'transparent' }}>
        <WorldClockFooter />
      </Footer>
    </Layout>
  )
}

function App(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionKey>('host')
  // 主题状态会持久化到本地，避免应用重启后丢失用户偏好。
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'dark' ? 'dark' : 'light'
  })

  const currentSection = SECTIONS.find((section) => section.key === activeSection) ?? SECTIONS[0]
  const isDark = themeMode === 'dark'

  // 使用 Ant Design 的算法和 token 做主题切换，并恢复默认蓝色主色。
  const appTheme = useMemo<ThemeConfig>(
    () => ({
      algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 16,
        colorBgLayout: isDark ? '#0f0f0f' : '#f5f5f5',
        colorBgBase: isDark ? '#141414' : '#ffffff',
        fontFamily:
          '"Segoe UI", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif'
      },
      components: {
        Layout: {
          bodyBg: isDark ? '#141414' : '#ffffff',
          headerBg: isDark ? '#141414' : '#ffffff',
          footerBg: 'transparent',
          lightSiderBg: isDark ? '#141414' : '#ffffff',
          siderBg: isDark ? '#141414' : '#ffffff',
          headerHeight: 40,
          headerPadding: '0 14px',
          footerPadding: '0 16px'
        },
        Menu: {
          itemBorderRadius: 12,
          itemMarginBlock: 6,
          itemMarginInline: 8
        }
      }
    }),
    [isDark]
  )

  // 每次切换主题时同步到 localStorage，保持桌面端使用习惯。
  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  return (
    <ConfigProvider theme={appTheme}>
      <AppShell
        activeSection={activeSection}
        currentSection={currentSection}
        setActiveSection={setActiveSection}
        setThemeMode={setThemeMode}
        themeMode={themeMode}
      />
    </ConfigProvider>
  )
}

export default App
