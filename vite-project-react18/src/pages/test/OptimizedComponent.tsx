import React, { useState, useEffect, useMemo, useCallback } from 'react';

// 一个昂贵的计算函数
const expensiveCalculation = (num) => {
  console.log('正在进行昂贵计算...');
  // 模拟昂贵的计算
  for (let i = 0; i < 100000000; i++) {}
  return num * 2;
};

// 使用React.memo包装子组件，避免不必要的重新渲染
const ChildComponent = React.memo(({ items, onAddItem }) => {
  console.log('子组件重新渲染了');

  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
      <h3>子组件 (使用React.memo优化)</h3>
      <p>项目数量: {items.length}</p>
      <button onClick={onAddItem}>添加项目</button>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
});

const OptimizedComponent = () => {
  const [count, setCount] = useState(0);
  const [todos, setTodos] = useState(['项目1', '项目2']);
  const [number, setNumber] = useState(1);
  const [theme, setTheme] = useState('light');

  // 使用useCallback缓存函数，依赖项不变时函数不会重新创建
  const addTodo = useCallback(() => {
    setTodos(prevTodos => [...prevTodos, `新项目 ${prevTodos.length + 1}`]);
  }, []); // 空依赖数组表示这个函数永远不会改变

  // 使用useMemo缓存计算结果，依赖项不变时不会重新计算
  const calculation = useMemo(() => {
    return expensiveCalculation(number);
  }, [number]); // 只有当number变化时才重新计算

  // 主题变化效果
  useEffect(() => {
    console.log('主题已更改:', theme);
  }, [theme]);

  return (
    <div style={{
      padding: '20px',
      backgroundColor: theme === 'dark' ? '#333' : '#fff',
      color: theme === 'dark' ? '#fff' : '#333'
    }}>
      <h2>优化后的组件</h2>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          切换主题 (当前: {theme})
        </button>
        <p>切换主题会触发组件重新渲染，但不会影响被useMemo和useCallback优化的部分</p>
      </div>

      <div>
        <p>计数器: {count}</p>
        <button onClick={() => setCount(c => c + 1)}>增加计数</button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <p>数字: {number}</p>
        <button onClick={() => setNumber(n => n + 1)}>增加数字</button>
        <p>昂贵计算结果: {calculation}</p>
      </div>

      <ChildComponent items={todos} onAddItem={addTodo} />

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: theme === 'dark' ? '#444' : '#f5f5f5' }}>
        <h4>优化说明:</h4>
        <ul>
          <li>使用<strong>useMemo</strong>缓存昂贵的计算结果，只有当依赖项(number)改变时才重新计算</li>
          <li>使用<strong>useCallback</strong>缓存函数引用，函数在整个组件生命周期内保持不变</li>
          <li>使用<strong>React.memo</strong>包装子组件，避免不必要的重新渲染</li>
          <li>观察控制台输出，了解性能改进</li>
        </ul>
      </div>
    </div>
  );
};

export default OptimizedComponent;
