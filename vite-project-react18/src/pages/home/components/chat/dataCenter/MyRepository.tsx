import React, {useEffect, useRef, useState} from 'react';
import { Modal, Tabs, Typography, Alert } from 'antd';
import JiraTab from './JiraTab';
import ConfluenceTab from './ConfluenceTab';
import FileComponent from "./File";
import type { ChatDocumentInfo } from './types';

const { Title } = Typography;

interface MyRepositoryProps {
  visible: boolean;
  onClose: () => void;
}

const MyRepository: React.FC<MyRepositoryProps> = ({
  visible,
  onClose,
}) => {
  // 管理文件状态
  const [files, setFiles] = useState<ChatDocumentInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<ChatDocumentInfo[]>([]);
  // 计算是否有文件正在上传
  const isUploading = files.some(file => file.status === 'processing');
  const visibleRef = useRef(visible);

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const items = [
    {
      key: 'files',
      label: 'Files',
      children: (
        <FileComponent
          files={files}
          setFiles={setFiles}
          setSelectedFiles={setSelectedFiles}
          isModalOpenRef={visibleRef}
        />
      )
    },
    {
      key: 'jira',
      label: 'Jira',
      children: <JiraTab />
    },
    {
      key: 'confluence',
      label: 'Confluence',
      children: <ConfluenceTab />
    }
  ];

  return (
    <Modal
      title={<Title level={2} style={{ margin: 0 }}>My Repository</Title>}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={1000}
      style={{ top: 20 }}
    >
      {/* Show upload status when files are uploading or processing */}
      {isUploading && (
        <Alert
          message="文件正在上传中，请稍后"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          closable={false}
        />
      )}

      {/* 显示选中的文件 */}
      {selectedFiles.length > 0 && (
        <Alert
          message={
            <div>
              <strong>{selectedFiles.length} item{selectedFiles.length === 1 ? '' : 's'} selected:</strong>
              <div className="mt-2">
                {selectedFiles.map((file, index) => (
                  <span key={file.id} className="inline-block mr-2 mb-1">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {file.documentName}
                    </span>
                    {index < selectedFiles.length - 1 && ' '}
                  </span>
                ))}
              </div>
            </div>
          }
          type="info"
          style={{ marginBottom: 16 }}
          closable={false}
        />
      )}

      <Tabs defaultActiveKey="files" items={items} />
    </Modal>
  );
};

export default MyRepository;
