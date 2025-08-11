"use client";

import { useState, useEffect } from "react";
import { useHistoryStorage } from "@/hooks/useHistoryStorage";
import { useFlowStore } from "@/store/useFlowStore";
import { NewProjectButton } from "@/components/ui/Button";
import { PanelLeft, Settings, Plus } from "lucide-react";

interface SidebarProps {
  onNewFlow?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  onNewFlow,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const {
    history,
    autoSaveHistory,
    loadHistory,
    deleteHistory,
    renameHistory,
  } = useHistoryStorage();
  const { resetState, setAutoSaveCallback } = useFlowStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Set auto-save callback
  useEffect(() => {
    setAutoSaveCallback(autoSaveHistory);
    return () => {
      setAutoSaveCallback(null);
    };
  }, [autoSaveHistory, setAutoSaveCallback]);

  const handleLoad = (id: string) => {
    loadHistory(id);
    setSelectedId(id);
  };

  const handleDelete = (id: string) => {
    deleteHistory(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleFinishEdit = (id: string) => {
    if (editingName.trim()) {
      renameHistory(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleNewFlow = () => {
    if (onNewFlow) {
      onNewFlow();
    } else {
      // 在重置状态之前，先保存当前项目（如果有的话）
      const { treeData } = useFlowStore.getState();
      if (treeData) {
        autoSaveHistory();
      }
      resetState();
    }
    setSelectedId(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <aside
      className={`${collapsed ? "w-12" : "w-64"} bg-white flex flex-col h-full transition-all duration-200 overflow-hidden`}
    >
      {/* 顶部工具栏 + 新建入口 */}
      <div className="p-3">
        {/* 工具栏 */}
        {collapsed ? (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded hover:bg-gray-100 text-gray-700"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNewFlow}
              aria-label="New project"
              className="mt-2 h-8 w-8 rounded-full bg-black text-white hover:bg-black/90 flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded hover:bg-gray-100 text-gray-700"
              aria-label="Toggle sidebar"
              title="Collapse"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 rounded hover:bg-gray-100 text-gray-700"
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="mt-3">
            <NewProjectButton onNewProject={handleNewFlow} />
          </div>
        )}
      </div>

      {/* 历史记录列表 */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-none ${collapsed ? "hidden" : "block"}`}
      >
        {history.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No history records
          </div>
        ) : (
          <div className="p-2">
            {history.map((item) => (
              <div
                key={item.id}
                className={`group relative p-3 mb-2 rounded-2xl transition-colors ${
                  selectedId === item.id ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleFinishEdit(item.id);
                        } else if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleFinishEdit(item.id)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="cursor-pointer"
                      onClick={() => handleLoad(item.id)}
                    >
                      <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                        {item.name}
                      </h3>
                      <div className="text-xs flex items-center gap-2 text-gray-500">
                        <span>{formatDate(item.timestamp)}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-400">
                          {item.flowState.nodes.length} nodes
                        </span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(item.id, item.name);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                          title="Rename"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
