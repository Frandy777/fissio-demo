"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DecomposeInput } from "@/components/ui/DecomposeInput";
import { useFlowStore } from "@/store/useFlowStore";
import { useHistoryStorage } from "@/hooks/useHistoryStorage";
import { TreeNode, DecomposeMode } from "@/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 分别获取需要的方法
  const treeData = useFlowStore((state) => state.treeData);
  const setTreeData = useFlowStore((state) => state.setTreeData);
  const startStreamDecomposition = useFlowStore(
    (state) => state.startStreamDecomposition,
  );
  const setStoreDecomposeMode = useFlowStore((state) => state.setDecomposeMode);
  const resetState = useFlowStore((state) => state.resetState);

  // 历史记录与会话控制
  const { autoSaveHistory, clearCurrentSession } = useHistoryStorage();

  const handleDecompose = async (
    inputText: string,
    decomposeMode: DecomposeMode,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // 在新建前，保存当前项目并重置会话，避免覆盖现有项目
      if (treeData) {
        autoSaveHistory();
      }
      resetState();
      clearCurrentSession();

      // 立即创建根节点
      const rootNode: TreeNode = {
        id: "root",
        content: inputText,
        children: null,
        expanded: false,
      };

      // 设置根节点并跳转到canvas页面
      setTreeData(rootNode);
      setStoreDecomposeMode(decomposeMode); // 设置分解模式到store
      router.push("/flow");

      // 启动流式分解
      startStreamDecomposition(inputText, decomposeMode);
    } catch (error) {
      console.error("分解失败:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        {/* 欢迎文案 */}
        <div className="text-center">
          <p className="text-[32px] font-bold text-gray-700">
            Hello, here is Fissio
          </p>
        </div>

        {/* 输入区域 */}
        <DecomposeInput
          onSubmit={handleDecompose}
          isLoading={isLoading}
          error={error}
          className="max-w-[650px] mx-auto"
        />
      </div>
    </div>
  );
}
