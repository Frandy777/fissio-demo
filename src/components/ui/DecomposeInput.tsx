"use client";

import { useEffect, useRef, useState } from "react";
import { ModeToggle, SendButton } from "./Button";
import { Textarea } from "./Input";
import { DecomposeMode } from "@/types";

export interface DecomposeInputProps {
  onSubmit: (text: string, mode: DecomposeMode) => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  placeholder?: string;
  defaultMode?: DecomposeMode;
  // 新增：外部预填与模式监听
  presetText?: string;
  presetMode?: DecomposeMode;
  onModeChange?: (mode: DecomposeMode) => void;
  presetKey?: number;
}

export function DecomposeInput({
  onSubmit,
  isLoading = false,
  error = null,
  className = "",
  placeholder = "Deconstruct anything.",
  defaultMode = "concept",
  presetText,
  presetMode,
  onModeChange,
  presetKey,
}: DecomposeInputProps) {
  const [inputText, setInputText] = useState("");
  const [decomposeMode, setDecomposeMode] =
    useState<DecomposeMode>(defaultMode);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleSubmit = () => {
    if (!inputText.trim() || isLoading) return;
    onSubmit(inputText.trim(), decomposeMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    autoResize();
  }, []);

  // 当父组件传入预填文本时，自动填充并聚焦
  useEffect(() => {
    if (typeof presetText === 'string') {
      setInputText(presetText);
      requestAnimationFrame(() => {
        autoResize();
        textareaRef.current?.focus();
      });
    }
  }, [presetText, presetKey]);

  // 当父组件传入模式时，同步更新
  useEffect(() => {
    if (presetMode) {
      setDecomposeMode(presetMode);
    }
  }, [presetMode]);

  // 将内部模式变化回调给父组件
  useEffect(() => {
    onModeChange?.(decomposeMode);
  }, [decomposeMode, onModeChange]);

  return (
    <div
      className={`bg-white rounded-3xl border border-gray-200 p-1 ${className}`}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="text-[18px] font-medium leading-6 pr-20 pb-14 min-h-0 resize-none border-0 shadow-none focus:ring-0 focus:outline-none text-gray-800 placeholder:text-gray-400"
          style={{ boxShadow: "none" }}
        />

        {/* 模式选择按钮 */}
        <div className="absolute left-2.5 bottom-1">
          <ModeToggle mode={decomposeMode} onModeChange={setDecomposeMode} />
        </div>

        {/* 发送按钮 */}
        <SendButton
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!inputText.trim() || isLoading}
          className="absolute right-3 bottom-3"
        />
      </div>

      {error && (
        <div className="mt-5 p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-[14px] font-normal text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
