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
import { DecomposeInput } from "@/components/ui/DecomposeInput";
import { useFlowStore } from "@/store/useFlowStore";
import { exportFlowToPNG, exportFlowToSVG } from "@/lib/utils";
import { FlowNode, TreeNode, DecomposeMode } from "@/types";
import { useHistoryStorage } from "@/hooks/useHistoryStorage";
import { ArrowLeft } from "lucide-react";

const nodeTypes = {
  custom: CustomNode,
};

function HomeContent() {
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

  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const treeData = useFlowStore((state) => state.treeData);
  const isDecomposing = useFlowStore((state) => state.isDecomposing);
  const decomposingProgress = useFlowStore((state) => state.decomposingProgress);
  const decomposingMessage = useFlowStore((state) => state.decomposingMessage);
  const setTreeData = useFlowStore((state) => state.setTreeData);
  const setSelectedNode = useFlowStore((state) => state.setSelectedNode);
  const terminateDecomposition = useFlowStore((state) => state.terminateDecomposition);
  const startStreamDecomposition = useFlowStore((state) => state.startStreamDecomposition);
  const setStoreDecomposeMode = useFlowStore((state) => state.setDecomposeMode);
  const resetState = useFlowStore((state) => state.resetState);
  const { clearCurrentSession, autoSaveHistory } = useHistoryStorage();

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (!initialized && !treeData && !isDecomposing) {
      setInitialized(true);
    }
  }, [initialized, treeData, isDecomposing]);

  useEffect(() => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [nodes, edges, setFlowNodes, setFlowEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

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

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node as FlowNode);
      setIsNodeEditorOpen(true);
    },
    [setSelectedNode],
  );

  const handleCloseNodeEditor = () => {
    setIsNodeEditorOpen(false);
  };

  const handleNewFlowSubmit = async (
    inputText: string,
    decomposeMode: DecomposeMode,
  ) => {
    setHomeIsLoading(true);
    setHomeError(null);
    try {
      if (treeData) {
        autoSaveHistory();
      }
      resetState();
      clearCurrentSession();

      const rootNode: TreeNode = {
        id: "root",
        content: inputText,
        children: null,
        expanded: false,
      };
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
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const safeProjectTitle = projectTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-");
      const filename = `${safeProjectTitle}-${timestamp}.png`;
      await exportFlowToPNG(".react-flow", filename);
      setToast({ message: "Flowchart successfully exported as PNG", type: "success" });
    } catch (error: unknown) {
      console.error("导出失败:", error);
      setToast({
        message: error instanceof Error ? error.message : "Export failed, please try again",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = async () => {
    setIsExporting(true);
    try {
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const safeProjectTitle = projectTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-");
      const filename = `${safeProjectTitle}-${timestamp}.svg`;
      await exportFlowToSVG(".react-flow", filename);
      setToast({ message: "Flowchart successfully exported as SVG", type: "success" });
    } catch (error: unknown) {
      console.error("SVG导出失败:", error);
      setToast({
        message: error instanceof Error ? error.message : "SVG export failed, please try again",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const isEmptyWorkspace =
    !treeData && !isDecomposing && flowNodes.length === 0 && flowEdges.length === 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onNewFlow={() => setShowNewFlowModal(true)}
        />

        <Canvas
          progressBar={
            isDecomposing ? (
              <ProgressBar
                isDecomposing={isDecomposing}
                decomposingMessage={decomposingMessage}
                decomposingProgress={decomposingProgress}
                onTerminate={terminateDecomposition}
              />
            ) : undefined
          }
        >
          {!isEmptyWorkspace && (
            <>
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
                proOptions={{ hideAttribution: true }}
                className="bg-gray-50"
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
                <MiniMap
                  className="bg-white border border-gray-200 rounded-lg shadow-sm"
                  nodeColor="#e2e8f0"
                  nodeStrokeWidth={2}
                  nodeBorderRadius={8}
                />
              </ReactFlow>
            </>
          )}

          {isEmptyWorkspace && (
            <div className="h-full w-full flex items-center justify-center p-8">
              <div className="w-full max-w-2xl mx-auto space-y-8">
                <div className="text-center">
                  <p className="text-[32px] font-bold text-gray-700">Hello, here is Fissio</p>
                </div>
                <DecomposeInput
                  onSubmit={handleNewFlowSubmit}
                  isLoading={homeIsLoading}
                  error={homeError}
                  className="max-w-[650px] mx-auto"
                />
              </div>
            </div>
          )}
        </Canvas>
      </div>

      {showNewFlowModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowNewFlowModal(false)}
          />
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

      <NodeEditor isOpen={isNodeEditorOpen} onClose={handleCloseNodeEditor} />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <ReactFlowProvider>
      <HomeContent />
    </ReactFlowProvider>
  );
}
