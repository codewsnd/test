import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadScreenshotModal from '../UploadScreenshotModal';

vi.mock('@ant-design/icons', () => ({
  DeleteOutlined: () => <span>delete-icon</span>,
  UploadOutlined: () => <span>upload-icon</span>,
}));

vi.mock('antd', () => {
  const Button = ({ children, disabled, loading, onClick, ...props }: { children?: React.ReactNode; disabled?: boolean; loading?: boolean; onClick?: () => void }) => {
    void loading;
    return <button disabled={disabled} onClick={onClick} {...props}>{children}</button>;
  };
  const Modal = ({ children, footer, onCancel, open, title }: { children?: React.ReactNode; footer?: React.ReactNode[]; onCancel?: () => void; open?: boolean; title?: string }) => open ? (
    <section><h2>{title}</h2><button onClick={onCancel}>modal-cancel</button>{children}<footer>{footer}</footer></section>
  ) : null;
  const Space = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Typography = { Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> };
  return { Button, Modal, Space, Typography };
});

describe('UploadScreenshotModal', () => {
  it('renders upload list, empty state, and fires file/remove/validate callbacks', () => {
    const onFilesSelected = vi.fn(() => Promise.resolve());
    const onRemove = vi.fn();
    const onValidate = vi.fn();
    render(
      <UploadScreenshotModal
        canValidate={true}
        onClose={vi.fn()}
        onFilesSelected={onFilesSelected}
        onRemoveImage={onRemove}
        onValidate={onValidate}
        open={true}
        preparingUpload={false}
        processing={false}
        uploadImages={[{
          base64: 'data:image/png;base64,QUJD',
          fileName: 'uuid-value.png',
          md5: 'md5-a',
          originalFileName: '首页截图.png',
          size: 2048,
        }]}
        uploadTotalSize={2048}
      />
    );
    fireEvent.click(screen.getByText('Validate'));
    expect(screen.getByText('首页截图.png')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Delete 首页截图.png'));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'new.png', { type: 'image/png' })] },
    });
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('md5-a');
    expect(onFilesSelected).toHaveBeenCalledTimes(1);

    render(
      <UploadScreenshotModal
        canValidate={false}
        onClose={vi.fn()}
        onFilesSelected={vi.fn()}
        onRemoveImage={vi.fn()}
        onValidate={vi.fn()}
        open={true}
        preparingUpload={true}
        processing={true}
        uploadImages={[]}
        uploadTotalSize={0}
      />
    );
    expect(screen.getByText('No screenshots selected')).toBeTruthy();
  });

  it.each([
    { preparingUpload: true, processing: false, stateLabel: '文件准备' },
    { preparingUpload: false, processing: true, stateLabel: '校验' },
  ])('$stateLabel期间锁定截图选择、删除和校验操作', ({
    preparingUpload,
    processing,
  }) => {
    /** 记录锁定期间意外触发的文件选择。 */
    const onFilesSelected = vi.fn(() => Promise.resolve());
    /** 记录锁定期间意外触发的图片删除。 */
    const onRemoveImage = vi.fn();
    /** 记录锁定期间意外触发的校验操作。 */
    const onValidate = vi.fn();

    render(
      <UploadScreenshotModal
        canValidate={true}
        onClose={vi.fn()}
        onFilesSelected={onFilesSelected}
        onRemoveImage={onRemoveImage}
        onValidate={onValidate}
        open={true}
        preparingUpload={preparingUpload}
        processing={processing}
        uploadImages={[{
          base64: 'data:image/png;base64,QUJD',
          fileName: 'screen-a.png',
          md5: 'md5-a',
          size: 3,
        }]}
        uploadTotalSize={3}
      />
    );

    /** 系统文件选择器入口。 */
    const selectButton = screen.getByText('Select screenshots').closest('button');
    /** 单图删除入口。 */
    const deleteButton = screen.getByLabelText('Delete screen-a.png') as HTMLButtonElement;
    /** 隐藏的浏览器文件输入框。 */
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    /** Validate 操作入口。 */
    const validateButton = screen.getByText('Validate').closest('button');

    expect(selectButton?.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);
    expect(fileInput.disabled).toBe(true);
    expect(validateButton?.disabled).toBe(true);

    fireEvent.click(selectButton as HTMLButtonElement);
    fireEvent.click(deleteButton);
    fireEvent.click(validateButton as HTMLButtonElement);
    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(onRemoveImage).not.toHaveBeenCalled();
    expect(onValidate).not.toHaveBeenCalled();
  });
});
