import '@testing-library/jest-dom/vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <span>close</span>,
}))

vi.mock('antd', () => {
  const Button = ({
    children,
    onClick,
    icon,
    className,
  }: React.PropsWithChildren<{ onClick?: () => void; icon?: React.ReactNode; className?: string }>) => (
    <button onClick={onClick} className={className}>
      {icon}
      {children}
    </button>
  )
  const Typography = {
    Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
    Text: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>,
  }

  return {
    Button,
    Typography,
  }
})

vi.mock('@/pages/agent-create/components/ToolSelection/IconConfig', () => ({
  getToolIcon: vi.fn(() => 'icon.svg'),
}))

import ToolInfoCard from '../ToolInfoCard'

describe('InfoCard', () => {
  it('renders content and handles quick actions', () => {
    const onViewDetails = vi.fn()
    const onFormDataChange = vi.fn()

    render(
      <ToolInfoCard
        tool={{
          tool_name: 'display_tool',
          tool_display_name: 'Display',
          mcp_server_name: 'MCP',
          provider: 'Web',
          icon: 'https://cdn.test/display.svg',
          is_hidden_in_tool: false,
          tool_full_name: 'keep/remove',
          tool_category: 'Category',
          tool_description: 'Description',
          tag: [],
          parameters: [],
        }}
        formData={{ tools: ['keep', 'display_tool'] }}
        onViewDetails={onViewDetails}
        onFormDataChange={onFormDataChange}
      />,
    )

    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('display_tool')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Details'))
    expect(onViewDetails).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('close'))
    expect(onFormDataChange).toHaveBeenCalledWith({ tools: ['keep'] })
  })
})
