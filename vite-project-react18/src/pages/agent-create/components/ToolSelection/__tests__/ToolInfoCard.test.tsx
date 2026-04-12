import '@testing-library/jest-dom/vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
}))

vi.mock('antd', () => {
  const Button = ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  )
  const Dropdown = ({
    children,
    menu,
  }: React.PropsWithChildren<{ menu: { items: Array<{ key: string; label: string; onClick?: () => void }> } }>) => (
    <div>
      {children}
      {menu.items.map((item) => (
        <button key={item.key} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  )
  const Typography = {
    Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
    Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  }

  return {
    Button,
    Dropdown,
    Modal: { confirm: confirmMock },
    Typography,
  }
})

vi.mock('@/pages/agent-create/components/ToolSelection/IconConfig', () => ({
  getToolIcon: vi.fn(() => 'icon.svg'),
}))

import ToolInfoCard from '../ToolInfoCard'

describe('InfoCard', () => {
  it('renders content and handles menu actions', () => {
    const onViewDetails = vi.fn()
    const onFormDataChange = vi.fn()

    render(
      <ToolInfoCard
        tool={{
          tool_name: 'name',
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
        formData={{ tools: ['keep', 'keep/remove'] }}
        onViewDetails={onViewDetails}
        onFormDataChange={onFormDataChange}
      />,
    )

    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()

    fireEvent.click(screen.getByText('View and edit details'))
    expect(onViewDetails).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Remove'))
    const config = confirmMock.mock.calls[0][0]
    render(config.footer(null, { OkBtn: () => <button>ok</button>, CancelBtn: () => <button>cancel</button> }))
    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(screen.getByText('cancel')).toBeInTheDocument()
    config.onOk()

    expect(onFormDataChange).toHaveBeenCalledWith({ tools: ['keep'] })
  })
})
