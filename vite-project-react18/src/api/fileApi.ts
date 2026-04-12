import axios from './axios';
import type { ChatDocumentInfo } from '../pages/home/components/chat/dataCenter/types';

// 获取文件列表
export const listFilesApi = (): Promise<ChatDocumentInfo[]> =>
  axios.get('/api/documents/list');

// 获取单个文件状态
export const fetchFileStatusApi = (fileId: number): Promise<ChatDocumentInfo> =>
  axios.get(`/api/documents/${fileId}`);

// 根据jobId获取文件状态
export const fetchFileStatusByJobIdApi = (jobId: string): Promise<ChatDocumentInfo> =>
  axios.get(`/api/documents/job/${jobId}`);

// 根据jobId获取文件状态和内容（新接口）
export const pollingStatusByJobIdApi = (jobId: string): Promise<{ status: string; content?: string, message: string}> =>
  axios.get(`/api/documents/job/${jobId}/status`);

// 上传文件
export const uploadFileApi = (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  return axios.post('/api/document/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// 上传多个文件
export const uploadMultipleFilesApi = (files: File[]): Promise<any> => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  return axios.post('/api/document/upload-multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// 下载文件
export const downloadFileApi = (recordId: number): Promise<Blob> =>
  axios.post(
    `/api/document/download/${recordId}`,
    {},
    { responseType: 'blob' }
  );

// 重命名文件
export const renameFileApi = (fileId: number, newFileName: string): Promise<any> =>
  axios.put(`/api/documents/${fileId}/rename`, { newFileName });

// 删除文件
export const deleteFileApi = (recordId: number): Promise<any> =>
  axios.delete(`/api/document/${recordId}`);

// 创建单个文档记录
export const createDocumentApi = (document: {
  documentName: string;
  documentType: string;
  fileSize: number;
}): Promise<any> =>
  axios.post('/api/documents/create', document);

// 上传单个文件
export const uploadSingleFileApi = (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  return axios.post('/api/document/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export interface resProps {code: number, message: string, data: boolean}

export const updateDocumentApi = (jobId: string, content: string, status: string): Promise<resProps> =>
  axios.put(`/api/documents/job/${jobId}/update`, { content, status });
