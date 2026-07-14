/**
 * 文件作用：提供 CopyTest 路由包装，并在关闭弹窗时返回聊天页面。
 */
import React from 'react';
import { useNavigate } from 'react-router';
import CopyTest from './CopyTest';

/** copyTest 直达路由的背景提示文案。 */
const COPY_TEST_ROUTE_BACKGROUND_TEXT = 'Copy Test is open in the modal.';

/** 通过 /copyTest 直接访问 CopyTest 弹窗的路由页。 */
export const CopyTestRoute: React.FC = () => {
  /** 用于在弹窗关闭后切换回聊天路由的导航函数。 */
  const navigate = useNavigate();

  /** 关闭直达弹窗时返回聊天工作区。 */
  const handleClose = (): void => {
    navigate('/chat');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
      <span>{COPY_TEST_ROUTE_BACKGROUND_TEXT}</span>
      <CopyTest open={true} onClose={handleClose} />
    </div>
  );
};

export default CopyTestRoute;
