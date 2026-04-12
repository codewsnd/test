import React, {useState, useEffect} from 'react';
import {
  Table,
  Button,
  Form as AntdForm,
  Input,
  Modal,
  message,
  Popconfirm,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Pagination,
} from 'antd';
import type {TableProps} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  AuditOutlined
} from '@ant-design/icons';
import {useRequest} from 'ahooks';
import {pageFormApi, saveFormApi, deleteFormApi} from '../../api/form';
import type {Form} from '../../models/form';
import {BQAForm} from "../../components/BQA/BQAForm";
import {formConfig} from "./form";
import {useNavigate} from "react-router";

export const FormManagement: React.FC = () => {

  const [searchForm] = AntdForm.useForm();
  const [currentRecord, setCurrentRecord] = useState<Form | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [data, setData] = useState<Form[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  // Load table data
  const loadData = async () => {
    setLoading(true);
    try {
      const values = searchForm.getFieldsValue();
      const result = await pageFormApi(
        pagination.page,
        pagination.pageSize,
        values
      );

      setData(result.content || []);
      setPagination({
        ...pagination,
        total: result.totalElements || 0,
      });
    } catch (error) {
      console.error('API Error:', error);
      message.error('Failed to fetch form data');
    } finally {
      setLoading(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    loadData();
  }, [pagination.page, pagination.pageSize]);

  // Save form
  const {run: saveForm} = useRequest(
    async (formData: Form) => {
      return saveFormApi(formData);
    },
    {
      manual: true,
      onSuccess: () => {
        message.success(`Form ${modalType === 'create' ? 'created' : 'updated'} successfully`);
        loadData();
        setShowModal(false);
      }
    }
  );

  // Delete form
  const {run: runDelete} = useRequest(
    async (id: string) => {
      return deleteFormApi({id});
    },
    {
      manual: true,
      onSuccess: () => {
        message.success('Form deleted successfully');
        loadData();
      }
    }
  );

  // Handle create
  const handleCreate = () => {
    setModalType('create');
    setCurrentRecord(null);
    setShowModal(true);
  };

  // Handle edit
  const handleEdit = (record: Form) => {
    setModalType('edit');
    setCurrentRecord(record);
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    runDelete(id);
  };

  // Handle search
  const handleSearch = () => {
    // Reset to first page
    setPagination({...pagination, page: 1});
    loadData();
  };

  // Handle reset search
  const handleReset = () => {
    searchForm.resetFields();
    setPagination({...pagination, page: 1});
    loadData();
  };

  // Handle pagination change
  const handlePaginationChange = (page: number, pageSize?: number) => {
    setPagination({
      ...pagination,
      page,
      pageSize: pageSize || pagination.pageSize,
    });
  };

  // Handle form submission
  const handleFormSubmit = (formData: any) => {
    saveForm(formData);
  };

  // Table column definitions
  const columns: TableProps<Form>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (text) => <Typography.Text ellipsis>{text}</Typography.Text>,
    },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 150,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Actions',
      key: 'action',
      fixed: 'right',
      width: 130,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<AuditOutlined/>}
            onClick={() => navigate(`/bqaFormDesigner?formId=` + record.id, {state: {activeMenu: 'sub3'}})}
          />
          <Button
            type="link"
            icon={<EditOutlined/>}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure to delete this form?"
            onConfirm={() => handleDelete(record.id || '')}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined/>}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{padding: 24}}>
      {/* Search and action bar */}
      <AntdForm form={searchForm}>
        <Row justify="space-between" style={{marginBottom: 16}}>
          <Col>
            <Space>
              <AntdForm.Item name="name" style={{marginBottom: 0}}>
                <Input
                  placeholder="Search by name"
                  suffix={<SearchOutlined/>}
                  style={{width: 200}}
                />
              </AntdForm.Item>
              <Button
                type="primary"
                icon={<SearchOutlined/>}
                onClick={handleSearch}
              >
                Search
              </Button>
              <Button onClick={handleReset}>Reset</Button>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined/>}
              onClick={handleCreate}
            >
              Create Form
            </Button>
          </Col>
        </Row>
      </AntdForm>

      {/* Form list */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        bordered
        loading={loading}
        pagination={false}
      />

      {/* Pagination */}
      <div style={{marginTop: 16, textAlign: 'right'}}>
        <Pagination
          current={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onChange={handlePaginationChange}
          showSizeChanger
          pageSizeOptions={['10', '20', '50', '100']}
          showTotal={(total) => `Total ${total} items`}
        />
      </div>

      {/* Create/Edit form modal */}
      <Modal
        title={`${modalType === 'create' ? 'Create' : 'Edit'} Form`}
        open={showModal}
        footer={null}
        onCancel={() => setShowModal(false)}
        width={800}
      >
        <BQAForm
          onSubmit={handleFormSubmit}
          formConfig={formConfig}
          initialValues={currentRecord || {}}
        />
      </Modal>
    </div>
  );
};
