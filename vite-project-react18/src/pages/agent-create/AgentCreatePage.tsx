import { useEffect, useMemo, useState } from 'react'
import { useRequest } from 'ahooks'
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SearchOutlined,
  StarOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router'

import {
  createAgentApi,
  getAgentApi,
  type AgentApiItem,
  updateAgentApi,
} from '@/api/agentApi'
import { getAllSkillsApi, type SkillApiItem } from '@/api/skillApi'
import { getAllToolsApi, type GetAllToolsApiItem } from '@/api/tool/toolApi'
import { getEmployeeId } from '@/utils/userUtils'
import type { AgentFormData } from '@/pages/agent-create/components/agentFormTypes'
import {
  AGENT_MODEL_PRESETS,
  AGENT_MODEL_PRESET_MAP,
  DEFAULT_AGENT_MODEL,
} from '@/pages/agent-create/modelPresets'
import ToolDetailModal from '@/pages/agent-create/components/ToolSelection/ToolDetailModal'
import ToolInfoCard from '@/pages/agent-create/components/ToolSelection/ToolInfoCard'
import ToolSelectionModal from '@/pages/agent-create/components/ToolSelection/ToolSelectionModal'
import './agentCreatePage.css'

const { Text, Title } = Typography
const { TextArea } = Input
const ALL_SKILL_CATEGORIES = 'All categories'

const TYPE_OPTIONS = [
  { label: 'assistant', value: 'assistant' },
  { label: 'reasoning', value: 'reasoning' },
  { label: 'multimodal', value: 'multimodal' },
  { label: 'workflow', value: 'workflow' },
  { label: 'retrieval', value: 'retrieval' },
]

const OUTPUT_TYPE_OPTIONS = [
  { label: 'markdown', value: 'markdown' },
  { label: 'text', value: 'text' },
  { label: 'json', value: 'json' },
  { label: 'html', value: 'html' },
]

const buildInitialValues = (staffId: string): AgentFormData => {
  const preset = AGENT_MODEL_PRESET_MAP[DEFAULT_AGENT_MODEL]

  return {
    name: '',
    type: preset.defaults.type,
    icon: '',
    modelName: preset.modelName,
    systemPrompt: '',
    callCount: 0,
    temperature: preset.defaults.temperature,
    maxTokens: preset.defaults.maxTokens,
    topP: preset.defaults.topP,
    frequencyPenalty: preset.defaults.frequencyPenalty,
    presencePenalty: preset.defaults.presencePenalty,
    outputType: preset.defaults.outputType,
    createUser: staffId,
    tools: [],
    skills: [],
    tags: [],
  }
}

const normalizeOptionalText = (value?: string) => {
  const nextValue = value?.trim()
  return nextValue ? nextValue : undefined
}

const parseMultiValue = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? []

const findToolByStoredValue = (tools: GetAllToolsApiItem[], value: string) =>
  tools.find((tool) => tool.tool_name === value || tool.tool_full_name === value)

