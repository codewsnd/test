import React, { useState, useEffect } from 'react';
import { Button, Space, Upload, message, Table, Modal } from 'antd';
import { convertMarkdownToAntdTableData } from '@/utils/markdownUtils';
import { importFromExcel } from '@/utils/excelUtils';
import { EditableCell } from './EditableCell';
import SaveIconSvg from '@/assets/save.svg';
import CloseIconSvg from '@/assets/close.svg';
import DeleteIconSvg from '@/assets/delete.svg';
import EditIconSvg from '@/assets/edit.svg';
import ImportIconSvg from '@/assets/import.svg';

interface EditableTestCaseTableProps {
  markdownTable: string;
  onMarkdownChange: (markdown: string) => void;
  uploadType?: string;
  selectedRowKeys?: React.Key[];
  onSelectedRowKeysChange?: (keys: React.Key[]) => void;
}

export const EditableTable: React.FC<EditableTestCaseTableProps> = ({
  markdownTable,
  onMarkdownChange,
  uploadType = 'single',
  selectedRowKeys: externalSelectedRowKeys,
  onSelectedRowKeysChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [originalDataSource, setOriginalDataSource] = useState<any[]>([]);
  const [internalSelectedRowKeys, setInternalSelectedRowKeys] = useState<React.Key[]>([]);

  // 使用外部或内部的 selectedRowKeys
  const selectedRowKeys = externalSelectedRowKeys !== undefined ? externalSelectedRowKeys : internalSelectedRowKeys;
  const setSelectedRowKeys = onSelectedRowKeysChange || setInternalSelectedRowKeys;

  // 同步 dataSource 与 markdown 表格
  useEffect(() => {
    const { dataSource: newDataSource } = convertMarkdownToAntdTableData(markdownTable);
    setDataSource(newDataSource);
    setOriginalDataSource(newDataSource);
  }, [markdownTable]);

  // 保存更改到 markdown
  const saveChanges = () => {
    const { columns } = convertMarkdownToAntdTableData(markdownTable);
    const headers = columns.map(col => col.title);
    let markdown = '| ' + headers.join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    dataSource.forEach(rowData => {
      const cells = columns.map(col => rowData[col.dataIndex] || '');
      markdown += '| ' + cells.join(' | ') + ' |\n';
    });
    onMarkdownChange(markdown);
    setIsEditing(false);
    setSelectedRowKeys([]);
  };

  // 取消编辑
  const handleCancel = () => {
    setDataSource([...originalDataSource]);
    setIsEditing(false);
    setSelectedRowKeys([]);
  };

  // 删除选中行
  const handleDelete = () => {
    Modal.confirm({
      title: 'Confirm Deletion',
      icon: null,
      content: 'Are you sure you want to delete? This action cannot be undone.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: {className: 'hsbcbtn'},
      footer: (_, {OkBtn, CancelBtn})=> (
        <div className={'flex flex-col'}>
          <div></div>
          <div className={'flex justify-start gap-2'}>
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        const newDataSource = dataSource.filter((_, index) => !selectedRowKeys.includes(index));

        // 重新生成 key
        const reindexedDataSource = newDataSource.map((row, index) => ({
          ...row,
          key: index
        }));

        setDataSource(reindexedDataSource);
        setSelectedRowKeys([]);
      },
    });
  };

  // 删除单行
  const handleDeleteRow = (rowIndex: number) => {
    Modal.confirm({
      title: 'Confirm Deletion',
      icon: null,
      content: 'Are you sure you want to delete? This action cannot be undone.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: {className: 'hsbcbtn'},
      footer: (_, {OkBtn, CancelBtn})=> (
        <div className={'flex flex-col'}>
          <div></div>
          <div className={'flex justify-start gap-2'}>
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        const newDataSource = dataSource.filter((_, index) => index !== rowIndex);
        // 重新生成 key
        const reindexedDataSource = newDataSource.map((row, index) => ({
          ...row,
          key: index
        }));
        setDataSource(reindexedDataSource);
      },
    });
  };

  // 导入 Excel
  const handleImport = async (file: File) => {
    try {
      const result = await importFromExcel(file, {
        requiredHeaders: [
          'Test Case ID',
          'Test Case Description',
          'Preconditions',
          'Test Steps',
          'Expected Results'
        ],
        strictMatch: false,
        sheetIndex: 0,
      });

      if (result.success && result.markdown) {
        onMarkdownChange(result.markdown);
      } else {
        message.error(result.error || 'Failed to import Excel file');
      }
    } catch (error) {
      message.error('Failed to import Excel file');
      console.error(error);
    }
    return false;
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    const buttonStyle = {
      fontWeight: 500,
      fontSize: '16px',
      color: '#000000',
      width: 'auto',
      padding: '0',
      gap: '8px',
      display: 'flex',
      alignItems: 'center',
    };

    if (!isEditing) {
      return (
        <Space size={24}>
          <Button
            type="text"
            icon={<img src={EditIconSvg} alt="edit" style={{ width: '18px', height: '18px' }} />}
            onClick={() => setIsEditing(true)}
            size="small"
            style={buttonStyle}
          >
            Edit
          </Button>
          <Upload
            accept=".xlsx,.xls"
            beforeUpload={handleImport}
            showUploadList={false}
          >
            <Button type="text" icon={<img src={ImportIconSvg} alt="import" style={{ width: '18px', height: '18px' }} />} size="small" style={buttonStyle}>
              Import
            </Button>
          </Upload>
        </Space>
      );
    }

    if (selectedRowKeys.length > 0) {
      return (
        <Space size={24}>
          <Button
            type="text"
            icon={<img src={SaveIconSvg} alt="save" style={{ width: '18px', height: '18px' }} />}
            onClick={saveChanges}
            size="small"
            style={buttonStyle}
          >
            Save
          </Button>
          <Button
            type="text"
            icon={<img src={DeleteIconSvg} alt="delete" style={{ width: '18px', height: '18px' }} />}
            onClick={handleDelete}
            size="small"
            style={buttonStyle}
          >
            Delete
          </Button>
          <Button
            type="text"
            icon={<img src={CloseIconSvg} alt="cancel" style={{ width: '18px', height: '18px' }} />}
            onClick={handleCancel}
            size="small"
            style={buttonStyle}
          >
            Cancel
          </Button>
        </Space>
      );
    }

    return (
      <Space size={24}>
        <Button
          type="text"
          icon={<img src={SaveIconSvg} alt="save" style={{ width: '18px', height: '18px' }} />}
          onClick={saveChanges}
          size="small"
          style={buttonStyle}
        >
          Save
        </Button>
        <Button
          type="text"
          icon={<img src={CloseIconSvg} alt="cancel" style={{ width: '18px', height: '18px' }} />}
          onClick={handleCancel}
          size="small"
          style={buttonStyle}
        >
          Cancel
        </Button>
      </Space>
    );
  };

  const { columns } = convertMarkdownToAntdTableData(markdownTable);

  // 添加 Action 列
  const columnsWithAction = [
    ...columns.map((col: any) => ({
      ...col,
      onCell: (record: any) => ({
        record,
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing,
      }),
    })),
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'center' as const,
      onCell: () => ({
        editing: false, // Action 列永远不进入编辑状态
      }),
      render: (_: any, _record: any, index: number) => (
        <Button
          type="text"
          icon={<img src={DeleteIconSvg} alt="delete" style={{ width: '18px', height: '18px' }} />}
          onClick={() => handleDeleteRow(index)}
          size="small"
          style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
        />
      ),
    }
  ];

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        {renderActionButtons()}
      </div>
      <Table
        components={{
          body: {
            cell: EditableCell,
          },
        }}
        columns={columnsWithAction}
        dataSource={dataSource}
        pagination={false}
        bordered
        className="mt-2"
        scroll={{ x: 'max-content' }}
        rowSelection={uploadType === 'multiple' || isEditing ? {
          type: 'checkbox',
          selectedRowKeys,
          onChange: (selectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(selectedRowKeys);
          },
        } : undefined}
      />
    </div>
  );
};

export default EditableTable;
