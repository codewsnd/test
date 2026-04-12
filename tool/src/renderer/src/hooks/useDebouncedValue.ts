import { useEffect, useState } from 'react'

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // 通过延迟同步输入值，避免搜索和筛选每次击键都立即触发表格重算。
    const timer = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [delay, value])

  return debouncedValue
}

export default useDebouncedValue
