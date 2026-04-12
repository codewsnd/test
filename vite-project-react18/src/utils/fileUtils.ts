// 将文件扩展名映射为友好的显示类型
import CryptoJS from "crypto-js";

export function getDisplayTypeFromExtension(extension: string): string {
  if (!extension) return 'Other';

  // 移除可能存在的点号前缀
  const ext = extension.toLowerCase().replace(/^\./, '');

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp'].includes(ext)) {
    return 'Image';
  }

  if (ext === 'pdf') {
    return 'PDF';
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return 'Spreadsheet';
  }

  if (['ppt', 'pptx'].includes(ext)) {
    return 'Presentation';
  }

  return extension;
}

// 从文件名获取扩展名
export function getFileExtension(fileName: string): string {
  if (!fileName) return '';
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex < fileName.length - 1) {
    return fileName.substring(lastDotIndex + 1).toLowerCase();
  }
  return '';
}


// 计算文件内容MD5哈希值
export const calculateFileMD5 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const md5Hash = CryptoJS.MD5(wordArray).toString();
        resolve(md5Hash);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
