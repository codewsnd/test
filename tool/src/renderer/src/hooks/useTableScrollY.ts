import { useCallback, useEffect, useState } from 'react'

type UseTableScrollYOptions = {
  rowHeight?: number
  minPageSize?: number
  headerHeight?: number
  paginationHeight?: number
}

function useTableScrollY(options: UseTableScrollYOptions = {}): {
  containerRef: (node: HTMLDivElement | null) => void
  pageSize: number
  maxRowsWithoutPagination: number
} {
  const { rowHeight = 56, minPageSize = 5, headerHeight = 55, paginationHeight = 56 } = options
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const [pageSize, setPageSize] = useState(minPageSize)
  const [maxRowsWithoutPagination, setMaxRowsWithoutPagination] = useState(minPageSize)
  // 使用回调 ref 追踪真实容器节点，确保像 Skills 这种延迟挂载的表格也能重新绑定测量逻辑。
  const containerRef = useCallback((node: HTMLDivElement | null): void => {
    setContainerElement(node)
  }, [])

  useEffect(() => {
    const element = containerElement

    if (!element) {
      return
    }

    let frameId = 0

    // 根据表格容器和真实行高动态计算分页大小，避免出现底部留白很多却提前分页。
    const updateScrollMetrics = (): void => {
      const containerHeight = Math.floor(element.getBoundingClientRect().height)
      const measuredHeaderHeight =
        Math.ceil(element.querySelector('.ant-table-thead')?.getBoundingClientRect().height ?? headerHeight)
      const rowElements = Array.from(element.querySelectorAll('.ant-table-tbody .ant-table-row'))
      // 用前几行的平均高度代替单行采样，减少 Skills 这类复杂单元格带来的误差。
      const measuredRowHeight =
        rowElements.length > 0
          ? Math.ceil(
              rowElements.slice(0, 5).reduce((totalHeight, rowElement) => {
                return totalHeight + rowElement.getBoundingClientRect().height
              }, 0) / Math.min(rowElements.length, 5)
            )
          : rowHeight
      const rowsWithPagination = Math.max(
        minPageSize,
        Math.floor(Math.max(measuredRowHeight, containerHeight - measuredHeaderHeight - paginationHeight) / measuredRowHeight)
      )
      const rowsWithoutPagination = Math.max(
        minPageSize,
        Math.floor(Math.max(measuredRowHeight, containerHeight - measuredHeaderHeight - 12) / measuredRowHeight)
      )

      setPageSize(rowsWithPagination)
      setMaxRowsWithoutPagination(rowsWithoutPagination)
    }

    const scheduleUpdate = (): void => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        updateScrollMetrics()
      })
    }

    scheduleUpdate()

    const observer = new ResizeObserver(() => {
      scheduleUpdate()
    })

    observer.observe(element)

    // 监听表格行和分页的真实渲染变化，避免只按估算高度导致分页过早。
    const mutationObserver = new MutationObserver(() => {
      scheduleUpdate()
    })

    mutationObserver.observe(element, { childList: true, subtree: true, attributes: true })

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [containerElement, headerHeight, minPageSize, paginationHeight, rowHeight])

  return { containerRef, pageSize, maxRowsWithoutPagination }
}

export default useTableScrollY
