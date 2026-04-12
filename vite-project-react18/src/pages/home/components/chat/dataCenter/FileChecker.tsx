import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input, message } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import {calculateFileMD5, getFileExtension} from '../../../../../utils/fileUtils';
import type { ChatDocumentInfo } from './types';

interface DuplicateInfo {
  sameNameAndContent: boolean;
  sameNameDifferentContent: boolean;
  differentNameSameContent: string | null;
  modalType: 'error' | 'warning' | null;
  modalTitle: string;
}

interface FileCheckerProps {
  isVisible: boolean;
  pendingFile: File | null;
  duplicateInfo: DuplicateInfo;
  existingFiles: ChatDocumentInfo[];
  onConfirm: (newFileName?: string) => void;
  onCancel: () => void;
}

interface UseFileCheckerReturn {
  duplicateCheckModal: boolean;
  pendingFile: File | null;
  duplicateInfo: DuplicateInfo;
  checkSingleFileDuplicate: (newFile: File, existingFiles: ChatDocumentInfo[]) => Promise<DuplicateInfo>;
  showDuplicateModal: (file: File, duplicateResult: DuplicateInfo) => void;
  hideDuplicateModal: () => void;
}

// Hook for file duplicate checking
export const useFileChecker = (): UseFileCheckerReturn => {
  const [duplicateCheckModal, setDuplicateCheckModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo>({
    sameNameAndContent: false,
    sameNameDifferentContent: false,
    differentNameSameContent: null,
    modalType: null,
    modalTitle: ''
  });


  // 检查单个文件重复
  const checkSingleFileDuplicate = async (newFile: File, existingFiles: ChatDocumentInfo[]): Promise<DuplicateInfo> => {
    console.log('Starting single file duplicate check...', newFile.name);
    console.log('Existing files:', existingFiles.map(f => ({ name: f.documentName, hasContent: !!f.content, hasMd5: !!f.md5 })));

    // Calculate new file MD5 hash
    const newFileMD5 = await calculateFileMD5(newFile);
    console.log(`New file ${newFile.name} MD5:`, newFileMD5.substring(0, 16) + '...');

    // Check for file name duplicates
    const existingFileWithSameName = existingFiles.find(f => f.documentName === newFile.name);

    if (existingFileWithSameName) {
      // 优先使用MD5进行比较
      if (existingFileWithSameName.md5) {
        console.log(`Existing file ${existingFileWithSameName.documentName} MD5:`, existingFileWithSameName.md5.substring(0, 16) + '...');

        if (newFileMD5 === existingFileWithSameName.md5) {
          console.log(`Duplicate found: ${newFile.name} (same name and content by MD5)`);
          return {
            sameNameAndContent: true,
            sameNameDifferentContent: false,
            differentNameSameContent: null,
            modalType: 'error' as const,
            modalTitle: 'Some files cannot be uploaded'
          };
        } else {
          console.log(`Conflict found: ${newFile.name} (same name but different content by MD5)`);
          return {
            sameNameAndContent: false,
            sameNameDifferentContent: true,
            differentNameSameContent: null,
            modalType: 'warning' as const,
            modalTitle: 'Some issues with your upload'
          };
        }
      } else if (existingFileWithSameName.content) {
        // 降级到文本内容比较（仅适用于文本文件）
        const existingContentMD5 = CryptoJS.MD5(existingFileWithSameName.content).toString();

        console.log(`Existing file ${existingFileWithSameName.documentName} content MD5:`, existingContentMD5.substring(0, 16) + '...');

        if (newFileMD5 === existingContentMD5) {
          console.log(`Duplicate found: ${newFile.name} (same name and content by content MD5)`);
          return {
            sameNameAndContent: true,
            sameNameDifferentContent: false,
            differentNameSameContent: null,
            modalType: 'error' as const,
            modalTitle: 'Some files cannot be uploaded'
          };
        } else {
          console.log(`Conflict found: ${newFile.name} (same name but different content by content MD5)`);
          return {
            sameNameAndContent: false,
            sameNameDifferentContent: true,
            differentNameSameContent: null,
            modalType: 'warning' as const,
            modalTitle: 'Some issues with your upload'
          };
        }
      } else {
        // 如果既没有MD5也没有内容，只能判断为文件名冲突
        console.log(`Name conflict found: ${newFile.name} (unable to compare content)`);
        return {
          sameNameAndContent: false,
          sameNameDifferentContent: true,
          differentNameSameContent: null,
          modalType: 'warning' as const,
          modalTitle: 'Some issues with your upload'
        };
      }
    }

    // Check for content duplicates (优先使用MD5比较)
    for (const existingFile of existingFiles) {
      if (newFile.name !== existingFile.documentName) {
        let existingHash: string | null = null;

        if (existingFile.md5) {
          // 使用已存储的MD5
          existingHash = existingFile.md5;
        } else if (existingFile.content) {
          // 降级到内容MD5比较
          existingHash = CryptoJS.MD5(existingFile.content).toString();
        }

        if (existingHash && newFileMD5 === existingHash) {
          console.log(`Content duplicate found: ${newFile.name} and ${existingFile.documentName} (different names but same content)`);
          return {
            sameNameAndContent: false,
            sameNameDifferentContent: false,
            differentNameSameContent: existingFile.documentName,
            modalType: 'warning' as const,
            modalTitle: 'Some issues with your upload'
          };
        }
      }
    }

    console.log('No duplicates found');
    return {
      sameNameAndContent: false,
      sameNameDifferentContent: false,
      differentNameSameContent: null,
      modalType: null,
      modalTitle: ''
    };
  };

  // 显示重复文件模态框
  const showDuplicateModal = (file: File, duplicateResult: DuplicateInfo) => {
    setDuplicateInfo(duplicateResult);
    setPendingFile(file);
    setDuplicateCheckModal(true);
  };

  // 隐藏重复文件模态框
  const hideDuplicateModal = () => {
    setDuplicateCheckModal(false);
    setPendingFile(null);
    setDuplicateInfo({
      sameNameAndContent: false,
      sameNameDifferentContent: false,
      differentNameSameContent: null,
      modalType: null,
      modalTitle: ''
    });
  };

  return {
    duplicateCheckModal,
    pendingFile,
    duplicateInfo,
    checkSingleFileDuplicate,
    showDuplicateModal,
    hideDuplicateModal,
  };
};

// FileChecker Component
const FileChecker: React.FC<FileCheckerProps> = ({
  isVisible,
  pendingFile,
  duplicateInfo,
  existingFiles,
  onConfirm,
  onCancel,
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [useTimestamp, setUseTimestamp] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [timestampFileName, setTimestampFileName] = useState('');

  // 生成带时间戳的文件名
  const generateTimestampFileName = (originalFileName: string): string => {
    const timestamp = dayjs().format('YYYYMMDDHHmmss');
    const fileExtension = getFileExtension(originalFileName);
    const nameWithoutExtension = originalFileName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExtension}_${timestamp}${fileExtension ? `.${fileExtension}` : ''}`;
  };

  // 获取现有文件名列表
  const existingFileNames = existingFiles.map(file => file.documentName);

  // 处理确认操作
  const handleConfirm = () => {
    if (isConfirming) return; // 防止重复点击

    setIsConfirming(true);

    if (duplicateInfo.sameNameDifferentContent) {
      let finalFileName = newFileName.trim();

      if (!finalFileName) {
        message.warning('Please enter a new file name');
        setIsConfirming(false);
        return;
      }

      // 确保文件名包含扩展名
      const originalExtension = getFileExtension(pendingFile?.name || '');
      if (!finalFileName.includes('.')) {
        finalFileName += originalExtension ? `.${originalExtension}` : '';
      }

      // 检查新文件名是否与现有文件冲突
      if (existingFileNames.includes(finalFileName)) {
        message.error('File name already exists, please choose another name');
        setIsConfirming(false);
        return;
      }

      // 立即关闭模态框并重置状态
      setNewFileName('');
      setUseTimestamp(true);
      setIsConfirming(false);

      // 启动后台上传
      onConfirm(useTimestamp ? timestampFileName : finalFileName);
    } else {
      // 立即关闭模态框并重置状态
      setNewFileName('');
      setUseTimestamp(true);
      setIsConfirming(false);

      // 启动后台上传
      onConfirm();
    }
  };

  // 处理取消操作
  const handleCancel = () => {
    if (isConfirming) return; // 防止在确认过程中取消

    setNewFileName('');
    setUseTimestamp(true);
    setIsConfirming(false);
    onCancel();
  };

  // 当模态框打开且是文件名冲突时，初始化重命名字段
  useEffect(() => {
    if (isVisible && duplicateInfo.sameNameDifferentContent && pendingFile) {
      const timestampName = generateTimestampFileName(pendingFile.name);
      setTimestampFileName(timestampName);
      setNewFileName(timestampName);
      setUseTimestamp(true);
      setIsConfirming(false); // 重置确认状态
    }
  }, [isVisible, duplicateInfo.sameNameDifferentContent, pendingFile]);

  return (
    <Modal
      title={null}
      open={isVisible}
      onCancel={handleCancel}
      closable={!duplicateInfo.sameNameAndContent}
      footer={
        duplicateInfo.sameNameAndContent ? [
          <Button key="ok" onClick={handleCancel} disabled={isConfirming}>
            OK
          </Button>,
        ] : [
          <Button key="cancel" onClick={handleCancel} disabled={isConfirming}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            onClick={handleConfirm}
            disabled={duplicateInfo.sameNameDifferentContent && !newFileName.trim()}
            loading={isConfirming}
          >
            {duplicateInfo.sameNameDifferentContent ? 'Upload with new name' : 'OK'}
          </Button>,
        ]
      }
      width={600}
    >
      <div className="space-y-4">
        {/* Files with same name and content - custom red warning layout */}
        {duplicateInfo.sameNameAndContent && (
          <div>
            <div className="flex items-center mb-3">
              <ExclamationCircleOutlined className="text-red-500 flex-shrink-0 text-4xl" />
            </div>
            <div className="text-lg font-medium text-gray-900 mb-2">
              Some files cannot be uploaded
            </div>
            <div className="text-sm text-gray-700 mb-3">
              The following files have the same name and content as existing or uploaded files and were not uploaded:
            </div>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li className="text-sm text-gray-600">{pendingFile?.name}</li>
            </ul>
          </div>
        )}

        {/* Files with same name but different content - custom yellow warning layout */}
        {duplicateInfo.sameNameDifferentContent && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center mb-3">
                <ExclamationCircleOutlined className="text-yellow-500 flex-shrink-0 text-4xl" />
              </div>
              <div className="text-lg font-medium text-gray-900 mb-2">
                Some issues with your upload
              </div>
              <div className="text-sm text-gray-700 mb-3">
                The following files have the same name but different content as existing files. Please provide a new name:
              </div>
              <ul className="list-disc list-inside pl-4 space-y-1 mb-4">
                <li className="text-sm text-gray-600">{pendingFile?.name}</li>
              </ul>
            </div>

            {/* Rename options */}
            <div className="space-y-3 px-4">
              <div className="text-sm font-medium text-gray-700">Choose a new file name:</div>

              {/* Timestamp option */}
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="useTimestamp"
                  name="renameOption"
                  checked={useTimestamp}
                  onChange={() => {
                    setUseTimestamp(true);
                    setNewFileName(timestampFileName);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="useTimestamp" className="text-sm text-gray-700">
                  Use timestamp: {timestampFileName}
                </label>
              </div>

              {/* Custom name option */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="useCustomName"
                    name="renameOption"
                    checked={!useTimestamp}
                    onChange={() => {
                      setUseTimestamp(false);
                      setNewFileName('');
                    }}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="useCustomName" className="text-sm text-gray-700">
                    Enter custom name:
                  </label>
                </div>

                {!useTimestamp && (
                  <Input
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder={`Enter new file name without extension (e.g., document_new)`}
                    className="ml-6"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Files with different name but same content - custom yellow warning layout */}
        {duplicateInfo.differentNameSameContent && (
          <div>
            <div className="flex items-center mb-3">
              <ExclamationCircleOutlined className="text-yellow-500 flex-shrink-0 text-4xl" />
            </div>
            <div className="text-lg font-medium text-gray-900 mb-2">
              Some issues with your upload
            </div>
            <div className="text-sm text-gray-700 mb-3">
              The content of this file is already available in {duplicateInfo.differentNameSameContent}. Do you still want to add it?
            </div>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li className="text-sm text-gray-600">{pendingFile?.name}</li>
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default FileChecker;
