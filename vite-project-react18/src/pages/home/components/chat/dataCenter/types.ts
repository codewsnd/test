// 后端chat_document_info表对应的接口
export interface ChatDocumentInfo {
  id: number;
  documentName: string;
  documentType: string;
  content?: string;
  fileSize?: string;
  uploadTime?: string;
  createTime?: string;
  updateTime?: string;
  stuffId?: string;
  status: 'processing' | 'completed' | 'error';
  s3Path?: string;
  jobId?: string;
  md5?: string;
}

