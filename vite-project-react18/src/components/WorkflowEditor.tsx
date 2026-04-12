import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NodeFormPanel from './NodeFormPanel';
import DockBar, { NodeTemplate } from './DockBar';
import CustomNode from './CustomNode';
import { nodeFormMockData, defaultNodeConfigs } from '../mockData/nodeFormData';

const nodeTypes = {
  default: CustomNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: '开始' },
    position: { x: 250, y: 25 },
  },
  {
    id: '2',
    data: { label: '处理任务' },
    position: { x: 250, y: 125 },
  },
  {
    id: '3',
    data: { label: '审核' },
    position: { x: 250, y: 225 },
  },
  {
    id: '4',
    type: 'output',
    data: { label: '结束' },
    position: { x: 250, y: 325 },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
];

const WorkflowEditor: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const handleDeleteNodeById = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) =>
      eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [setNodes, setEdges, selectedNode]);

  // 更新所有节点的 data，添加 onDelete 回调
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: node.type !== 'input' && node.type !== 'output' ? handleDeleteNodeById : undefined,
        },
      }))
    );
  }, [handleDeleteNodeById, setNodes]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleFormClose = () => {
    setSelectedNode(null);
  };

  const handleAddNode = (template: NodeTemplate) => {
    const newNodeId = `${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: template.type === 'input' || template.type === 'output' ? template.type : 'default',
      data: {
        label: template.label,
        nodeType: template.type,
        onDelete: template.type !== 'input' && template.type !== 'output' ? handleDeleteNodeById : undefined,
      },
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
      );
      setSelectedNode(null);
    }
  };

  // 获取选中节点的配置
  const selectedNodeConfig = selectedNode
    ? nodeFormMockData[selectedNode.id] ||
      defaultNodeConfigs[selectedNode.data?.nodeType || selectedNode.type || 'default']
    : null;

  // 判断选中节点是否可删除
  const canDeleteSelectedNode = selectedNode && selectedNode.type !== 'input' && selectedNode.type !== 'output';

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
        <DockBar onAddNode={handleAddNode} />
      </div>
      {selectedNodeConfig && (
        <NodeFormPanel
          title={selectedNodeConfig.title}
          fields={selectedNodeConfig.fields}
          onClose={handleFormClose}
          onSave={handleFormSave}
          onDelete={canDeleteSelectedNode ? handleDeleteNode : undefined}
        />
      )}
    </div>
  );
};

export default WorkflowEditor;