const parseTemplateSchemas = (value?: string): Record<string, unknown> => {
  if (!value?.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

const parseSkillIds = (value?: string) => {
  const parsed = parseTemplateSchemas(value)
  const rawSkillIds = parsed.skillIds ?? parsed.skills

  if (!Array.isArray(rawSkillIds)) {
    return []
  }

  return rawSkillIds
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const buildTemplateSchemas = (value: string | undefined, skillIds: string[]) => {
  const parsed = parseTemplateSchemas(value)
  const nextSkillIds = Array.from(new Set(skillIds.map((item) => item.trim()).filter(Boolean)))

  if (nextSkillIds.length > 0) {
    parsed.skillIds = nextSkillIds
  } else {
    delete parsed.skillIds
  }

  return Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : undefined
}

const findSkillById = (skills: SkillApiItem[], skillId: string) =>
  skills.find((skill) => skill.id === skillId)

const getSkillCategory = (skill: SkillApiItem) => skill.tags[0] || 'General'

const getSkillInstallLabel = (skill: SkillApiItem, index: number) => {
  const installCount = skill.installCount ?? Math.max(0, index) * 100
  if (installCount >= 1000) {
    return `${(installCount / 1000).toFixed(1)}k installs`
  }

  return `${installCount} installs`
}

const getSkillCommand = (skill: SkillApiItem) => `/${skill.commandName || skill.id}`

const getSkillInvocationLabel = (skill: SkillApiItem) => {
  if (skill.disableModelInvocation) {
    return 'Manual only'
  }

  if (skill.userInvocable === false) {
    return 'Model only'
  }

  return 'Auto + slash'
}

const addFrontmatterLine = (lines: string[], key: string, value?: string | null) => {
  if (value?.trim()) {
    lines.push(`${key}: ${value.trim()}`)
  }
}

const addFrontmatterList = (lines: string[], key: string, values?: string[]) => {
  if (values?.length) {
    lines.push(`${key}: ${values.join(' ')}`)
  }
}

const buildSkillMarkdownPreview = (skill: SkillApiItem) => {
  const lines = ['---']
  addFrontmatterLine(lines, 'name', skill.commandName || skill.id)
  addFrontmatterLine(lines, 'description', skill.description)
  addFrontmatterLine(lines, 'when_to_use', skill.whenToUse)
  addFrontmatterLine(lines, 'argument-hint', skill.argumentHint)
  addFrontmatterList(lines, 'arguments', skill.arguments)
  addFrontmatterList(lines, 'allowed-tools', skill.allowedTools)
  addFrontmatterList(lines, 'paths', skill.paths)

  if (skill.disableModelInvocation) {
    lines.push('disable-model-invocation: true')
  }

  if (skill.userInvocable === false) {
    lines.push('user-invocable: false')
  }

  addFrontmatterLine(lines, 'model', skill.model)
  addFrontmatterLine(lines, 'effort', skill.effort)
  addFrontmatterLine(lines, 'context', skill.context)
  addFrontmatterLine(lines, 'agent', skill.agent)
  lines.push('---', '', skill.content)

  return lines.join('\n')
}

const buildFormValuesFromAgent = (agent: AgentApiItem): AgentFormData => ({
  name: agent.name || '',
  type: agent.type || AGENT_MODEL_PRESET_MAP[agent.modelName || DEFAULT_AGENT_MODEL]?.defaults.type,
  icon: agent.icon || '',
  modelName: agent.modelName || DEFAULT_AGENT_MODEL,
  systemPrompt: agent.systemPrompt || '',
  callCount: agent.callCount ?? 0,
  temperature: agent.temperature,
  maxTokens: agent.maxTokens,
  topP: agent.topP,
  frequencyPenalty: agent.frequencyPenalty,
  presencePenalty: agent.presencePenalty,
  outputType:
    agent.outputType || AGENT_MODEL_PRESET_MAP[agent.modelName || DEFAULT_AGENT_MODEL]?.defaults.outputType,
  createUser: agent.createUser || '',
  tools: parseMultiValue(agent.tools),
  skills: parseSkillIds(agent.templateSchemas),
  tags: parseMultiValue(agent.tags),
  templateSchemas: agent.templateSchemas,
})

const AgentCreatePage = () => {
  const [form] = Form.useForm<AgentFormData>()
  const [saving, setSaving] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(false)
  const [initialValues, setInitialValues] = useState<AgentFormData | null>(null)
  const [toolModalVisible, setToolModalVisible] = useState(false)
  const [skillHubOpen, setSkillHubOpen] = useState(false)
  const [skillHubSearch, setSkillHubSearch] = useState('')
  const [skillHubCategory, setSkillHubCategory] = useState(ALL_SKILL_CATEGORIES)
  const [activeHubSkillId, setActiveHubSkillId] = useState<string | null>(null)
  const [activeDetailTool, setActiveDetailTool] = useState<GetAllToolsApiItem | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const staffId = useMemo(() => getEmployeeId(), [])
  const navigate = useNavigate()
  const { id: agentId } = useParams<{ id: string }>()
  const isEditMode = Boolean(agentId)
  const { data: toolList = [], loading: loadingTools } = useRequest(getAllToolsApi)
  const { data: skillList = [], loading: loadingSkills } = useRequest(getAllSkillsApi)

  const watchedModelName = Form.useWatch('modelName', form) || DEFAULT_AGENT_MODEL
  const watchedTools = Form.useWatch('tools', { form, preserve: true }) || []
  const watchedSkills = Form.useWatch('skills', { form, preserve: true }) || []
  const currentPreset = AGENT_MODEL_PRESET_MAP[watchedModelName]
  const selectedTools = useMemo(
    () =>
      watchedTools
        .map((toolName) => findToolByStoredValue(toolList, toolName))
        .filter((tool): tool is GetAllToolsApiItem => Boolean(tool)),
    [toolList, watchedTools],
  )
  const selectedSkills = useMemo(
    () =>
      watchedSkills
        .map((skillId) => findSkillById(skillList, skillId))
        .filter((skill): skill is SkillApiItem => Boolean(skill)),
    [skillList, watchedSkills],
  )
  const activeHubSkill = useMemo(
    () => findSkillById(skillList, activeHubSkillId || '') || skillList[0] || null,
    [activeHubSkillId, skillList],
  )
  const skillCategories = useMemo(
    () => [
      ALL_SKILL_CATEGORIES,
      ...Array.from(new Set(skillList.map(getSkillCategory))).sort((left, right) =>
        left.localeCompare(right),
      ),
    ],
    [skillList],
  )
  const filteredHubSkills = useMemo(() => {
    const normalizedSearch = skillHubSearch.trim().toLowerCase()

    return skillList.filter((skill) => {
      const categoryMatches =
        skillHubCategory === ALL_SKILL_CATEGORIES || getSkillCategory(skill) === skillHubCategory
      const searchableText = [
        skill.name,
        skill.id,
        skill.commandName,
        skill.description,
        skill.whenToUse,
        skill.content,
        ...skill.tags,
        ...skill.triggerKeywords,
        ...skill.toolNames,
        ...(skill.allowedTools ?? []),
        ...(skill.resourceFiles ?? []),
      ].join(' ').toLowerCase()

      return categoryMatches && (!normalizedSearch || searchableText.includes(normalizedSearch))
    })
  }, [skillHubCategory, skillHubSearch, skillList])
  const featuredHubSkills = useMemo(
    () => skillList.slice(0, 3),
    [skillList],
  )

  useEffect(() => {
    const defaultValues = buildInitialValues(staffId)

    if (!agentId) {
      setInitialValues(defaultValues)
      form.setFieldsValue(defaultValues)
      return
    }

    let active = true
    setLoadingAgent(true)

    void getAgentApi(agentId)
      .then((agent) => {
        if (!active) {
          return
        }

        const nextValues = buildFormValuesFromAgent(agent)
        setInitialValues(nextValues)
        form.setFieldsValue(nextValues)
      })
      .catch((error) => {
        console.error('Failed to load agent detail:', error)
      })
      .finally(() => {
        if (active) {
          setLoadingAgent(false)
        }
      })

    return () => {
      active = false
    }
  }, [agentId, form, staffId])

  const applyModelPreset = (modelName: string) => {
    const preset = AGENT_MODEL_PRESET_MAP[modelName]
    if (!preset) {
      return
    }

    form.setFieldsValue({
      modelName,
      type: preset.defaults.type,
      temperature: preset.defaults.temperature,
      maxTokens: preset.defaults.maxTokens,
      topP: preset.defaults.topP,
      frequencyPenalty: preset.defaults.frequencyPenalty,
      presencePenalty: preset.defaults.presencePenalty,
      outputType: preset.defaults.outputType,
    })
  }

  const handleToolFormDataChange = (data: Partial<AgentFormData>) => {
    if (Array.isArray(data.tools)) {
      form.setFieldValue('tools', data.tools)
    }
  }

  const handleToggleSkill = (skillId: string) => {
    const currentSkillIds = Array.from(new Set(watchedSkills))

    form.setFieldValue(
      'skills',
      currentSkillIds.includes(skillId)
        ? currentSkillIds.filter((item) => item !== skillId)
        : [...currentSkillIds, skillId],
    )
  }

  const handleOpenSkillHub = (skillId?: string) => {
    setActiveHubSkillId(skillId || activeHubSkill?.id || skillList[0]?.id || null)
    setSkillHubOpen(true)
  }

  const handleSubmit = async (values: AgentFormData) => {
    setSaving(true)
    try {
      const payload = {
        name: values.name?.trim() || '',
        type: normalizeOptionalText(values.type),
        icon: normalizeOptionalText(values.icon),
        modelName: normalizeOptionalText(values.modelName),
        systemPrompt: normalizeOptionalText(values.systemPrompt),
        callCount: values.callCount ?? 0,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        topP: values.topP,
        frequencyPenalty: values.frequencyPenalty,
        presencePenalty: values.presencePenalty,
        outputType: normalizeOptionalText(values.outputType),
        createUser: normalizeOptionalText(values.createUser),
        tools: selectedTools.length > 0 ? selectedTools.map((tool) => tool.tool_name).join(',') : undefined,
        tags: values.tags && values.tags.length > 0 ? values.tags.join(',') : undefined,
        templateSchemas: buildTemplateSchemas(values.templateSchemas, values.skills ?? []),
      }

      const saved = isEditMode && agentId
        ? await updateAgentApi(agentId, payload)
        : await createAgentApi(payload)

      const nextValues = buildFormValuesFromAgent(saved)
      setInitialValues(nextValues)
      form.setFieldsValue(nextValues)
      messageApi.success(isEditMode ? 'Agent updated successfully.' : 'Agent created successfully.')

      if (!isEditMode) {
        navigate(`/agent-create/${saved.id}`, { replace: true })
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} agent:`, error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="agent-create-page">
      {contextHolder}
      <div className="agent-create-page__shell">
        <div className="agent-create-page__hero">
          <Title level={2} className="agent-create-page__title">
            {isEditMode ? 'Edit agent' : 'Create agent'}
          </Title>
        </div>

        <Spin spinning={loadingAgent}>
          <Form<AgentFormData>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="agent-create-page__form"
          >
            <Form.Item name="icon" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="callCount" hidden>
              <InputNumber />
            </Form.Item>
            <Form.Item name="createUser" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="tools" hidden>
              <Select mode="multiple" />
            </Form.Item>
            <Form.Item name="templateSchemas" hidden>
              <Input />
            </Form.Item>

            <div className="agent-create-page__grid">
              <div className="agent-create-page__left">
                <Card className="agent-create-page__card agent-create-page__card--prompt">
                  <div className="agent-create-page__section-head">
                    <div>
                      <Title level={4} className="agent-create-page__section-title">
                        System prompt
                      </Title>
                    </div>
                  </div>

                  <Form.Item
                    name="systemPrompt"
                    rules={[{ required: true, message: '请输入 system prompt。' }]}
                  >
                    <TextArea
                      autoSize={{ minRows: 20, maxRows: 30 }}
                      placeholder="定义 agent 的角色、目标、边界、工具使用规则、输出格式和拒答策略。"
                      className="agent-create-page__prompt-input"
                    />
                  </Form.Item>
                </Card>
              </div>

              <div className="agent-create-page__right">
                <Card className="agent-create-page__card">
                  <div className="agent-create-page__section-head">
                    <div>
                      <Title level={4} className="agent-create-page__section-title">
                        Basics
                      </Title>
                    </div>
                  </div>

                  <Row gutter={[12, 0]}>
                    <Col span={24}>
                      <Form.Item
                        label="Agent name"
                        name="name"
                        rules={[{ required: true, message: '请输入 agent 名称。' }]}
                      >
                        <Input maxLength={100} placeholder="例如：Release notes copilot" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Agent type" name="type">
                        <Select options={TYPE_OPTIONS} placeholder="Select type" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Output type" name="outputType">
                        <Select options={OUTPUT_TYPE_OPTIONS} placeholder="Select output type" />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item label="Tags" name="tags">
                        <Select
                          mode="tags"
                          tokenSeparators={[',']}
                          placeholder="输入标签后回车，例如 release-notes, jira"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                <Card className="agent-create-page__card">
                  <div className="agent-create-page__section-head">
                    <div>
                      <Title level={4} className="agent-create-page__section-title">
                        Skills
                      </Title>
                      <Text className="agent-create-page__inline-note">
                        已绑定 {selectedSkills.length} 个 skill，运行时按 Claude Code 的描述匹配或 /skill 调用注入
                      </Text>
                    </div>
                    <Button
                      type="default"
                      icon={<AppstoreOutlined />}
                      onClick={() => handleOpenSkillHub()}
                    >
                      Skill hub
                    </Button>
                  </div>

                  <div className="agent-create-page__skills-layout">
                    <div className="agent-create-page__skills-main">
                      <Form.Item name="skills">
                        <Select
                          mode="multiple"
                          loading={loadingSkills}
                          disabled={loadingSkills}
                          optionFilterProp="label"
                          placeholder="Select reusable model skills"
                          options={skillList.map((skill) => ({
                            value: skill.id,
                            label: `${skill.name} · ${skill.description}`,
                          }))}
                        />
                      </Form.Item>

                      <div className="agent-create-page__skills">
                        {loadingSkills ? (
                          <div className="agent-create-page__tools-loading">
                            <Spin />
                          </div>
                        ) : selectedSkills.length > 0 ? (
                          selectedSkills.map((skill) => (
                            <div key={skill.id} className="agent-skill-card">
                              <div className="agent-skill-card__header">
                                <Text className="agent-skill-card__title">{skill.name}</Text>
                                <Text className="agent-skill-card__id">{getSkillCommand(skill)}</Text>
                              </div>
                              <Text className="agent-skill-card__description">
                                {skill.description}
                              </Text>
                              <div className="agent-skill-card__tags">
                                <Tag bordered={false} color="green">
                                  {getSkillInvocationLabel(skill)}
                                </Tag>
                                {skill.triggerKeywords.slice(0, 4).map((keyword) => (
                                  <Tag key={keyword} bordered={false}>
                                    {keyword}
                                  </Tag>
                                ))}
                                {skill.toolNames.map((toolName) => (
                                  <Tag key={toolName} bordered={false} color="red">
                                    {toolName}
                                  </Tag>
                                ))}
                                {(skill.allowedTools ?? []).map((toolName) => (
                                  <Tag key={toolName} bordered={false} color="purple">
                                    {toolName}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="agent-create-page__tools-empty">
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No skills selected"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <aside className="agent-skill-hub-rail">
                      <div className="agent-skill-hub-rail__head">
                        <div>
                          <Text className="agent-skill-hub-rail__eyebrow">Registry</Text>
                          <Text className="agent-skill-hub-rail__title">Skill hub</Text>
                        </div>
                        <SafetyCertificateOutlined className="agent-skill-hub-rail__icon" />
                      </div>
                      <div className="agent-skill-hub-rail__stats">
                        <span>{skillList.length} skills</span>
                        <span>{skillCategories.length - 1} categories</span>
                      </div>
                      <div className="agent-skill-hub-rail__featured">
                        {featuredHubSkills.map((skill) => {
                          const isBound = watchedSkills.includes(skill.id)

                          return (
                            <button
                              key={skill.id}
                              type="button"
                              className="agent-skill-hub-rail__item"
                              onClick={() => handleOpenSkillHub(skill.id)}
                            >
                              <span>
                                <strong>{skill.name}</strong>
                                <small>{getSkillCategory(skill)}</small>
                              </span>
                              {isBound ? <CheckCircleOutlined /> : <EyeOutlined />}
                            </button>
                          )
                        })}
                      </div>
                      <Button
                        type="primary"
                        block
                        icon={<AppstoreOutlined />}
                        onClick={() => handleOpenSkillHub()}
                      >
                        Browse hub
                      </Button>
                    </aside>
                  </div>
                </Card>

                <Card className="agent-create-page__card">
                  <div className="agent-create-page__section-head">
                    <div>
                      <Title level={4} className="agent-create-page__section-title">
                        Model
                      </Title>
                    </div>

                    <Button
                      type="text"
                      icon={<ReloadOutlined />}
                      onClick={() => applyModelPreset(watchedModelName)}
                    >
                      恢复推荐值
                    </Button>
                  </div>

                  <Form.Item
                    label="Model name"
                    name="modelName"
                    rules={[{ required: true, message: '请选择模型。' }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      onChange={applyModelPreset}
                      options={AGENT_MODEL_PRESETS.map((preset) => ({
                        value: preset.modelName,
                        label: `${preset.label} · ${preset.family}`,
                      }))}
                    />
                  </Form.Item>

                  {currentPreset ? (
                    <Text className="agent-create-page__inline-note">
                      {currentPreset.summary}
                    </Text>
                  ) : null}

                  <Row gutter={[12, 0]}>
                    <Col span={12}>
                      <Form.Item label="Temperature" name="temperature">
                        <InputNumber min={0} max={2} step={0.1} precision={2} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Top P" name="topP">
                        <InputNumber min={0} max={1} step={0.05} precision={2} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Max tokens" name="maxTokens">
                        <InputNumber min={1} max={100000} step={256} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Frequency penalty" name="frequencyPenalty">
                        <InputNumber min={-2} max={2} step={0.1} precision={2} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Presence penalty" name="presencePenalty">
                        <InputNumber min={-2} max={2} step={0.1} precision={2} className="w-full" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                <Card className="agent-create-page__card">
                  <div className="agent-create-page__section-head">
                    <div>
                      <Title level={4} className="agent-create-page__section-title">
                        Tools
                      </Title>
                      <Text className="agent-create-page__inline-note">
                        已选择 {selectedTools.length} 个工具
                      </Text>
                    </div>
                    <Button
                      type="default"
                      icon={<PlusOutlined />}
                      onClick={() => setToolModalVisible(true)}
                    >
                      Add tools
                    </Button>
                  </div>

                  <div className="agent-create-page__tools">
                    {loadingTools ? (
                      <div className="agent-create-page__tools-loading">
                        <Spin />
                      </div>
                    ) : selectedTools.length > 0 ? (
                      selectedTools.map((tool) => (
                        <ToolInfoCard
                          key={tool.tool_full_name}
                          tool={tool}
                          onViewDetails={() => setActiveDetailTool(tool)}
                          formData={{ tools: watchedTools }}
                          onFormDataChange={handleToolFormDataChange}
                        />
                      ))
                    ) : (
                      <div className="agent-create-page__tools-empty">
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No tools selected"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            <div className="agent-create-page__footer">
              <Button
                onClick={() => {
                  form.setFieldsValue(initialValues || buildInitialValues(staffId))
                }}
                disabled={saving}
              >
                Reset
              </Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                {isEditMode ? 'Update agent' : 'Create agent'}
              </Button>
            </div>
          </Form>
        </Spin>

        <ToolSelectionModal
          toolModalVisible={toolModalVisible}
          setToolModalVisible={setToolModalVisible}
          formData={{ tools: watchedTools }}
          onFormDataChange={handleToolFormDataChange}
          toolList={toolList}
          loading={loadingTools}
        />

        <Drawer
          open={skillHubOpen}
          onClose={() => setSkillHubOpen(false)}
          width="min(1120px, calc(100vw - 32px))"
          title={(
            <div className="skill-hub-drawer__title">
              <AppstoreOutlined />
              <span>Skill hub</span>
              <Tag bordered={false}>{skillList.length} skills</Tag>
            </div>
          )}
          styles={{
            body: {
              padding: 0,
            },
          }}
        >
          <div className="skill-hub">
            <div className="skill-hub__sidebar">
              <div className="skill-hub__search">
                <Input
                  value={skillHubSearch}
                  onChange={(event) => setSkillHubSearch(event.target.value)}
                  placeholder="Search skills, tags, triggers"
                  prefix={<SearchOutlined />}
                  allowClear
                />
                <Select
                  value={skillHubCategory}
                  onChange={(value) => {
                    setSkillHubCategory(value)
                    setActiveHubSkillId(null)
                  }}
                  options={skillCategories.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                />
              </div>

              <div className="skill-hub__catalog">
                {loadingSkills ? (
                  <div className="skill-hub__loading">
                    <Spin />
                  </div>
                ) : filteredHubSkills.length > 0 ? (
                  filteredHubSkills.map((skill) => {
                    const isActive = activeHubSkill?.id === skill.id
                    const isBound = watchedSkills.includes(skill.id)
                    const installLabel = getSkillInstallLabel(
                      skill,
                      skillList.findIndex((item) => item.id === skill.id),
                    )

                    return (
                      <button
                        key={skill.id}
                        type="button"
                        className={[
                          'skill-hub__catalog-card',
                          isActive ? 'skill-hub__catalog-card--active' : '',
                        ].join(' ')}
                        onClick={() => setActiveHubSkillId(skill.id)}
                      >
                        <span className="skill-hub__catalog-main">
                          <span className="skill-hub__catalog-title">
                            {skill.name}
                            {isBound ? <CheckCircleOutlined /> : null}
                          </span>
                          <span className="skill-hub__catalog-description">
                            {skill.description}
                          </span>
                          <span className="skill-hub__catalog-meta">
                            <StarOutlined />
                            {installLabel}
                            <span>{getSkillCategory(skill)}</span>
                            <span>{getSkillInvocationLabel(skill)}</span>
                            <span>{getSkillCommand(skill)}</span>
                          </span>
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No skills matched" />
                )}
              </div>
            </div>

            <div className="skill-hub__detail">
              {activeHubSkill ? (
                <>
                  <div className="skill-hub__detail-head">
                    <div>
                      <Text className="skill-hub__detail-eyebrow">Claude Code style SKILL.md package</Text>
                      <Title level={3} className="skill-hub__detail-title">
                        {activeHubSkill.name}
                      </Title>
                      <Text className="skill-hub__detail-description">
                        {activeHubSkill.description}
                      </Text>
                      <Text className="skill-hub__code-chip">
                        {getSkillCommand(activeHubSkill)}
                        {activeHubSkill.argumentHint ? ` ${activeHubSkill.argumentHint}` : ''}
                      </Text>
                    </div>
                    <Button
                      type={watchedSkills.includes(activeHubSkill.id) ? 'default' : 'primary'}
                      icon={watchedSkills.includes(activeHubSkill.id) ? <CheckCircleOutlined /> : <PlusOutlined />}
                      onClick={() => handleToggleSkill(activeHubSkill.id)}
                    >
                      {watchedSkills.includes(activeHubSkill.id) ? 'Remove from agent' : 'Bind to agent'}
                    </Button>
                  </div>

                  <div className="skill-hub__detail-grid">
                    <div className="skill-hub__metric">
                      <span>Source</span>
                      <strong>{activeHubSkill.source || 'Core registry'}</strong>
                    </div>
                    <div className="skill-hub__metric">
                      <span>Invocation</span>
                      <strong>{getSkillInvocationLabel(activeHubSkill)}</strong>
                    </div>
                    <div className="skill-hub__metric">
                      <span>Command</span>
                      <strong>{getSkillCommand(activeHubSkill)}</strong>
                    </div>
                    <div className="skill-hub__metric">
                      <span>Package</span>
                      <strong>{activeHubSkill.sourcePath ? 'SKILL.md' : 'Built-in'}</strong>
                    </div>
                    <div className="skill-hub__metric">
                      <span>Author</span>
                      <strong>{activeHubSkill.author || 'Core Team'}</strong>
                    </div>
                    <div className="skill-hub__metric">
                      <span>Status</span>
                      <strong>{watchedSkills.includes(activeHubSkill.id) ? 'Bound' : 'Available'}</strong>
                    </div>
                  </div>

                  <Space size={[8, 8]} wrap className="skill-hub__tag-row">
                    {activeHubSkill.tags.map((tag) => (
                      <Tag key={tag} bordered={false}>
                        {tag}
                      </Tag>
                    ))}
                    {activeHubSkill.triggerKeywords.map((keyword) => (
                      <Tag key={keyword} bordered={false} color="blue">
                        {keyword}
                      </Tag>
                    ))}
                    {activeHubSkill.toolNames.map((toolName) => (
                      <Tag key={toolName} bordered={false} color="red">
                        {toolName}
                      </Tag>
                    ))}
                    {(activeHubSkill.allowedTools ?? []).map((toolName) => (
                      <Tag key={toolName} bordered={false} color="purple">
                        {toolName}
                      </Tag>
                    ))}
                    {activeHubSkill.disableModelInvocation ? (
                      <Tag bordered={false} color="gold">
                        disable-model-invocation
                      </Tag>
                    ) : null}
                    {activeHubSkill.userInvocable === false ? (
                      <Tag bordered={false} color="gold">
                        user-invocable: false
                      </Tag>
                    ) : null}
                  </Space>

                  <div className="skill-hub__section">
                    <Text className="skill-hub__section-title">Rendered SKILL.md</Text>
                    <pre className="skill-hub__skill-md">
{buildSkillMarkdownPreview(activeHubSkill)}
                    </pre>
                  </div>

                  {activeHubSkill.resourceFiles?.length ? (
                    <div className="skill-hub__section">
                      <Text className="skill-hub__section-title">Supporting files</Text>
                      <div className="skill-hub__resource-list">
                        {activeHubSkill.resourceFiles.map((filePath) => (
                          <span key={filePath}>{filePath}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="skill-hub__section">
                    <Text className="skill-hub__section-title">Usage</Text>
                    <div className="skill-hub__usage">
                      <span>Bind this skill to the agent so its description can trigger automatic loading.</span>
                      <span>Type {getSkillCommand(activeHubSkill)} in chat, or select it in the composer, for manual loading.</span>
                      <span>Only the invoked SKILL.md body is injected; supporting files stay as lazy resources.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="skill-hub__empty">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a skill to inspect" />
                </div>
              )}
            </div>
          </div>
        </Drawer>

        {activeDetailTool ? (
          <ToolDetailModal
            open={Boolean(activeDetailTool)}
            onClose={() => setActiveDetailTool(null)}
            tool={activeDetailTool}
          />
        ) : null}
      </div>
    </div>
  )
}

export default AgentCreatePage
