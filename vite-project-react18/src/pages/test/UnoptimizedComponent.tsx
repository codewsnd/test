import React, { useState, useEffect } from 'react';

// 一个昂贵的计算函数
const expensiveCalculation = (num) => {
  console.log('正在进行昂贵计算...');
  // 模拟昂贵的计算
  for (let i = 0; i < 100000000; i++) {}
  return num * 2;
};

// 子组件
const ChildComponent = ({ items, onAddItem }) => {
  console.log('子组件重新渲染了');

  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
      <h3>子组件</h3>
      <p>项目数量: {items.length}</p>
      <button onClick={onAddItem}>添加项目</button>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const UnoptimizedComponent = () => {
  const [count, setCount] = useState(0);
  const [todos, setTodos] = useState(['项目1', '项目2']);
  const [number, setNumber] = useState(1);
  const [theme, setTheme] = useState('light');

  // 每次渲染都会创建新函数
  const addTodo = () => {
    setTodos([...todos, `新项目 ${todos.length + 1}`]);
  };

  // 每次渲染都会重新计算
  const calculation = expensiveCalculation(number);

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
      <h2>未优化的组件</h2>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          切换主题 (当前: {theme})
        </button>
        <p>切换主题会触发组件重新渲染，导致不必要的计算和函数创建</p>
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
        <h4>问题说明:</h4>
        <ul>
          <li>每次组件渲染时，expensiveCalculation 都会执行，即使 number 没有变化</li>
          <li>每次组件渲染时，addTodo 函数都会重新创建</li>
          <li>由于函数每次都是新创建的，子组件即使没有变化也会重新渲染</li>
          <li>观察控制台输出，了解性能问题</li>
        </ul>
      </div>
    </div>
  );
};

export default UnoptimizedComponent;
