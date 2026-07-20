import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyTestImportBar } from '../CopyTestImportBar';

vi.mock('antd', () => {
  /** 支持禁用和加载状态的测试按钮替身。 */
  const Button = ({ children, disabled, loading, onClick }: { children?: React.ReactNode; disabled?: boolean; loading?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} data-loading={loading ? 'true' : 'false'} onClick={onClick}>{children}</button>
  );
  const Form = {
    Item: ({ children, help }: { children?: React.ReactNode; help?: React.ReactNode }) => (
      <div>{children}{help && <div role="alert">{help}</div>}</div>
    ),
  };
  const Input = ({ disabled, onChange, placeholder, value }: { disabled?: boolean; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; value?: string }) => (
    <input disabled={disabled} onChange={onChange} placeholder={placeholder} value={value} />
  );
  const Space = { Compact: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> };
  return { Button, Form, Input, Space };
});

describe('CopyTestImportBar', () => {
  it('renders url input and fires import callbacks', () => {
    const onUrlChange = vi.fn();
    const onImport = vi.fn();
    render(
      <CopyTestImportBar
        confluenceUrl="http://wiki"
        disabled={false}
        loading={true}
        onConfluenceUrlChange={onUrlChange}
        onImport={onImport}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('Confluence URL'), { target: { value: 'http://next' } });
    fireEvent.click(screen.getByText('Import'));
    expect(onUrlChange).toHaveBeenCalledWith('http://next');
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('disables both URL input and Import button while another operation is busy', () => {
    /** 用于确认禁用按钮不会触发导入的回调。 */
    const onImport = vi.fn();
    render(
      <CopyTestImportBar
        confluenceUrl="http://wiki"
        disabled={true}
        loading={false}
        onConfluenceUrlChange={vi.fn()}
        onImport={onImport}
      />
    );

    /** 忙碌状态下应禁用的 URL 输入框。 */
    const input = screen.getByPlaceholderText('Confluence URL');
    /** 忙碌状态下应禁用的导入按钮。 */
    const importButton = screen.getByRole('button', { name: 'Import' });
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect((importButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(importButton);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('renders the exact inline error below the URL input', () => {
    const error = 'In valid URL format, Please enter a valid Http:// or https:// URL';
    render(
      <CopyTestImportBar
        confluenceUrl="invalid"
        disabled={false}
        error={error}
        loading={false}
        onConfluenceUrlChange={vi.fn()}
        onImport={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Confluence URL');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(error);
    expect(input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
