import { Button, Typography } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import type { GetAllToolsApiItem } from '@/api/tool/toolApi'
import type { AgentFormData } from '@/pages/agent-create/components/agentFormTypes'
import { getToolIcon } from '@/pages/agent-create/components/ToolSelection/IconConfig'
import { capitalizeFirstLetter } from '@/utils/stringUtils'

const { Paragraph, Text } = Typography

type InfoCardProps = {
  tool: GetAllToolsApiItem
  onViewDetails: () => void
  formData: AgentFormData
  onFormDataChange: (data: Partial<AgentFormData>) => void
}

const ToolInfoCard = ({ tool, onViewDetails, formData, onFormDataChange }: InfoCardProps) => {
  const iconSrc = getToolIcon(tool.icon)

  const handleRemove = () => {
    onFormDataChange({
      tools: formData.tools.filter((toolName) => toolName !== tool.tool_name),
    })
  }

  return (
    <div className="agent-tool-card">
      <div className="agent-tool-card__main">
        <div className="agent-tool-card__icon-wrap">
          <img src={iconSrc} alt={tool.tool_display_name} className="agent-tool-card__icon" />
        </div>

        <div className="agent-tool-card__content">
          <Text className="agent-tool-card__title">
            {capitalizeFirstLetter(tool.tool_display_name)}
          </Text>
          <Text className="agent-tool-card__meta">{tool.tool_name}</Text>
          <Paragraph ellipsis={{ rows: 2 }} className="agent-tool-card__description">
            {tool.tool_description}
          </Paragraph>
        </div>
      </div>

      <div className="agent-tool-card__actions">
        <Button type="link" onClick={onViewDetails} className="agent-tool-card__link">
          Details
        </Button>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={handleRemove}
          className="agent-tool-card__remove"
        />
      </div>
    </div>
  )
}

export default ToolInfoCard
