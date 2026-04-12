import '@testing-library/jest-dom/vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ant-design/icons', () => ({
  MinusCircleOutlined: () => <span>minus</span>,
  PlusCircleOutlined: () => <span>plus</span>,
  RightOutlined: () => <span>right</span>,
}))

vi.mock('antd', () => {
  const Button = ({
    children,
    icon,
    onClick,
    className,
  }: React.PropsWithChildren<{ icon?: React.ReactNode; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; className?: string }>) => (
    <button className={className} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
  const Card = ({
    children,
    onClick,
    className,
    styles,
  }: React.PropsWithChildren<{ onClick?: () => void; className?: string; styles?: { body?: { padding?: number } } }>) => <div className={className} data-padding={styles?.body?.padding} onClick={onClick}>{children}</div>
  const Space = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  const Tag = ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>
  const Typography = {
    Paragraph: ({ children, className, ellipsis }: React.PropsWithChildren<{ className?: string; ellipsis?: unknown }>) => <p className={className} data-ellipsis={ellipsis ? 'true' : 'false'}>{children}</p>,
    Text: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <span className={className}>{children}</span>,
  }

  return { Button, Card, Space, Tag, Typography }
})

vi.mock('../IconConfig', () => ({
  getToolIcon: vi.fn(() => 'icon.svg'),
}))

import ToolItemCard from '../ToolItemCard'

const baseTool = {
  tool_name: 'name',
  tool_display_name: 'display',
  mcp_server_name: 'MCP',
  provider: 'Web',
  icon: 'https://cdn.test/card.svg',
  is_hidden_in_tool: false,
  tool_full_name: 'tool/full',
  tool_category: 'Category',
  tool_description: 'Description',
  tag: ['tag'],
  parameters: [{ param_name: 'first', param_description: 'desc', required: true }],
}

describe('ToolItemCard', () => {
  it('renders both icon variants and handles card/button clicks', () => {
    const onClick = vi.fn()
    const onToggleAdd = vi.fn()

    const { container } = render(
      <ToolItemCard
        tool={baseTool}
        selected={false}
        added={false}
        onClick={onClick}
        onToggleAdd={onToggleAdd}
      />,
    )

    expect(screen.getByText('Display')).toHaveClass('!text-[16px]')
    expect(screen.getByText('Display')).toHaveClass('!font-medium')
    expect(screen.getByText('Description')).toHaveClass('!text-[14px]')
    expect(screen.getByText('Description')).toHaveAttribute('data-ellipsis', 'true')
    expect(screen.getByText('tag')).toHaveClass('!h-6')
    expect(screen.getByText('Add to agent')).toHaveClass('!mt-5')
    expect(screen.getByText('Add to agent')).toHaveClass('!text-[16px]')
    expect(container.querySelector('img')).toBeInTheDocument()
    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.getByText('tag')).toBeInTheDocument()
    expect(screen.getByText('first')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Display'))
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Add to agent'))
    expect(onToggleAdd).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders empty title and remove state', () => {
    const { container } = render(
      <ToolItemCard
        tool={{ ...baseTool, tool_display_name: '', tag: [], parameters: [] }}
        selected={true}
        added={true}
        onClick={vi.fn()}
        onToggleAdd={vi.fn()}
      />,
    )

    expect(container.firstChild).toHaveAttribute('data-padding', '16')
    expect(screen.getByText('Remove')).toBeInTheDocument()
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
