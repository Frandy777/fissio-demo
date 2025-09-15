import { create } from 'zustand'
import { FlowState, TreeNode, FlowNode, FlowEdge, DecomposeMode } from '@/types'
import { treeToFlowData, computeLayeredGridLayout, DEFAULT_LAYOUT_CONFIG } from '@/lib/utils'



// 将树数据转换为流数据的纯函数（支持传入已测量的节点宽度）
function convertTreeToFlowData(treeData: TreeNode | null, nodeWidths: Record<string, number>) {
  if (!treeData) {
    return { nodes: [], edges: [] }
  }
  return treeToFlowData(treeData, 0, 0, nodeWidths)
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  nodeWidths: {},
  selectedNode: null,
  searchQuery: '',
  treeData: null,
  isDecomposing: false,
  decomposingProgress: 0,
  decomposingMessage: '',
  currentAbortController: null as AbortController | null,
  autoSaveCallback: null as (() => void) | null,
  isNewDecomposition: true,
  decomposeMode: 'concept' as DecomposeMode, // 新增：默认分解模式
  // 新增：可见性与布局控制
  collapsedNodeIds: new Set<string>(),
  maxVisibleLevel: DEFAULT_LAYOUT_CONFIG.defaultExpandedLevels,
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  
  setNodes: (nodes) => {
    set({ nodes })
  },
  
  setEdges: (edges) => {
    set({ edges })
  },
  
  setSelectedNode: (selectedNode) => {
    set({ selectedNode })
  },
  
  setSearchQuery: (searchQuery) => {
    set({ searchQuery })
  },
  
  setTreeData: (treeData) => {
    const { nodeWidths } = get()
    const { nodes, edges } = convertTreeToFlowData(treeData, nodeWidths)
    const currentState = get()
    const isFirstTime = !currentState.treeData && treeData // 首次设置根节点
    
    set({ 
      treeData, 
      nodes, 
      edges,
      isNewDecomposition: false // 标记已开始分解
    })
    
    // 自动保存：当有根节点首次出现时（开始新会话）
    if (isFirstTime && currentState.autoSaveCallback) {
      currentState.autoSaveCallback()
    }
  },

  // 启动流式分解
  startStreamDecomposition: async (inputText: string, mode: DecomposeMode = 'concept') => {
    // 创建新的 AbortController
    const abortController = new AbortController()
    
    set({ 
      isDecomposing: true, 
      decomposingProgress: 0, 
      decomposingMessage: '准备开始分解...',
      currentAbortController: abortController,
      isNewDecomposition: true,
      decomposeMode: mode // 设置当前分解模式
    })
    
    try {
      const response = await fetch('/api/decompose-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText, mode }), // 传递分解模式
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error('分解任务失败')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              const currentState = get()
              
              if (data.type === 'update' && data.treeData) {
                // 更新树数据
                const { nodeWidths } = get()
                const { nodes, edges } = convertTreeToFlowData(data.treeData, nodeWidths)
                set({ 
                  treeData: data.treeData,
                  nodes,
                  edges,
                  decomposingProgress: data.progress || currentState.decomposingProgress,
                  decomposingMessage: data.message || currentState.decomposingMessage,
                  isNewDecomposition: false // 标记为非新分解
                })
                // 自动保存：当节点更新时（更新当前会话）
                const state = get()
                if (state.autoSaveCallback) {
                  state.autoSaveCallback()
                }
              } else if (data.type === 'progress') {
                // 只更新进度
                set({ 
                  decomposingProgress: data.progress || currentState.decomposingProgress,
                  decomposingMessage: data.message || currentState.decomposingMessage
                })
              } else if (data.type === 'complete') {
                // 分解完成
                if (data.treeData) {
                  const { nodeWidths } = get()
                  const { nodes, edges } = convertTreeToFlowData(data.treeData, nodeWidths)
                  set({ 
                    treeData: data.treeData,
                    nodes,
                    edges,
                    isDecomposing: false,
                    decomposingProgress: 100,
                    decomposingMessage: data.message || '分解完成',
                    currentAbortController: null,
                    isNewDecomposition: false
                  })
                  // 自动保存：当分解完成时（完成当前会话）
                  const state = get()
                  if (state.autoSaveCallback) {
                    state.autoSaveCallback()
                  }
                } else {
                  set({ 
                    isDecomposing: false,
                    decomposingProgress: 100,
                    decomposingMessage: data.message || '分解完成',
                    currentAbortController: null,
                    isNewDecomposition: false
                  })
                }
              } else if (data.type === 'terminated') {
                // 分解被终止
                if (data.treeData) {
                  const { nodeWidths } = get()
                  const { nodes, edges } = convertTreeToFlowData(data.treeData, nodeWidths)
                  set({ 
                    treeData: data.treeData,
                    nodes,
                    edges,
                    isDecomposing: false,
                    decomposingMessage: data.message || '分解已终止',
                    currentAbortController: null,
                    isNewDecomposition: true
                  })
                } else {
                  set({ 
                    isDecomposing: false,
                    decomposingMessage: data.message || '分解已终止',
                    currentAbortController: null,
                    isNewDecomposition: true
                  })
                }
              } else if (data.type === 'error') {
                // 分解出错
                set({ 
                  isDecomposing: false,
                  decomposingProgress: 0,
                  decomposingMessage: data.error || '分解过程中发生错误',
                  currentAbortController: null,
                  isNewDecomposition: true
                })
              }
            } catch (parseError) {
              console.error('解析流数据失败:', parseError)
            }
          }
        }
      }
    } catch (error) {
      // 如果是用户主动取消，不显示错误信息
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('分解过程被用户终止')
        set({ 
          isDecomposing: false,
          decomposingMessage: '分解已终止',
          currentAbortController: null,
          isNewDecomposition: true
        })
        return
      }
      
      console.error('流式分解失败:', error)
      set({ 
        isDecomposing: false,
        decomposingProgress: 0,
        decomposingMessage: `分解失败: ${error instanceof Error ? error.message : '未知错误'}`,
        currentAbortController: null,
        isNewDecomposition: true
      })
      throw error
    }
  },

  // 终止分解过程
  terminateDecomposition: () => {
    const { currentAbortController } = get()
    
    if (currentAbortController) {
      console.log('正在终止分解过程...')
      currentAbortController.abort()
    }
    
    // 同时调用后端终止方法
    fetch('/api/terminate-decomposition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }).catch(error => {
      console.warn('调用后端终止方法失败:', error)
    })
    
    set({ 
      isDecomposing: false,
      decomposingMessage: '正在终止分解...',
      currentAbortController: null,
      isNewDecomposition: true
    })
  },
  
  addNode: (node) => {
    const { nodes } = get()
    set({ nodes: [...nodes, node] })
  },
  
  updateNode: (nodeId, updates) => {
    const { nodes } = get()
    set({
      nodes: nodes.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      )
    })
  },
  
  deleteNode: (nodeId) => {
    const { nodes, edges } = get()
    set({
      nodes: nodes.filter(node => node.id !== nodeId),
      edges: edges.filter(edge => 
        edge.source !== nodeId && edge.target !== nodeId
      )
    })
  },

  // 删除树中的某个节点（及其所有子节点），并同步更新 React Flow 数据与项目状态
  deleteTreeNode: (targetNodeId: string) => {
    const { treeData, selectedNode } = get()
    if (!treeData) return

    // 递归过滤：返回删除了目标子树后的新树；如果根就是目标，返回 null
    const removeSubtree = (node: TreeNode): TreeNode | null => {
      if (node.id === targetNodeId) {
        return null
      }
      if (node.children && node.children.length > 0) {
        const nextChildren = node.children
          .map(child => removeSubtree(child))
          .filter((n): n is TreeNode => n !== null)
        return { ...node, children: nextChildren.length > 0 ? nextChildren : null }
      }
      return node
    }

    const updatedTreeData = removeSubtree(treeData)

    // 如果删除的是根节点或整棵树为空
    if (!updatedTreeData) {
      set({
        nodes: [],
        edges: [],
        treeData: null,
        selectedNode: null,
        isNewDecomposition: true
      })
    } else {
      const { nodeWidths } = get()
      const { nodes: newNodes, edges: newEdges } = convertTreeToFlowData(updatedTreeData, nodeWidths)
      // 如果当前选中节点位于被删除子树，清空选中
      const stillExists = selectedNode && newNodes.some(n => n.id === selectedNode.id)
      set({
        treeData: updatedTreeData,
        nodes: newNodes,
        edges: newEdges,
        selectedNode: stillExists ? selectedNode : null
      })
    }

    // 触发自动保存，更新当前 project 状态
    const state = get()
    if (state.autoSaveCallback) {
      state.autoSaveCallback()
    }
  },

  toggleNodeExpanded: (nodeId) => {
    const { treeData } = get()
    if (!treeData) return
    
    // 递归更新树数据的展开状态
    const updateTreeNodeExpanded = (treeNode: TreeNode): TreeNode => {
      if (treeNode.id === nodeId) {
        return { ...treeNode, expanded: !treeNode.expanded }
      }
      if (treeNode.children) {
        return {
          ...treeNode,
          children: treeNode.children.map(updateTreeNodeExpanded)
        }
      }
      return treeNode
    }

    const updatedTreeData = updateTreeNodeExpanded(treeData)
    const { nodeWidths } = get()
    const { nodes: newNodes, edges: newEdges } = convertTreeToFlowData(updatedTreeData, nodeWidths)
    
    set({ 
      treeData: updatedTreeData,
      nodes: newNodes,
      edges: newEdges
    })
  },

  // 更新树节点内容
  updateTreeNodeContent: async (nodeId: string, newContent: string) => {
    const { treeData } = get()
    if (!treeData) return
    
    // 递归更新树数据的内容
    const updateTreeNodeContent = (treeNode: TreeNode): TreeNode => {
      if (treeNode.id === nodeId) {
        return { ...treeNode, content: newContent }
      }
      if (treeNode.children) {
        return {
          ...treeNode,
          children: treeNode.children.map(updateTreeNodeContent)
        }
      }
      return treeNode
    }

    const updatedTreeData = updateTreeNodeContent(treeData)
    const { nodeWidths } = get()
    const { nodes: newNodes, edges: newEdges } = convertTreeToFlowData(updatedTreeData, nodeWidths)
    
    set({ 
      treeData: updatedTreeData,
      nodes: newNodes,
      edges: newEdges
    })

    // 更新后触发自动保存，确保本地历史同步
    const state = get()
    if (state.autoSaveCallback) {
      state.autoSaveCallback()
    }
  },

  // 从指定节点重新分解 - 使用流式处理
  redecomposeFromNode: async (nodeId: string, content: string, mode?: DecomposeMode) => {
    const { treeData, decomposeMode: currentMode, currentAbortController } = get()
    if (!treeData) return
    
    const useMode = mode || currentMode // 使用传入的模式或当前模式
    
    // 取消之前的分解任务
    if (currentAbortController) {
      currentAbortController.abort()
    }
    
    // 创建新的 AbortController
    const abortController = new AbortController()
    
    try {
      // 标记进入分解中并提示
      set({
        isDecomposing: true,
        decomposingProgress: 0,
        decomposingMessage: '正在重新分解当前节点...',
        currentAbortController: abortController
      })

      // 先清空该节点的子节点，给出即时的视觉反馈
      const clearChildren = (treeNode: TreeNode): TreeNode => {
        if (treeNode.id === nodeId) {
          return { ...treeNode, children: [] }
        }
        if (treeNode.children) {
          return { ...treeNode, children: treeNode.children.map(clearChildren) }
        }
        return treeNode
      }

      const interimTreeData = clearChildren(treeData)
      const { nodeWidths } = get()
      const interimFlow = convertTreeToFlowData(interimTreeData, nodeWidths)
      set({
        treeData: interimTreeData,
        nodes: interimFlow.nodes,
        edges: interimFlow.edges,
      })
      // 保存中间状态，避免刷新丢失
      const interimState = get()
      if (interimState.autoSaveCallback) {
        interimState.autoSaveCallback()
      }

      // 使用流式 API 进行重新分解
      const response = await fetch('/api/decompose-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          mode: useMode
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error('重新分解失败')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              const currentState = get()
              
              if (data.type === 'update' && data.treeData) {
                // 用新的分解结果替换指定节点的子树，并重映射子树ID避免冲突
                const subtreeIdPrefix = `${nodeId}__${Date.now()}__`
                const remapChildIds = (node: TreeNode): TreeNode => ({
                  ...node,
                  id: `${subtreeIdPrefix}${node.id}`,
                  children: node.children ? node.children.map(remapChildIds) : null
                })
                const replaceNodeSubtree = (treeNode: TreeNode): TreeNode => {
                  if (treeNode.id === nodeId) {
                    const mappedChildren = (data.treeData.children || []).map(remapChildIds)
                    return { ...treeNode, children: mappedChildren }
                  }
                  if (treeNode.children) {
                    return {
                      ...treeNode,
                      children: treeNode.children.map(replaceNodeSubtree)
                    }
                  }
                  return treeNode
                }

                const updatedTreeData = replaceNodeSubtree(currentState.treeData!)
                const { nodeWidths } = get()
                const { nodes, edges } = convertTreeToFlowData(updatedTreeData, nodeWidths)
                set({ 
                  treeData: updatedTreeData,
                  nodes,
                  edges,
                  decomposingProgress: data.progress || currentState.decomposingProgress,
                  decomposingMessage: data.message || currentState.decomposingMessage
                })
                // 自动保存更新
                const state = get()
                if (state.autoSaveCallback) {
                  state.autoSaveCallback()
                }
              } else if (data.type === 'progress') {
                // 只更新进度
                set({ 
                  decomposingProgress: data.progress || currentState.decomposingProgress,
                  decomposingMessage: data.message || currentState.decomposingMessage
                })
              } else if (data.type === 'complete') {
                // 分解完成
                if (data.treeData) {
                  const subtreeIdPrefix = `${nodeId}__${Date.now()}__`
                  const remapChildIds = (node: TreeNode): TreeNode => ({
                    ...node,
                    id: `${subtreeIdPrefix}${node.id}`,
                    children: node.children ? node.children.map(remapChildIds) : null
                  })
                  const replaceNodeSubtree = (treeNode: TreeNode): TreeNode => {
                    if (treeNode.id === nodeId) {
                      const mappedChildren = (data.treeData.children || []).map(remapChildIds)
                      return { ...treeNode, children: mappedChildren }
                    }
                    if (treeNode.children) {
                      return {
                        ...treeNode,
                        children: treeNode.children.map(replaceNodeSubtree)
                      }
                    }
                    return treeNode
                  }

                  const finalTreeData = replaceNodeSubtree(currentState.treeData!)
                  const { nodeWidths } = get()
                  const { nodes, edges } = convertTreeToFlowData(finalTreeData, nodeWidths)
                  set({ 
                    treeData: finalTreeData,
                    nodes,
                    edges,
                    isDecomposing: false,
                    decomposingProgress: 100,
                    decomposingMessage: data.message || '重新分解完成',
                    currentAbortController: null
                  })
                  // 完成后保存
                  const state = get()
                  if (state.autoSaveCallback) {
                    state.autoSaveCallback()
                  }
                } else {
                  set({ 
                    isDecomposing: false,
                    decomposingProgress: 100,
                    decomposingMessage: data.message || '重新分解完成',
                    currentAbortController: null
                  })
                }
              } else if (data.type === 'terminated') {
                // 分解被终止
                set({ 
                  isDecomposing: false,
                  decomposingMessage: data.message || '重新分解已终止',
                  currentAbortController: null
                })
              } else if (data.type === 'error') {
                // 分解出错
                set({ 
                  isDecomposing: false,
                  decomposingProgress: 0,
                  decomposingMessage: data.error || '重新分解过程中发生错误',
                  currentAbortController: null
                })
              }
            } catch (parseError) {
              console.error('解析重新分解流数据失败:', parseError)
            }
          }
        }
      }
    } catch (error) {
      // 如果是用户主动取消，不显示错误信息
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('重新分解过程被用户终止')
        set({ 
          isDecomposing: false,
          decomposingMessage: '重新分解已终止',
          currentAbortController: null
        })
        return
      }
      
      console.error('流式重新分解失败:', error)
      set({
        isDecomposing: false,
        decomposingProgress: 0,
        decomposingMessage: `重新分解失败: ${error instanceof Error ? error.message : '未知错误'}`,
        currentAbortController: null
      })
      throw error
    }
  },

  loadState: (state: { nodes: FlowNode[], edges: FlowEdge[], treeData: TreeNode | null, selectedNode?: FlowNode | null }) => {
    set({
      nodes: state.nodes,
      edges: state.edges,
      treeData: state.treeData,
      selectedNode: state.selectedNode || null,
    })
  },

  resetState: () => {
    set({
      nodes: [],
      edges: [],
      nodeWidths: {},
      selectedNode: null,
      searchQuery: '',
      treeData: null,
      isDecomposing: false,
      decomposingProgress: 0,
      decomposingMessage: '',
      currentAbortController: null,
      isNewDecomposition: true,
      decomposeMode: 'concept', // 重置为默认模式
      collapsedNodeIds: new Set<string>(),
      maxVisibleLevel: DEFAULT_LAYOUT_CONFIG.defaultExpandedLevels,
      layoutConfig: DEFAULT_LAYOUT_CONFIG
    })
  },

  // 记录节点真实宽度，并据此刷新布局
  setNodeWidths: (widths: Record<string, number>) => {
    set((state) => ({ nodeWidths: { ...state.nodeWidths, ...widths } }))
    const state = get()
    if (state.treeData) {
      const { nodes, edges } = convertTreeToFlowData(state.treeData, state.nodeWidths)
      set({ nodes, edges })
    }
  },

  setAutoSaveCallback: (callback) => {
    set({ autoSaveCallback: callback })
  },

  // 新增：设置分解模式
  setDecomposeMode: (mode: DecomposeMode) => {
    set({ decomposeMode: mode })
  },

  // 新增：切换节点折叠状态
  toggleNodeCollapsed: (nodeId: string) => {
    set((state) => {
      const next = new Set(state.collapsedNodeIds)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return { collapsedNodeIds: next }
    })
  },

  // 新增：设置最大可见层级
  setMaxVisibleLevel: (level: number) => {
    set({ maxVisibleLevel: level })
  },

  // 新增：更新布局配置
  updateLayoutConfig: (config) => {
    set((state) => ({ layoutConfig: { ...state.layoutConfig, ...config } }))
  },

  // 新增：获取可见节点（根据折叠与层级限制，并计算布局）
  getVisibleNodes: () => {
    const { nodes, edges, layoutConfig, collapsedNodeIds, maxVisibleLevel } = get()
    return computeLayeredGridLayout(nodes, edges, layoutConfig, collapsedNodeIds, maxVisibleLevel)
  },

  // 新增：获取可见边（两端节点需可见）
  getVisibleEdges: () => {
    const visibleNodeIds = new Set(get().getVisibleNodes().map(n => n.id))
    const { edges } = get()
    return edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
  }
})) 