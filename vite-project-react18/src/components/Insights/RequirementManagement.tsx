import { useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Row,
  Col,
  Input,
  Pagination,
  Popconfirm,
  Typography,
  Select,
  Space,
  Tooltip,
  Dropdown,
  Flex,
  Modal,
  Divider,
  message
} from "antd";
import {
  LikeOutlined,
  UserOutlined,
  TagOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons';
import { useRequest } from "ahooks";
import { listFormApi } from "../../api/form";
import type { Form } from "../../models/form";
import { BQAForm } from "../BQA/BQAForm";
import {
  pageFormResponseApi,
  saveFormResponseApi,
  deleteFormResponseApi
} from "../../api/formResponse";
import type { FormResponse } from "../../models/formResponse";

const { Title } = Typography;
const { Paragraph, Text } = Typography;
const PAGE_SIZE = 12;

export const RequirementManagement = () => {
  const [page, setPage] = useState(1);
  const [searchValue, setSearchValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'likes' | 'createdAt' | 'updatedAt'>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentForm, setCurrentForm] = useState<Form>();
  const [currentResponse, setCurrentResponse] = useState<FormResponse>();

  // Fetch requirement list
  const {
    data: pageFormResponseApiData,
    loading: pageFormResponseApiLoading,
    run: refreshFormResponses
  } = useRequest(
    () => pageFormResponseApi(page, PAGE_SIZE, {
      search: searchValue,
      tags: selectedTags,
      sort: `${sortField},${sortDirection}`
    }),
    {
      refreshDeps: [page, searchValue, selectedTags, sortField, sortDirection],
      onError: (error: any) => {
        message.error('Failed to fetch requirements: ' + error.message);
      }
    }
  );

  // Fetch form templates
  const {
    data: formsData,
    loading: formsLoading
  } = useRequest(
    () => listFormApi({ module: 'requirement' }),
    {
      onError: (error: any) => {
        message.error('Failed to fetch form templates: ' + error.message);
      }
    }
  );

  // Save form response
  const {
    run: saveResponse,
    loading: saveResponseLoading
  } = useRequest(
    (formResponse: FormResponse) => saveFormResponseApi(formResponse),
    {
      manual: true,
      onSuccess: () => {
        message.success('Requirement saved successfully');
        refreshFormResponses();
        setShowAddModal(false);
        setShowViewModal(false);
      },
      onError: (error: any) => {
        message.error('Failed to save requirement: ' + error.message);
      }
    }
  );

  // Delete requirement
  const {
    run: deleteResponse,
    loading: deleteResponseLoading
  } = useRequest(
    (id: string) => deleteFormResponseApi(id),
    {
      manual: true,
      onSuccess: () => {
        message.success('Requirement deleted successfully');
        refreshFormResponses();
      },
      onError: (error: any) => {
        message.error('Failed to delete requirement: ' + error.message);
      }
    }
  );

  // Handle view requirement
  const handleView = (response: FormResponse, form: Form) => {
    setCurrentResponse(response);
    setCurrentForm(form);
    setShowViewModal(true);
  };

  // Handle submit requirement
  const handleSubmit = (values: Record<string, any>) => {
    if (currentForm?.id) {
      saveResponse({
        response: values,
        formId: currentForm.id,
        ...(showViewModal && { id: currentResponse?.id })
      });
    }
  };

  // Handle delete requirement
  const handleDelete = (id: string) => {
    deleteResponse(id);
  };

  // Handle like requirement
  const handleLike = (id: string) => {
    message.info('Like functionality to be implemented');
  };

  // Sort options
  const sortOptions = [
    { key: 'likes', label: 'Likes' },
    { key: 'updatedAt', label: 'Last Updated' },
    { key: 'createdAt', label: 'Created Date' }
  ];

  // Get tags from form response
  const getTags = (response: FormResponse) => {
    const tags = (response.response as any)?.['tags'];
    if (!tags) return [];
    return Array.isArray(tags) ? tags : [tags];
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {/* Top Toolbar */}
      <Flex justify="space-between" align="center" gap="middle">
        <Space size="middle">
          <Input.Search
            placeholder="Search by title or description"
            allowClear
            enterButton={<Button type="primary" icon={<SearchOutlined />} />}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ width: 300 }}
          />

          <Select
            style={{ width: 200 }}
            mode="multiple"
            allowClear
            placeholder="Filter by categories"
            value={selectedTags}
            onChange={setSelectedTags}
            suffixIcon={<TagOutlined />}
            maxTagCount="responsive"
          />

          <Dropdown
            menu={{
              items: sortOptions,
              onClick: (e) => setSortField(e.key as any),
              selectedKeys: [sortField]
            }}
          >
            <Button>
              Sort by: {sortField === 'likes' ? 'Likes' :
              sortField === 'updatedAt' ? 'Last Updated' :
                'Created Date'}
            </Button>
          </Dropdown>

          <Tooltip title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}>
            <Button
              icon={sortDirection === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? 'Asc' : 'Desc'}
            </Button>
          </Tooltip>
        </Space>

        <Dropdown
          menu={{
            items: formsData?.map((form) => ({
              label: form.name,
              key: form.id || '',
            })) || [],
            onClick: (e) => {
              const form = formsData?.find(item => item?.id === e.key);
              if (form) {
                setCurrentForm(form);
                setShowAddModal(true);
              }
            }
          }}
          placement="bottomLeft"
          arrow
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={formsLoading}
          >
            Add Requirement
          </Button>
        </Dropdown>
      </Flex>

      {/* Requirements List */}
      <Row gutter={[16, 24]}>
        {pageFormResponseApiData?.content?.map((response: FormResponse) => {
          const responseForm = formsData?.find(f => f.id === response.formId);
          const tags = getTags(response);
          const title = response.response?.['title'] || 'Untitled Requirement';
          const description = response.response?.['description'] || 'No description available';

          return (
            <Col key={response.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                title={
                  <Text strong ellipsis={{ tooltip: title }} style={{ display: 'block' }}>
                    {title}
                  </Text>
                }
                actions={[
                  <Tooltip title="Like">
                    <Button
                      type="text"
                      icon={<LikeOutlined />}
                      onClick={() => response.id && handleLike(response.id)}
                    >
                      {/* Like count will go here */}
                    </Button>
                  </Tooltip>,
                  <Tooltip title="View Details">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => responseForm && handleView(response, responseForm)}
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="Delete this requirement?"
                    onConfirm={() => response.id && handleDelete(response.id)}
                    okText="Confirm"
                    cancelText="Cancel"
                    disabled={deleteResponseLoading}
                  >
                    <Tooltip title="Delete">
                      <Button type="text" icon={<DeleteOutlined />} danger />
                    </Tooltip>
                  </Popconfirm>
                ]}
              >
                <Space direction="vertical" size="small" style={{ width: '100%', flex: 1 }}>
                  {/* Description */}
                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true, symbol: 'More' }}
                  >
                    {description}
                  </Paragraph>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <Flex align="center" gap="small">
                      <TagOutlined style={{ color: '#666' }} />
                      <Space wrap size={4}>
                        {tags.map((tag: string) => (
                          <Tag key={tag} color="blue">
                            {tag}
                          </Tag>
                        ))}
                      </Space>
                    </Flex>
                  )}

                  {/* Created Date */}
                  <Flex align="center" gap="small">
                    <ClockCircleOutlined style={{ color: '#666' }} />
                    <Text type="secondary">Created: {new Date(response.createdAt).toLocaleDateString()}</Text>
                  </Flex>

                  {/* Creator */}
                  <Flex align="center" gap="small">
                    <UserOutlined style={{ color: '#666' }} />
                    <Text type="secondary">Creator: </Text>
                    <Avatar src={response.createdBy || undefined} icon={<UserOutlined />} size={24} />
                    <Text type="secondary">{response.createdBy || 'Anonymous'}</Text>
                  </Flex>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Pagination */}
      {pageFormResponseApiData && (
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={pageFormResponseApiData.totalElements}
          onChange={setPage}
          showSizeChanger={false}
          showQuickJumper
          style={{ textAlign: 'center' }}
        />
      )}

      {/* Add Requirement Modal */}
      <Modal
        width={'60%'}
        open={showAddModal}
        footer={null}
        onCancel={() => setShowAddModal(false)}
        confirmLoading={saveResponseLoading}
      >
        <Title level={5}>{currentForm?.title}</Title>
        <Paragraph>
          {currentForm?.description}
        </Paragraph>
        <Divider />
        <BQAForm
          onSubmit={handleSubmit}
          formConfig={currentForm?.formConfig || []}
          loading={saveResponseLoading}
        />
      </Modal>

      {/* View Requirement Modal */}
      <Modal
        width={'60%'}
        open={showViewModal}
        footer={null}
        onCancel={() => setShowViewModal(false)}
        confirmLoading={saveResponseLoading}
      >
        <Title level={5}>{currentForm?.title}</Title>
        <Paragraph>
          {currentForm?.description}
        </Paragraph>
        <Divider />
        <BQAForm
          onSubmit={handleSubmit}
          formConfig={currentForm?.formConfig || []}
          initialValues={currentResponse?.response || {}}
          loading={saveResponseLoading}
        />
      </Modal>
    </Space>
  );
};
