import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { ChangeEvent, PropsWithChildren, ReactNode } from 'react'

const { useRefMock } = vi.hoisted(() => ({
  useRefMock: vi.fn(),
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useRef: useRefMock,
  }
})

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <span>close</span>,
  MinusCircleOutlined: () => <span>minus</span>,
  PlusCircleOutlined: () => <span>plus</span>,
  SearchOutlined: () => <span>search</span>,
}))

vi.mock('antd', () => {
  const Alert = ({ message }: { message: ReactNode }) => <div>{message}</div>
  const Button = ({
    children,
    onClick,
    className,
  }: PropsWithChildren<{ onClick?: () => void; className?: string }>) => <button className={className} onClick={onClick}>{children}</button>
  const ConfigProvider = ({ children }: PropsWithChildren) => <div>{children}</div>
  const Input = ({
    value,
    onChange,
    onPressEnter,
    placeholder,
    className,
  }: {
    value?: string
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void
    onPressEnter?: () => void
    placeholder?: string
    className?: string
  }) => (
    <input
      aria-label={placeholder}
      className={className}
      value={value}
      onChange={onChange}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onPressEnter?.()
        }
      }}
    />
  )
  const Modal = ({
    children,
    open,
    onCancel,
  }: PropsWithChildren<{ open?: boolean; onCancel?: () => void }>) => (
    open ? (
      <div>
        <button onClick={onCancel}>modal-close</button>
        {children}
      </div>
    ) : null
  )
  const Select = ({
    value,
    onChange,
    options,
    className,
  }: {
    value?: string
    onChange?: (value: string) => void
    options: Array<{ value: string; label: string }>
    className?: string
  }) => (
    <select aria-label={value} className={className} value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
  const Spin = () => <div>loading</div>
  const Table = ({
    columns,
    dataSource,
  }: {
    columns: Array<{ title: string; key: string; dataIndex: string; render?: (value: string, row: Record<string, string>) => React.ReactNode }>
    dataSource: Array<Record<string, string>>
  }) => (
    <table>
      <tbody>
        {dataSource.map((row) => (
          <tr key={row.key}>
            {columns.map((column) => (
              <td key={`${row.key}-${column.key}`}>
                {column.render ? column.render(row[column.dataIndex], row) : row[column.dataIndex]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
  const Typography = {
    Paragraph: ({ children, className }: PropsWithChildren<{ className?: string }>) => <p className={className}>{children}</p>,
    Text: ({ children, className }: PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>,
    Title: ({ children, className }: PropsWithChildren<{ className?: string }>) => <h1 className={className}>{children}</h1>,
  }

  return { Alert, Button, ConfigProvider, Input, Modal, Select, Spin, Table, Typography }
})

vi.mock('@/styles/style', () => ({ default: {} }))
vi.mock('../IconConfig', () => ({ getToolIcon: vi.fn(() => 'icon.svg') }))
vi.mock('../ToolItemCard', () => ({
  __esModule: true,
  default: ({
    tool,
    selected,
    added,
    onClick,
    onToggleAdd,
  }: {
    tool: { tool_full_name: string; tool_display_name: string }
    selected: boolean
    added: boolean
    onClick: () => void
    onToggleAdd: () => void
  }) => (
    <div>
      <div>{tool.tool_display_name}</div>
      <div>{selected ? 'selected' : 'not-selected'}</div>
      <div>{added ? 'added' : 'not-added'}</div>
      <button onClick={onClick}>select-{tool.tool_full_name}</button>
      <button onClick={onToggleAdd}>toggle-{tool.tool_full_name}</button>
    </div>
  ),
}))

import ToolSelectionModal from '../ToolSelectionModal'

const tools = [
  {
    tool_name: 'alpha_name',
    tool_display_name: 'Alpha',
    mcp_server_name: 'Web',
    provider: 'Web',
    icon: 'https://cdn.test/alpha.svg',
    is_hidden_in_tool: false,
    tool_full_name: 'web/alpha',
    tool_category: 'Alpha Category',
    tool_description: 'Alpha description',
    tag: [],
    parameters: [{ param_name: 'id', param_description: 'alpha param', required: true }],
  },
  {
    tool_name: 'beta_name',
    tool_display_name: 'Beta',
    mcp_server_name: 'JIRA',
    provider: 'JIRA',
    icon: '',
    is_hidden_in_tool: false,
    tool_full_name: 'jira/beta',
    tool_category: 'Beta Category',
    tool_description: 'Beta description',
    tag: [],
    parameters: [{ param_name: 'code', param_description: 'beta param', required: false }],
  },
  {
    tool_name: 'zulu_name',
    tool_display_name: 'Zulu',
    mcp_server_name: 'Web',
    provider: 'Web',
    icon: 'https://cdn.test/zulu.svg',
    is_hidden_in_tool: false,
    tool_full_name: 'web/zulu',
    tool_category: 'Alpha Category',
    tool_description: 'Zulu description',
    tag: [],
    parameters: [],
  },
  {
    tool_name: 'hidden_name',
    tool_display_name: 'Hidden',
    mcp_server_name: 'Hidden',
    provider: 'Hidden',
    icon: 'https://cdn.test/hidden.svg',
    is_hidden_in_tool: true,
    tool_full_name: 'hidden/tool',
    tool_category: 'Hidden Category',
    tool_description: 'Hidden description',
    tag: [],
    parameters: [],
  },
]

describe('ToolSelectionModal', () => {
  const setTimeoutSpy = vi.fn(() => 11 as unknown as ReturnType<typeof setTimeout>)
  const clearTimeoutSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useRefMock.mockImplementation((value: unknown) => ({ current: value }))
    vi.stubGlobal('setTimeout', setTimeoutSpy)
    vi.stubGlobal('clearTimeout', clearTimeoutSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders loading state', () => {
    render(
      <ToolSelectionModal
        toolModalVisible={true}
        setToolModalVisible={vi.fn()}
        formData={{ tools: [] }}
        onFormDataChange={vi.fn()}
        toolList={[]}
        loading={true}
      />,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('filters, selects, resets and closes modal', () => {
    const setToolModalVisible = vi.fn()
    const onFormDataChange = vi.fn()

    render(
      <ToolSelectionModal
        toolModalVisible={true}
        setToolModalVisible={setToolModalVisible}
        formData={{ tools: [] }}
        onFormDataChange={onFormDataChange}
        toolList={tools}
        loading={false}
      />,
    )

    expect(screen.getByText('Select tool')).toHaveClass('!text-[23px]')
    expect(screen.getByText('Select tool')).toHaveClass('!leading-[30px]')
    expect(screen.getByLabelText('Search by tool name / keywords')).toHaveClass('flex-1')
    expect(screen.getByText('Clear filter')).toHaveClass('!text-[14px]')
    expect(screen.getByText('Clear filter')).toHaveClass('underline')
    expect(screen.getByText('Sort by')).toHaveClass('text-[16px]')
    expect(screen.getByText('Sort by')).toHaveClass('text-[#000000]')
    expect(screen.getAllByText('Alpha Category')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Beta Category')[0]).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    const showingAll = screen.getByText((_, element) =>
      element?.textContent === 'Showing 3 tools matched for your query',
    )
    expect(showingAll).toBeInTheDocument()
    expect(showingAll).toHaveClass('!text-[16px]')
    expect(showingAll).toHaveClass('!text-[#333333]')

    fireEvent.change(screen.getByLabelText('Search by tool name / keywords'), {
      target: { value: 'beta' },
    })
    fireEvent.keyDown(screen.getByLabelText('Search by tool name / keywords'), { key: 'Enter' })
    expect(
      screen.getByText((_, element) => element?.textContent === 'Showing 1 tools matched for your query'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Reset'))
    expect(
      screen.getByText((_, element) => element?.textContent === 'Showing 3 tools matched for your query'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('All categories'), {
      target: { value: 'Beta Category' },
    })
    expect(
      screen.getByText((_, element) => element?.textContent === 'Showing 1 tools matched for your query'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'JIRA' },
    })
    expect(
      screen.getByText((_, element) => element?.textContent === 'Showing 1 tools matched for your query'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Clear filter'))
    expect(
      screen.getByText((_, element) => element?.textContent === 'Showing 3 tools matched for your query'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Alphabetically A-Z'), {
      target: { value: 'Alphabetically Z-A' },
    })
    fireEvent.click(screen.getByText('select-jira/beta'))
    expect(screen.getByText('View details')).toBeInTheDocument()
    expect(screen.getByText('Beta description')).toBeInTheDocument()
    expect(screen.getByText('Inputs (1)')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.getAllByText('JIRA')[0]).toBeInTheDocument()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByText('View details')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('modal-close'))
    expect(setToolModalVisible).toHaveBeenCalledWith(false)
  })

  it('handles add flow, alert callback and cleanup', () => {
    useRefMock.mockImplementation(() => ({ current: 9 }))
    const onFormDataChange = vi.fn()

    const { unmount } = render(
      <ToolSelectionModal
        toolModalVisible={true}
        setToolModalVisible={vi.fn()}
        formData={{ tools: [] }}
        onFormDataChange={onFormDataChange}
        toolList={tools}
        loading={false}
      />,
    )

    fireEvent.click(screen.getByText('toggle-web/alpha'))
    expect(onFormDataChange).toHaveBeenCalledWith({ tools: ['alpha_name'] })
    expect(screen.getByText(/added successfully\./)).toBeInTheDocument()
    expect(clearTimeoutSpy).toHaveBeenCalledWith(9)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)

    act(() => {
      const firstCall = setTimeoutSpy.mock.calls[0] as unknown[] | undefined
      const callback = firstCall ? firstCall[0] : undefined
      expect(typeof callback).toBe('function')

      if (typeof callback === 'function') {
        ;(callback as () => void)()
      }
    })
    expect(screen.queryByText(/added successfully\./)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('toggle-web/alpha'))
    unmount()
    expect(clearTimeoutSpy).toHaveBeenCalledWith(11)
  })

  it('handles remove flow from detail panel', () => {
    const onFormDataChange = vi.fn()

    render(
      <ToolSelectionModal
        toolModalVisible={true}
        setToolModalVisible={vi.fn()}
        formData={{ tools: ['alpha_name'] }}
        onFormDataChange={onFormDataChange}
        toolList={tools}
        loading={false}
      />,
    )

    fireEvent.click(screen.getByText('select-web/alpha'))
    expect(screen.getByText('Remove')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Remove'))
    expect(onFormDataChange).toHaveBeenCalledWith({ tools: [] })
  })
})
