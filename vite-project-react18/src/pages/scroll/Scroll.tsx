import { useState } from 'react';
import { Tabs, type TabsProps } from 'antd';

export const Scroll = () => {
  const [activeKey, setActiveKey] = useState('1');

  const array = Array.from({ length: 70 }, (_, i) => i + 1);

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: 'Tab1',
      children: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          <p style={{
            padding: '15px',
            margin: 0,
            borderBottom: '1px solid #eee',
            flexShrink: 0,
          }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
          <ul style={{
            flex: 1,
            overflowY: 'auto',
          }}>
            {array.map((item, index) => (
              <li key={index}>
                <p>Item {item} - Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: '2',
      label: '测试',
      children: (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          color: '#666',
        }}>
          <h3 style={{ marginTop: 0 }}>测试内容区域</h3>
          <p>这是第二个标签页的内容</p>
          <p>您可以在这里添加任何测试内容</p>
        </div>
      ),
    }
  ];

  return (
    <div style={{
      height: '100vh',
      width: 300,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={items}
        tabPosition="top"
        className="custom-tabs"
      />
    </div>
  )
}

