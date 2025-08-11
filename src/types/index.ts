// 分解模式类型
export type DecomposeMode = 'task' | 'concept';

// 基础树节点接口
export interface TreeNode {
  id: string;
  content: string;
  children: TreeNode[] | null;
  expanded: boolean;
  // 新增：节点状态
  status?: 'pending' | 'processing' | 'completed' | 'need_decomposition' | 'can_answer';
  // 新增：是否为叶子节点
  isLeaf?: boolean;
  // 新增：判断结果
  canDirectlyAnswer?: boolean;
}

// AI Agent 响应接口
export interface AITreeNode {
  id: string;
  label?: string;
  content: string;
  children: AITreeNode[] | null;
}

// 分解响应接口
export interface DecomposeResponse {
  root: AITreeNode;
  reasoning: string | null;
  mode?: DecomposeMode; // 新增：分解模式
}

// 判断响应接口
export interface JudgementResponse {
  canDirectlyAnswer: boolean;
  reasoning: string;
  confidence: number; // 0-1 之间的置信度
}

// 工作流状态接口
export interface WorkflowState {
  currentTree: TreeNode;
  pendingNodes: TreeNode[];
  completedNodes: TreeNode[];
  totalNodes: number;
  processedNodes: number;
  isComplete: boolean;
}

// 工作流事件类型
export type WorkflowEvent = 
  | { type: 'start'; message: string; state: WorkflowState }
  | { type: 'decompose_node'; nodeId: string; message: string; state: WorkflowState }
  | { type: 'judge_node'; nodeId: string; result: boolean; message: string; state: WorkflowState }
  | { type: 'update_tree'; tree: TreeNode; message: string; state: WorkflowState }
  | { type: 'progress'; progress: number; message: string; state: WorkflowState }
  | { type: 'complete'; finalTree: TreeNode; message: string; state: WorkflowState }
  | { type: 'terminated'; finalTree: TreeNode; message: string; state: WorkflowState }
  | { type: 'error'; error: string };

// React Flow 节点数据类型
export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    content: string
    expanded?: boolean
    level?: number
    treeNode: TreeNode
  }
}

// React Flow 边数据类型  
export interface FlowEdge {
  id: string
  source: string
  target: string
  type?: string
}

// 布局配置接口
export interface LayoutConfig {
  columnWidth: number // 列宽
  columnGap: number // 列间距
  rowHeight: number // 行高
  rowGap: number // 行间距
  maxColumnHeight: number // 单列最大高度阈值
  sectionGap: number // 段间距
  nodeGridCols: number // 栅格列数
  defaultExpandedLevels: number // 默认展开层级数
}

// Store状态类型
export interface FlowState {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedNode: FlowNode | null
  searchQuery: string
  treeData: TreeNode | null
  isDecomposing: boolean
  decomposingProgress: number
  decomposingMessage: string
  currentAbortController: AbortController | null
  autoSaveCallback: (() => void) | null
  isNewDecomposition: boolean
  decomposeMode: DecomposeMode // 新增：当前分解模式
  collapsedNodeIds: Set<string> // 新增：折叠节点ID集合
  maxVisibleLevel: number // 新增：最大可见层级
  layoutConfig: LayoutConfig // 新增：布局配置
  
  setNodes: (nodes: FlowNode[]) => void
  setEdges: (edges: FlowEdge[]) => void
  setSelectedNode: (selectedNode: FlowNode | null) => void
  setSearchQuery: (searchQuery: string) => void
  setTreeData: (treeData: TreeNode | null) => void
  startStreamDecomposition: (inputText: string, mode?: DecomposeMode) => Promise<void>
  terminateDecomposition: () => void
  addNode: (node: FlowNode) => void
  updateNode: (nodeId: string, updates: Partial<FlowNode>) => void
  deleteNode: (nodeId: string) => void
  // 新增：删除树中的某个节点（及其所有子节点）
  deleteTreeNode: (nodeId: string) => void
  toggleNodeExpanded: (nodeId: string) => void
  updateTreeNodeContent: (nodeId: string, newContent: string) => Promise<void>
  redecomposeFromNode: (nodeId: string, content: string, mode?: DecomposeMode) => Promise<void>
  loadState: (state: { nodes: FlowNode[], edges: FlowEdge[], treeData: TreeNode | null, selectedNode?: FlowNode | null }) => void
  resetState: () => void
  setAutoSaveCallback: (callback: (() => void) | null) => void
  setDecomposeMode: (mode: DecomposeMode) => void // 新增：设置分解模式
  toggleNodeCollapsed: (nodeId: string) => void // 新增：切换节点折叠状态
  setMaxVisibleLevel: (level: number) => void // 新增：设置最大可见层级
  updateLayoutConfig: (config: Partial<LayoutConfig>) => void // 新增：更新布局配置
  getVisibleNodes: () => FlowNode[] // 新增：获取可见节点
  getVisibleEdges: () => FlowEdge[] // 新增：获取可见边
} 

// 历史记录相关类型
export interface HistoryItem {
  id: string
  name: string
  timestamp: number
  flowState: {
    nodes: FlowNode[]
    edges: FlowEdge[]
    treeData: TreeNode | null
    selectedNode: FlowNode | null
  }
}

export interface HistoryStorageHook {
  history: HistoryItem[]
  saveHistory: (name?: string) => void
  loadHistory: (id: string) => void
  deleteHistory: (id: string) => void
  renameHistory: (id: string, newName: string) => void
} 