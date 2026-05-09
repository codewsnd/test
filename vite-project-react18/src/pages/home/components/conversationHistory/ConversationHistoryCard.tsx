import React, {useState, useEffect, useRef, useMemo} from "react";
import {Button, Input, Checkbox, Popover, Space, List, Collapse, Empty, Spin, Modal, ConfigProvider} from "antd";
import {
  SearchOutlined,
  PushpinOutlined,
  FilterOutlined,
  PlusOutlined,
  AppstoreOutlined,
  DownOutlined,
  RightOutlined
} from "@ant-design/icons";
import { useAtom, useSetAtom } from 'jotai';
import {
  conversationHistoriesAtom,
  initializeDbAtom,
  loadMoreConversationsAtom,
  dbInitializedAtom,
  searchConversationsAtom,
  searchQueryAtom,
  currentPageAtom,
  hasMoreAtom,
  batchDeleteConversationsAtom,
  batchPinConversationsAtom,
  batchUnpinConversationsAtom,
  activeConversationIdAtom
} from './conversationHistoryAtom';
import type {ConversationHistory} from '../../../../api/conversationHistoryApi';
import ConversationItem from "./ConversationItem";
import type { CollapseProps } from "antd";
import dayjs from 'dayjs';

// 时间分组规则接口
interface TimeGroupRule {
  key: string;
  label: string;
  enabled: boolean;
  filter: (timestamp: number) => boolean;
}

// 预定义分组规则
const DEFAULT_GROUP_RULES: TimeGroupRule[] = [
  {
    key: 'pinned',
    label: 'Pinned',
    enabled: true,
    filter: () => false,
  },
  {
    key: 'today',
    label: 'Today',
    enabled: true,
    filter: (timestamp: number) => {
      const startOfToday = dayjs().startOf('day').valueOf();
      return timestamp >= startOfToday;
    },
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    enabled: true,
    filter: (timestamp: number) => {
      const startOfToday = dayjs().startOf('day').valueOf();
      const startOfYesterday = dayjs().subtract(1, 'day').startOf('day').valueOf();
      return timestamp >= startOfYesterday && timestamp < startOfToday;
    },
  },
  {
    key: 'previous7Days',
    label: 'Previous 7 days',
    enabled: true,
    filter: (timestamp: number) => {
      const startOfYesterday = dayjs().subtract(1, 'day').startOf('day').valueOf();
      const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').valueOf();
      return timestamp >= sevenDaysAgo && timestamp < startOfYesterday;
    },
  },
  {
    key: 'earlier',
    label: 'Earlier',
    enabled: true,
    filter: (timestamp: number) => {
      const sevenDaysAgo = dayjs().subtract(7, 'day').startOf('day').valueOf();
      return timestamp < sevenDaysAgo;
    },
  }
];

// 分页大小配置 - 可以在这里修改默认每页显示的条数
const PAGE_SIZE = 10;

// 筛选选项类型
interface FilterOptions {
  showPinned: boolean;
  showRegular: boolean;
}

