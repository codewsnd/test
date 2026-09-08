import React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadScreenshotModal from '../UploadScreenshotModal';
import { DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION } from '../../types';

vi.mock('@ant-design/icons', () => ({
  DeleteOutlined: () => <span>delete-icon</span>,
  UploadOutlined: () => <span>upload-icon</span>,
  QuestionCircleOutlined: () => <span>help-icon</span>,
}));

vi.mock('antd', async importOriginal => {
  const actual = await importOriginal<typeof import('antd')>();
  const Button = ({ children, disabled, loading, onClick, ...props }: { children?: React.ReactNode; disabled?: boolean; loading?: boolean; onClick?: () => void }) => {
    void loading;
    return <button disabled={disabled} onClick={onClick} {...props}>{children}</button>;
  };
  const Modal = ({ children, footer, onCancel, open, title }: { children?: React.ReactNode; footer?: React.ReactNode[]; onCancel?: () => void; open?: boolean; title?: string }) => open ? (
    <section><h2>{title}</h2><button onClick={onCancel}>modal-cancel</button>{children}<footer>{footer}</footer></section>
  ) : null;
  const Space = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Typography = { Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> };
  return { ...actual, Button, Modal, Space, Typography };
});

/** 粘贴测试只覆盖弹窗上传入口，文件读取由现有上传测试负责。 */
const renderPasteModal = (uploadImages: React.ComponentProps<typeof UploadScreenshotModal>['uploadImages'] = []) => {
  const onFilesSelected = vi.fn(() => Promise.resolve());
  render(
    <UploadScreenshotModal
      displayConfiguration={DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION}
      onDisplayConfigurationChange={vi.fn()}
      canValidate={false}
      onClose={vi.fn()}
      onFilesSelected={onFilesSelected}
      onRemoveImage={vi.fn()}
      onValidate={vi.fn()}
      open
      preparingUpload={false}
      processing={false}
      uploadImages={uploadImages}
      uploadTotalSize={0}
    />
  );
  return { onFilesSelected, zone: screen.getByRole('region', { name: 'Screenshot drop area' }) };
};

describe('UploadScreenshotModal', () => {
  it.each([true, false])('accepts pasted images once and ignores accompanying non-image files when empty=%s', empty => {
    const { onFilesSelected, zone } = renderPasteModal(empty ? [] : [
      { fileName: 'old.png', md5: 'old', base64: 'data:image/png;base64,QQ==', size: 1 },
    ]);
    const images = [
      new File(['a'], 'first.png', { type: 'image/png' }),
      new File(['b'], 'second.jpg', { type: 'image/jpeg' }),
    ];
    const clipboardData = {
      files: [...images, new File(['text'], 'note.txt', { type: 'text/plain' })],
      items: images.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    };
    zone.focus();
    expect(document.activeElement).toBe(zone);
    expect(fireEvent.paste(zone, { clipboardData })).toBe(false);
    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith(images);
    expect(screen.getByText('To paste, click this area and press Ctrl+V / ⌘V.')).toBeTruthy();
  });

  it('accepts clipboard item images while ignoring text and unreadable file items', () => {
    const { onFilesSelected, zone } = renderPasteModal();
    const file = new File(['a'], 'clipboard.png', { type: 'image/png' });
    fireEvent.paste(zone, {
      clipboardData: {
        files: [],
        items: [
          { kind: 'string', type: 'text/plain' },
          { kind: 'file', type: 'image/png', getAsFile: () => null },
          { kind: 'file', type: 'image/png', getAsFile: () => file },
        ],
      },
    });
    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith([file]);
  });

  it('does not consume empty or text-only paste events', () => {
    const { onFilesSelected, zone } = renderPasteModal();
    expect(fireEvent.paste(zone, { clipboardData: { files: [], items: [] } })).toBe(true);
    expect(fireEvent.paste(zone, {
      clipboardData: { files: [], items: [{ kind: 'string', type: 'text/plain' }] },
    })).toBe(true);
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it('renders upload list, empty state, and fires file/remove/validate callbacks', () => {
    const onFilesSelected = vi.fn(() => Promise.resolve());
    const onRemove = vi.fn();
    const onValidate = vi.fn();
    render(
      <UploadScreenshotModal
        displayConfiguration={DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION}
        onDisplayConfigurationChange={vi.fn()}
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
        displayConfiguration={DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION}
        onDisplayConfigurationChange={vi.fn()}
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
    expect(screen.getByText('Drop or paste screenshots here')).toBeTruthy();
  });

  it.each([true, false])('accepts dropped files without opening the picker on area click when empty=%s', empty => {
    const onFilesSelected = vi.fn(() => Promise.resolve());
    render(
      <UploadScreenshotModal
        displayConfiguration={DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION}
        onDisplayConfigurationChange={vi.fn()}
        canValidate={!empty}
        onClose={vi.fn()}
        onFilesSelected={onFilesSelected}
        onRemoveImage={vi.fn()}
        onValidate={vi.fn()}
        open
        preparingUpload={false}
        processing={false}
        uploadImages={empty ? [] : [{ fileName: 'old.png', md5: 'old', base64: 'data:image/png;base64,QQ==', size: 1 }]}
        uploadTotalSize={empty ? 0 : 1}
      />
    );
    const zone = screen.getByRole('region', { name: 'Screenshot drop area' });
    const files = [new File(['x'], 'new.png', { type: 'image/png' }), new File(['y'], 'next.png', { type: 'image/png' })];
    const dataTransfer = { files, dropEffect: 'none' };
    const dragEvent = createEvent.dragOver(zone, { dataTransfer }) as DragEvent;
    expect(fireEvent(zone, dragEvent)).toBe(false);
    expect(dragEvent.dataTransfer?.dropEffect).toBe('copy');
    expect(fireEvent.drop(zone, { dataTransfer })).toBe(false);
    expect(onFilesSelected).toHaveBeenCalledExactlyOnceWith(files);
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByText(/Drop or paste .*screenshots here/));
    fireEvent.click(zone);
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Select screenshots'));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
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
        displayConfiguration={DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION}
        onDisplayConfigurationChange={vi.fn()}
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
    const zone = screen.getByRole('region', { name: 'Screenshot drop area' });
    const dataTransfer = { files: [new File(['x'], 'new.png', { type: 'image/png' })], dropEffect: 'copy' };
    const dragEvent = createEvent.dragOver(zone, { dataTransfer }) as DragEvent;
    fireEvent(zone, dragEvent);
    expect(dragEvent.dataTransfer?.dropEffect).toBe('none');
    fireEvent.drop(zone, { dataTransfer });
    fireEvent.paste(zone, { clipboardData: { files: dataTransfer.files, items: [] } });
    expect(zone.getAttribute('aria-disabled')).toBe('true');
    expect(zone.tabIndex).toBe(-1);
    fireEvent.click(screen.getByText('Drop or paste more screenshots here'));
    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(onRemoveImage).not.toHaveBeenCalled();
    expect(onValidate).not.toHaveBeenCalled();
  });
});
