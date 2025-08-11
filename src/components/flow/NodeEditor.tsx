import React, { useState, useEffect } from "react";
import { X, ChevronRight, Home } from "lucide-react";
import {
  Button,
  UpdateNodeButton,
  RedecomposeButton,
  DeleteNodeButton,
} from "@/components/ui/Button";

import { useFlowStore } from "@/store/useFlowStore";
import { TreeNode } from "@/types";
import { cn } from "@/lib/utils";

interface NodeEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NodeEditor({ isOpen, onClose }: NodeEditorProps) {
  const { selectedNode, treeData, updateTreeNodeContent, redecomposeFromNode, deleteTreeNode } =
    useFlowStore();
  const [editedContent, setEditedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // 当选中节点变化时更新编辑内容
  useEffect(() => {
    if (selectedNode) {
      setEditedContent(selectedNode.data?.content || "");
      setError(null);
    }
  }, [selectedNode]);

  // 获取节点路径（面包屑导航）
  const getNodePath = (
    targetNodeId: string,
    treeData: TreeNode,
  ): TreeNode[] => {
    const path: TreeNode[] = [];

    const findPath = (node: TreeNode, currentPath: TreeNode[]): boolean => {
      currentPath.push(node);

      if (node.id === targetNodeId) {
        path.push(...currentPath);
        return true;
      }

      if (node.children) {
        for (const child of node.children) {
          if (findPath(child, [...currentPath])) {
            return true;
          }
        }
      }

      return false;
    };

    if (treeData) {
      findPath(treeData, []);
    }

    return path;
  };

  // 获取子节点预览
  const getChildrenPreview = (node: TreeNode): TreeNode[] => {
    return node.children ? node.children.slice(0, 3) : [];
  };

  // 获取父节点
  const getParentNode = (
    targetNodeId: string,
    treeData: TreeNode,
  ): TreeNode | null => {
    const findParent = (node: TreeNode): TreeNode | null => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === targetNodeId) {
            return node;
          }
          const found = findParent(child);
          if (found) return found;
        }
      }
      return null;
    };

    return treeData ? findParent(treeData) : null;
  };

  // 保存节点内容
  const handleSaveContent = async () => {
    if (!selectedTreeNode || !editedContent.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await updateTreeNodeContent(selectedTreeNode.id, editedContent.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsLoading(false);
    }
  };

  // 重新分解节点
  const handleRedecompose = async () => {
    if (!selectedTreeNode || !editedContent.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // 先保存当前内容，然后启动重分解，并立即关闭编辑器
      await updateTreeNodeContent(selectedTreeNode.id, editedContent.trim());
      redecomposeFromNode(selectedTreeNode.id, editedContent.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-decompose failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEditedContent("");
    setError(null);
    onClose();
  };

  // 打开删除确认
  const handleDelete = () => {
    if (!selectedTreeNode) return;
    setIsConfirmOpen(true);
  };

  // 确认删除
  const confirmDelete = () => {
    if (!selectedTreeNode) return;
    try {
      deleteTreeNode(selectedTreeNode.id);
      setIsConfirmOpen(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setIsConfirmOpen(false);
    }
  };

  if (!isOpen || !selectedNode || !treeData) {
    return null;
  }

  const selectedTreeNode = selectedNode.data?.treeNode;
  const nodePath = selectedTreeNode
    ? getNodePath(selectedTreeNode.id, treeData)
    : [];
  const parentNode = selectedTreeNode
    ? getParentNode(selectedTreeNode.id, treeData)
    : null;
  const childrenPreview = selectedTreeNode
    ? getChildrenPreview(selectedTreeNode)
    : [];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Node Editor</h2>
            <p className="text-sm text-gray-500 mt-1">
              Edit node content or re-decompose
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 滚动内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 节点路径（面包屑导航）*/}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Node Path</h3>
            <nav className="flex items-center space-x-1 text-sm text-gray-600">
              <Home className="w-4 h-4" />
              {nodePath.map((pathNode, index) => (
                <React.Fragment key={pathNode.id}>
                  {index > 0 && (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={cn(
                      "px-2 py-1 rounded",
                      pathNode.id === selectedNode.id
                        ? "bg-gray-800 text-white font-medium"
                        : "text-gray-600",
                    )}
                  >
                    {pathNode.content.slice(0, 30)}
                    {pathNode.content.length > 30 ? "..." : ""}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* 父子节点预览 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 父节点预览 */}
            {parentNode && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Parent</h3>
                <div className="p-3 bg-gray-50 rounded-xl border">
                  <p className="text-sm text-gray-800 line-clamp-3">
                    {parentNode.content}
                  </p>
                </div>
              </div>
            )}

            {/* 子节点预览 */}
            {childrenPreview.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Children Preview ({selectedTreeNode?.children?.length || 0})
                </h3>
                <div className="space-y-2">
                  {childrenPreview.map((child, index) => (
                    <div
                      key={child.id}
                      className="p-2 bg-gray-50 rounded border text-sm"
                    >
                      <span className="text-gray-500 mr-2">{index + 1}.</span>
                      <span className="text-gray-800">
                        {child.content.slice(0, 40)}
                        {child.content.length > 40 ? "..." : ""}
                      </span>
                    </div>
                  ))}
                  {(selectedTreeNode?.children?.length || 0) > 3 && (
                    <p className="text-xs text-gray-500 px-2">
                      and {(selectedTreeNode?.children?.length || 0) - 3} more
                      child nodes...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 文本编辑区域 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900">Node Content</h3>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="Enter node content..."
              className="w-full min-h-[2.5rem] p-3 border border-gray-300 rounded-xl resize-none focus:outline-none overflow-hidden text-black"
              disabled={isLoading}
              rows={1}
              style={{
                height: "auto",
                minHeight: "2.5rem",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = target.scrollHeight + "px";
              }}
            />
            <p className="text-xs text-gray-900">
              {editedContent.length} characters
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
          <UpdateNodeButton
            onClick={handleSaveContent}
            disabled={
              isLoading ||
              !editedContent.trim() ||
              editedContent === selectedTreeNode?.content
            }
            isLoading={isLoading}
            className="flex-1 sm:flex-none"
          />

          <RedecomposeButton
            onClick={handleRedecompose}
            disabled={isLoading || !editedContent.trim()}
            isLoading={isLoading}
            className="flex-1 sm:flex-none"
          />

          <DeleteNodeButton
            onClick={handleDelete}
            disabled={isLoading}
            isLoading={false}
            className="flex-1 sm:flex-none"
          />

        </div>
      </div>

      {/* 自定义删除确认弹窗 */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* 背景遮罩，单独层次以拦截点击 */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsConfirmOpen(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200">
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-900">Delete Node</h3>
              <p className="mt-2 text-sm text-gray-600">
                This operation will delete the current node and all its child nodes. Are you sure to delete it?
              </p>
            </div>
            <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button
                variant="outline"
                className="sm:min-w-[120px]"
                onClick={() => setIsConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="sm:min-w-[140px]"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
