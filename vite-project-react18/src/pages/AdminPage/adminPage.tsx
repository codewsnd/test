import React, {useEffect, useState} from 'react';
import {AppstoreOutlined, MailOutlined, SettingOutlined} from '@ant-design/icons';
import type {MenuProps} from 'antd';
import {Menu} from 'antd';
import {FormManagement} from "./FormManagement";
import {useLocation} from "react-router";

type MenuItem = Required<MenuProps>['items'][number];

// 定义不同的内容组件
const Sub1Content = () => (
  <div className="content-area">
    <h2>Sub1 内容</h2>
  </div>
);

const Sub2Content = () => (
  <div className="content-area">
    <h2>Sub2 内容</h2>
  </div>
);

const Sub3Content = () => (
  <div className="content-area">
    <FormManagement/>
  </div>
);

// 菜单项配置
const items: MenuItem[] = [
  {
    key: 'sub1',
    label: '导航一',
    icon: <MailOutlined/>,
  },
  {
    key: 'sub2',
    label: '导航二',
    icon: <AppstoreOutlined/>,
  },
  {
    key: 'sub3',
    label: '导航三',
    icon: <SettingOutlined/>,
  },
];

export const AdminPage: React.FC = () => {

  const location = useLocation();
  const [currentContent, setCurrentContent] = useState<string>('sub1');

  useEffect(() => {
    if (location.state?.activeMenu) {
      setCurrentContent(location.state.activeMenu);
    }
  }, [location.state]);


  const onClick: MenuProps['onClick'] = (e) => {
    setCurrentContent(e.key);
    console.log('点击了菜单: ', e.key);
  };

  const renderContent = () => {
    switch (currentContent) {
      case 'sub1':
        return <Sub1Content/>;
      case 'sub2':
        return <Sub2Content/>;
      case 'sub3':
        return <Sub3Content/>;
      default:
        return <Sub1Content/>;
    }
  };

  return (
    <div style={{display: 'flex', minHeight: '100vh'}}>
      <Menu
        onClick={onClick}
        style={{width: 256, minHeight: '100%'}}
        defaultSelectedKeys={['sub1']}
        selectedKeys={[currentContent]}
        mode="inline"
        items={items}
      />

      <div>
        {renderContent()}
      </div>
    </div>
  );
};
