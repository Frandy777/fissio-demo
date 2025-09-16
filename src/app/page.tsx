"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  ConnectionLineType,
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
import {
  CheckSquare,
  CalendarCheck,
  ListChecks,
  Rocket,
  Brain,
  BookOpen,
  Lightbulb,
  FlaskConical,
} from "lucide-react";

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

  const [homeIsLoading, setHomeIsLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const treeData = useFlowStore((state) => state.treeData);
  const nodeWidths = useFlowStore((state) => state.nodeWidths);
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
  const setNodeWidths = useFlowStore((state) => state.setNodeWidths);
  const { clearCurrentSession, autoSaveHistory } = useHistoryStorage();

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [currentMode, setCurrentMode] = useState<DecomposeMode>("concept");
  const [examplePreset, setExamplePreset] = useState<string | undefined>(
    undefined,
  );
  const [presetKey, setPresetKey] = useState<number>(0);
  const dragStartXRef = useRef<Map<string, number>>(new Map());

  // 首页示例（胶囊）
  const taskExamples = [
    { Icon: CheckSquare, text: "Start a company" },
    { Icon: CalendarCheck, text: "Begin triathlon" },
    { Icon: ListChecks, text: "Build a Astro Blog" },
    { Icon: Rocket, text: "Ship a marketing campaign in 2 weeks" },
  ];
  const conceptExamples = [
    { Icon: Brain, text: "Human nervous system" },
    { Icon: BookOpen, text: "Modern and contemporary literature" },
    { Icon: Lightbulb, text: "Ethereum ecosystem" },
    { Icon: FlaskConical, text: "Basic RAG application" },
  ];

  useEffect(() => {
    if (!initialized && !treeData && !isDecomposing) {
      setInitialized(true);
    }
  }, [initialized, treeData, isDecomposing]);

  useEffect(() => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [nodes, edges, setFlowNodes, setFlowEdges]);

  // 实测节点宽度并反馈给 store，用于精准横向布局
  useEffect(() => {
    if (flowNodes.length === 0) return;
    const measure = () => {
      const map: Record<string, number> = {};
      const elements = document.querySelectorAll<HTMLElement>(
        '.react-flow__node',
      );
      elements.forEach((el) => {
        const idAttr = el.getAttribute('data-id');
        const dataId = el.dataset ? el.dataset.id : undefined;
        const id = idAttr ?? dataId;
        if (!id) return;
        const w = el.offsetWidth;
        if (!Number.isFinite(w) || w <= 0) return;
        if (nodeWidths[id] !== w) {
          map[id] = w;
        }
      });
      if (Object.keys(map).length > 0) {
        setNodeWidths(map);
      }
    };
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [flowNodes, setNodeWidths, nodeWidths]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 钳制水平位移：保持 x 不变，仅允许 y 改变
      const clamped = changes.map((chg) => {
        if (chg.type === "position" && 'position' in chg && chg.position) {
          const current = flowNodes.find((n) => n.id === chg.id);
          if (current) {
            return {
              ...chg,
              position: { x: current.position.x, y: chg.position.y },
            } as NodeChange;
          }
        }
        return chg;
      });
      onNodesChange(clamped);
    },
    [onNodesChange, flowNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setFlowEdges((eds) => addEdge({ ...params, type: "step" }, eds)),
    [setFlowEdges],
  );

  const handleNodeDragStart = useCallback((_e: React.MouseEvent, node: Node) => {
    dragStartXRef.current.set(node.id, node.position.x);
  }, []);

  const handleNodeDrag = useCallback((_e: React.MouseEvent, node: Node) => {
    const startX = dragStartXRef.current.get(node.id) ?? node.position.x;
    setFlowNodes((nds) =>
      nds.map((n) =>
        n.id === node.id ? { ...n, position: { x: startX, y: node.position.y } } : n,
      ),
    );
  }, [setFlowNodes]);

  const handleNodeDragStop = useCallback((_e: React.MouseEvent, node: Node) => {
    const startX = dragStartXRef.current.get(node.id) ?? node.position.x;
    setFlowNodes((nds) =>
      nds.map((n) =>
        n.id === node.id ? { ...n, position: { x: startX, y: node.position.y } } : n,
      ),
    );
    dragStartXRef.current.delete(node.id);
  }, [setFlowNodes]);

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

  const isEmptyWorkspace =
    !treeData &&
    !isDecomposing &&
    flowNodes.length === 0 &&
    flowEdges.length === 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onNewFlow={() => {
            if (treeData) {
              autoSaveHistory();
            }
            resetState();
            clearCurrentSession();
          }}
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
                onNodeDragStart={handleNodeDragStart}
                onNodeDrag={handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                onInit={(instance) => setRf(instance)}
                proOptions={{ hideAttribution: true }}
                className="bg-gray-50"
                defaultEdgeOptions={{
                  type: "step",
                  style: { stroke: "#94a3b8", strokeWidth: 1.5 },
                }}
                connectionLineType={ConnectionLineType.Step}
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
            </>
          )}

          {isEmptyWorkspace && (
            <div className="h-full w-full flex items-center justify-center p-8">
              <div className="w-full max-w-2xl mx-auto space-y-8">
                <div className="text-center">
                  <p className="text-[32px] font-serif text-gray-700">
                    Hello, here is Fissio
                  </p>
                </div>
                <DecomposeInput
                  onSubmit={handleNewFlowSubmit}
                  isLoading={homeIsLoading}
                  error={homeError}
                  className="max-w-[650px] mx-auto"
                  presetText={examplePreset}
                  presetMode={currentMode}
                  onModeChange={(m) => setCurrentMode(m)}
                  presetKey={presetKey}
                />
                {/* 示例胶囊：仅显示当前模式 */}
                <div className="max-w-[650px] mx-auto mt-2">
                  <div className="text-xs font-semibold text-gray-500 mb-2 pl-3">
                    {currentMode === "task" ? "Task" : "Concept"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(currentMode === "task"
                      ? taskExamples
                      : conceptExamples
                    ).map(({ Icon, text }) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => {
                          setExamplePreset(text);
                          setPresetKey((k) => k + 1);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-[14px] font-medium leading-none">
                          {text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Canvas>
      </div>

      <NodeEditor isOpen={isNodeEditorOpen} onClose={handleCloseNodeEditor} />

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

export default function HomePage() {
  return (
    <ReactFlowProvider>
      <HomeContent />
    </ReactFlowProvider>
  );
}
