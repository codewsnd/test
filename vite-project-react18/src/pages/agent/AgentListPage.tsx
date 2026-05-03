import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useRequest } from 'ahooks'
import { Button, Card, Empty, Spin, Tag, Typography } from 'antd'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'

import { getAgentsApi, type AgentApiItem } from '@/api/agentApi'
import './agentListPage.css'

const { Paragraph, Text, Title } = Typography

const parseCommaList = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? []

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

const buildSubtitle = (agent: AgentApiItem) =>
  [agent.modelName, agent.type].filter(Boolean).join(' · ') || 'Unconfigured agent'

const AgentListPage = () => {
  const navigate = useNavigate()

  const {
    data: agents = [],
    loading,
    refresh,
  } = useRequest(getAgentsApi)

  const sortedAgents = useMemo(
    () =>
      [...agents].sort((left, right) => {
        const rightTime = right.updateTime ? new Date(right.updateTime).getTime() : 0
        const leftTime = left.updateTime ? new Date(left.updateTime).getTime() : 0
        return rightTime - leftTime
      }),
    [agents],
  )

  return (
    <div className="agent-list-page">
      <div className="agent-list-page__shell">
        <div className="agent-list-page__header">
          <Title level={2} className="agent-list-page__title">
            Agents
          </Title>

          <div className="agent-list-page__actions">
            <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agent-create')}>
              Create
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="agent-list-page__loading">
            <Spin size="large" />
          </div>
        ) : sortedAgents.length === 0 ? (
          <div className="agent-list-page__empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 agent">
              <Button type="primary" onClick={() => navigate('/agent-create')}>
                Create your first agent
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="agent-list-page__grid">
            {sortedAgents.map((agent) => {
              const tools = parseCommaList(agent.tools)
              const tags = parseCommaList(agent.tags)

              return (
                <Card
                  key={agent.id}
                  size="small"
                  className="agent-list-page__card"
                  extra={(
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/agent-create/${agent.id}`)}
                    >
                      Edit
                    </Button>
                  )}
                >
                  <Title level={5} className="agent-list-page__card-title">
                    {agent.name}
                  </Title>
                  <Text className="agent-list-page__card-subtitle">
                    {buildSubtitle(agent)}
                  </Text>

                  <Paragraph className="agent-list-page__prompt-preview">
                    {agent.systemPrompt || 'No system prompt'}
                  </Paragraph>

                  {tools.length > 0 ? (
                    <div className="agent-list-page__chip-row">
                      {tools.slice(0, 4).map((tool) => (
                        <Tag key={tool} bordered={false} className="agent-list-page__chip">
                          {tool}
                        </Tag>
                      ))}
                      {tools.length > 4 ? (
                        <Tag bordered={false} className="agent-list-page__chip">
                          +{tools.length - 4}
                        </Tag>
                      ) : null}
                    </div>
                  ) : null}

                  {tags.length > 0 ? (
                    <div className="agent-list-page__chip-row">
                      {tags.slice(0, 3).map((tag) => (
                        <Tag key={tag} bordered={false} className="agent-list-page__chip agent-list-page__chip--muted">
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  ) : null}

                  <div className="agent-list-page__meta">
                    <Text className="agent-list-page__meta-text">
                      Updated {formatDateTime(agent.updateTime)}
                    </Text>
                    {agent.createUser ? (
                      <Text className="agent-list-page__meta-text">
                        {agent.createUser}
                      </Text>
                    ) : null}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentListPage
