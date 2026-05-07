import React, { useState } from "react";
import { List, Button, Dropdown, Input, Modal, Checkbox, Spin } from "antd";
import {
  PushpinOutlined, PushpinFilled,
  DeleteOutlined, MoreOutlined, EditOutlined
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { ConversationHistory } from '../../../../api/conversationHistoryApi';
import { useAtom, useSetAtom } from 'jotai';
import {
  activeConversationIdAtom,
  batchPinConversationsAtom,
  batchUnpinConversationsAtom,
  setConversationHistoryAtom,
  batchDeleteConversationsAtom
} from './conversationHistoryAtom';
import { renameConversationApi } from "../../../../api/conversationHistoryApi";

// 会话项Props类型
export interface ConversationItemProps {
  item: ConversationHistory;
  groupName: string;
  showPinOption?: boolean;
  isLast?: boolean;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  selectedCount?: number;
  selectedConversations?: ConversationHistory[];
  onBatchPin?: () => void;
  onBatchDelete?: () => void;
}

export default function ConversationItem({
                                           item, groupName, showPinOption = true, isLast = false,
                                           isMultiSelectMode = false, isSelected = false, onToggleSelection,
                                           selectedCount = 0, selectedConversations = [], onBatchPin, onBatchDelete
                                         }: ConversationItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [activeConversationId, setActiveConversationId] = useAtom(activeConversationIdAtom);
  const batchPinConversations = useSetAtom(batchPinConversationsAtom);
  const batchUnpinConversations = useSetAtom(batchUnpinConversationsAtom);
  const updateConversationHistory = useSetAtom(setConversationHistoryAtom);
  const batchDeleteConversations = useSetAtom(batchDeleteConversationsAtom);

  // 计算状态
  const isActive = activeConversationId === item.id;
  const isMoreButtonDisabled = Boolean(item.titleGenerating);

  const handleStartRename = () => {
    setIsRenaming(true);
    setRenameValue(item.title);
  };

  const handleConfirmRename = async () => {
    const nextTitle = renameValue.trim();

    if (nextTitle) {
      // 更新本地状态
      updateConversationHistory({
        conversationHistoryId: item.id,
        updater: { title: nextTitle },
        isDone: false
      });

      // 持久化到数据库
      try {
        const renamedConversation = await renameConversationApi(item.id, nextTitle);
        updateConversationHistory({
          conversationHistoryId: item.id,
          updater: {
            title: renamedConversation.title,
            updatedAt: renamedConversation.updatedAt,
            titleGenerating: renamedConversation.titleGenerating
          },
          isDone: false
        });
      } catch (error) {
        console.error('Failed to persist rename', error);
        // 如果API调用失败，可以考虑回滚本地状态
      }
    }
    setIsRenaming(false);
    setRenameValue("");
  };

  const handleItemClick = (_e: React.MouseEvent) => {
    if (isRenaming) {
      return;
    }

    if (isMultiSelectMode && onToggleSelection) {
      onToggleSelection();
    } else {
      setActiveConversationId(item.id);
    }
  };

  // 简化的操作处理
  const handleOperation = async (operation: 'pin' | 'delete', targetId: string) => {
    if (operation === 'delete') {
      batchDeleteConversations([targetId]);
    } else if (operation === 'pin') {
      // 根据当前状态决定调用pin还是unpin
      if (item.isPinned) {
        await batchUnpinConversations([targetId]);
      } else {
        await batchPinConversations([targetId]);
      }
    }
  };

  const handleDeleteClick = () => {
    Modal.confirm({
      title: 'Delete Conversation',
      content: 'Are you sure you want to delete this conversation?',
      okText: 'Delete',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: () => handleOperation('delete', item.id),
    });
  };

  // 计算实际会被操作的会话数量
  const getOperationCount = (isPinOperation: boolean) => {
    if (!isMultiSelectMode || selectedConversations.length === 0) {
      return 0;
    }

    if (isPinOperation) {
      // 置顶操作：只计算未置顶的会话
      return selectedConversations.filter(c => !c.isPinned).length;
    } else {
      // 取消置顶操作：只计算已置顶的会话
      return selectedConversations.filter(c => c.isPinned).length;
    }
  };

  const menu: MenuProps = {
    items: [
      {
        key: 'rename',
        label: 'Rename',
        icon: <EditOutlined />,
        disabled: isMultiSelectMode,
        onClick: (e) => {
          e?.domEvent?.stopPropagation();
          if (!isMultiSelectMode) {
            handleStartRename();
          }
        },
      },
      ...(showPinOption ? [{
        key: 'pin',
        label: (() => {
          if (item.isPinned) {
            const count = getOperationCount(false);
            return `Unpin${isMultiSelectMode && count > 0 ? ` (${count})` : ''}`;
          } else {
            const count = getOperationCount(true);
            return `Pin to Top${isMultiSelectMode && count > 0 ? ` (${count})` : ''}`;
          }
        })(),
        icon: item.isPinned ? <PushpinFilled /> : <PushpinOutlined />,
        onClick: async (e: any) => {
          e?.domEvent?.stopPropagation();
          if (isMultiSelectMode && selectedCount > 0) {
            onBatchPin?.();
          } else if (!isMultiSelectMode) {
            await handleOperation('pin', item.id);
          }
        },
      }] : []),
      { type: 'divider' },
      {
        key: 'delete',
        label: `Delete${isMultiSelectMode && selectedCount > 0 ? ` (${selectedCount})` : ''}`,
        icon: <DeleteOutlined />,
        danger: true,
        onClick: (e) => {
          e?.domEvent?.stopPropagation();
          if (isMultiSelectMode && selectedCount > 0) {
            onBatchDelete?.();
          } else if (!isMultiSelectMode) {
            handleDeleteClick();
          }
        },
      },
    ],
  };

  return (
    <List.Item
      style={{
        background: (() => {
          if (isMultiSelectMode) {
            return isSelected ? "#e6f7ff" : "transparent";
          } else {
            return isActive ? "#f0f7ff" : "transparent";
          }
        })(),
        borderLeft: (() => {
          if (isMultiSelectMode) {
            return isSelected ? "3px solid #1890ff" : "none";
          } else {
            return isActive ? "3px solid #1890ff" : "none";
          }
        })(),
        borderRight: "none",
        borderTop: "none",
        borderBottom: isLast ? "none" : "1px solid #f0f0f0",
        padding: "12px 16px",
        cursor: isRenaming ? "default" : "pointer",
        transition: "all 0.2s",
        minHeight: "48px"
      }}
      onClick={handleItemClick}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          {/* 多选模式下显示复选框 */}
          {isMultiSelectMode && (
            <Checkbox
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection?.();
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ marginRight: 4 }}
            />
          )}
          {showPinOption && item.isPinned && groupName !== 'Pinned' && <PushpinOutlined style={{ color: "#1890ff", fontSize: 12 }} />}

          {isRenaming ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              onBlur={handleConfirmRename}
              autoFocus
              size="small"
              style={{ fontSize: 14, fontWeight: 500 }}
              maxLength={50}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{
              fontWeight: 500,
              fontSize: 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "#333"
            }}>
              {item.titleGenerating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Spin size="small" />
                  Generating Summary
                </span>
              ) : item.title}
            </span>
          )}
        </div>

        {!isRenaming && (
          <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
              disabled={isMoreButtonDisabled}
              style={{ color: "#666", flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        )}
      </div>
    </List.Item>
  );
}
