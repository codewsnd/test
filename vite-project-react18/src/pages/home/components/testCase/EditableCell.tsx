import React, { useRef, useEffect } from 'react';
import { Input } from 'antd';

export interface EditableCellProps {
  editing: boolean;
  dataIndex: string;
  title: string;
  record: any;
  index: number;
  children: React.ReactNode;
}

/**
 * 可编辑的表格单元格组件
 *
 * 功能：
 * - 显示模式：正常显示单元格内容，支持换行显示
 * - 编辑模式：使用 TextArea 进行多行文本编辑
 * - 自动处理 <br> 标签和换行符的转换
 * - 保持编辑和显示模式的样式一致性
 */
export const EditableCell: React.FC<EditableCellProps> = ({
  editing,
  dataIndex,
  title,
  record,
  index,
  children,
  ...restProps
}) => {
  const inputRef = useRef<any>(null);

  /**
   * 将 <br> 标签转换为换行符
   * 用于在 TextArea 中正确显示换行
   */
  const convertBrToNewline = (text: any): string => {
    if (!text) return '';
    return String(text).replace(/<br>/gi, '\n');
  };

  /**
   * 将换行符转换为 <br> 标签
   * 用于存储到 dataSource 中，保持 Markdown 表格格式
   */
  const convertNewlineToBr = (text: string): string => {
    return text.replace(/\n/g, '<br>');
  };

  // 手动控制焦点，防止滚动
  useEffect(() => {
    if (editing && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus({ preventScroll: true });
      }, 0);
    }
  }, [editing]);

  return (
    <td {...restProps} style={{ padding: editing ? '0' : '4px', height: '100%', position: 'relative' }}>
      {editing ? (
        <Input.TextArea
          ref={inputRef}
          defaultValue={convertBrToNewline(record[dataIndex])}
          onChange={(e) => {
            record[dataIndex] = convertNewlineToBr(e.target.value);
          }}
          style={{
            width: 'calc(100% - 16px)',
            minHeight: '48px',
            border: '1px solid #767676',
            resize: 'none',
            padding: '8px 12px',
            fontSize: '14px',
            lineHeight: '1.5',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            overflowY: 'hidden',
            overflowX: 'hidden',
            margin: '8px',
            boxShadow: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderTop = '1px solid #767676';
            e.target.style.borderLeft = '1px solid #767676';
            e.target.style.borderRight = '1px solid #767676';
            e.target.style.borderBottom = '2px solid #767676';
          }}
          onBlur={(e) => {
            e.target.style.border = '1px solid #767676';
          }}
        />
      ) : (
        <div style={{
          padding: '8px 12px',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          transition: 'background-color 0.2s ease',
        }}>
          {children}
        </div>
      )}
    </td>
  );
};

export default EditableCell;