export default function ConversationHistoryCard() {
  const [conversationHistories] = useAtom(conversationHistoriesAtom);
  const [dbInitialized] = useAtom(dbInitializedAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [currentPage] = useAtom(currentPageAtom);
  const [hasMore] = useAtom(hasMoreAtom);
  const setActiveConversationId = useSetAtom(activeConversationIdAtom);
  const initializeDb = useSetAtom(initializeDbAtom);
  const loadMoreConversations = useSetAtom(loadMoreConversationsAtom);
  const searchConversations = useSetAtom(searchConversationsAtom);
  const batchDeleteConversations = useSetAtom(batchDeleteConversationsAtom);
  const batchPinConversations = useSetAtom(batchPinConversationsAtom);
  const batchUnpinConversations = useSetAtom(batchUnpinConversationsAtom);

  // 本地状态
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    showPinned: true,
    showRegular: true
  });
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollThrottleRef = useRef<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [openPanels, setOpenPanels] = useState<string[]>([]);
  const [groupRules] = useState<TimeGroupRule[]>(DEFAULT_GROUP_RULES);

  // 多选相关函数
  const toggleConversationSelection = (id: string) => {
    setSelectedConversationIds(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const clearAllSelections = () => {
    setSelectedConversationIds(new Set());
  };

  // 批量置顶操作函数
  const handleBatchPin = async (isPinOperation: boolean) => {
    const selectedIds = Array.from(selectedConversationIds);
    const selectedConversations = conversationHistories.filter(c => selectedIds.includes(c.id));

    let targetConversationIds: string[];

    if (isPinOperation) {
      // 只对未置顶的会话执行置顶
      targetConversationIds = selectedConversations
        .filter(c => !c.isPinned)
        .map(c => c.id);
    } else {
      // 只对已置顶的会话执行取消置顶
      targetConversationIds = selectedConversations
        .filter(c => c.isPinned)
        .map(c => c.id);
    }

    if (targetConversationIds.length === 0) {
      return; // 没有需要操作的会话
    }

    try {
      setLoading(true);

      if (isPinOperation) {
        await batchPinConversations(targetConversationIds);
      } else {
        await batchUnpinConversations(targetConversationIds);
      }

      clearAllSelections();
    } catch (error) {
      console.error('Failed to batch pin/unpin conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = () => {
    const selectedCount = selectedConversationIds.size;
    Modal.confirm({
      title: `Delete ${selectedCount} conversations?`,
      content: `Are you sure you want to delete ${selectedCount} selected conversations?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setLoading(true);
          const selectedIds = Array.from(selectedConversationIds);
          await batchDeleteConversations(selectedIds);
          clearAllSelections();
        } catch (error) {
          console.error('Failed to batch delete conversations:', error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 数据库初始化
  useEffect(() => {
    initializeDb();
  }, [initializeDb]);

  // 处理搜索
  const handleSearch = async (value: string) => {
    setLoading(true);
    try {
      await searchConversations(value.trim());
    } finally {
      setLoading(false);
    }
  };

  // 处理回车搜索
  const handleSearchKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      await handleSearch(searchQuery);
    }
  };

  // 简化的数据过滤逻辑
  const filteredConversations = useMemo(() => {
    return conversationHistories.filter(conv => {
      if (conv.isPinned && !filterOptions.showPinned) return false;
      if (!conv.isPinned && !filterOptions.showRegular) return false;
      return true;
    });
  }, [conversationHistories, filterOptions]);

  // 本地分组函数
  const groupConversationsLocally = (conversations: ConversationHistory[], rules: TimeGroupRule[]): Record<string, ConversationHistory[]> => {
    const enabledRules = rules.filter(rule => rule.enabled);
    const grouped: Record<string, ConversationHistory[]> = {};

    // 初始化分组
    enabledRules.forEach(rule => grouped[rule.label] = []);

    // 分组逻辑（复制自ConversationDb）
    conversations.forEach(conv => {
      // 置顶优先
      if (conv.isPinned) {
        const pinnedRule = enabledRules.find(r => r.key === 'pinned');
        if (pinnedRule) {
          grouped[pinnedRule.label].push(conv);
          return;
        }
      }

      // 按规则匹配
      for (const rule of enabledRules) {
        if (rule.key !== 'pinned' && rule.filter(new Date(conv.updatedAt).getTime())) {
          grouped[rule.label].push(conv);
          return;
        }
      }
    });

    // 排序
    Object.entries(grouped).forEach(([label, convs]) => {
      const rule = enabledRules.find(r => r.label === label);
      convs.sort((a, b) =>
        rule?.key === 'pinned'
          ? (new Date(b.pinnedAt || 0).getTime()) - (new Date(a.pinnedAt || 0).getTime())
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    return grouped;
  };

  // 简化的分组数据处理
  const groupedData = useMemo(() => {
    return groupConversationsLocally(filteredConversations, groupRules);
  }, [filteredConversations, groupRules]);

  // 直接使用openPanels状态管理
  useEffect(() => {
    setOpenPanels(Object.keys(groupedData));
  }, [groupedData]);

  // 分页加载
  const handleLoadMore = async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      const result = await loadMoreConversations({ currentPage: currentPage + 1, pageSize: PAGE_SIZE });

      if (!result.success) {
        console.error('Failed to load more conversations');
      }
    } catch (error) {
      console.error('Failed to load more conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (scrollThrottleRef.current) return;

    const {scrollTop, scrollHeight, clientHeight} = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100 && !loading && hasMore) {
      scrollThrottleRef.current = true;
      handleLoadMore().finally(() => {
        setTimeout(() => scrollThrottleRef.current = false, 300);
      });
    }
  };

  // 筛选器内容
  const filterContent = (
    <div style={{padding: '8px 0', minWidth: 200}}>
      <div style={{marginBottom: 12, fontWeight: 500, fontSize: 14}}>Filter Options</div>
      <Space direction="vertical" size={8} style={{width: '100%'}}>
        <Checkbox
          checked={filterOptions.showPinned}
          onChange={(e) => setFilterOptions({...filterOptions, showPinned: e.target.checked})}
        >
          <Space>
            <PushpinOutlined style={{color: '#1890ff'}}/>
            Pinned Conversations
          </Space>
        </Checkbox>
        <Checkbox
          checked={filterOptions.showRegular}
          onChange={(e) => setFilterOptions({...filterOptions, showRegular: e.target.checked})}
        >
          Regular Conversations
        </Checkbox>
      </Space>
      <div style={{marginTop: 12, paddingTop: 8, borderTop: '1px solid #f0f0f0'}}>
        <Button
          size="small"
          type="link"
          onClick={() => setFilterOptions({showPinned: true, showRegular: true})}
          style={{padding: 0, height: 'auto'}}
        >
          Reset Filters
        </Button>
      </div>
    </div>
  );

  // 面板变化处理
  const handlePanelChange = (keys: string | string[]) => {
    setOpenPanels(Array.isArray(keys) ? keys : [keys]);
  };

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = !filterOptions.showPinned || !filterOptions.showRegular;

  // 渲染函数
  const renderHistoryContent = () => {
    // 如果数据库还未初始化，显示加载状态
    if (!dbInitialized) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '300px',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Spin size="large" />
          <span style={{ color: '#666', fontSize: '14px' }}>Loading conversations...</span>
        </div>
      );
    }

    const hasData = Object.values(groupedData).some(arr => arr.length > 0);

    if (!hasData) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No conversation history"
          />
        </div>
      );
    }

    const collapseItems: CollapseProps['items'] = Object.entries(groupedData)
      .filter(([_, conversations]) => conversations.length > 0)
      .map(([groupName, conversations]) => ({
        key: groupName,
        label: (
          <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
            {groupName} ({conversations.length})
          </span>
        ),
        children: (
          <List
            dataSource={conversations}
            renderItem={(item: ConversationHistory, index: number) => (
              <ConversationItem
                key={item.id}
                item={item}
                groupName={groupName}
                showPinOption={true}
                isLast={index === conversations.length - 1}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedConversationIds.has(item.id)}
                onToggleSelection={() => toggleConversationSelection(item.id)}
                selectedCount={selectedConversationIds.size}
                selectedConversations={conversationHistories.filter(c =>
                  Array.from(selectedConversationIds).includes(c.id)
                )}
                onBatchPin={() => handleBatchPin(!item.isPinned)}
                onBatchDelete={handleBatchDelete}
              />
            )}
            size="small"
            split={false}
          />
        ),
        style: {
          marginBottom: 8,
          border: 'none',
          background: 'transparent'
        }
      }));

    return (
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <ConfigProvider
          theme={{
            components: {
              Collapse: {
                headerPadding: "0 12px"
              },
            },
          }}
        >
          <Collapse
            activeKey={openPanels}
            onChange={handlePanelChange}
            ghost
            expandIcon={({ isActive }) =>
              isActive ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />
            }
            style={{ background: 'transparent' }}
            items={collapseItems}
          />
        </ConfigProvider>

        {loading && (
          <div style={{textAlign: 'center', padding: '16px'}}>
            <div style={{fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              <Spin size="small" />
              <span style={{ color: '#666' }}>Loading...</span>
            </div>
          </div>
        )}
        {!hasMore && conversationHistories.length === 0 && (
          <div style={{textAlign: 'center', padding: '40px'}}>
            <div style={{fontSize: 14, color: '#999'}}>No conversations found</div>
          </div>
        )}

      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        <Button
          size="small"
          type={isMultiSelectMode ? "primary" : "default"}
          icon={<AppstoreOutlined/>}
          onClick={() => {
            setIsMultiSelectMode(!isMultiSelectMode);
            if (isMultiSelectMode) {
              clearAllSelections();
            }
          }}
          style={{flexShrink: 0}}
          disabled={!dbInitialized || loading}
        />

        <Input
          placeholder="Search... (Press Enter to search)"
          prefix={<SearchOutlined style={{color: '#999'}}/>}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          onClear={() => handleSearch('')}
          allowClear
          size="small"
          style={{flex: 1, minWidth: 120}}
          disabled={!dbInitialized || loading}
        />

        <Popover content={filterContent} trigger="click" placement="bottomRight">
          <Button
            size="small"
            icon={<FilterOutlined/>}
            type={hasActiveFilters ? "primary" : "default"}
            style={{flexShrink: 0}}
            disabled={!dbInitialized || loading}
          />
        </Popover>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined/>}
          onClick={() => setActiveConversationId(null)}
          style={{flexShrink: 0}}
          title="New Conversation"
          disabled={!dbInitialized || loading}
        />
      </div>


      {renderHistoryContent()}
    </div>
  );
}
