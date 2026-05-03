import '@testing-library/jest-dom/vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <span>close</span>,
}))

vi.mock('antd', () => {
  const ConfigProvider = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  const Modal = ({
    children,
    open,
    onCancel,
  }: React.PropsWithChildren<{ open?: boolean; onCancel?: () => void }>) => (
    open ? (
      <div>
        <button onClick={onCancel}>cancel</button>
        {children}
      </div>
    ) : null
  )
  const Table = ({
    columns,
    dataSource,
  }: {
    columns: Array<{ title: string; dataIndex: string; key?: string; render?: (value: string, row: Record<string, string>) => React.ReactNode }>
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
    Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
    Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
    Title: ({ children }: React.PropsWithChildren) => <h1>{children}</h1>,
  }

  return { ConfigProvider, Modal, Table, Typography }
})

vi.mock('@/styles/style', () => ({ default: {} }))
vi.mock('../IconConfig', () => ({ getToolIcon: vi.fn(() => 'icon.svg') }))

import ToolDetailModal from '../ToolDetailModal'

const tool = {
  tool_name: 'name',
  tool_display_name: 'Display',
  mcp_server_name: 'Fallback Provider',
  provider: 'Actual Provider',
  icon: 'https://cdn.test/detail.svg',
  is_hidden_in_tool: false,
  tool_full_name: 'tool/full',
  tool_category: 'Category',
  tool_description: 'Description',
  tag: [],
  parameters: [
    { param_name: 'requiredOne', param_description: 'desc1', required: true },
    { param_name: 'optionalOne', param_description: 'desc2', required: false },
  ],
}

describe('ToolDetailModal', () => {
  it('renders tool details and closes', () => {
    const onClose = vi.fn()

    const { rerender } = render(<ToolDetailModal open={true} onClose={onClose} tool={tool} />)

    expect(screen.getByText('Tool details')).toBeInTheDocument()
    expect(screen.getByText('Actual Provider')).toBeInTheDocument()
    expect(screen.getByText('Inputs (2)')).toBeInTheDocument()
    expect(screen.getByText('requiredOne')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('optionalOne')).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()

    fireEvent.click(screen.getByText('cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<ToolDetailModal open={true} onClose={onClose} tool={{ ...tool, provider: undefined }} />)
    expect(screen.queryByText('Actual Provider')).not.toBeInTheDocument()
  })
})
