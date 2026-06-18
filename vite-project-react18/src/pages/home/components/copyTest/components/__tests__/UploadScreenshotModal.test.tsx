import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadScreenshotModal from '../UploadScreenshotModal';

vi.mock('@ant-design/icons', () => ({
  DeleteOutlined: () => <span>delete-icon</span>,
  UploadOutlined: () => <span>upload-icon</span>,
}));

vi.mock('antd', () => {
  const Button = ({ children, disabled, onClick, ...props }: { children?: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} onClick={onClick} {...props}>{children}</button>
  );
  const Modal = ({ children, footer, onCancel, open, title }: { children?: React.ReactNode; footer?: React.ReactNode[]; onCancel?: () => void; open?: boolean; title?: string }) => open ? (
    <section><h2>{title}</h2><button onClick={onCancel}>modal-cancel</button>{children}<footer>{footer}</footer></section>
  ) : null;
  const Space = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Typography = { Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> };
  return { Button, Modal, Space, Typography };
});

describe('UploadScreenshotModal', () => {
  it('renders upload list, empty state, and fires file/remove/validate callbacks', () => {
    const onFilesSelected = vi.fn();
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
        uploadImages={[{ base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png', md5: 'md5-a', size: 2048 }]}
        uploadTotalSize={2048}
      />
    );
    fireEvent.click(screen.getByText('Validate'));
    fireEvent.click(screen.getByLabelText('Delete screen-a.png'));
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
});
