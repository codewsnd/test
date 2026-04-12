import React, {useState, useEffect} from 'react';
import {useRequest} from 'ahooks';
import {
  Button,
  Input,
  Select,
  Radio,
  Row,
  Col,
  Space,
  Typography,
  Form,
  message,
  Collapse,
  Tooltip,
  Spin,
} from 'antd';
import './radio.css'; // 导入 Radio 自定义样式
import {
  QuestionCircleOutlined,
} from '@ant-design/icons';
import {useAtom, useSetAtom} from 'jotai';
import {
  hideTestCaseSidebarAtom,
  testCaseJiraDocumentAom,
  testCaseMarkdownTableAom,
  testCaseCurrentViewAtom,
  testCaseExportResultAtom
} from './testCaseAtom';
import { activeConversationIdAtom } from '../conversationHistory/conversationHistoryAtom';
import {
  listJiraIssueLabels,
  exportApi,
  saveTestCaseStatistics, type IssueLabel,
} from '@/api/tool/testCaseApi';
import {getEmployeeId} from "@/utils/userUtils";
import { EditableTable } from './EditableTable';

const {Title} = Typography;
const {Option} = Select;

interface TestCaseStep {
  summary: string;
  content: string;
  step: string;
  result: string;
  data: string;
}

interface ExportData {
  source: string;
  staffId: string;
  projectKey: string;
  uploadType: string;
  theme?: string;
  linkType?: string;
  issues?: string;
  labels?: string[];
  assignee: string;
  step: TestCaseStep[] | string;
  issueType: string;
}

