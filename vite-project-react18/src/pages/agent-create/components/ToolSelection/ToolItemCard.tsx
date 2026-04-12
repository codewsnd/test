import { MinusCircleOutlined, PlusCircleOutlined, RightOutlined } from '@ant-design/icons'
import { Button, Card, Space, Tag, Typography } from 'antd'
import type { GetAllToolsApiItem } from '@/api/tool/toolApi'
import { capitalizeFirstLetter } from '@/utils/stringUtils'
import { getToolIcon } from './IconConfig'

const { Paragraph, Text } = Typography

export const ToolIcon = ({
  square = false,
  iconSize = 'card',
  src,
  alt,
}: {
  square?: boolean
  iconSize?: 'card' | 'detail'
  src: string
  alt: string
}) => {
  let imageSizeClass = 'h-6 w-6'

  if (square) {
    imageSizeClass = iconSize === 'detail' ? 'h-12 w-12' : 'h-8 w-8'
  }

  return (
    <div
      className={[
        'flex items-center justify-center overflow-hidden rounded-[14px] bg-white',
        square ? 'h-14 w-14' : 'h-10 w-10',
      ].join(' ')}
    >
      <img
        src={src}
        alt={alt}
        className={[
          'object-contain',
          imageSizeClass,
        ].join(' ')}
      />
    </div>
  )
}

const ToolItemCard = ({
  tool,
  selected,
  added,
  onClick,
  onToggleAdd,
}: {
  tool: GetAllToolsApiItem
  selected: boolean
  added: boolean
  onClick: () => void
  onToggleAdd: () => void
}) => {
  const toolIcon = getToolIcon(tool.icon)
  const displayTitle = capitalizeFirstLetter(tool?.tool_display_name)
  const actionLabel = added ? 'Remove' : 'Add to agent'
  const actionIcon = added ? <MinusCircleOutlined /> : <PlusCircleOutlined />
  const cardClassName = selected
    ? 'border-[#1f1f1f] bg-white'
    : 'border-[#ececec] bg-white hover:border-[#bfbfbf]'

  return (
    <Card
      onClick={onClick}
      className={[
        'w-full cursor-pointer rounded-none shadow-none transition-all',
        cardClassName,
      ].join(' ')}
      styles={{
        body: {
          padding: 16,
        },
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-3">
          <img src={toolIcon} width={'32px'} height={'32px'} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Text className="!text-[16px] !font-medium !leading-6 !text-[#333333]">
                {capitalizeFirstLetter(displayTitle)}
              </Text>
              <RightOutlined className="shrink-0 text-[18px] text-[#1f1f1f]" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <Paragraph
            ellipsis={{ rows: 2 }}
            className="!mb-0 !min-h-0 !text-[14px] !font-[350] !leading-6 !text-[#333333]"
          >
            {tool.tool_description}
          </Paragraph>

          <div className="mt-4 min-h-6">
            <Space size={[10, 10]} wrap>
              {tool.tag.map((tag) => (
                <Tag
                  key={tag}
                  className="!m-0 !flex !h-6 !items-center rounded-none border-[#ececec] bg-[#f5f5f5] !px-3 !py-0 text-[12px] text-[#434343]"
                >
                  {tag}
                </Tag>
              ))}
            </Space>
          </div>

          <div className="mt-4">
            <div className="border-t border-[#f0f0f0]" />
            <div className="mt-1 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-7">
              <span className="text-[#595959]">Tool ID</span>
              <span className="break-all font-medium text-[#1f1f1f]">{tool.tool_full_name}</span>
              <span className="text-[#595959]">Parameters</span>
              <span className="text-[#1f1f1f]">
                {tool.parameters.length > 0 ? tool.parameters.map((item) => item.param_name).join(', ') : '-'}
              </span>
            </div>
          </div>

          <Button
            type="text"
            icon={actionIcon}
            className="!mt-5 !ml-auto !h-auto !justify-end !px-0 !text-[16px] !font-medium !text-[#1f1f1f] hover:!bg-transparent hover:!shadow-none"
            onClick={(event) => {
              event.stopPropagation()
              onToggleAdd()
            }}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ToolItemCard
