import React, { useState, useMemo, useEffect } from 'react';
import { Input, Button, Upload, Empty, Dropdown, Spin, message, Modal, Typography, Card } from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  LoadingOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileWordOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ChatDocumentInfo } from '../chat/dataCenter/types';
import {
  listFilesApi,
  uploadSingleFileApi,
  downloadFileApi,
  deleteFileApi,
  renameFileApi
} from '../../../../api/fileApi';
import { getDisplayTypeFromExtension, getFileExtension } from '../../../../utils/fileUtils';
import dayjs from 'dayjs';

export default function FileCard() {
  const [files, setFiles] = useState<ChatDocumentInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ChatDocumentInfo | null>(null);
  const [renameFileName, setRenameFileName] = useState('');

  // Filter files based on search and type
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const fileName = file.documentName || '';
      const matchesSearch = fileName.toLowerCase().includes(searchQuery.toLowerCase());
      const displayType = getDisplayTypeFromExtension(file.documentType || '');
      const matchesType = selectedType === '' || displayType === selectedType;
      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, selectedType]);

  // Get unique file types for filtering
  const fileTypes = useMemo(() => {
    const types = files.map(file => getDisplayTypeFromExtension(file.documentType || ''));
    return Array.from(new Set(types)).filter(type => type !== '');
  }, [files]);

  // Fetch files from API
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await listFilesApi();
      setFiles(data);
    } catch (error: any) {
      message.error('Failed to load files: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      await uploadSingleFileApi(file);
      message.success('File uploaded successfully');
      fetchFiles(); // Refresh file list
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      message.error(`Upload failed: ${errorMsg}`);
    }
    return false; // Prevent default upload behavior
  };

  // Handle file download
  const handleDownload = async (file: ChatDocumentInfo) => {
    if (!file.id) return;

    setActionLoading(prev => ({ ...prev, [file.id!]: true }));
    try {
      const blob = await downloadFileApi(file.id);

      // 检查blob是否有效
      if (!blob || blob.size === 0) {
        console.error('下载的文件为空');
        return;
      }

      // 检查blob类型，如果是JSON格式说明可能是错误信息
      if (blob.type === 'application/json') {
        const errorText = await blob.text();
        const errorData = JSON.parse(errorText);
        console.error('API返回错误:', errorData);
        alert(`下载失败: ${errorData.message || '未知错误'}`);
        return;
      }

      // 确保文件名包含正确扩展名
      const fileExtension = getFileExtensionFromBlob(blob) || getFileExtensionFromName(file.documentName);
      const fileName = file.documentName && !file.documentName.includes('.')
        ? `${file.documentName}.${fileExtension || 'bin'}`
        : file.documentName || `download.${fileExtension || 'bin'}`;

      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 释放URL对象（添加延迟确保下载完成）
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error: any) {
      message.error('Download failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[file.id!];
        return newState;
      });
    }
  };

  // Handle file delete
  const handleDelete = (file: ChatDocumentInfo) => {
    Modal.confirm({
      title: 'Delete File',
      content: `Are you sure you want to delete "${file.documentName}"?`,
      onOk: async () => {
        if (!file.id) return;
        setActionLoading(prev => ({ ...prev, [file.id!]: true }));
        try {
          await deleteFileApi(file.id);
          setFiles(prev => prev.filter(f => f.id !== file.id));
          message.success('File deleted successfully');
        } catch (error: any) {
          message.error('Delete failed: ' + (error.response?.data?.message || error.message));
        } finally {
          setActionLoading(prev => {
            const newState = { ...prev };
            delete newState[file.id!];
            return newState;
          });
        }
      }
    });
  };

  // Handle file rename
  const handleEdit = (file: ChatDocumentInfo) => {
    if (!file.documentName) {
      message.error('File name is missing');
      return;
    }
    setSelectedFile(file);
    const nameWithoutExtension = file.documentName.replace(/\.[^/.]+$/, '');
    setRenameFileName(nameWithoutExtension);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedFile?.id || !selectedFile?.documentName) return;

    const extension = getFileExtension(selectedFile.documentName);
    const fullNewFileName = renameFileName.trim() + (extension ? `.${extension}` : '');

    if (fullNewFileName === selectedFile.documentName) {
      message.warning('New file name is same as original file name');
      return;
    }

    try {
      const response = await renameFileApi(selectedFile.id, fullNewFileName);
      if (response.success) {
        setFiles(prev => prev.map(file =>
          file.id === selectedFile.id
            ? { ...file, documentName: fullNewFileName, updateTime: response.updateTime }
            : file
        ));
        message.success('File renamed successfully');
        setEditModalVisible(false);
        setSelectedFile(null);
        setRenameFileName('');
      } else {
        message.error(response.message || 'Rename failed');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      message.error(`Rename failed: ${errorMsg}`);
    }
  };

  // Get file icon based on file type
  const getFileIcon = (documentType: string, size: number = 40) => {
    const type = getDisplayTypeFromExtension(documentType);

    switch (type) {
      case 'PDF':
        return <FilePdfOutlined style={{ fontSize: size, color: '#ff4d4f' }} />;
      case 'Image':
        return <FileImageOutlined style={{ fontSize: size, color: '#52c41a' }} />;
      case 'Spreadsheet':
        return <FileExcelOutlined style={{ fontSize: size, color: '#389e0d' }} />;
      case 'Presentation':
        return <FilePptOutlined style={{ fontSize: size, color: '#fa8c16' }} />;
      case 'Document':
        return <FileWordOutlined style={{ fontSize: size, color: '#2f54eb' }} />;
      default:
        return <FileTextOutlined style={{ fontSize: size, color: '#1890ff' }} />;
    }
  };

  // Initialize files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  const renderFileItem = (file: ChatDocumentInfo) => {
    const isLoading = actionLoading[file.id] || file.status === 'processing';

    return (
      <Card
        key={file.id}
        size="small"
        hoverable
        style={{
          width: '100%',
          marginBottom: 0,
          borderRadius: 12,
          border: '1px solid #f0f0f0',
          transition: 'all 0.3s ease',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 0 }}
        actions={
          file.status === 'completed' && !isLoading ? [
            <Button
              key="rename"
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(file)}
              title="Rename"
            />,
            <Button
              key="download"
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(file)}
              title="Download"
            />,
            <Button
              key="delete"
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(file)}
              title="Delete"
            />
          ] : [
            <Spin key="loading" indicator={<LoadingOutlined spin />} size="small" />
          ]
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header with icon and status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              {getFileIcon(file.documentType, 36)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#262626',
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.documentName}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#8c8c8c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{
                    backgroundColor: '#f6f6f6',
                    borderRadius: 4,
                    fontSize: 11
                  }}>
                    {getDisplayTypeFromExtension(file.documentType)}
                  </span>
                  {file.updateTime && (
                    <span>{dayjs(file.updateTime).format('MMM DD, YYYY')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Status badge */}
            <div style={{
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 500,
              backgroundColor:
                file.status === 'completed' ? '#f6ffed' :
                file.status === 'processing' ? '#e6f7ff' : '#fff2f0',
              color:
                file.status === 'completed' ? '#52c41a' :
                file.status === 'processing' ? '#1890ff' : '#ff4d4f',
              border: `1px solid ${
                file.status === 'completed' ? '#b7eb8f' :
                file.status === 'processing' ? '#91d5ff' : '#ffccc7'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {file.status === 'processing' && (
                <LoadingOutlined style={{ fontSize: 10 }} />
              )}
              {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
            </div>
          </div>

          {/* Content preview */}
          {file.content && (
            <div style={{
              fontSize: 12,
              color: '#8c8c8c',
              lineHeight: 1.4,
              backgroundColor: '#fafafa',
              borderRadius: 6,
              border: '1px solid #f0f0f0',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              textOverflow: 'ellipsis'
            }}>
              {file.content}
            </div>
          )}

          {/* File details */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#bfbfbf',
            paddingTop: 8,
            borderTop: '1px solid #f5f5f5'
          }}>
            <span>
              {file.fileSize ? `Size: ${file.fileSize}` : 'Size: Unknown'}
            </span>
            {file.updateTime && (
              <span>
                Modified: {dayjs(file.updateTime).format('MMM DD, YYYY')}
              </span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const typeButtons = fileTypes.map(type => ({
    label: type,
    value: type
  }));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header with search and controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        <Input
          placeholder="Search files..."
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
          style={{ flex: 1, minWidth: 120 }}
        />

        {typeButtons.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              size="small"
              type={selectedType === '' ? 'primary' : 'default'}
              onClick={() => setSelectedType('')}
            >
              All
            </Button>
            {typeButtons.map(button => (
              <Button
                key={button.value}
                type={selectedType === button.value ? 'primary' : 'default'}
                size="small"
                onClick={() => setSelectedType(selectedType === button.value ? '' : button.value)}
              >
                {button.label}
              </Button>
            ))}
          </div>
        )}

        <Upload
          beforeUpload={handleFileUpload}
          showUploadList={false}
          multiple={false}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.svg,.xls,.xlsx,.csv,.ppt,.pptx,.doc,.docx,.txt,.md"
        >
          <Button
            type="primary"
            size="small"
            icon={<UploadOutlined />}
            style={{ flexShrink: 0 }}
            title="Upload File"
          >
            Upload
          </Button>
        </Upload>
      </div>

      {/* Content area with grid layout */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px'
          }}>
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px'
          }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={searchQuery || selectedType ? "No matching files found" : "No files yet"}
            />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
            padding: '8px 0'
          }}>
            {filteredFiles.map(renderFileItem)}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <Modal
        title="Rename File"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedFile(null);
          setRenameFileName('');
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setEditModalVisible(false);
              setSelectedFile(null);
              setRenameFileName('');
            }}
          >
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleSave}
            disabled={!renameFileName.trim()}
          >
            Save
          </Button>,
        ]}
        width={500}
      >
        {selectedFile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>File name</div>
              <Input
                value={renameFileName}
                onChange={(e) => setRenameFileName(e.target.value)}
                placeholder="Enter file name"
              />
            </div>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>File type</div>
              <div style={{ color: '#666' }}>{selectedFile.documentType}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
