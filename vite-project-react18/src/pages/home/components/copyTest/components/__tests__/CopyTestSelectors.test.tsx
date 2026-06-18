import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyTestSelectors } from '../CopyTestSelectors';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';

vi.mock('@ant-design/icons', () => ({
  CloudUploadOutlined: () => <span>cloud-icon</span>,
  UploadOutlined: () => <span>upload-icon</span>,
}));

vi.mock('antd', () => ({
  Button: ({ children, disabled, onClick }: { children?: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button disabled={disabled} onClick={onClick}>{children}</button>
  ),
  Select: ({ disabled, onChange, options = [], placeholder, value }: { disabled?: boolean; onChange?: (value?: number) => void; options?: Array<{ label: string; value: number }>; placeholder?: string; value?: number }) => (
    <select aria-label={placeholder || 'select'} disabled={disabled} onChange={event => onChange?.(event.target.value === '' ? undefined : Number(event.target.value))} value={value ?? ''}>
      <option value="">{placeholder || 'empty'}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Typography: { Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> },
}));

const table = parseCopyTestStorageTables('<table><tr><th>Target</th><th>Test Result - Target</th></tr><tr><td>copy</td><td></td></tr></table>')[0];

describe('CopyTestSelectors', () => {
  it('renders selectors and action buttons only after a column is selected', () => {
    const onTableChange = vi.fn();
    const onColumnChange = vi.fn();
    const onChooseImages = vi.fn();
    const onExport = vi.fn();
    const { rerender, queryByText } = render(
      <CopyTestSelectors
        canExportToConfluence={true}
        canUpload={true}
        exporting={false}
        onChooseImages={onChooseImages}
        onComparisonColumnChange={onColumnChange}
        onExportToConfluence={onExport}
        onTableChange={onTableChange}
        preparingUpload={false}
        processing={false}
        selectedColumnIndex={undefined}
        selectedTable={table}
        selectedTableIndex={0}
        tables={[table]}
      />
    );
    expect(queryByText('Upload Screenshot')).toBeNull();
    rerender(
      <CopyTestSelectors
        canExportToConfluence={false}
        canUpload={false}
        exporting={true}
        onChooseImages={onChooseImages}
        onComparisonColumnChange={onColumnChange}
        onExportToConfluence={onExport}
        onTableChange={onTableChange}
        preparingUpload={true}
        processing={false}
        selectedColumnIndex={0}
        selectedTable={table}
        selectedTableIndex={0}
        tables={[table]}
      />
    );
    fireEvent.change(screen.getByLabelText('select'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Select comparison column'), { target: { value: '0' } });
    expect(onTableChange).toHaveBeenCalledWith(0);
    expect(onColumnChange).toHaveBeenCalledWith(0);
    expect(screen.getByText('Upload Screenshot')).toHaveProperty('disabled', true);
  });
});
