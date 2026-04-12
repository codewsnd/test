import '@testing-library/jest-dom/vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { useRequestMock } = vi.hoisted(() => ({
  useRequestMock: vi.fn(),
}))

vi.mock('ahooks', () => ({
  useRequest: useRequestMock,
}))

vi.mock('antd', () => {
  const Button = ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  )
  const Space = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  const Spin = () => <div>loading-spin</div>
  return { Button, Space, Spin, Typography: { Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>, Text: ({ children }: React.PropsWithChildren) => <span>{children}</span> } }
})

vi.mock('@/pages/agent-create/components/ToolSelection/ToolDetailModal', () => ({
  default: ({
    open,
    tool,
    onClose,
  }: {
    open: boolean
    tool: { tool_display_name: string }
    onClose: () => void
  }) =>
    open ? (
      <div>
        <div>detail:{tool.tool_display_name}</div>
        <button onClick={onClose}>close-detail</button>
      </div>
    ) : null,
}))

vi.mock('@/pages/agent-create/components/ToolSelection/ToolSelectionModal', () => ({
  default: ({
    toolModalVisible,
    onFormDataChange,
  }: {
    toolModalVisible: boolean
    onFormDataChange: (data: { tools?: string[] }) => void
  }) => (
    <div>
      <div>modal:{toolModalVisible ? 'open' : 'closed'}</div>
      <button onClick={() => onFormDataChange({ tools: ['jira/get_jira_ticket_details'] })}>pick-tool</button>
    </div>
  ),
}))

vi.mock('@/pages/agent-create/components/ToolSelection/ToolInfoCard', () => ({
  default: ({
    tool,
    onViewDetails,
  }: {
    tool: { tool_display_name: string }
    onViewDetails: () => void
  }) => (
    <div>
      <span>info:{tool.tool_display_name}</span>
      <button onClick={onViewDetails}>view-card</button>
    </div>
  ),
}))

import ToolSelectionT from '../ToolSelectionT'

const toolList = [
  {
    tool_name: 'name',
    tool_display_name: 'Get Jira ticket details',
    mcp_server_name: 'JIRA',
    provider: 'JIRA',
    is_hidden_in_tool: false,
    tool_full_name: 'jira/get_jira_ticket_details',
    tool_category: 'Category',
    tool_description: 'Description',
    tag: [],
    parameters: [],
  },
]

describe('ToolSelectionT', () => {
  it('renders loading state', () => {
    useRequestMock.mockReturnValue({ data: [], loading: true })
    render(<ToolSelectionT />)
    expect(screen.getByText('loading-spin')).toBeInTheDocument()
  })

  it('opens modal, selects tool and opens detail views', () => {
    useRequestMock.mockReturnValue({ data: toolList, loading: false })
    render(<ToolSelectionT />)

    expect(screen.getByText('No selected tools yet.')).toBeInTheDocument()
    expect(screen.getByText('modal:closed')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Open Tool Selection'))
    expect(screen.getByText('modal:open')).toBeInTheDocument()

    fireEvent.click(screen.getByText('pick-tool'))
    expect(screen.getByText('info:Get Jira ticket details')).toBeInTheDocument()

    fireEvent.click(screen.getByText('view-card'))
    expect(screen.getByText('detail:Get Jira ticket details')).toBeInTheDocument()
    fireEvent.click(screen.getByText('close-detail'))
    expect(screen.queryByText('detail:Get Jira ticket details')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Show Tool Detail'))
    expect(screen.getByText('detail:Get Jira ticket details')).toBeInTheDocument()
  })
})
