import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const ConfluenceTab: React.FC = () => {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
      <Title level={3}>Confluence Integration</Title>
      <p>Confluence component will be implemented here</p>
    </div>
  );
};

export default ConfluenceTab;