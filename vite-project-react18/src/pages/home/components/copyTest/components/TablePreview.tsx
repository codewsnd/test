/**
 * 文件作用：使用 iframe 渲染 CopyTest 表格预览，并承载行选择和 Evidence 图片事件。
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Empty } from 'antd';
export {
  COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
  COPY_TEST_PREVIEW_HEADER_WIDTH,
  COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
} from '../constants';
import {
  PREVIEW_STATE_MESSAGE_TYPE,
  PREVIEW_TABLE_SELECTOR,
} from './tablePreview/tablePreviewConstants';
import { buildPreviewDocumentHtml } from './tablePreview/tablePreviewDocument';
import {
  clamp,
  getFrameScrollRoot,
  getFrameTableScrollWidth,
  isPreviewFrameMessage,
  replaceFramePreviewContent,
  setHorizontalDragInteraction,
  syncFramePreviewState,
  updateSelectedRowIndexes,
} from './tablePreview/tablePreviewFrame';
import {
  createPreviewImageUrlBundle,
  EMPTY_PREVIEW_IMAGES,
  mapPreviewImageUrlsByKey,
  useStablePreviewImages,
} from './tablePreview/tablePreviewImages';
import type {
  CopyTestTablePreviewProps,
  HorizontalDragStart,
  HorizontalScrollMetrics,
} from './tablePreview/tablePreviewTypes';

/** 渲染 iframe 表格预览组件。 */
export const TablePreview: React.FC<CopyTestTablePreviewProps> = ({
  disabled = false,
  images = EMPTY_PREVIEW_IMAGES,
  onEvidenceImageDelete,
  onEvidenceImagePreview,
  onResultStatusChange,
  onSelectedRowIndexesChange,
  previewRevision,
  resultStatusDisabled = false,
  selectedColumnIndex,
  selectedRowIndexes,
  table,
}) => {
  /** 当前表格预览 iframe 的 DOM 引用。 */
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** 固定横向滚动条轨道的 DOM 引用。 */
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  /** 固定横向滚动条滑块的 DOM 引用。 */
  const horizontalThumbRef = useRef<HTMLDivElement>(null);
  /** 当前滑块拖拽所使用的起点快照。 */
  const horizontalDragStartRef = useRef<HorizontalDragStart>({
    clientX: 0,
    maxScrollLeft: 0,
    maxThumbTravel: 1,
    scrollLeft: 0,
  });
  /** 指针是否正在拖拽固定横向滚动条。 */
  const horizontalDraggingRef = useRef(false);
  /** 当前已排队的横向拖拽动画帧 ID。 */
  const horizontalDragFrameRef = useRef<number | null>(null);
  /** 高频 mousemove 事件中待消费的最新水平坐标。 */
  const pendingHorizontalDragClientXRef = useRef<number | null>(null);
  /** 解除 iframe scroll 事件监听的清理函数。 */
  const frameScrollCleanupRef = useRef<() => void>(() => {});
  /** 停止 iframe 尺寸监听的清理函数。 */
  const frameResizeCleanupRef = useRef<() => void>(() => {});
  /** 供 iframe message 处理器读取的最新已选行。 */
  const selectedRowIndexesRef = useRef(selectedRowIndexes);
  /** 供 iframe 状态同步读取的最新禁用状态。 */
  const disabledRef = useRef(disabled);
  /** 供 iframe 状态同步读取的最新 Result 状态禁用标记。 */
  const resultStatusDisabledRef = useRef(resultStatusDisabled);
  /** 供 iframe 状态同步读取的最新 working table 版本。 */
  const previewRevisionRef = useRef(previewRevision);
  /** 供 iframe message 校验读取的最新表格下标。 */
  const tableIndexRef = useRef(table?.index);
  /** 固定横向滚动条的尺寸与位置状态。 */
  const [horizontalScrollMetrics, setHorizontalScrollMetrics] = useState<HorizontalScrollMetrics>({
    contentWidth: 0,
    scrollLeft: 0,
    visible: false,
    viewportWidth: 0,
  });

  /** 状态更新前后内容一致的 Evidence 图片数组。 */
  const stablePreviewImages = useStablePreviewImages(images);
  /** 当前表格 Evidence 图片的 Blob URL 缓存。 */
  const previewImageUrlBundle = useMemo(
    () => createPreviewImageUrlBundle(stablePreviewImages),
    [stablePreviewImages]
  );

  useEffect(() => {
    return () => {
      previewImageUrlBundle.urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewImageUrlBundle]);

  /** 当前 working table 图片实例到稳定 Blob URL 的映射。 */
  const previewImageUrlsByKey = useMemo(
    () => mapPreviewImageUrlsByKey(
      table?.workingHtml || '',
      previewImageUrlBundle.urlsByImageId
    ),
    [previewImageUrlBundle.urlsByImageId, table?.workingHtml]
  );

  /** 完成安全改写后供 iframe 加载的整体 HTML。 */
  const previewHtml = useMemo(
    () => table
      ? buildPreviewDocumentHtml(
        table,
        previewImageUrlsByKey,
        selectedColumnIndex
      )
      : '',
    [previewImageUrlsByKey, selectedColumnIndex, table]
  );

  /** 只有切换表格或 Comparison Column 才允许更新 iframe 的完整 srcDoc。 */
  const previewDocumentKey = `${table?.index ?? 'empty'}:${selectedColumnIndex ?? 'all'}`;
  /** 同一预览上下文内冻结 srcDoc，working 内容改为在 iframe 内局部更新。 */
  const [previewDocument, setPreviewDocument] = useState(() => ({
    html: previewHtml,
    key: previewDocumentKey,
  }));
  /** 用于识别真实 srcDoc 上下文切换的上一文档快照。 */
  const previousPreviewDocumentRef = useRef({
    html: previewDocument.html,
    key: previewDocument.key,
  });
  /** iframe 当前实际已加载或已局部写入的最新内容。 */
  const lastAppliedPreviewDocumentRef = useRef({
    html: previewDocument.html,
    key: previewDocument.key,
  });
  if (previewDocument.key !== previewDocumentKey) {
    setPreviewDocument({
      html: previewHtml,
      key: previewDocumentKey,
    });
  }

  /** 将轻量交互状态增量同步到当前 iframe，不重建 srcDoc。 */
  const postPreviewState = useCallback((): void => {
    /** 当前受控 srcDoc iframe 的消息接收窗口。 */
    const previewWindow = iframeRef.current?.contentWindow;
    if (!previewWindow) {
      return;
    }
    /** srcDoc 继承父页面安全域，使用父页面的有效 origin，避免 iframe URL 返回 "null"。 */
    const targetOrigin = window.location.origin;
    previewWindow.postMessage({
      disabled: disabledRef.current,
      previewRevision: previewRevisionRef.current,
      resultStatusDisabled: resultStatusDisabledRef.current,
      selectedRowIndexes: selectedRowIndexesRef.current,
      type: PREVIEW_STATE_MESSAGE_TYPE,
    }, targetOrigin);
  }, []);

  /** 在绘制前同步 DOM 状态，并通知 iframe runtime 更新版本。 */
  const syncCurrentPreviewState = useCallback((): void => {
    syncFramePreviewState(iframeRef.current, {
      disabled: disabledRef.current,
      previewRevision: previewRevisionRef.current,
      resultStatusDisabled: resultStatusDisabledRef.current,
      selectedRowIndexes: selectedRowIndexesRef.current,
    });
    postPreviewState();
  }, [postPreviewState]);

  useLayoutEffect(() => {
    disabledRef.current = disabled;
    previewRevisionRef.current = previewRevision;
    resultStatusDisabledRef.current = resultStatusDisabled;
    selectedRowIndexesRef.current = selectedRowIndexes;
    tableIndexRef.current = table?.index;
    syncCurrentPreviewState();
  }, [
    disabled,
    previewRevision,
    resultStatusDisabled,
    selectedRowIndexes,
    syncCurrentPreviewState,
    table?.index,
  ]);

  /** 同步固定横向滚动条尺寸。 */
  const updateHorizontalScrollMetrics = useCallback((): void => {
    /** iframe 内部的表格滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    if (!scrollRoot) {
      setHorizontalScrollMetrics({
        contentWidth: 0,
        scrollLeft: 0,
        visible: false,
        viewportWidth: 0,
      });
      return;
    }

    /** 结合容器和表格读取的实际内容宽度。 */
    const contentWidth = getFrameTableScrollWidth(iframeRef.current);
    /** iframe 滚动容器的可见宽度。 */
    const viewportWidth = scrollRoot.clientWidth;
    /** 内容宽度是否超出可见区域。 */
    const visible = contentWidth > viewportWidth + 1;
    setHorizontalScrollMetrics({
      contentWidth,
      scrollLeft: scrollRoot.scrollLeft,
      visible,
      viewportWidth,
    });
  }, []);

  /** 将一次横向拖拽位置直接写入滚动 DOM，避免 mousemove 触发 React 渲染。 */
  const applyHorizontalDragPosition = useCallback((clientX: number): void => {
    /** iframe 内部的表格滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    /** 固定横向滚动条的轨道节点。 */
    const track = horizontalTrackRef.current;
    /** 固定横向滚动条的滑块节点。 */
    const thumb = horizontalThumbRef.current;
    if (!scrollRoot || !track || !thumb) {
      return;
    }

    /** 按下滑块时记录的拖拽起点。 */
    const dragStart = horizontalDragStartRef.current;
    /** 指针相对拖拽起点的水平移动距离。 */
    const deltaX = clientX - dragStart.clientX;
    /** 按滑块移动比例换算的目标滚动偏移。 */
    const nextScrollLeft = dragStart.scrollLeft
      + (deltaX / dragStart.maxThumbTravel) * dragStart.maxScrollLeft;
    /** 约束在当前表格可滚动范围内的偏移。 */
    const scrollLeft = clamp(nextScrollLeft, 0, dragStart.maxScrollLeft);
    /** 滑块和表格当前的归一化滚动进度。 */
    const thumbProgress = dragStart.maxScrollLeft === 0
      ? 0
      : scrollLeft / dragStart.maxScrollLeft;
    scrollRoot.scrollLeft = scrollLeft;
    thumb.style.left = `${thumbProgress * 100}%`;
    thumb.style.transform = `translateX(-${thumbProgress * 100}%)`;
    track.setAttribute('aria-valuenow', String(scrollLeft));
  }, []);

  /** 取消尚未执行的横向拖拽动画帧。 */
  const cancelHorizontalDragFrame = useCallback((): void => {
    if (horizontalDragFrameRef.current !== null) {
      window.cancelAnimationFrame(horizontalDragFrameRef.current);
    }
    horizontalDragFrameRef.current = null;
  }, []);

  /** 消费鼠标事件队列中最新的横向拖拽位置。 */
  const applyPendingHorizontalDrag = useCallback((): void => {
    /** 下一动画帧需要应用的最新指针水平坐标。 */
    const clientX = pendingHorizontalDragClientXRef.current;
    pendingHorizontalDragClientXRef.current = null;
    if (clientX === null || !horizontalDraggingRef.current) {
      return;
    }
    applyHorizontalDragPosition(clientX);
  }, [applyHorizontalDragPosition]);

  /** 将高频 mousemove 合并到下一动画帧。 */
  const scheduleHorizontalDrag = useCallback((clientX: number): void => {
    pendingHorizontalDragClientXRef.current = clientX;
    if (horizontalDragFrameRef.current !== null) {
      return;
    }
    horizontalDragFrameRef.current = window.requestAnimationFrame(() => {
      horizontalDragFrameRef.current = null;
      applyPendingHorizontalDrag();
    });
  }, [applyPendingHorizontalDrag]);

  /** mouseup 前同步最后一条尚未绘制的 mousemove。 */
  const flushHorizontalDrag = useCallback((): void => {
    cancelHorizontalDragFrame();
    applyPendingHorizontalDrag();
  }, [applyPendingHorizontalDrag, cancelHorizontalDragFrame]);

  /** 同步 iframe 表格和固定底部横向滚动条。 */
  const bindFrameScrollSync = useCallback((): (() => void) => {
    /** 需要监听横向偏移的 iframe 滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    if (!scrollRoot) {
      return () => {};
    }

    /** 在非拖拽场景下将 iframe 滚动位置同步给滑块。 */
    const handleFrameScroll = (): void => {
      if (horizontalDraggingRef.current) {
        return;
      }
      setHorizontalScrollMetrics(previous => ({
        ...previous,
        scrollLeft: scrollRoot.scrollLeft,
      }));
    };
    scrollRoot.addEventListener('scroll', handleFrameScroll);
    return () => {
      scrollRoot.removeEventListener('scroll', handleFrameScroll);
    };
  }, []);

  /** 用 ResizeObserver 监听预览内容尺寸，避免重复延时同步。 */
  const bindFrameResizeSync = useCallback((): (() => void) => {
    /** 需要监听尺寸变化的 iframe 滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    /** 需要监听实际内容宽度变化的预览表格。 */
    const tableElement = iframeRef.current?.contentDocument?.querySelector(PREVIEW_TABLE_SELECTOR);
    if (!scrollRoot || !tableElement || typeof ResizeObserver === 'undefined') {
      return () => {};
    }

    /** 同时观察容器和表格的尺寸监听器。 */
    const observer = new ResizeObserver(updateHorizontalScrollMetrics);
    observer.observe(scrollRoot);
    observer.observe(tableElement);
    return () => {
      observer.disconnect();
    };
  }, [updateHorizontalScrollMetrics]);

  /** 将 working table 的最新内容局部写入现有 iframe，并刷新新表格的尺寸监听。 */
  const patchFramePreviewContent = useCallback((): void => {
    if (!replaceFramePreviewContent(iframeRef.current, previewHtml)) {
      return;
    }
    lastAppliedPreviewDocumentRef.current = {
      html: previewHtml,
      key: previewDocument.key,
    };
    frameResizeCleanupRef.current();
    syncCurrentPreviewState();
    updateHorizontalScrollMetrics();
    frameResizeCleanupRef.current = bindFrameResizeSync();
  }, [
    bindFrameResizeSync,
    previewDocument.key,
    previewHtml,
    syncCurrentPreviewState,
    updateHorizontalScrollMetrics,
  ]);

  useLayoutEffect(() => {
    const lastAppliedDocument = lastAppliedPreviewDocumentRef.current;
    if (
      lastAppliedDocument.key !== previewDocument.key
      || previewHtml === lastAppliedDocument.html
    ) {
      return;
    }
    patchFramePreviewContent();
  }, [patchFramePreviewContent, previewDocument.key, previewHtml]);

  /** iframe 加载后同步滚动条。 */
  const handleFrameLoad = useCallback((): void => {
    frameScrollCleanupRef.current();
    frameResizeCleanupRef.current();
    let appliedHtml = previewDocument.html;
    if (previewHtml !== previewDocument.html) {
      const replaced = replaceFramePreviewContent(iframeRef.current, previewHtml);
      if (replaced) {
        appliedHtml = previewHtml;
      }
    }
    lastAppliedPreviewDocumentRef.current = {
      html: appliedHtml,
      key: previewDocument.key,
    };
    syncCurrentPreviewState();
    updateHorizontalScrollMetrics();
    frameScrollCleanupRef.current = bindFrameScrollSync();
    frameResizeCleanupRef.current = bindFrameResizeSync();
  }, [
    bindFrameResizeSync,
    bindFrameScrollSync,
    previewDocument.html,
    previewDocument.key,
    previewHtml,
    syncCurrentPreviewState,
    updateHorizontalScrollMetrics,
  ]);

  /** 处理固定底部滚动条滑块按下。 */
  const handleHorizontalThumbMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    /** 拖拽操作要控制的 iframe 滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    /** 用于计算滑块可移动距离的轨道节点。 */
    const track = horizontalTrackRef.current;
    /** 用于计算实际宽度的滑块节点。 */
    const thumb = horizontalThumbRef.current;
    /** 拖拽开始时 iframe 滚动容器的可见宽度。 */
    const viewportWidth = scrollRoot?.clientWidth || 0;
    horizontalDragStartRef.current = {
      clientX: event.clientX,
      maxScrollLeft: Math.max(0, getFrameTableScrollWidth(iframeRef.current) - viewportWidth),
      maxThumbTravel: Math.max(1, (track?.clientWidth || 0) - (thumb?.offsetWidth || 0)),
      scrollLeft: scrollRoot?.scrollLeft || 0,
    };
    cancelHorizontalDragFrame();
    pendingHorizontalDragClientXRef.current = null;
    horizontalDraggingRef.current = true;
    setHorizontalDragInteraction(iframeRef.current, thumb, true);
  }, [cancelHorizontalDragFrame]);

  /** 横向滚动条滑块宽度百分比。 */
  const horizontalThumbWidthPercent = horizontalScrollMetrics.visible
    ? Math.max(5, Math.min(100, (horizontalScrollMetrics.viewportWidth / horizontalScrollMetrics.contentWidth) * 100))
    : 100;

  /** 横向滚动条滑块滚动进度。 */
  const horizontalThumbProgress = horizontalScrollMetrics.visible
    ? horizontalScrollMetrics.scrollLeft
      / Math.max(1, horizontalScrollMetrics.contentWidth - horizontalScrollMetrics.viewportWidth)
    : 0;

  useEffect(() => {
    /** 当前 iframe 节点，用于卸载时恢复鼠标交互。 */
    const horizontalIframe = iframeRef.current;
    /** 当前滑块节点，用于卸载时清理拖拽样式。 */
    const horizontalThumb = horizontalThumbRef.current;
    /** 将高频指针移动合并到下一动画帧。 */
    const handleMouseMove = (event: MouseEvent): void => {
      if (!horizontalDraggingRef.current) {
        return;
      }
      scheduleHorizontalDrag(event.clientX);
    };
    /** 结束拖拽并对齐 iframe 与滑块的最终位置。 */
    const handleMouseUp = (): void => {
      if (!horizontalDraggingRef.current) {
        return;
      }
      flushHorizontalDrag();
      horizontalDraggingRef.current = false;
      setHorizontalDragInteraction(iframeRef.current, horizontalThumbRef.current, false);
      updateHorizontalScrollMetrics();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
      horizontalDraggingRef.current = false;
      pendingHorizontalDragClientXRef.current = null;
      setHorizontalDragInteraction(horizontalIframe, horizontalThumb, false);
      cancelHorizontalDragFrame();
    };
  }, [
    cancelHorizontalDragFrame,
    flushHorizontalDrag,
    scheduleHorizontalDrag,
    updateHorizontalScrollMetrics,
  ]);

  useEffect(() => {
    window.addEventListener('resize', updateHorizontalScrollMetrics);
    return () => {
      window.removeEventListener('resize', updateHorizontalScrollMetrics);
    };
  }, [updateHorizontalScrollMetrics]);

  useLayoutEffect(() => {
    const previousDocument = previousPreviewDocumentRef.current;
    if (previousDocument.key === previewDocument.key) {
      return;
    }
    /** 当前 srcDoc 状态对应的稳定快照。 */
    const currentDocument = {
      html: previewDocument.html,
      key: previewDocument.key,
    };
    previousPreviewDocumentRef.current = currentDocument;
    if (previousDocument.html === previewDocument.html) {
      if (lastAppliedPreviewDocumentRef.current.html !== previewDocument.html) {
        patchFramePreviewContent();
      } else {
        lastAppliedPreviewDocumentRef.current = currentDocument;
      }
    } else {
      lastAppliedPreviewDocumentRef.current = currentDocument;
      frameScrollCleanupRef.current();
      frameResizeCleanupRef.current();
      frameScrollCleanupRef.current = () => {};
      frameResizeCleanupRef.current = () => {};
    }
    if (!horizontalDraggingRef.current) {
      return;
    }
    horizontalDraggingRef.current = false;
    pendingHorizontalDragClientXRef.current = null;
    setHorizontalDragInteraction(
      iframeRef.current,
      horizontalThumbRef.current,
      false
    );
    cancelHorizontalDragFrame();
  }, [
    cancelHorizontalDragFrame,
    patchFramePreviewContent,
    previewDocument.html,
    previewDocument.key,
  ]);

  useEffect(() => {
    /** 当前 iframe 节点，用于组件卸载时恢复鼠标交互。 */
    const horizontalIframe = iframeRef.current;
    /** 当前滑块节点，用于组件卸载时清理样式。 */
    const horizontalThumb = horizontalThumbRef.current;
    return () => {
      frameScrollCleanupRef.current();
      frameResizeCleanupRef.current();
      horizontalDraggingRef.current = false;
      pendingHorizontalDragClientXRef.current = null;
      setHorizontalDragInteraction(horizontalIframe, horizontalThumb, false);
      cancelHorizontalDragFrame();
      frameScrollCleanupRef.current = () => {};
      frameResizeCleanupRef.current = () => {};
    };
  }, [cancelHorizontalDragFrame]);

  useLayoutEffect(() => {
    /** 分发 iframe 内部行选择、图片预览、删除和 Result 状态事件。 */
    const handleFrameMessage = (event: MessageEvent): void => {
      if (
        event.origin !== window.location.origin
        || event.source !== iframeRef.current?.contentWindow
        || !isPreviewFrameMessage(event.data)
      ) {
        return;
      }

      if (event.data.action === 'preview') {
        onEvidenceImagePreview({
          alt: event.data.alt,
          imageId: event.data.imageId,
          src: event.data.src,
        });
        return;
      }

      if (event.data.action === 'selection') {
        /** 连续 iframe 消息必须基于上一条已接收的选择，而不是等待父组件提交后的 props。 */
        const nextSelectedRowIndexes = updateSelectedRowIndexes(
          selectedRowIndexesRef.current,
          event.data.rowIndexes,
          event.data.checked
        );
        selectedRowIndexesRef.current = nextSelectedRowIndexes;
        onSelectedRowIndexesChange(nextSelectedRowIndexes);
        return;
      }

      if (event.data.action === 'set-result-status') {
        if (
          disabledRef.current
          || resultStatusDisabledRef.current
          || event.data.tableIndex !== tableIndexRef.current
          || event.data.previewRevision !== previewRevisionRef.current
        ) {
          return;
        }
        onResultStatusChange({
          imageId: event.data.imageId,
          instanceId: event.data.instanceId,
          passed: event.data.passed,
          previewRevision: event.data.previewRevision,
          rowIndex: event.data.rowIndex,
          sourceColumnKey: event.data.sourceColumnKey,
          tableIndex: event.data.tableIndex,
        });
        return;
      }

      if (event.data.action === 'delete') {
        onEvidenceImageDelete({
          imageId: event.data.imageId,
          instanceId: event.data.instanceId,
        });
      }
    };

    window.addEventListener('message', handleFrameMessage);
    return () => {
      window.removeEventListener('message', handleFrameMessage);
    };
  }, [
    onEvidenceImageDelete,
    onEvidenceImagePreview,
    onResultStatusChange,
    onSelectedRowIndexesChange,
  ]);

  if (!table) {
    return <Empty description="No table selected" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <style>
        {`
          .copy-test-fixed-horizontal-scrollbar {
            background: #f1f3f5;
            border-radius: 6px;
            height: 12px;
            margin-top: 3px;
            position: relative;
            user-select: none;
          }

          .copy-test-fixed-horizontal-scrollbar-thumb {
            background: #9aa0a6;
            border-radius: 6px;
            bottom: 2px;
            cursor: grab;
            min-width: 48px;
            position: absolute;
            top: 2px;
          }

          .copy-test-fixed-horizontal-scrollbar-thumb.is-dragging {
            cursor: grabbing;
          }

          .copy-test-fixed-horizontal-scrollbar-thumb:hover {
            background: #7d848c;
          }
        `}
      </style>
      <iframe
        ref={iframeRef}
        className="min-h-0 flex-1 w-full border-0"
        data-testid="copy-test-table-preview-iframe"
        onLoad={handleFrameLoad}
        srcDoc={previewDocument.html}
        title="CopyTest table preview"
      />
      <div
        ref={horizontalTrackRef}
        aria-label="Horizontal table scroll"
        aria-orientation="horizontal"
        aria-valuemax={Math.max(0, horizontalScrollMetrics.contentWidth - horizontalScrollMetrics.viewportWidth)}
        aria-valuemin={0}
        aria-valuenow={horizontalScrollMetrics.scrollLeft}
        className={`copy-test-fixed-horizontal-scrollbar shrink-0 ${
          horizontalScrollMetrics.visible ? 'block' : 'hidden'
        }`}
        role="scrollbar"
      >
        <div
          ref={horizontalThumbRef}
          className="copy-test-fixed-horizontal-scrollbar-thumb"
          onMouseDown={handleHorizontalThumbMouseDown}
          style={{
            left: `${horizontalThumbProgress * 100}%`,
            transform: `translateX(-${horizontalThumbProgress * 100}%)`,
            width: `${horizontalThumbWidthPercent}%`,
          }}
        />
      </div>
    </div>
  );
};

export default TablePreview;
