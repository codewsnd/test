import { Flex, Typography, theme } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import chinaFlag from '@renderer/assets/flag-cn.svg'
import indiaFlag from '@renderer/assets/flag-in.svg'
import ukFlag from '@renderer/assets/flag-gb.svg'
import usFlag from '@renderer/assets/flag-us.svg'
import utcFlag from '@renderer/assets/flag-utc.svg'

type ClockItem = {
  key: string
  label: string
  city: string
  timeZone: string
  flag: string
}

const CLOCKS: ClockItem[] = [
  {
    key: 'utc',
    label: 'UTC',
    city: 'UTC',
    timeZone: 'UTC',
    flag: utcFlag
  },
  {
    key: 'china',
    label: 'CN',
    city: 'Beijing',
    timeZone: 'Asia/Shanghai',
    flag: chinaFlag
  },
  {
    key: 'us',
    label: 'US',
    city: 'Washington',
    timeZone: 'America/New_York',
    flag: usFlag
  },
  {
    key: 'uk',
    label: 'UK',
    city: 'London',
    timeZone: 'Europe/London',
    flag: ukFlag
  },
  {
    key: 'india',
    label: 'IN',
    city: 'New Delhi',
    timeZone: 'Asia/Kolkata',
    flag: indiaFlag
  }
]

const TIME_FORMATTERS = Object.fromEntries(
  CLOCKS.map((clock) => [
    clock.timeZone,
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: clock.timeZone
    })
  ])
) as Record<string, Intl.DateTimeFormat>

function useSecondTicker(): number {
  const [timestamp, setTimestamp] = useState(() => Date.now())

  useEffect(() => {
    let timer = 0

    // 只在页脚组件里按秒刷新，既满足动态时间展示，也不会影响主体界面的性能。
    const scheduleNextTick = (): void => {
      const now = Date.now()
      const nextSecond = 1_000 - (now % 1_000)

      timer = window.setTimeout(() => {
        setTimestamp(Date.now())
        scheduleNextTick()
      }, nextSecond + 25)
    }

    scheduleNextTick()

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  return timestamp
}

function WorldClockFooter(): React.JSX.Element {
  const { token } = theme.useToken()
  const timestamp = useSecondTicker()
  const now = new Date(timestamp)
  const [usageMetrics, setUsageMetrics] = useState({ cpuPercent: 0, memoryMB: 0 })

  const wrapperStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      height: 40,
      border: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgContainer,
      borderRadius: 14,
      padding: '0 10px',
      overflow: 'hidden'
    }),
    [token.colorBgContainer, token.colorBorderSecondary]
  )

  const itemStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      height: 28,
      minWidth: 0,
      width: 0,
      flex: 1,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: 999,
      background: token.colorFillQuaternary,
      padding: '0 8px'
    }),
    [token.colorBorderSecondary, token.colorFillQuaternary]
  )

  const metricsStyle = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      height: 28,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: 999,
      background: token.colorFillTertiary,
      padding: '0 10px',
      flexShrink: 0
    }),
    [token.colorBorderSecondary, token.colorFillTertiary]
  )

  useEffect(() => {
    let disposed = false

    // 页脚每秒同步一次主进程指标，用轻量轮询展示当前程序的 CPU 和内存占用。
    const syncUsageMetrics = async (): Promise<void> => {
      try {
        const nextMetrics = await window.api.getAppUsageMetrics()

        if (!disposed) {
          setUsageMetrics(nextMetrics)
        }
      } catch {
        if (!disposed) {
          setUsageMetrics({ cpuPercent: 0, memoryMB: 0 })
        }
      }
    }

    void syncUsageMetrics()

    return () => {
      disposed = true
    }
  }, [timestamp])

  return (
    <div style={wrapperStyle}>
      {/* 页脚时钟压缩成单行紧凑布局，避免头尾占据过多垂直空间。 */}
      <Flex align="center" justify="space-between" gap={10} wrap={false} style={{ width: '100%', minWidth: 0 }}>
        <Flex align="center" gap={8} wrap={false} style={{ minWidth: 0, flex: 1 }}>
          {CLOCKS.map((clock) => (
            <div key={clock.key} style={itemStyle}>
              <Flex align="center" gap={6} justify="center" wrap={false} style={{ width: '100%', minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    height: 18,
                    width: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: `1px solid ${token.colorBorderSecondary}`
                  }}
                >
                  <img alt={clock.label} src={clock.flag} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                </span>
                <Typography.Text
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: token.colorTextSecondary
                  }}
                >
                  {`${clock.label} (${clock.city})`}
                </Typography.Text>
                <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                  {TIME_FORMATTERS[clock.timeZone].format(now)}
                </Typography.Text>
              </Flex>
            </div>
          ))}
        </Flex>

        <div style={metricsStyle}>
          <Flex align="center" gap={10} wrap={false}>
            <Typography.Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
              CPU <strong>{usageMetrics.cpuPercent.toFixed(1)}%</strong>
            </Typography.Text>
            <Typography.Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
              MEM <strong>{usageMetrics.memoryMB} MB</strong>
            </Typography.Text>
          </Flex>
        </div>
      </Flex>
    </div>
  )
}

export default WorldClockFooter
