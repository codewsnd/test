import { useMemo, useState } from 'react'
import { Button, Space, Spin } from 'antd'
import { getAllToolsApi, type GetAllToolsApiItem } from '@/api/tool/toolApi'
import ToolDetailModal from '@/pages/agent-create/components/ToolSelection/ToolDetailModal'
import ToolSelectionModal from '@/pages/agent-create/components/ToolSelection/ToolSelectionModal'
import ToolInfoCard from '@/pages/agent-create/components/ToolSelection/ToolInfoCard'
import type { AgentFormData } from '@/pages/agent-create/components/agentFormTypes'
import { useRequest } from 'ahooks'

const demoTool: GetAllToolsApiItem = {
  tool_name: 'get_jira_ticket_details',
  tool_display_name: 'Get Jira ticket details',
  mcp_server_name: 'JIRA',
  provider: 'JIRA',
  is_hidden_in_tool: false,
  tool_full_name: 'jira/get_jira_ticket_details',
  tool_category: 'Tasks & Project management',
  'tool_description': 'Retrieve full details of a Jira ticket, including assignee, comments, description, change log, and more.',
  tag: ['Tag 1', 'Tag 2'],
  parameters: [
    {
      param_name: 'jira_key',
      param_description: 'Target issue identifier or exact issue key.',
      required: true,
    },
    {
      param_name: 'source',
      param_description: 'Target Jira environment.',
      required: true,
    },
  ],
}

const ToolSelectionT = () => {
  const [toolDetailVisible, setToolDetailVisible] = useState(false)
  const [activeDetailTool, setActiveDetailTool] = useState<GetAllToolsApiItem>(demoTool)
  const [toolModalVisible, setToolModalVisible] = useState(false)
  const [formData, setFormData] = useState<AgentFormData>({ tools: [] })

  const { data: toolList = [], loading } = useRequest(getAllToolsApi, {
    ready: toolModalVisible,
    refreshDeps: [toolModalVisible],
  })

  const selectedTools = useMemo(
    () =>
      formData.tools
        .map((fullName) => toolList.find((tool) => tool.tool_full_name === fullName))
        .filter((tool): tool is GetAllToolsApiItem => Boolean(tool)),
    [formData.tools, toolList],
  )

  const handleOpenToolSelection = () => {
    setToolModalVisible(true)
  }

  const handleViewAndEditDetails = (tool: GetAllToolsApiItem) => {
    setActiveDetailTool(tool)
    setToolDetailVisible(true)
  }

  const onFormDataChange = (data: Partial<AgentFormData>) => {
    setFormData((current) => ({
      ...current,
      ...data,
    }))
  }

  return (
    <div className="space-y-6">
      <Space>
        <Button onClick={handleOpenToolSelection}>Open Tool Selection</Button>
        <Button
          onClick={() => {
            setActiveDetailTool(demoTool)
            setToolDetailVisible(true)
          }}
        >
          Show Tool Detail
        </Button>
      </Space>

      <ToolDetailModal
        open={toolDetailVisible}
        onClose={() => setToolDetailVisible(false)}
        tool={activeDetailTool}
      />

      <div className="space-y-4">
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center border border-[#f0f0f0] bg-white">
            <Spin />
          </div>
        ) : selectedTools.length > 0 ? (
          selectedTools.map((tool) => (
            <ToolInfoCard
              key={tool.tool_full_name}
              tool={tool}
              onViewDetails={() => handleViewAndEditDetails(tool)}
              formData={formData}
              onFormDataChange={onFormDataChange}
            />
          ))
        ) : (
          <div className="border border-dashed border-[#d9d9d9] bg-white px-5 py-8 text-[14px] text-[#8c8c8c]">
            No selected tools yet.
          </div>
        )}
      </div>

      <ToolSelectionModal
        toolModalVisible={toolModalVisible}
        setToolModalVisible={setToolModalVisible}
        formData={formData}
        onFormDataChange={onFormDataChange}
      />
    </div>
  )
}

export default ToolSelectionT
