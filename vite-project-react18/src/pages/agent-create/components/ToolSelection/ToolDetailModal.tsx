import { CloseOutlined } from '@ant-design/icons'
import { ConfigProvider, Modal, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { GetAllToolsApiItem, GetAllToolsApiParameter } from '@/api/tool/toolApi'
import testCaseTheme from '@/styles/style'
import { capitalizeFirstLetter } from '@/utils/stringUtils'
import { getToolIcon } from './IconConfig'

const { Paragraph, Text, Title } = Typography

type ToolDetailProps = {
  open: boolean
  onClose: () => void
  tool: GetAllToolsApiItem
}

type ParameterRow = {
  key: string
  name: string
  type: string
  description: string
  required: string
}

const buildParameterRows = (parameters: GetAllToolsApiParameter[]): ParameterRow[] =>
  parameters.map((item, index) => ({
    key: `${item.param_name}-${index}`,
    name: item.param_name,
    type: 'String',
    description: item.param_description,
    required: item.required ? 'Required' : 'Optional',
  }))

const parameterColumns: ColumnsType<ParameterRow> = [
  {
    title: 'Parameter',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    render: (value: string) => <span className="font-medium text-[#1f1f1f]">{value}</span>,
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    width: 110,
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
    width: 110,
  },
]

const ToolDetailModal = ({ open, onClose, tool }: ToolDetailProps) => {

  return (
    <ConfigProvider theme={testCaseTheme}>
      <Modal
        open={open}
        centered
        title={null}
        width="calc(100vw - 80px)"
        footer={null}
        closeIcon={<CloseOutlined className="text-[#595959]" />}
        onCancel={onClose}
        style={{ maxWidth: 1120 }}
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
        <div className="min-h-0 bg-white px-8 pb-8 pt-6">
          <div className="border-b border-[#f0f0f0] pb-5">
            <Text className="!text-[16px] !font-medium !text-[#1f1f1f]">Tool details</Text>

            <div className="mt-6 flex items-center gap-4">
              <img
                src={getToolIcon(tool.icon)}
                alt={capitalizeFirstLetter(tool?.tool_display_name)}
                className="h-12 w-12 object-contain"
              />
              <div className="min-w-0">
                <Title level={3} className="!mb-0 !text-[22px] !font-medium !leading-[30px] !text-[#1f1f1f]">
                  {capitalizeFirstLetter(tool?.tool_display_name)}
                </Title>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-x-6 gap-y-4 text-[13px] leading-6">
              <div>
                <div className="text-[#8c8c8c]">Category</div>
                <div className="mt-1 text-[#1f1f1f]">{tool.tool_category}</div>
              </div>
              <div>
                <div className="text-[#8c8c8c]">Provider</div>
                <div className="mt-1 text-[#1f1f1f]">{tool?.provider}</div>
              </div>
              <div>
                <div className="text-[#8c8c8c]">Tool ID</div>
                <div className="mt-1 break-all text-[#1f1f1f]">{tool.tool_full_name}</div>
              </div>
            </div>
          </div>

          <Paragraph className="!mb-0 !mt-6 !text-[13px] !leading-8 !text-[#595959]">
            {tool.tool_description}
          </Paragraph>

          <div className="mt-10">
            <Title level={4} className="!mb-3 !text-[20px] !font-medium !text-[#1f1f1f]">
              Parameters
            </Title>
            <Text className="!mb-4 block !text-[13px] !font-medium !text-[#1f1f1f]">
              Inputs ({tool.parameters.length})
            </Text>
            <Table
              rowKey="key"
              columns={parameterColumns}
              dataSource={buildParameterRows(tool.parameters)}
              pagination={false}
              size="small"
              bordered
              className="tool-detail-table"
            />
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  )
}

export default ToolDetailModal
