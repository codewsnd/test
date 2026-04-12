import UnoptimizedComponent from './UnoptimizedComponent';
import OptimizedComponent from './OptimizedComponent';

const TestTest = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>React useMemo 和 useCallback 对比示例</h1>
      <p>打开浏览器开发者工具的控制台，观察两个组件的不同行为</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ flex: '1 1 400px', border: '2px solid red', padding: '10px' }}>
          <UnoptimizedComponent />
        </div>

        <div style={{ flex: '1 1 400px', border: '2px solid green', padding: '10px' }}>
          <OptimizedComponent />
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5' }}>
        <h3>使用说明:</h3>
        <ol>
          <li>点击"切换主题"按钮 - 观察两个组件的不同反应</li>
          <li>点击"增加计数"按钮 - 注意左侧组件会重新计算昂贵操作，而右侧不会</li>
          <li>点击"增加数字"按钮 - 两侧都会重新计算，因为这是预期的行为</li>
          <li>点击"添加项目"按钮 - 观察子组件的重新渲染行为</li>
          <li>查看控制台输出，了解性能差异</li>
        </ol>
      </div>
    </div>
  );
};

export default TestTest;
