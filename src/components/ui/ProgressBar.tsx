import React from "react";
import { TerminateButton } from "./Button";

interface ProgressBarProps {
  isDecomposing: boolean;
  decomposingMessage?: string;
  decomposingProgress?: number;
  onTerminate?: () => void;
}

export function ProgressBar({
  isDecomposing,
  decomposingMessage,
  decomposingProgress = 0,
  onTerminate
}: ProgressBarProps) {
  if (!isDecomposing && !decomposingMessage) {
    return null;
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center justify-center space-x-3">
          {isDecomposing && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          )}
          <div className="flex flex-col items-center space-y-2">
            <span className="text-gray-700 text-sm font-medium">
              {decomposingMessage || "分解任务中，请稍候..."}
            </span>
            {isDecomposing && decomposingProgress > 0 && (
              <div className="w-64 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${decomposingProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* 终止按钮 */}
        {isDecomposing && onTerminate && (
          <TerminateButton onClick={onTerminate} />
        )}
      </div>
    </div>
  );
}
