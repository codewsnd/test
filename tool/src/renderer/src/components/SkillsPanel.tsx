import {
  DeleteOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  FrownOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagOutlined
} from '@ant-design/icons'
import { Button, Empty, Flex, Input, Modal, Spin, Table, Tag, Typography, message, theme } from 'antd'
import type { TableColumnsType } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import useTableScrollY from '../hooks/useTableScrollY'
import getStripedTableRowClassName from '../utils/getStripedTableRowClassName'

type CodexSkill = {
  id: string
  name: string
  description: string
  category: 'system' | 'custom' | 'superpower'
  path: string
}

const categoryTone: Record<CodexSkill['category'], string> = {
  system: 'System',
  custom: 'Custom',
  superpower: 'Superpower'
}

// 从本地 `SKILL.md` 路径里提取所属目录名，用于在卡片中展示真实来源文件夹。
function getSkillFolderName(skillPath: string): string {
  const normalizedPath = skillPath.replace(/\\/g, '/')
  const segments = normalizedPath.split('/').filter(Boolean)

  return segments.at(-2) ?? 'unknown'
}

function SkillsPanel(): React.JSX.Element {
  const { token } = theme.useToken()
  const [skills, setSkills] = useState<CodexSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingSkillId, setOpeningSkillId] = useState<string | null>(null)
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null)
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<CodexSkill | null>(null)
  const [keyword, setKeyword] = useState('')
  const [messageApi, contextHolder] = message.useMessage()
  const { containerRef, pageSize, maxRowsWithoutPagination } = useTableScrollY({ rowHeight: 56, minPageSize: 7 })

  const panelStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      height: '100%'
    }),
    []
  )

  // 把技能扫描提成独立函数，供首次加载和手动刷新复用。
  const loadSkills = async (mode: 'initial' | 'refresh' = 'initial'): Promise<void> => {
    try {
      if (mode === 'initial') {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      const items = await window.api.listCodexSkills()
      setSkills(items)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load Codex skills.')
    } finally {
      if (mode === 'initial') {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    let disposed = false

    // 仅在 Skills 面板挂载时读取本机技能目录，避免无关页面产生额外 IO。
    const bootstrap = async (): Promise<void> => {
      if (disposed) {
        return
      }

      await loadSkills('initial')
    }

    bootstrap()

    return () => {
      disposed = true
    }
  }, [])

  // 搜索同时匹配技能名、描述和分类，方便快速定位目标技能。
  const filteredSkills = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return skills
    }

    return skills.filter((skill) => {
      const haystack =
        `${skill.name} ${skill.description} ${categoryTone[skill.category]} ${getSkillFolderName(skill.path)}`.toLowerCase()
      return haystack.includes(normalizedKeyword)
    })
  }, [keyword, skills])

  const columns = useMemo<TableColumnsType<CodexSkill>>(
    () => [
      {
        title: 'Skill',
        dataIndex: 'name',
        key: 'name',
        width: '18%',
        render: (_, record) => (
          <Typography.Text strong ellipsis style={{ display: 'block' }}>
            {record.name}
          </Typography.Text>
        )
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: '40%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ margin: 0, color: token.colorTextSecondary }}>
            {record.description || 'No description available'}
          </Typography.Text>
        )
      },
      {
        title: 'Category',
        dataIndex: 'category',
        key: 'category',
        width: '14%',
        // 将分类拆成独立列，避免 Skill 单元格变成双层结构抬高整行高度。
        render: (_, record) => (
          <Tag bordered={false} color="blue" icon={<TagOutlined />} style={{ margin: 0 }}>
            {categoryTone[record.category]}
          </Tag>
        )
      },
      {
        title: 'Folder',
        dataIndex: 'path',
        key: 'folder',
        width: '16%',
        render: (_, record) => (
          <Typography.Text ellipsis style={{ color: token.colorTextSecondary }}>
            <FolderOpenOutlined style={{ marginRight: 6 }} />
            {getSkillFolderName(record.path)}
          </Typography.Text>
        )
      },
      {
        title: 'Actions',
        key: 'actions',
        width: '12%',
        render: (_, record) => (
          <div className="flex items-center gap-1">
            <Button
              aria-label={`Open ${record.name} folder`}
              icon={<ExportOutlined />}
              loading={openingSkillId === record.id}
              shape="circle"
              size="small"
              type="text"
              onClick={() => {
                void handleOpenSkillFolder(record)
              }}
            />
            <Button
              danger
              aria-label={`Delete ${record.name} folder`}
              icon={<DeleteOutlined />}
              loading={deletingSkillId === record.id}
              shape="circle"
              size="small"
              type="text"
              onClick={() => {
                setPendingDeleteSkill(record)
              }}
            />
          </div>
        )
      }
    ],
    [deletingSkillId, openingSkillId, token.colorTextSecondary]
  )

  // 打开按钮会直接调用桌面端能力，定位到对应 skill 所在的本地目录。
  const handleOpenSkillFolder = async (skill: CodexSkill): Promise<void> => {
    try {
      setOpeningSkillId(skill.id)
      await window.api.openSkillFolder(skill.path)
    } catch (openError) {
      messageApi.error(openError instanceof Error ? openError.message : 'Failed to open skill folder.')
    } finally {
      setOpeningSkillId(null)
    }
  }

  // 删除动作走主进程执行，并在成功后重新扫描列表，保持界面与本地文件系统一致。
  const handleDeleteSkillFolder = async (): Promise<void> => {
    if (!pendingDeleteSkill) {
      return
    }

    try {
      setDeletingSkillId(pendingDeleteSkill.id)
      await window.api.deleteSkillFolder(pendingDeleteSkill.path)
      messageApi.success(`Deleted ${pendingDeleteSkill.name}`)
      setPendingDeleteSkill(null)
      await loadSkills('refresh')
    } catch (deleteError) {
      messageApi.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete skill folder.')
    } finally {
      setDeletingSkillId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center" style={panelStyle}>
        <Flex align="center" gap="middle" vertical>
          <Spin size="large" />
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            Scanning local Codex skills...
          </Typography.Text>
        </Flex>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center px-6" style={panelStyle}>
        <Empty
          description={<Typography.Text style={{ color: token.colorTextSecondary }}>{error}</Typography.Text>}
          image={<FrownOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
        />
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {contextHolder}
      <Modal
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: deletingSkillId === pendingDeleteSkill?.id }}
        okText="Delete"
        open={Boolean(pendingDeleteSkill)}
        title="Delete skill folder"
        onCancel={() => setPendingDeleteSkill(null)}
        onOk={() => {
          void handleDeleteSkillFolder()
        }}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Are you sure you want to delete the folder for <strong>{pendingDeleteSkill?.name}</strong>? This action
          cannot be undone.
        </Typography.Paragraph>
      </Modal>

      {/* 表格搜索统一改成“左侧搜索图标 + 输入框外右侧操作区”的布局。 */}
      <Flex align="center" gap={8}>
        <Input
          allowClear
          placeholder="Search by skill name, description, or category"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          size="large"
          style={{ flex: 1 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Button
          aria-label="Refresh skills"
          icon={<ReloadOutlined />}
          loading={refreshing}
          shape="circle"
          size="middle"
          type="text"
          onClick={() => {
            // 点击刷新时重新扫描本机 skills 目录，确保列表反映最新文件状态。
            void loadSkills('refresh')
          }}
        />
      </Flex>

      <div
        ref={containerRef}
        className="tool-table-shell mt-5 min-h-0 flex-1 overflow-hidden rounded-[18px]"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary
        }}
      >
        <Table<CodexSkill>
          className="tool-fill-table"
          columns={columns}
          dataSource={filteredSkills}
          size="small"
          tableLayout="fixed"
          rowClassName={getStripedTableRowClassName}
          pagination={
            filteredSkills.length > maxRowsWithoutPagination
              ? {
                  pageSize,
                  showSizeChanger: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                }
              : false
          }
          rowKey="id"
          locale={{
            emptyText: (
              <Empty
                description={
                  <Typography.Text style={{ color: token.colorTextSecondary }}>
                    No matching skills found
                  </Typography.Text>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          }}
        />
      </div>
    </div>
  )
}

export default SkillsPanel
