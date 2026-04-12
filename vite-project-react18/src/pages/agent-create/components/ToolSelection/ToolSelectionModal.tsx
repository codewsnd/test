import { useEffect, useRef, useMemo, useState } from 'react'
import { useRequest } from 'ahooks'
import {
  CloseOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Alert, Button, ConfigProvider, Input, Modal, Select, Spin, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import testCaseTheme from '@/styles/style'
import { getAllToolsApi } from '@/api/tool/toolApi'
import type { GetAllToolsApiItem, GetAllToolsApiParameter } from '@/api/tool/toolApi'
import type { AgentFormData } from '@/pages/agent-create/components/agentFormTypes'
import { capitalizeFirstLetter } from '@/utils/stringUtils'
import ToolItemCard from './ToolItemCard'
import { getToolIcon } from './IconConfig'

const { Paragraph, Text, Title } = Typography
const ALL_CATEGORIES = 'All categories'
const ALL_PROVIDERS = 'All providers'
const SORT_A_TO_Z = 'Alphabetically A-Z'
const SORT_Z_TO_A = 'Alphabetically Z-A'
const getToolProvider = (tool: GetAllToolsApiItem) => tool.provider

type ToolSelectionModalProps = {
  toolModalVisible: boolean
  setToolModalVisible: (visible: boolean) => void
  formData: AgentFormData
  onFormDataChange: (data: Partial<AgentFormData>) => void
}

type DetailRow = {
  key: string
  name: string
  description: string
  required: string
  defaultValue: string
}

type ToolActionAlert = {
  toolName: string
  action: 'added' | 'removed'
}

const buildParameterRows = (parameters: GetAllToolsApiParameter[]): DetailRow[] =>
  parameters.map((item, index) => ({
    key: `${item.param_name}-${index}`,
    name: `${item.param_name}\nString`,
    description: item.param_description,
    required: item.required ? 'Required' : 'Optional',
    defaultValue: '-',
  }))

const parameterColumns: ColumnsType<DetailRow> = [
  {
    title: 'Parameter / Type',
    dataIndex: 'name',
    key: 'name',
    render: (_, row) => (
      <div className="leading-5">
        <div className="whitespace-pre-line text-[13px] font-medium text-[#1f1f1f]">{row.name}</div>
      </div>
    ),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: 'Required',
    dataIndex: 'required',
    key: 'required',
    width: 90,
  },
  {
    title: 'Default',
    dataIndex: 'defaultValue',
    key: 'defaultValue',
    width: 90,
  },
]

const ToolSelectionModal = ({
  toolModalVisible,
  setToolModalVisible,
  formData,
  onFormDataChange,
}: ToolSelectionModalProps) => {
  const successAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)
  const [selectedProvider, setSelectedProvider] = useState(ALL_PROVIDERS)
  const [selectedSort, setSelectedSort] = useState(SORT_A_TO_Z)
  const [toolActionAlert, setToolActionAlert] = useState<ToolActionAlert | null>(null)

  const { data: toolList = [], loading } = useRequest(getAllToolsApi, {
    ready: toolModalVisible,
    refreshDeps: [toolModalVisible],
  })


  const visibleTools = useMemo(
    () => toolList.filter((tool) => !tool.is_hidden_in_tool),
    [toolList],
  )

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(visibleTools.map((tool) => tool.tool_category)))

    return [
      { value: ALL_CATEGORIES, label: ALL_CATEGORIES },
      ...categories.map((category) => ({
        value: category,
        label: capitalizeFirstLetter(category),
      })),
    ]
  }, [visibleTools])

  const providerOptions = useMemo(() => {
    const providers = Array.from(
      new Set(visibleTools.map((tool) => getToolProvider(tool)).filter(Boolean)),
    ) as string[]

    return [
      { value: ALL_PROVIDERS, label: ALL_PROVIDERS },
      ...providers.map((provider) => ({
        value: provider,
        label: capitalizeFirstLetter(provider),
      })),
    ]
  }, [visibleTools])

  const filteredTools = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase()

    const matchedTools = visibleTools.filter((tool) => {
      const matchCategory =
        selectedCategory === ALL_CATEGORIES || tool.tool_category === selectedCategory
      const matchProvider =
        selectedProvider === ALL_PROVIDERS || getToolProvider(tool) === selectedProvider

      const matchKeyword =
        normalizedKeyword.length === 0 ||
        tool.tool_name.toLowerCase().includes(normalizedKeyword) ||
        tool.tool_display_name.toLowerCase().includes(normalizedKeyword)

      return matchCategory && matchProvider && matchKeyword
    })

    return [...matchedTools].sort((left, right) => {
      const categorySortResult = left.tool_category.localeCompare(right.tool_category)

      if (categorySortResult !== 0) {
        return selectedSort === SORT_Z_TO_A ? -categorySortResult : categorySortResult
      }

      const displayNameSortResult = left.tool_display_name.localeCompare(right.tool_display_name)

      return selectedSort === SORT_Z_TO_A ? -displayNameSortResult : displayNameSortResult
    })
  }, [searchKeyword, selectedCategory, selectedProvider, selectedSort, visibleTools])

  const toolGroups = useMemo(() => {
    const grouped = new Map<string, GetAllToolsApiItem[]>()

    filteredTools.forEach((tool) => {
      const group = grouped.get(tool.tool_category) ?? []
      group.push(tool)
      grouped.set(tool.tool_category, group)
    })

    return Array.from(grouped.entries()).map(([title, tools]) => ({
      title,
      tools,
    }))
  }, [filteredTools])

  const selectedTool = useMemo(
    () => filteredTools.find((tool) => tool.tool_full_name === selectedToolId) ?? null,
    [filteredTools, selectedToolId],
  )

  const selectedToolAdded = selectedTool ? formData.tools.includes(selectedTool.tool_full_name) : false
  const detailActionLabel = selectedToolAdded ? 'Remove' : 'Add to agent'
  const detailActionIcon = selectedToolAdded ? <MinusCircleOutlined /> : <PlusCircleOutlined />

  useEffect(() => {
    if (!toolActionAlert) {
      return
    }

    if (successAlertTimerRef.current) {
      globalThis.clearTimeout(successAlertTimerRef.current)
    }

    successAlertTimerRef.current = globalThis.setTimeout(() => {
      setToolActionAlert(null)
      successAlertTimerRef.current = null
    }, 4000)

    return () => {
      if (successAlertTimerRef.current) {
        globalThis.clearTimeout(successAlertTimerRef.current)
        successAlertTimerRef.current = null
      }
    }
  }, [toolActionAlert])

  const handleSearch = () => {
    setSearchKeyword(searchInput)
    setSelectedToolId(null)
  }

  const handleReset = () => {
    setSearchInput('')
    setSearchKeyword('')
    setSelectedCategory(ALL_CATEGORIES)
    setSelectedProvider(ALL_PROVIDERS)
    setSelectedSort(SORT_A_TO_Z)
    setSelectedToolId(null)
  }

  const handleToggleTool = (tool: GetAllToolsApiItem) => {
    const willAdd = !formData.tools.includes(tool.tool_full_name)

    onFormDataChange({
      tools: formData.tools.includes(tool.tool_full_name)
        ? formData.tools.filter((item) => item !== tool.tool_full_name)
        : [...formData.tools, tool.tool_full_name],
    })

    setToolActionAlert({
      toolName: tool.tool_display_name,
      action: willAdd ? 'added' : 'removed',
    })
  }

  return (
      <ConfigProvider theme={testCaseTheme}>
        <Modal
          open={toolModalVisible}
          title={null}
          width="calc(100vw - 32px)"
          footer={null}
          closeIcon={<CloseOutlined className="text-[#595959]" />}
          onCancel={() => {
            setToolModalVisible(false)
            setSelectedToolId(null)
          }}
          style={{ top: 20, maxWidth: 1440 }}
          styles={{
            content: {
              padding: 0,
              overflow: 'hidden',
              borderRadius: 0,
            },
            body: {
              padding: 0,
            },
          }}
        >
          <div className="relative flex h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] min-h-0 flex-col overflow-hidden">
            {toolActionAlert ? (
              <div className="pointer-events-none absolute left-1/2 top-10 z-20 w-[300px] -translate-x-1/2">
                <Alert
                  type="success"
                  showIcon
                  message={(
                    <span>
                      {"Tool '"}
                      <strong>{toolActionAlert.toolName}</strong>
                      {`' ${toolActionAlert.action} successfully.`}
                    </span>
                  )}
                />
              </div>
            ) : null}
            <div className="px-4 pb-6 pt-5">
              <Title
                level={3}
                className="!mb-0 !mt-0 !text-[23px] !font-normal !leading-[30px] !text-[#1f1f1f]"
              >
                Select tool
              </Title>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full min-h-[320px] items-center justify-center">
                  <Spin size="large" />
                </div>
              ) : (
                <div
                  className={[
                    'min-h-full px-4 pb-5',
                    selectedTool ? 'grid grid-cols-[minmax(0,1fr)_440px] gap-8' : 'block',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'flex min-w-0 flex-col',
                      selectedTool ? 'border-r border-[#f0f0f0] pr-8' : '',
                    ].join(' ')}
                  >
                    <div className="shrink-0">
                      <div className="flex flex-wrap items-center gap-4">
                        <Input
                          value={searchInput}
                          onChange={(event) => setSearchInput(event.target.value)}
                          onPressEnter={handleSearch}
                          placeholder="Search by tool name / keywords"
                          prefix={<SearchOutlined className="text-[#8c8c8c]" />}
                          className="max-w-[460px] flex-1"
                        />
                        <Button className="hsbcbtn" onClick={handleSearch}>
                          Search
                        </Button>
                        <Button onClick={handleReset}>
                          Reset
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <Select
                          value={selectedCategory}
                          onChange={(value) => {
                            setSelectedCategory(value)
                            setSelectedToolId(null)
                          }}
                          className="!w-[220px]"
                          styles={{
                            selector: {
                              border: '1px solid #D7D8D6',
                            },
                          }}
                          options={categoryOptions}
                        />
                        <Select
                          value={selectedProvider}
                          onChange={(value) => {
                            setSelectedProvider(value)
                            setSelectedToolId(null)
                          }}
                          className="!w-[180px]"
                          styles={{
                            selector: {
                              border: '1px solid #D7D8D6',
                            },
                          }}
                          options={providerOptions}
                        />
                        <Button
                          type="link"
                          className="!px-0 !text-[14px] !font-medium !text-[#1f1f1f] underline"
                          onClick={handleReset}
                        >
                          Clear filter
                        </Button>

                        <div className="ml-auto flex items-center gap-4">
                          <span className="text-[16px] font-normal text-[#000000]">Sort by</span>
                          <Select
                            value={selectedSort}
                            onChange={(value) => setSelectedSort(value)}
                            variant="borderless"
                            className="!w-[180px]"
                            options={[
                              { value: SORT_A_TO_Z, label: SORT_A_TO_Z },
                              { value: SORT_Z_TO_A, label: SORT_Z_TO_A },
                            ]}
                          />
                        </div>
                      </div>

                      <Text className="mt-5 block !text-[16px] !font-normal !text-[#333333]">
                        Showing <span className="font-medium">{filteredTools.length}</span> tools
                        matched for your query
                      </Text>
                    </div>

                    <div className="mt-6 pr-2">
                      <div className="space-y-8">
                        {toolGroups.map((group) => (
                          <section key={group.title}>
                            <Title level={4} className="!mb-4 !text-[24px] !font-normal !text-[#1f1f1f]">
                              {capitalizeFirstLetter(group.title)}
                            </Title>
                            <div
                              className={[
                                'grid grid-cols-1 gap-4',
                                selectedTool ? 'xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3',
                              ].join(' ')}
                            >
                              {group.tools.map((tool) => (
                                <ToolItemCard
                                  key={tool.tool_full_name}
                                  tool={tool}
                                  selected={tool.tool_full_name === selectedToolId}
                                  added={formData.tools.includes(tool.tool_full_name)}
                                  onClick={() => setSelectedToolId(tool.tool_full_name)}
                                  onToggleAdd={() => handleToggleTool(tool)}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedTool ? (
                    <div className="flex min-h-full min-w-0 flex-col pr-1">
                      <div className="flex items-center justify-between gap-4">
                        <Text className="!text-[19px] !font-normal !leading-[28px] !text-[#000000]">
                          View details
                        </Text>
                        <Button
                          className="!h-[48px] !rounded-none !border-[#8c8c8c] !px-6 !text-[16px] !font-medium !text-[#1f1f1f]"
                          icon={detailActionIcon}
                          onClick={() => {
                            if (selectedTool) {
                              handleToggleTool(selectedTool)
                            }
                          }}
                        >
                          {detailActionLabel}
                        </Button>
                      </div>

                      <div className="mb-3 mt-6">
                        <div className="flex items-center gap-4">
                          <img
                            src={getToolIcon(selectedTool.icon)}
                            alt={capitalizeFirstLetter(selectedTool?.tool_display_name)}
                            className="h-12 w-12 object-contain"
                          />
                          <div className="min-w-0">
                            <Title level={3} className="!mb-0 !mt-0 !text-[22px] !font-medium !text-[#1f1f1f]">
                              {capitalizeFirstLetter(selectedTool?.tool_display_name)}
                            </Title>
                          </div>
                        </div>
                      </div>

                      <Paragraph className="!mb-0 !mt-0 !text-[14px] !font-[350] !leading-5 !text-[#333333]">
                        {selectedTool.tool_description}
                      </Paragraph>

                      <div className="mt-6 grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-3 pr-3 leading-5">
                        <span className="text-[12px] font-[350] text-[#333333]">Category</span>
                        <span className="text-[14px] font-medium text-[#333333]">
                          {selectedTool.tool_category}
                        </span>
                        <span className="text-[12px] font-[350] text-[#333333]">Provider</span>
                        <span className="text-[14px] font-medium text-[#333333]">
                          {getToolProvider(selectedTool)}
                        </span>
                        <span className="text-[12px] font-[350] text-[#333333]">Tool ID</span>
                        <span className="break-all text-[14px] font-medium text-[#333333]">
                          {selectedTool.tool_full_name}
                        </span>
                      </div>

                      <div className="mt-10">
                        <Title level={4} className="!mb-4 !text-[20px] !font-medium !text-[#1f1f1f]">
                          Parameters
                        </Title>
                        <Text className="!mb-3 block !text-[13px] !text-[#595959]">
                          Inputs ({selectedTool.parameters.length})
                        </Text>
                        <Table
                          rowKey="key"
                          columns={parameterColumns}
                          dataSource={buildParameterRows(selectedTool.parameters)}
                          pagination={false}
                          size="small"
                          bordered
                          className="tool-detail-table"
                        />
                      </div>

                      <div className="mt-auto flex justify-start pb-2 pt-8">
                        <Button
                          className="!h-[44px] !rounded-none !border-[#8c8c8c] !px-8 !text-[16px] !font-medium !text-[#1f1f1f]"
                          onClick={() => setSelectedToolId(null)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </Modal>
      </ConfigProvider>
  )
}

export default ToolSelectionModal
