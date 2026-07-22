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
  Dropdown: function MockDropdown({ children, menu, trigger }: {
    children?: React.ReactNode;
    menu: { items: Array<{ disabled?: boolean; key: string; label: React.ReactNode; onClick?: () => void }> };
    trigger?: string[];
  }) {
    const [open, setOpen] = React.useState(false);
    return (
      <div
        data-testid="export-dropdown"
        data-trigger={trigger?.join(',')}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
        {open && (
          <div role="menu">
            {menu.items.map(item => (
              <button
                key={item.key}
                role="menuitem"
                disabled={item.disabled}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
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
  it('shows continuous labels while preserving original table indexes as values', () => {
    /** 模拟过滤无效表后保留下来的非连续原始表格下标。 */
    const tables = [0, 2, 4, 5, 6].map(index => ({ ...table, index }));
    /** 记录用户切换表格时提交的原始 storage 表格下标。 */
    const onTableChange = vi.fn();
    render(
      <CopyTestSelectors
        canExportFile={true}
        canExportToConfluence={false}
        canUpload={false}
        exporting={false}
        fileExporting={false}
        onChooseImages={vi.fn()}
        onComparisonColumnChange={vi.fn()}
        onExportFile={vi.fn()}
        onExportToConfluence={vi.fn()}
        onTableChange={onTableChange}
        preparingUpload={false}
        processing={false}
        selectedColumnIndex={undefined}
        selectedTable={tables[0]}
        selectedTableIndex={0}
        tables={tables}
      />
    );

    /** 使用过滤后顺序展示、但保留原始 value 的 Table 下拉框。 */
    const tableSelect = screen.getByLabelText('select') as HTMLSelectElement;
    expect(Array.from(tableSelect.options).map(option => option.textContent)).toEqual([
      'empty',
      'Table1',
      'Table2',
      'Table3',
      'Table4',
      'Table5',
    ]);
    expect(Array.from(tableSelect.options).map(option => option.value)).toEqual([
      '',
      '0',
      '2',
      '4',
      '5',
      '6',
    ]);
    fireEvent.change(tableSelect, { target: { value: '6' } });
    expect(onTableChange).toHaveBeenCalledWith(6);
  });

  it('keeps table export available while showing upload only after a column is selected', () => {
    const onTableChange = vi.fn();
    const onColumnChange = vi.fn();
    const onChooseImages = vi.fn();
    const onExport = vi.fn();
    const { rerender, queryByText } = render(
      <CopyTestSelectors
        canExportFile={true}
        canExportToConfluence={true}
        canUpload={true}
        exporting={false}
        fileExporting={false}
        onChooseImages={onChooseImages}
        onComparisonColumnChange={onColumnChange}
        onExportFile={vi.fn()}
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
    expect(screen.getByRole('button', { name: 'Export' })).toHaveProperty('disabled', false);
    rerender(
      <CopyTestSelectors
        canExportFile={false}
        canExportToConfluence={false}
        canUpload={false}
        exporting={true}
        fileExporting={false}
        onChooseImages={onChooseImages}
        onComparisonColumnChange={onColumnChange}
        onExportFile={vi.fn()}
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
    expect(screen.getByRole('button', { name: 'Export' })).not.toBeNull();
    expect(screen.queryByText('Export to Confluence')).toBeNull();
  });

  it('shows all export formats on hover and delegates each enabled action', () => {
    /** 记录用户从悬停菜单选择 Confluence 后触发的回写操作。 */
    const onExport = vi.fn();
    /** 记录本地文件菜单提交的三个格式。 */
    const onExportFile = vi.fn();
    render(
      <CopyTestSelectors
        canExportFile={true}
        canExportToConfluence={true}
        canUpload={true}
        exporting={false}
        fileExporting={false}
        onChooseImages={vi.fn()}
        onComparisonColumnChange={vi.fn()}
        onExportFile={onExportFile}
        onExportToConfluence={onExport}
        onTableChange={vi.fn()}
        preparingUpload={false}
        processing={false}
        selectedColumnIndex={0}
        selectedTable={table}
        selectedTableIndex={0}
        tables={[table]}
      />
    );

    /** Export 按钮使用悬停触发菜单，初始状态不展示格式选项。 */
    const dropdown = screen.getByTestId('export-dropdown');
    expect(dropdown.getAttribute('data-trigger')).toBe('hover');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.mouseEnter(dropdown);

    /** Confluence 与三个本地文件格式均可点击。 */
    const confluenceItem = screen.getByRole('menuitem', { name: 'Confluence' });
    expect(confluenceItem).toHaveProperty('disabled', false);
    [
      { format: 'pdf', label: 'PDF' },
      { format: 'word', label: 'Word' },
      { format: 'excel', label: 'Excel' },
    ].forEach(({ format, label }) => {
      /** 当前本地文件格式对应的菜单项。 */
      const menuItem = screen.getByRole('menuitem', { name: label });
      expect(menuItem).toHaveProperty('disabled', false);
      fireEvent.click(menuItem);
      expect(onExportFile).toHaveBeenLastCalledWith(format);
    });
    fireEvent.click(confluenceItem);
    expect(onExport).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(dropdown);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('labels blank headers by original column index and excludes generated headers', () => {
    /** 记录空表头选项实际提交的原始逻辑列下标。 */
    const onColumnChange = vi.fn();
    /** 包含普通、空白和生成表头的测试工作表。 */
    const tableWithFilteredHeaders = {
      ...table,
      headers: [
        { index: 0, label: 'Target' },
        { index: 1, label: '' },
        { index: 2, label: '   ' },
        { index: 3, label: 'Test Result - Target' },
        { index: 4, label: 'Test Evidence - Target' },
      ],
    };
    render(
      <CopyTestSelectors
        canExportFile={true}
        canExportToConfluence={false}
        canUpload={false}
        exporting={false}
        fileExporting={false}
        onChooseImages={vi.fn()}
        onComparisonColumnChange={onColumnChange}
        onExportFile={vi.fn()}
        onExportToConfluence={vi.fn()}
        onTableChange={vi.fn()}
        preparingUpload={false}
        processing={false}
        selectedColumnIndex={undefined}
        selectedTable={tableWithFilteredHeaders}
        selectedTableIndex={0}
        tables={[tableWithFilteredHeaders]}
      />
    );

    const comparisonSelect = screen.getByLabelText('Select comparison column') as HTMLSelectElement;
    expect(Array.from(comparisonSelect.options).map(option => option.textContent)).toEqual([
      'Select comparison column',
      'Target',
      'Column 2',
      'Column 3',
    ]);
    expect(Array.from(comparisonSelect.options).map(option => option.value)).toEqual([
      '',
      '0',
      '1',
      '2',
    ]);
    fireEvent.change(comparisonSelect, { target: { value: '2' } });
    expect(onColumnChange).toHaveBeenCalledWith(2);
  });

  it('adds logical column numbers only to duplicate comparison headers', () => {
    /** 记录用户实际选择的来源逻辑列。 */
    const onColumnChange = vi.fn();
    /** 包含两个同名来源表头的测试工作表。 */
    const tableWithDuplicateHeaders = {
      ...table,
      headers: [
        { index: 0, label: 'Module' },
        { index: 1, label: 'Owner' },
        { index: 2, label: 'Module' },
      ],
    };
    /** 用于确认选项展示不会修改来源表头的原始快照。 */
    const originalHeaders = structuredClone(tableWithDuplicateHeaders.headers);
    render(
      <CopyTestSelectors
        canExportFile={true}
        canExportToConfluence={false}
        canUpload={false}
        exporting={false}
        fileExporting={false}
        onChooseImages={vi.fn()}
        onComparisonColumnChange={onColumnChange}
        onExportFile={vi.fn()}
        onExportToConfluence={vi.fn()}
        onTableChange={vi.fn()}
        preparingUpload={false}
        processing={false}
        selectedColumnIndex={undefined}
        selectedTable={tableWithDuplicateHeaders}
        selectedTableIndex={0}
        tables={[tableWithDuplicateHeaders]}
      />
    );

    /** 当前 Comparison Column 原生下拉框。 */
    const comparisonSelect = screen.getByLabelText('Select comparison column') as HTMLSelectElement;
    expect(Array.from(comparisonSelect.options).map(option => option.textContent)).toEqual([
      'Select comparison column',
      'Module (Column 1)',
      'Owner',
      'Module (Column 3)',
    ]);
    fireEvent.change(comparisonSelect, { target: { value: '2' } });
    expect(onColumnChange).toHaveBeenCalledWith(2);
    expect(tableWithDuplicateHeaders.headers).toEqual(originalHeaders);
  });
});
