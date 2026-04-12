import { Button, Dropdown, Modal, Typography } from 'antd'
import type { MenuProps } from 'antd'
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
    Modal.confirm({
      title: 'Confirm removal',
      icon: null,
      content: 'Are you sure you want to remove.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: { className: 'hsbcbtn' },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-col">
          <div className="mb-4 border-t border-gray-200"></div>
          <div className="flex justify-start gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        onFormDataChange({
          tools: formData.tools.filter((fullName) => fullName !== tool.tool_full_name),
        })
      },
    })
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'view',
      label: 'View and edit details',
      onClick: onViewDetails,
    },
    {
      key: 'remove',
      label: 'Remove',
      onClick: handleRemove,
    },
  ]

  return (
    <div style={{
      border: '1px solid #D7D8D6'
    }} className="flex max-h-[128px] items-start gap-3 border border-[#D7D8D6] bg-white p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white">
        <img src={iconSrc} alt={tool.tool_display_name} className="h-9 w-9 object-contain" />
      </div>

      <div className="min-w-0 flex-1">
        <Text className="!block !text-[16px] !font-normal !leading-6 !text-[#333333]">
          {capitalizeFirstLetter(tool?.tool_display_name)}
        </Text>
        <Text className="!mt-1 !block !text-[12px] !font-[350] !leading-4 !text-[#545454]">
          {tool.tool_full_name}
        </Text>
        <Paragraph
          ellipsis={{ rows: 2 }}
          className="!mb-0 !mt-2 !text-[14px] !font-[350] !leading-5 !text-[#333333]"
        >
          {tool.tool_description}
        </Paragraph>
      </div>

      <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
        <Button
          type="text"
          className="!my-auto !h-auto !min-w-0 !px-0 hover:!bg-transparent hover:!shadow-none"
        >
          <span className="flex flex-col items-center justify-center gap-[3px]">
            <span className="h-[4px] w-[4px] rounded-full bg-[#595959]" />
            <span className="h-[4px] w-[4px] rounded-full bg-[#595959]" />
            <span className="h-[4px] w-[4px] rounded-full bg-[#595959]" />
          </span>
        </Button>
      </Dropdown>
    </div>
  )
}

export default ToolInfoCard
