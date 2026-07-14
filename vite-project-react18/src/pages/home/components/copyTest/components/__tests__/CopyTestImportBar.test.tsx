import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyTestImportBar } from '../CopyTestImportBar';

vi.mock('antd', () => {
  const Button = ({ children, loading, onClick }: { children?: React.ReactNode; loading?: boolean; onClick?: () => void }) => (
    <button data-loading={loading ? 'true' : 'false'} onClick={onClick}>{children}</button>
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
