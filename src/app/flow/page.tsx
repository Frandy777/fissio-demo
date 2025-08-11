"use client";

import { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
  BackgroundVariant,
  NodeChange,
  EdgeChange,
  Node,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { Sidebar } from "@/components/layout/Sidebar";
import { Canvas } from "@/components/layout/Canvas";
import CustomNode from "@/components/flow/CustomNode";
import { NodeEditor } from "@/components/flow/NodeEditor";
import CanvasToolbar from "@/components/layout/CanvasToolbar";
import { Toast } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFlowStore } from "@/store/useFlowStore";
import { exportFlowToPNG, exportFlowToSVG } from "@/lib/utils";
import { FlowNode, TreeNode, DecomposeMode } from "@/types";
import { DecomposeInput } from "@/components/ui/DecomposeInput";
import { useHistoryStorage } from "@/hooks/useHistoryStorage";
import { ArrowLeft } from "lucide-react";

// 定义节点类型
const nodeTypes = {
  custom: CustomNode,
};

function FlowContent() {
  const [projectTitle] = useState("Workspace");
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [homeIsLoading, setHomeIsLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  // 分别获取需要的状态和方法
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const treeData = useFlowStore((state) => state.treeData);
  const isDecomposing = useFlowStore((state) => state.isDecomposing);
  const decomposingProgress = useFlowStore(
    (state) => state.decomposingProgress,
  );
  const decomposingMessage = useFlowStore((state) => state.decomposingMessage);
  const setTreeData = useFlowStore((state) => state.setTreeData);
  const setSelectedNode = useFlowStore((state) => state.setSelectedNode);
  const terminateDecomposition = useFlowStore(
    (state) => state.terminateDecomposition,
  );
  const startStreamDecomposition = useFlowStore(
    (state) => state.startStreamDecomposition,
  );
  const setStoreDecomposeMode = useFlowStore((state) => state.setDecomposeMode);
  const resetState = useFlowStore((state) => state.resetState);
  // 历史会话：用于在新建时显式开启一个全新的会话，避免覆盖当前项目
  const { clearCurrentSession, autoSaveHistory } = useHistoryStorage();

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);

  // 初始化数据 - 只在组件首次加载且没有数据时执行
  useEffect(() => {
    if (!initialized && !treeData && !isDecomposing) {
      setInitialized(true);
    }
  }, [initialized, treeData, isDecomposing]);

  // 当状态管理中的nodes/edges改变时，同步到ReactFlow
  useEffect(() => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [nodes, edges, setFlowNodes, setFlowEdges]);

  // 处理节点变化（主要是位置变化）
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // 如果需要，也可以同步到状态管理
    },
    [onNodesChange],
  );

  // 处理边变化
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => setFlowEdges((eds) => addEdge(params, eds)),
    [setFlowEdges],
  );

  // 处理节点选择
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node as FlowNode);
      setIsNodeEditorOpen(true);
    },
    [setSelectedNode],
  );

  // 关闭节点编辑器
  const handleCloseNodeEditor = () => {
    setIsNodeEditorOpen(false);
  };

  // 处理 Workspace 内新建流程弹层提交（与首页一致）
  const handleNewFlowSubmit = async (
    inputText: string,
    decomposeMode: DecomposeMode,
  ) => {
    setHomeIsLoading(true);
    setHomeError(null);
    try {
      // 关键：在重置状态之前，先保存当前项目（如果有的话）
      if (treeData) {
        // 触发自动保存，确保当前项目不会丢失
        autoSaveHistory();
      }

      // 然后重置当前工作区状态，这将清除画布并重置会话ID
      resetState();
      // 立即清除当前会话 ID，确保后续操作在新会话中进行
      clearCurrentSession();

      const rootNode: TreeNode = {
        id: "root",
        content: inputText,
        children: null,
        expanded: false,
      };
      // 设置新的树数据。因为状态已重置，这将自动触发创建一个新的历史记录条目
      setTreeData(rootNode);
      setStoreDecomposeMode(decomposeMode);
      startStreamDecomposition(inputText, decomposeMode);
      setShowNewFlowModal(false);
    } catch (error: unknown) {
      console.error("分解失败:", error);
      setHomeError(error instanceof Error ? error.message : "发生未知错误");
    } finally {
      setHomeIsLoading(false);
    }
  };



  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 生成带时间戳的文件名
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const safeProjectTitle = projectTitle.replace(
        /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
        "-",
      );
      const filename = `${safeProjectTitle}-${timestamp}.png`;

      await exportFlowToPNG(".react-flow", filename);
      setToast({
        message: "Flowchart successfully exported as PNG",
        type: "success",
      });
    } catch (error: unknown) {
      console.error("导出失败:", error);
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Export failed, please try again",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = async () => {
    setIsExporting(true);
    try {
      // 生成带时间戳的文件名
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const safeProjectTitle = projectTitle.replace(
        /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
        "-",
      );
      const filename = `${safeProjectTitle}-${timestamp}.svg`;

      await exportFlowToSVG(".react-flow", filename);
      setToast({
        message: "Flowchart successfully exported as SVG",
        type: "success",
      });
    } catch (error: unknown) {
      console.error("SVG导出失败:", error);
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "SVG export failed, please try again",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 主体内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onNewFlow={() => setShowNewFlowModal(true)}
        />

        {/* 主画布区域 */}
        <Canvas
          progressBar={
            <ProgressBar
              isDecomposing={isDecomposing}
              decomposingMessage={decomposingMessage}
              decomposingProgress={decomposingProgress}
              onTerminate={terminateDecomposition}
            />
          }
        >
          {/* 画布工具栏 */}
          <CanvasToolbar
            isExporting={isExporting}
            onZoomIn={() => rf?.zoomIn?.({ duration: 150 })}
            onZoomOut={() => rf?.zoomOut?.({ duration: 150 })}
            onFitView={() => rf?.fitView?.({ padding: 0.2, duration: 250 })}
            onExportPNG={handleExport}
            onExportSVG={handleExportSVG}
          />
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            onInit={(instance) => setRf(instance)}
            attributionPosition="top-right"
            className="bg-gray-50"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#e2e8f0"
            />
            <MiniMap
              className="bg-white border border-gray-200 rounded-lg shadow-sm"
              nodeColor="#e2e8f0"
              nodeStrokeWidth={2}
              nodeBorderRadius={8}
            />
          </ReactFlow>
        </Canvas>
      </div>

      {/* 新建流程弹层：背景模糊 + 中央输入框 */}
      {showNewFlowModal && (
        <div className="fixed inset-0 z-50">
          {/* 背景遮罩与模糊 */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowNewFlowModal(false)}
          />
          {/* 居中输入框容器 */}
          <div className="relative h-full w-full flex items-center justify-center p-6">
            <div className="w-full max-w-[650px] mx-auto">
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowNewFlowModal(false)}
                  className="flex items-center gap-2 font-semibold text-gray-100 hover:text-gray-200"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              </div>
              <DecomposeInput
                onSubmit={handleNewFlowSubmit}
                isLoading={homeIsLoading}
                error={homeError}
              />
            </div>
          </div>
        </div>
      )}

      {/* 节点编辑器 */}
      <NodeEditor isOpen={isNodeEditorOpen} onClose={handleCloseNodeEditor} />

      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function FlowPage() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}
