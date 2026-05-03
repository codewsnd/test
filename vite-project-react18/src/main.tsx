import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App'
import {BrowserRouter, Route, Routes} from "react-router";
import {BQAFormDesigner} from "./components/BQA/BQAFormDesigner";
import {RequirementManagement} from "./components/Insights/RequirementManagement";
import {AdminPage} from "./pages/AdminPage/adminPage";
import ChatApp from "./pages/home/ChatApp";
import {Scroll} from "./pages/scroll/Scroll";
import TestTest from "./pages/test/testtest";
import {User} from "./pages/jotai/User";
import WorkflowEditor from "./components/WorkflowEditor";
import StringDiffViewer from "./components/Diff";
import './styles/antd-common.less';
import { getDefaultStore } from 'jotai';
import { globalStaffIdAtom } from './atom/globalAtom';
import { ConfigProvider } from 'antd';
import { appTheme } from './styles/appTheme';
import HtmlSharePage from './components/htmlPreview/HtmlSharePage';
import AgentCreatePage from '@/pages/agent-create/AgentCreatePage';
import AgentListPage from '@/pages/agent/AgentListPage';

// 设置全局 Staff ID
const store = getDefaultStore();
store.set(globalStaffIdAtom, '12345678');

createRoot(document.getElementById('root')!).render(
  <ConfigProvider theme={appTheme}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App/>}/>
        <Route path="/chat" element={<ChatApp />} />
        <Route path="/form" element={<RequirementManagement/>}/>
        <Route path="/admin" element={<AdminPage/>}/>
        <Route path="/bqaFormDesigner" element={<BQAFormDesigner/>}/>
        <Route path="/scroll" element={<Scroll/>}/>
        <Route path="/test" element={<TestTest/>}/>
        <Route path="/user" element={<User/>}/>
        <Route path="/workflow" element={<WorkflowEditor/>}/>
        <Route path="/diff" element={<StringDiffViewer/>}/>
        <Route path="/htmlPreview/:id" element={<HtmlSharePage/>}/>
        <Route path="/agent" element={<AgentListPage />}/>
        <Route path="/agent-create" element={<AgentCreatePage />}/>
        <Route path="/agent-create/:id" element={<AgentCreatePage />}/>
      </Routes>
    </BrowserRouter>
  </ConfigProvider>
)
