import React, {useEffect, useState, useMemo, useRef} from 'react';
import {Input, Button, Table, Upload, Dropdown, Spin, message, Modal, Typography} from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  MoreOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {ChatDocumentInfo} from './types';
import {calculateFileMD5, getDisplayTypeFromExtension, getFileExtension} from '@/utils/fileUtils';
import {
  deleteFileApi,
  downloadFileApi,
  listFilesApi,
  renameFileApi,
  uploadSingleFileApi,
  pollingStatusByJobIdApi, updateDocumentApi, type resProps,
} from "@/api/fileApi";
import FileChecker, {useFileChecker} from './FileChecker';
import dayjs from 'dayjs';

const { Text } = Typography;

interface FileComponentProps {
  files: ChatDocumentInfo[];
  setFiles: React.Dispatch<React.SetStateAction<ChatDocumentInfo[]>>;
  setSelectedFiles?: React.Dispatch<React.SetStateAction<ChatDocumentInfo[]>>;
  isModalOpenRef?: React.MutableRefObject<boolean>;
}

const FileComponent: React.FC<FileComponentProps> = ({
                                                       files,
                                                       setFiles,
                                                       setSelectedFiles,
                                                       isModalOpenRef,
                                                     }) => {

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ChatDocumentInfo | null>(null);
  const [renameFileName, setRenameFileName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);

  const {
    duplicateCheckModal,
    pendingFile,
    duplicateInfo,
    checkSingleFileDuplicate,
    showDuplicateModal,
    hideDuplicateModal,
  } = useFileChecker();

  // 轮询管理
  const pollingIntervals = useRef<Record<string, number>>({});
  const completedFiles = useRef<string[]>([]);

  // 开始轮询
  const startPolling = (jobId: string, fileName: string, documentId: number) => {
    if (pollingIntervals.current[jobId]) {
      clearInterval(pollingIntervals.current[jobId]);
    }

    pollingIntervals.current[jobId] = setInterval(async () => {
      try {
        const response = await pollingStatusByJobIdApi(jobId);

        // 如果状态变为completed，停止轮询并更新文件状态
        if (response.status === 'completed' || response.status === 'error') {
          clearInterval(pollingIntervals.current[jobId]);
          delete pollingIntervals.current[jobId];

          const content = response.content ?? '';
          const status = response.status;

          updateDocumentApi(jobId, content, status)
            .then((res: resProps) => {
              if (res.code == 200) {
                // fetchFiles();
                setFiles(prev => prev.map(file => file.id === documentId ? {...file, content, status} : file))
              }
            })

          // 添加到已完成文件列表（避免重复）
          if (!completedFiles.current.includes(fileName)) {
            completedFiles.current.push(fileName);
          }

          // 检查是否所有轮询都已完成
          if (Object.keys(pollingIntervals.current).length === 0) {
            // 所有轮询完成，只有模态框关闭时才显示消息
            if (completedFiles.current.length > 0) {
              if (!isModalOpenRef?.current) {
                // 只有模态框关闭时，才显示完整消息
                message.success({
                  content: (
                    <div>
                      Files {completedFiles.current.map((name, index) => (
                        <span key={index}>
                          <strong>{name}</strong>
                          {index < completedFiles.current.length - 1 && ', '}
                        </span>
                      ))} processing completed, You can check in the <Text underline>my repository</Text>
                    </div>
                  )
                });
                completedFiles.current = [];
              }
              // 模态框打开时不显示任何消息，也不清空 completedFiles，等待关闭时显示
            }
          }
        }
      } catch (error) {
        console.error(`Failed to poll status for jobId ${jobId}:`, error);
        // 发生错误时也停止轮询
        clearInterval(pollingIntervals.current[jobId]);
        delete pollingIntervals.current[jobId];

        // 标记为错误并移除
        setFiles(prev => prev.map(file =>
          file.id === documentId ? {...file, status: 'error'} : file
        ));

        setTimeout(() => {
          setFiles(prev => prev.filter(f => f.id !== documentId));
        }, 2000);
      }
    }, 2000);
  };

  // 获取文件列表
  const fetchFiles = async (isPolling: boolean = true) => {
    setFilesLoading(true);
    try {
      const data = await listFilesApi();
      console.log('response.data', data);
      setFiles(data);

      if (isPolling) {
        // 为processing状态且有jobId的文件启动轮询
        data.forEach((file: ChatDocumentInfo) => {
          if (file.status === 'processing' && file.jobId) {
            startPolling(file.jobId, file.documentName, file.id || 0);
          }
        });
      }
    } catch (error: any) {
      message.error('Failed to load files: ' + (error.message || 'Unknown error'));
    } finally {
      setFilesLoading(false);
    }
  };


  // 上传单个文件
  const handleSingleUpload = async (fileToUpload: File) => {
    console.log('Starting single file upload process:', fileToUpload.name);
    try {
      // First check for file duplicates
      const duplicateResult = await checkSingleFileDuplicate(fileToUpload, files);

      console.log('Duplicate check result:', duplicateResult);

      // If duplicate detected, show confirmation dialog
      if (duplicateResult.modalType) {
        console.log('Duplicate file found, showing confirmation dialog');
        showDuplicateModal(fileToUpload, duplicateResult);
        return;
      }

      console.log('No duplicate files found, proceeding with upload');
      // No duplicates, proceed with upload
      await performSingleUpload(fileToUpload);
    } catch (error: any) {
      console.error('Upload process error:', error);
      const errorMsg = error.response?.data?.message || error.message;
      message.error(`Upload failed: ${errorMsg}`);
    }
  };

  // 实际执行单个文件上传的函数 - 使用临时文件
  const performSingleUpload = async (fileToUpload: File) => {
    const tempId = Date.now();
    const md5 = await calculateFileMD5(fileToUpload)

    // 立即添加上传中状态的文件，确保 Alert 能够显示
    const uploadingFile: ChatDocumentInfo = {
      id: tempId,
      documentName: fileToUpload.name,
      documentType: getFileExtension(fileToUpload.name),
      updateTime: new Date().toISOString(),
      status: 'processing' as const,
      md5
    };
    setFiles(prev => [uploadingFile, ...prev]);

    try {
      const uploadResponse = await uploadSingleFileApi(fileToUpload);
      const fileData = uploadResponse.files?.[0] || uploadResponse;

      if (fileData.status === 'completed') {
        // 替换临时文件为完成状态的文件
        const completedFile: ChatDocumentInfo = {
          ...fileData,
          id: fileData.id
        };
        setFiles(prev => prev.map(file =>
          file.id === tempId ? completedFile : file
        ));
      } else if (fileData.status === 'processing' && fileData.jobId) {
        // 更新临时文件为服务器返回的处理中状态
        const processingFile: ChatDocumentInfo = {
          id: fileData.id,
          documentName: fileToUpload.name,
          documentType: getFileExtension(fileToUpload.name),
          updateTime: new Date().toISOString(),
          status: 'processing' as const,
          jobId: fileData.jobId,
          s3Path: fileData.s3Path,
          md5
        };
        setFiles(prev => prev.map(file =>
          file.id === tempId ? processingFile : file
        ));
        startPolling(fileData.jobId, fileToUpload.name, fileData.id);
      }

    } catch (error: any) {
      // 上传失败时移除临时文件
      setFiles(prev => prev.filter(file => file.id !== tempId));
      const errorMsg = error.response?.data?.message || error.message;
      message.error(`Upload failed: ${errorMsg}`);
    }
  };

  // 处理重复文件确认
  const handleDuplicateConfirm = async (newFileName?: string) => {
    if (!pendingFile) return;

    // 立即隐藏模态框
    hideDuplicateModal();

    try {
      if (newFileName) {
        // 使用新文件名创建文件对象
        const renamedFile = new File([pendingFile], newFileName, {
          type: pendingFile.type,
          lastModified: pendingFile.lastModified
        });
        await performSingleUpload(renamedFile);
      } else {
        // 直接上传原文件
        await performSingleUpload(pendingFile);
      }
    } catch (error) {
      console.error('Upload error in handleDuplicateConfirm:', error);
    }
  };

  // 处理单个文件上传
  const handleFileChange = (file: File) => {
    handleSingleUpload(file);
    return false;
  };

  // 重命名文件
  const handleRename = (record: ChatDocumentInfo) => {
    if (!record.documentName) {
      message.error('File name is missing');
      return;
    }
    setSelectedFile(record);
    // Remove file extension to initialize input
    const nameWithoutExtension = record.documentName.replace(/\.[^/.]+$/, '');
    setRenameFileName(nameWithoutExtension);
    setRenameModalVisible(true);
  };

  const handleRenameUpdate = async () => {
    if (!selectedFile?.id || !selectedFile?.documentName) return;

    const extension = getFileExtension(selectedFile.documentName);
    const fullNewFileName = renameFileName.trim() + (extension ? `.${extension}` : '');

    // Check if new name is same as original
    if (fullNewFileName === selectedFile.documentName) {
      message.warning('New file name is same as original file name');
      return;
    }

    // Check for name conflicts with other files
    if (existingFileNames.includes(fullNewFileName)) {
      message.error('File name already exists, please choose another name');
      return;
    }

    console.log('selectedFile', selectedFile);

    setRenameLoading(true);
    try {
      const response = await renameFileApi(selectedFile.id, fullNewFileName);

      if (response.success) {
        setFiles(prev => prev.map(file =>
          file.id === selectedFile.id
            ? {...file, documentName: fullNewFileName, updateTime: response.updateTime}
            : file
        ));
        message.success('File renamed successfully');
        handleRenameCancel();
      } else {
        message.error(response.message || 'Rename failed');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      message.error(`Rename failed: ${errorMsg}`);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleRenameCancel = () => {
    setRenameModalVisible(false);
    setSelectedFile(null);
    setRenameFileName('');
    setRenameLoading(false);
  };

  // 搜索功能
  const handleSearch = () => {
    setSearchText(searchValue);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 下载文件
  const handleDownload = async (record: ChatDocumentInfo) => {
    if (!record.id) return;

    setActionLoading(prev => ({...prev, [record.id!]: true}));

    try {
      const downloadData = await downloadFileApi(record.id);
      const link = document.createElement('a');
      link.href = downloadData.downloadUrl;
      link.download = downloadData.fileName || record.documentName || 'download';
      link.click();
    } catch (error: any) {
      message.error('Download failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(prev => {
        const newState = {...prev};
        delete newState[record.id!];
        return newState;
      });
    }
  };

  // 删除文件
  const handleDelete = async (record: ChatDocumentInfo) => {
    if (!record.id) return;

    setActionLoading(prev => ({...prev, [record.id!]: true}));

    try {
      await deleteFileApi(record.id);
      setFiles(prev => prev.filter(f => f.id !== record.id));
      // Remove selected file ID from selectedRowKeys
      setSelectedRowKeys(prev => prev.filter(key => key !== record.id));
      message.success('Deleted successful');
    } catch (error: any) {
      message.error('Delete failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(prev => {
        const newState = {...prev};
        delete newState[record.id!];
        return newState;
      });
    }
  };

  // 过滤显示文件列表
  const displayFiles = useMemo(() => {
    return files.filter(file => {
      // 安全检查：确保 file.documentName 存在且为字符串
      const fileName = file.documentName || '';
      const matchesSearch = fileName.toLowerCase().includes(searchText.toLowerCase());
      const displayType = getDisplayTypeFromExtension(file.documentType || '');
      const matchesType = selectedType === '' || displayType === selectedType;
      return matchesSearch && matchesType;
    });
  }, [files, searchText, selectedType]);

  // 获取现有文件名列表（用于重命名检查）
  const existingFileNames = useMemo(() => {
    return files.map(file => file.documentName || '').filter(name => name !== '');
  }, [files]);

  // 当选中文件变化时通知父组件
  useEffect(() => {
    if (setSelectedFiles) {
      const selectedFilesData = files.filter(file => selectedRowKeys.includes(file.id));
      setSelectedFiles(selectedFilesData);
    }
  }, [selectedRowKeys, files, setSelectedFiles]);

  // 初始化文件列表
  useEffect(() => {
    fetchFiles();
  }, []);

  // 监听模态框关闭，显示完整消息
  const prevModalOpen = useRef(false);

  // 初始化 prevModalOpen
  useEffect(() => {
    if (isModalOpenRef) {
      prevModalOpen.current = isModalOpenRef.current;
    }
  }, []);

  useEffect(() => {
    if (isModalOpenRef) {
      console.log('Modal state change:', { prevModalOpen: prevModalOpen.current, isModalOpen: isModalOpenRef.current, completedFilesLength: completedFiles.current.length });

      if (prevModalOpen.current && !isModalOpenRef.current && completedFiles.current.length > 0) {
        console.log('Modal closed with completed files, showing full message');
        message.success({
          content: (
            <div>
              Files {completedFiles.current.map((name, index) => (
                <span key={index}>
                  <strong>{name}</strong>
                  {index < completedFiles.current.length - 1 && ', '}
                </span>
              ))} processing completed, You can check in the <Text underline>my repository</Text>
            </div>
          )
        });
        completedFiles.current = [];
      }
      prevModalOpen.current = isModalOpenRef.current;
    }
  }, [isModalOpenRef?.current]);

  // Table columns
  const columns: ColumnsType<ChatDocumentInfo> = [
    {
      title: 'Document Name',
      dataIndex: 'documentName',
      key: 'documentName',
    },
    {
      title: 'Type',
      dataIndex: 'documentType',
      key: 'documentType',
      render: (documentType: string) => getDisplayTypeFromExtension(documentType),
    },
    {
      title: 'Last Modified',
      dataIndex: 'updateTime',
      key: 'updateTime',
      render: (updateTime: string) => {
        if (!updateTime) return '';
        return dayjs(updateTime).format('DD MMM YYYY HH:mm');
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 80,
      render: (_, record) => {
        if (record.status !== 'completed' || actionLoading[record.id]) {
          return <Spin indicator={<LoadingOutlined spin/>} size="small"/>;
        }

        return (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'rename',
                  label: 'Rename',
                  icon: <EditOutlined/>,
                  onClick: () => handleRename(record)
                },
                {
                  key: 'download',
                  label: 'Download',
                  icon: <DownloadOutlined/>,
                  onClick: () => handleDownload(record)
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: <DeleteOutlined/>,
                  danger: true,
                  onClick: () => handleDelete(record)
                }
              ]
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" icon={<MoreOutlined/>} size="small"/>
          </Dropdown>
        );
      }
    }
  ];

  const typeButtons = [
    {label: 'Image', value: 'Image'},
    {label: 'PDF', value: 'PDF'},
    {label: 'Spreadsheet', value: 'Spreadsheet'},
    {label: 'Presentation', value: 'Presentation'}
  ];

  // Calculate variables related to renaming
  const originalNameWithoutExtension = selectedFile ? selectedFile.documentName.replace(/\.[^/.]+$/, '') : '';
  const isNameChanged = renameFileName.trim() && renameFileName !== originalNameWithoutExtension;

  return (
    <div className="flex flex-col max-h-[60vh]">
      {/* Search and Filter */}
      <div className="mb-4 flex gap-2 items-center flex-wrap">
        <Input
          placeholder="Search documents..."
          prefix={<SearchOutlined/>}
          value={searchValue}
          onChange={handleSearchInputChange}
          onPressEnter={handleSearchKeyPress}
          className="flex-1"
        />
        <Button
          type="default"
          icon={<SearchOutlined/>}
          onClick={handleSearch}
          className="!bg-black !text-white !border-black hover:!bg-gray-800 hover:!border-gray-800"
        >
          Search
        </Button>
        <span>Filter by type:</span>
        <div className="flex gap-1">
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
      </div>

      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className={'text-lg'}>Files</h1>
        <Upload
          beforeUpload={(file) => {
            handleFileChange(file);
            return false;
          }}
          showUploadList={false}
          multiple={false}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.svg,.xls,.xlsx,.csv,.ppt,.pptx,.doc,.docx,.txt,.md"
        >
          <Button
            icon={<UploadOutlined/>}
            className="!bg-transparent !border-transparent hover:!bg-gray-50"
          >
            Upload Document
          </Button>
        </Upload>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <Table
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (selectedKeys: React.Key[]) => setSelectedRowKeys(selectedKeys),
            getCheckboxProps: (record) => ({
              disabled: record.status === 'processing',
            }),
          }}
          columns={columns}
          dataSource={displayFiles}
          loading={filesLoading}
          pagination={false}
        />
      </div>

      {/* Rename Modal */}
      <Modal
        title="Update file name"
        open={renameModalVisible}
        onCancel={handleRenameCancel}
        footer={[
          <Button key="cancel" onClick={handleRenameCancel}>
            Cancel
          </Button>,
          <Button
            key="update"
            type="primary"
            onClick={handleRenameUpdate}
            disabled={!isNameChanged}
            loading={renameLoading}
          >
            Update
          </Button>,
        ]}
        width={500}
      >
        {selectedFile && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">File name</div>
              <div className="flex items-center">
                <Input
                  value={renameFileName}
                  onChange={(e) => setRenameFileName(e.target.value)}
                  placeholder="Enter file name"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">File type</div>
              <div className="text-gray-600">{selectedFile.documentType}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* File Checker Component */}
      <FileChecker
        isVisible={duplicateCheckModal}
        pendingFile={pendingFile}
        duplicateInfo={duplicateInfo}
        existingFiles={files}
        onConfirm={handleDuplicateConfirm}
        onCancel={hideDuplicateModal}
      />
    </div>
  );
};

export default FileComponent;
