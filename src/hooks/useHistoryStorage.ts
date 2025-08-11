import { useState, useEffect, useCallback, useRef } from 'react'
import { HistoryItem, HistoryStorageHook } from '@/types'
import { useFlowStore } from '@/store/useFlowStore'

const HISTORY_STORAGE_KEY = 'fissio-flow-history'
const CURRENT_SESSION_STORAGE_KEY = 'fissio-current-session-id'

export function useHistoryStorage(): Omit<HistoryStorageHook, 'saveHistory'> & { 
  autoSaveHistory: () => void
  startNewSession: (rootContent: string) => void
  updateCurrentSession: () => void
  clearCurrentSession: () => void
} {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  // 使用独立选择器，避免返回新对象触发 useSyncExternalStore 警告
  const loadState = useFlowStore(state => state.loadState)

  // 通过 ref 提供给稳定的回调函数读取当前会话 ID
  const currentSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // 保存最新的 history 引用，供稳定回调读取
  const historyRef = useRef<HistoryItem[]>([])
  useEffect(() => {
    historyRef.current = history
  }, [history])

  // 从 localStorage 加载历史记录与当前会话ID
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (storedHistory) {
        const parsedHistory: HistoryItem[] = JSON.parse(storedHistory)
        setHistory(parsedHistory.sort((a, b) => b.timestamp - a.timestamp))
      }
      const storedSessionId = localStorage.getItem(CURRENT_SESSION_STORAGE_KEY)
      if (storedSessionId) {
        setCurrentSessionId(storedSessionId)
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
      setHistory([])
      setCurrentSessionId(null)
    }
  }, [])

  // 保存历史记录到 localStorage
  const saveToStorage = (newHistory: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory))
      setHistory(newHistory.sort((a, b) => b.timestamp - a.timestamp))
    } catch (error) {
      console.error('保存历史记录失败:', error)
    }
  }

  const clearCurrentSession = useCallback(() => {
    setCurrentSessionId(null)
    try {
      localStorage.removeItem(CURRENT_SESSION_STORAGE_KEY)
    } catch {}
  }, [])

  // 开始新的分解会话
  const startNewSession = useCallback((rootContent: string) => {
    // 使用最新的全局状态，避免闭包过期
    const { nodes, edges, treeData: latestTreeData, selectedNode } = useFlowStore.getState()
    if (!latestTreeData) return

    const timestamp = Date.now()
    const sessionId = `history-${timestamp}`

    const newHistoryItem: HistoryItem = {
      id: sessionId,
      name: rootContent.length > 20 ? rootContent.substring(0, 20) + '...' : rootContent,
      timestamp,
      flowState: {
        nodes,
        edges,
        treeData: latestTreeData,
        selectedNode
      }
    }

    const newHistory = [newHistoryItem, ...historyRef.current]
    saveToStorage(newHistory)
    setCurrentSessionId(sessionId)
    try {
      localStorage.setItem(CURRENT_SESSION_STORAGE_KEY, sessionId)
    } catch {}
  }, [])

  // 更新当前会话
  const updateCurrentSession = useCallback(() => {
    const { nodes, edges, treeData: latestTreeData, selectedNode } = useFlowStore.getState()
    const sessionId = currentSessionIdRef.current
    if (!sessionId || !latestTreeData) return

    const newHistory = historyRef.current.map(item =>
      item.id === sessionId 
        ? { 
            ...item, 
            timestamp: Date.now(),
            flowState: {
              nodes,
              edges,
              treeData: latestTreeData,
              selectedNode
            }
          }
        : item
    )
    saveToStorage(newHistory)
  }, [])

  // 自动保存逻辑：根据是否为新分解来决定是新建还是更新
  const autoSaveHistory = useCallback(() => {
    const { treeData: latestTreeData } = useFlowStore.getState()
    if (!latestTreeData) return

    // 关键：每次自动保存前从 localStorage 读取当前会话ID，避免跨组件实例不同步
    let sessionId = currentSessionIdRef.current
    try {
      const stored = localStorage.getItem(CURRENT_SESSION_STORAGE_KEY)
      if (stored !== null) {
        sessionId = stored
        if (stored !== currentSessionIdRef.current) {
          currentSessionIdRef.current = stored
        }
      } else {
        sessionId = null
      }
    } catch {}

    if (sessionId) {
      updateCurrentSession()
    } else {
      const rootContent = latestTreeData.content || '新分解任务'
      startNewSession(rootContent)
    }
  }, [startNewSession, updateCurrentSession])

  // 加载历史记录
  const loadHistory = (id: string) => {
    const historyItem = history.find(item => item.id === id)
    if (historyItem) {
      loadState(historyItem.flowState)
      // 如果当前不在分解中，则将会话ID绑定到加载的项目，以便后续编辑更新该项目
      const { isDecomposing } = useFlowStore.getState()
    if (!isDecomposing) {
      setCurrentSessionId(id)
      try {
        localStorage.setItem(CURRENT_SESSION_STORAGE_KEY, id)
      } catch {}
    }
    }
  }

  // 删除历史记录
  const deleteHistory = (id: string) => {
    const newHistory = history.filter(item => item.id !== id)
    saveToStorage(newHistory)
    // 如果删除的是当前会话，清除会话ID
    if (id === currentSessionId) {
      setCurrentSessionId(null)
      try {
        localStorage.removeItem(CURRENT_SESSION_STORAGE_KEY)
      } catch {}
    }
  }

  // 重命名历史记录
  const renameHistory = (id: string, newName: string) => {
    const newHistory = history.map(item =>
      item.id === id ? { ...item, name: newName } : item
    )
    saveToStorage(newHistory)
  }



  // 重置状态时清除当前会话
  /*   useEffect(() => {
    if (!treeData) {
      setCurrentSessionId(null)
    }
  }, [treeData]) */

  return {
    history,
    autoSaveHistory,
    startNewSession,
    updateCurrentSession,
    loadHistory,
    deleteHistory,
    renameHistory,
    clearCurrentSession
  }
} 