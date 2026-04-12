import {
  CodeOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import { Card, Descriptions, Flex, Spin, Statistic, Tag, Typography, message, theme } from 'antd'
import { useEffect, useMemo, useState } from 'react'

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
  tools: {
    git: string
    java: string
    npm: string
    pnpm: string
    powershell: string
    python: string
  }
  user: {
    username: string
  }
}

function HostPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [overview, setOverview] = useState<HostOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [messageApi, contextHolder] = message.useMessage()

  const panelStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      height: '100%'
    }),
    []
  )

  const sectionTitleStyle = useMemo(
    () => ({
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: token.colorTextTertiary
    }),
    [token.colorTextTertiary]
  )

  const cardStyle = useMemo(
    () => ({
      borderRadius: 18,
      border: `1px solid ${token.colorBorderSecondary}`
    }),
    [token.colorBorderSecondary]
  )

  const tagStyle = useMemo(
    () => ({
      borderRadius: 999,
      paddingInline: 10,
      marginInlineEnd: 0
    }),
    []
  )

  useEffect(() => {
    let disposed = false

    // Host 面板改为静态开发环境视图，仅在初始化时读取一次本机信息。
    const bootstrap = async (): Promise<void> => {
      try {
        const nextOverview = await window.api.getHostOverview()

        if (disposed) {
          return
        }

        setOverview(nextOverview)
      } catch (loadError) {
        if (!disposed) {
          messageApi.error(loadError instanceof Error ? loadError.message : 'Failed to load workstation information.')
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

  if (loading || !overview) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center" style={panelStyle}>
        {contextHolder}
        <Flex align="center" gap="middle" vertical>
          <Spin size="large" />
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            Loading workstation information...
          </Typography.Text>
        </Flex>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {contextHolder}
      <div>
        <Typography.Text style={sectionTitleStyle}>Workstation Profile</Typography.Text>
        <Typography.Title level={3} style={{ margin: '6px 0 0' }}>
          Developer Workstation
        </Typography.Title>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-auto pr-1">
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
          <Card
            style={cardStyle}
            title={
              <Flex align="center" gap={10}>
                <DesktopOutlined />
                <span>Workstation</span>
              </Flex>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Statistic title="Hostname" value={overview.system.hostname} />
              <Statistic title="Username" value={overview.user.username} />
              <Statistic title="Platform" value={overview.system.platform} />
              <Statistic title="Architecture" value={overview.system.architecture} />
              <Statistic title="CPU" value={overview.hardware.cpuModel} />
              <Statistic suffix="cores" title="CPU Cores" value={overview.hardware.cpuCores} />
            </div>
          </Card>

          <Card
            style={cardStyle}
            title={
              <Flex align="center" gap={10}>
                <CloudServerOutlined />
                <span>Operating System</span>
              </Flex>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
              <Statistic title="OS Type" value={overview.system.osType} />
              <Statistic title="Release" value={overview.system.release} />
              <Statistic title="Locale" value={overview.system.locale} />
              <Statistic title="Timezone" value={overview.system.timezone} />
            </div>

            <Descriptions
              className="mt-5"
              column={1}
              items={[
                { key: 'osVersion', label: 'OS Version', children: overview.system.osVersion },
                { key: 'platform', label: 'Platform', children: overview.system.platform },
                { key: 'architecture', label: 'Architecture', children: overview.system.architecture }
              ]}
              size="small"
            />
          </Card>

          <Card
            style={cardStyle}
            title={
              <Flex align="center" gap={10}>
                <CodeOutlined />
                <span>Developer Toolchain</span>
              </Flex>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Statistic title="Java" value={overview.tools.java} />
              <Statistic title="Python" value={overview.tools.python} />
              <Statistic title="Git" value={overview.tools.git} />
              <Statistic title="pnpm" value={overview.tools.pnpm} />
              <Statistic title="npm" value={overview.tools.npm} />
              <Statistic title="PowerShell" value={overview.tools.powershell} />
            </div>
          </Card>

          <Card
            style={cardStyle}
            title={
              <Flex align="center" gap={10}>
                <CloudServerOutlined />
                <span>Runtime Stack</span>
              </Flex>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
              <Statistic title="App Version" value={overview.runtime.appVersion} />
              <Statistic title="Electron" value={overview.runtime.electron} />
              <Statistic title="Chrome" value={overview.runtime.chrome} />
              <Statistic title="Node" value={overview.runtime.node} />
              <Statistic title="V8" value={overview.runtime.v8} />
            </div>
          </Card>

          <Card
            className="2xl:col-span-2"
            style={cardStyle}
            title={
              <Flex align="center" gap={10}>
                <GlobalOutlined />
                <span>Network</span>
              </Flex>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Statistic title="Interfaces" value={overview.network.interfaceCount} />
              <Statistic title="IPv4 Addresses" value={overview.network.ipv4.length} />
              <Statistic title="IPv6 Addresses" value={overview.network.ipv6.length} />
            </div>

            <Descriptions
              className="mt-5"
              column={1}
              items={[
                {
                  key: 'ipv4',
                  label: 'IPv4',
                  children:
                    overview.network.ipv4.length > 0 ? (
                      <Flex gap={8} wrap>
                        {overview.network.ipv4.map((address) => (
                          <Tag key={address} color="blue" style={tagStyle}>
                            {address}
                          </Tag>
                        ))}
                      </Flex>
                    ) : (
                      <Typography.Text style={{ color: token.colorTextSecondary }}>
                        No external IPv4 address detected.
                      </Typography.Text>
                    )
                },
                {
                  key: 'ipv6',
                  label: 'IPv6',
                  children:
                    overview.network.ipv6.length > 0 ? (
                      <Flex gap={8} wrap>
                        {overview.network.ipv6.map((address) => (
                          <Tag key={address} style={tagStyle}>
                            {address}
                          </Tag>
                        ))}
                      </Flex>
                    ) : (
                      <Typography.Text style={{ color: token.colorTextSecondary }}>
                        No external IPv6 address detected.
                      </Typography.Text>
                    )
                }
              ]}
              size="small"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default HostPanel
