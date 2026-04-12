import React from 'react';
import { Button, Dropdown, Image } from 'antd';
import { DeleteOutlined, MoreOutlined } from '@ant-design/icons';

interface TestEvidenceRendererProps {
  text: string;
  onDeleteImage?: (imageIndex: number) => void;
}

interface ImageData {
  fileName: string;
  base64: string;
  displayName?: string;
}

export const TestEvidenceRenderer: React.FC<TestEvidenceRendererProps> = ({
  text,
  onDeleteImage
}) => {
  if (!text || text.trim() === '') {
    return null;
  }

  // 处理图片预览的函数
  const handlePreview = (base64: string) => {
    // 使用 Image.PreviewGroup 的全局预览功能
    const images = document.querySelectorAll('.ant-image');
    const currentImage = Array.from(images).find(img => {
      const imgElement = img.querySelector('img');
      return imgElement?.src === base64;
    });

    if (currentImage) {
      const imgElement = currentImage.querySelector('img');
      if (imgElement) {
        imgElement.click();
      }
    }
  };

  // 尝试解析 JSON 数组格式
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      // 如果是空数组，返回空白
      if (parsed.length === 0) {
        return null;
      }

      // 检查是否为新的简化格式 [{fileName: "xxx", base64: "xxx"}]
      const isNewFormat = parsed.every(
        item => item && typeof item === 'object' && 'fileName' in item && 'base64' in item
      );

      if (isNewFormat ) {
        return (
          <Image.PreviewGroup>
            <div className="grid grid-cols-2 gap-2 w-full">
              {parsed.map((imageData: ImageData, index: number) => {
                // 始终显示 Screen + 索引格式
                const displayName = `Screen ${String(index + 1).padStart(2, '0')}`;
                const base64 = imageData.base64;
                const fileName = imageData.fileName;

                return (
                  <div key={index} className="flex flex-col w-full max-w-full">
                    {/* 显示名称 - 显示 Screen01 格式 */}
                    <div className="text-black font-bold" title={fileName}>
                      {displayName}
                    </div>

                    {/* 图片 */}
                    <Image
                      src={base64}
                      alt={displayName}
                      width={100}
                      height={200}
                      className="object-cover w-full"
                      onError={(e) => {
                        console.error('Image load failed for', displayName, fileName);
                        console.error('Error:', e);
                      }}
                    />

                    {/* 按钮组 */}
                    <div className="flex gap-1 mt-1 justify-end items-center w-full max-w-[110px] overflow-hidden">
                      <Button
                        type="text"
                        size="small"
                        className="text-xs px-2 h-6 border-none"
                        onClick={() => handlePreview(base64)}
                      >
                        <span className={'underline'}>View</span>
                      </Button>
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'delete',
                              label: 'Delete',
                              icon: <DeleteOutlined />,
                              danger: true,
                              onClick: () => onDeleteImage?.(index)
                            }
                          ]
                        }}
                        trigger={['click']}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<MoreOutlined />}
                          className="px-1 h-6 border-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Dropdown>
                    </div>
                  </div>
                );
              })}
            </div>
          </Image.PreviewGroup>
        );
      }
    }
  } catch (e) {
    // 不是有效的 JSON，继续尝试其他格式
  }

  // 普通文本
  return <>{text}</>;
};