export const TestCaseForm: React.FC = () => {
  const hideTestCaseSidebar = useSetAtom(hideTestCaseSidebarAtom);
  const [testCaseJiraDocuments] = useAtom(testCaseJiraDocumentAom);
  const [testCaseMarkdownTable, setTestCaseMarkdownTable] = useAtom(testCaseMarkdownTableAom);
  const setCurrentView = useSetAtom(testCaseCurrentViewAtom);
  const setExportResult = useSetAtom(testCaseExportResultAtom);
  const [activeConversationId] = useAtom(activeConversationIdAtom);

  const [form] = Form.useForm();
  const [source, setSource] = useState<'wpb' | 'alm'>('wpb');
  const [loading, setLoading] = useState(false);
  const [uploadType, setUploadType] = useState<string>('single');
  const [isFormValid, setIsFormValid] = useState<boolean>(false);
  const [collapsePanelOpen, setCollapsePanelOpen] = useState<boolean>(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [labelQuery, setLabelQuery] = useState('');
  const [labelsOpen, setLabelsOpen] = useState(false);

  const {
    data: issueLabels = [] as IssueLabel[],
    loading: issueLabelsLoading,
  } = useRequest(
    () => listJiraIssueLabels(source === 'wpb' ? 'wpb-jira' : 'alm', labelQuery),
    {
      ready: labelsOpen,
      refreshDeps: [labelQuery, source],
      debounceWait: 300,
      onError: (error) => {
        console.error('Failed to load issue labels:', error);
        message.error('Failed to load issue labels');
      },
    }
  );

  // 加载Issue标签
  useEffect(() => {
    // Extract jiraKey from testCaseJiraDocuments
    const jiraKeys = testCaseJiraDocuments
      .filter(doc => doc.jiraKey && doc.jiraKey.length > 0)
      .flatMap(doc => doc.jiraKey || []);

    const firstJiraKey = jiraKeys.length > 0 ? jiraKeys[0] : '';
    const projectKey = firstJiraKey.match(/^([A-Z]+)/)?.[1] || '';

    // 设置默认值
    form.setFieldsValue({
      almType: source,
      assignee: getEmployeeId(),
      content: '123',
      issueType: 'Test',
      issues: jiraKeys.join(', '),
      linkType: 'Relates',
      projectKey: projectKey,
      uploadType: 'single',
      relationship: 'relates-to'
    });

    // 初始检查表单有效性
    setTimeout(() => checkFormValid(), 100);
  }, [form, testCaseJiraDocuments]);

  // 简化的StaffId验证（仅格式验证）
  const validateStaffIdField = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error('Please input assignee staff ID!'));
    }

    if (value.length !== 8 || !/^\d{8}$/.test(value)) {
      return Promise.reject(new Error('Staff ID must be exactly 8 digits!'));
    }

    return Promise.resolve();
  };

  // 检查表单是否有效
  const checkFormValid = () => {
    const values = form.getFieldsValue();
    const requiredFields = ['projectKey', 'issueType', 'assignee'];

    // 如果是single模式，summary也是必填的
    if (uploadType === 'single') {
      requiredFields.push('summary');
    }

    let isValid = requiredFields.every(field => {
      const value = values[field];
      return value && (Array.isArray(value) ? value.length > 0 : value.trim() !== '');
    });

    if ((values.labels ?? []).some((label: string) => /\s/.test(label))) {
      isValid = false;
    }

    setIsFormValid(isValid);
  };

  // 监听表单字段变化
  useEffect(() => {
    checkFormValid();
  }, [uploadType]);

  // 处理表单提交 - 调用exportApi
  const handleExport = async (values: any) => {
    setLoading(true);
    try {
      let stepsArray: TestCaseStep[] = [];
      let totalCount = 0;
      let acceptedCount = 0;
      let rejectedCount = 0;

      if (values.uploadType === 'multiple') {
        // 解析markdown表格
        const lines = testCaseMarkdownTable.trim().split('\n').filter(line => line.trim());
        if (lines.length >= 3) {
          const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
          const dataRows = lines.slice(2);

          // 找到对应列的索引
          const testCaseIdIndex = headers.findIndex(h => h === 'Test Case ID');
          const descriptionIndex = headers.findIndex(h => h === 'Test Case Description');
          const preconditionsIndex = headers.findIndex(h => h === 'Preconditions');
          const testStepsIndex = headers.findIndex(h => h === 'Test Steps');
          const expectedResultsIndex = headers.findIndex(h => h === 'Expected Results');

          // 过滤出被选中的行
          const selectedRows = dataRows.filter((_, index) => selectedRowKeys.includes(index));

          // 多选模式的统计
          totalCount = dataRows.length; // 总数是表格所有行
          acceptedCount = selectedRows.length; // 勾选的数量
          rejectedCount = totalCount - acceptedCount; // 未勾选的数量

          stepsArray = selectedRows.map(row => {
            const cells = row.split('|').map(c => c.trim());
            return {
              summary: cells[testCaseIdIndex + 1] || '',
              content: cells[descriptionIndex + 1] || '',
              step: cells[testStepsIndex + 1] || '',
              result: cells[expectedResultsIndex + 1] || '',
              data: cells[preconditionsIndex + 1] || ''
            };
          });
        }
      } else {
        // single 模式，总数为 1，统计参数都设置为 0
        totalCount = 1;
        acceptedCount = 0;
        rejectedCount = 0;
      }

      // 构建数据对象
      const exportData: ExportData = {
        source: source,
        staffId: getEmployeeId(),
        projectKey: values.projectKey,
        uploadType: values.uploadType,
        theme: values.summary,
        linkType: values.linkType,
        issues: values.issues,
        labels: values.labels,
        assignee: values.assignee,
        step: values.uploadType === 'multiple' ? stepsArray : testCaseMarkdownTable,
        issueType: values.issueType,
      };

      console.log('Export data:', exportData);

      // 调用exportApi
      const result = await exportApi(exportData);
      console.log('Export result:', result);

      // 存储结果到atom
      setExportResult(result);

      // Export 成功后，调用统计 API
      // 使用当前会话 ID 作为 sessionId
      if (activeConversationId) {
        await saveTestCaseStatistics({
          staffId: getEmployeeId(),
          sessionId: activeConversationId,
          generatedType: 'JIRA',
          uploadMode: values.uploadType === 'multiple' ? 'MULTIPLE' : 'SINGLE',
          totalGeneratedCount: totalCount,
          acceptedWithoutChangeCount: acceptedCount,
          acceptedWithChangeCount: 0,
          rejectedCount: rejectedCount,
        });
      } else {
        console.warn('No active conversation ID found, skipping statistics save');
      }

      setCurrentView('result');
    } catch (error: any) {
      console.error('Export failed:', error);
      message.error('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleExport}
      onFieldsChange={() => setTimeout(() => checkFormValid(), 50)}
      className="w-full"
    >
      <Space direction="vertical" className="w-full" size={20}>
        {/* 第一行：Export to JIRA */}
        <Title level={2} className="!m-0 !text-3xl">Export to JIRA</Title>

        {/* 第二行：Export to */}
        <Title level={2} className="!my-5 !mx-0 !text-lg">Export to</Title>

        {/* 第三行：Export Key 和 Issue type */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={'Source'}
              required={false}
            >
              <Select
                placeholder={'Select Source'}
                value={source}
                onChange={(value: 'wpb' | 'alm') => {
                  setSource(value);
                  form.setFieldValue('almType', value === 'wpb' ? 'wpb-jira' : 'alm');
                }}
              >
                <Option value={'wpb'}>WPB</Option>
                <Option value={'alm'}>ALM</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="projectKey"
              label="Export Key"
              rules={[{required: true, message: 'Please input export key!'}]}
              required={false}
            >
              <Input placeholder="Enter export key"/>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="issueType"
              label="Issue type"
              rules={[{required: true, message: 'Please input issue type!'}]}
              required={false}
            >
              <Input placeholder="Enter issue type"/>
            </Form.Item>
          </Col>
        </Row>

        {/* 第四行：Issue labels 和 Assignee's staff ID */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="labels"
              label="Issue labels (Optional)"
              required={false}
              normalize={(values: string[] | undefined)=> {
                const list = (values??[])
                  .map(v=>v.trim())
                  .filter(Boolean);
                return Array.from(new Set(list));
              }}
              rules={[
                {
                  validator: (_rule, values: string[] | undefined) => {
                    const hasSpace = (values ?? []).some(value => /\s/.test(value));
                    if (hasSpace) {
                      return Promise.reject(new Error('Issue labels cannot contain spaces.'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Select
                mode="tags"
                placeholder="Select issue labels"
                loading={issueLabelsLoading}
                filterOption={false}
                onSearch={setLabelQuery}
                onOpenChange={setLabelsOpen}
                notFoundContent={issueLabelsLoading ? <Spin size="small" /> : null}
              >
                {issueLabels.map(label => (
                  <Option key={label.value} value={label.value}>
                    {label.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="assignee"
              label="Assignee's staff ID"
              rules={[
                {validator: validateStaffIdField}
              ]}
              required={false}
            >
              <Input placeholder="Enter assignee's staff ID" maxLength={8}/>
            </Form.Item>
          </Col>
        </Row>

        {/* 第五行：Upload mode 单选按钮 - 上下两行 */}
        <Form.Item
          name="uploadType"
          label="Upload mode"
          rules={[{required: true, message: 'Please select upload mode!'}]}
          required={false}
        >
          <Radio.Group onChange={(e) => setUploadType(e.target.value)}>
            <Space direction="vertical">
              <Radio value="single">Group into a single ticket</Radio>
              <Radio value="multiple">Create individual tickets</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        {/* Summary field - shows when uploadType is single */}
        {uploadType === 'single' && (
          <Form.Item
            name="summary"
            label="Summary"
            rules={[
              {required: true, message: 'Summary is required when grouping into a single ticket!'}
            ]}
            required={false}
          >
            <Input placeholder="Enter summary"/>
          </Form.Item>
        )}

        {/* 第六行：Linked issues 标题 */}
        <Title level={3} className="!m-0 !text-lg">Linked issues</Title>

        {/* 第七行：Relationship 和 Issues */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="linkType"
              label="Relationship (Optional)"
              required={false}
            >
              <Select placeholder="Select relationship" className="w-full">
                <Option value="Relates">Relates to</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="issues"
              label={
                <Space>
                  Issues (Optional)
                  <Tooltip title="Enter one or more issue keys, eg. PRJ-123, PRJ-456">
                    <QuestionCircleOutlined className="text-gray-600"/>
                  </Tooltip>
                </Space>
              }
              required={false}
            >
              <Input placeholder="Enter issues"/>
            </Form.Item>
          </Col>
        </Row>

        {/* 第八行：Issues to be exported 标题 */}
        <Title level={3} className="!m-0 !text-lg">Issues to be exported</Title>

        {/* 折叠面板：Show issues */}
        <Collapse
          ghost
          defaultActiveKey={['1']}
          onChange={(key) => setCollapsePanelOpen(key.length > 0)}
          items={[
            {
              key: '1',
              label: collapsePanelOpen ? "Hide issues" : "Show issues",
              children: (
                <EditableTable
                  markdownTable={testCaseMarkdownTable}
                  onMarkdownChange={setTestCaseMarkdownTable}
                  uploadType={uploadType}
                  selectedRowKeys={selectedRowKeys}
                  onSelectedRowKeysChange={setSelectedRowKeys}
                />
              )
            }
          ]}
        />

        {/* 第九行：Cancel 和 Export 按钮 */}
        <div className="text-left">
          <Space>
            <Button onClick={hideTestCaseSidebar}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={loading || !isFormValid}
            >
              Export
            </Button>
          </Space>
        </div>
      </Space>
    </Form>
  );
};

export default TestCaseForm;
