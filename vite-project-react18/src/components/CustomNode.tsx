import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const CustomNode: React.FC<NodeProps> = ({ data, id }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
    setShowMenu(false);
  };

  return (
    <div className="relative bg-white border-2 border-gray-300 rounded-lg px-4 py-2 shadow-md hover:shadow-lg transition-shadow min-w-[150px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">{data.label}</div>

        {/* 省略号按钮 */}
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="text-gray-500 hover:text-gray-700 px-1 py-0 text-lg leading-none"
          >
            ⋯
          </button>

          {/* 下拉菜单 */}
          {showMenu && (
            <>
              {/* 背景遮罩，点击关闭菜单 */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-md shadow-lg min-w-[100px]">
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                >
                  删除
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default CustomNode;
