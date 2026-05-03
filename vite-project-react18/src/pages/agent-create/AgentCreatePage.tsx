import { useEffect, useMemo, useState } from 'react'
import { useRequest } from 'ahooks'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Spin,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router'

import {
  createAgentApi,
  getAgentApi,
  type AgentApiItem,
  updateAgentApi,
} from '@/api/agentApi'
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
  tags: parseMultiValue(agent.tags),
})

const AgentCreatePage = () => {
  const [form] = Form.useForm<AgentFormData>()
  const [saving, setSaving] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(false)
  const [initialValues, setInitialValues] = useState<AgentFormData | null>(null)
  const [toolModalVisible, setToolModalVisible] = useState(false)
  const [activeDetailTool, setActiveDetailTool] = useState<GetAllToolsApiItem | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const staffId = useMemo(() => getEmployeeId(), [])
  const navigate = useNavigate()
  const { id: agentId } = useParams<{ id: string }>()
  const isEditMode = Boolean(agentId)
  const { data: toolList = [], loading: loadingTools } = useRequest(getAllToolsApi)

  const watchedModelName = Form.useWatch('modelName', form) || DEFAULT_AGENT_MODEL
  const watchedTools = Form.useWatch('tools', { form, preserve: true }) || []
  const currentPreset = AGENT_MODEL_PRESET_MAP[watchedModelName]
  const selectedTools = useMemo(
    () =>
      watchedTools
        .map((toolName) => findToolByStoredValue(toolList, toolName))
        .filter((tool): tool is GetAllToolsApiItem => Boolean(tool)),
    [toolList, watchedTools],
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
