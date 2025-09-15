import { ButtonHTMLAttributes, forwardRef, useState, ReactNode } from "react";
import {
  ListTodo,
  Atom,
  CornerDownLeft,
  Save,
  RotateCcw,
  Trash2,
  CircleStop,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-[14px] font-medium ring-offset-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gray-900 text-white hover:bg-gray-700 shadow-sm hover:shadow-md":
              variant === "default",
            "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300":
              variant === "outline",
            "text-gray-700 hover:bg-gray-100": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md":
              variant === "destructive",
          },
          {
            "h-11 px-5 py-3": size === "default",
            "h-9 rounded-xl px-4 py-2": size === "sm",
            "h-12 rounded-xl px-8 py-3": size === "lg",
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// 模式选择器组件
export interface ModeToggleProps {
  mode: "task" | "concept";
  onModeChange: (mode: "task" | "concept") => void;
  className?: string;
}

export const ModeToggle = forwardRef<HTMLDivElement, ModeToggleProps>(
  ({ mode, onModeChange, className }, ref) => {
    const [hovered, setHovered] = useState<"task" | "concept" | null>(null);

    const TooltipBubble = ({
      icon,
      title,
      description,
      align = "left",
    }: {
      icon: ReactNode;
      title: string;
      description: string;
      align?: "left" | "right";
    }) => {
      return (
        <div
          className={cn(
            "absolute top-full mt-2 z-50 w-[260px] rounded-2xl border border-gray-200 bg-white p-3",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          <div className="grid grid-cols-[auto_1fr] gap-x-1 items-start">
            <div className="mt-0.5">{icon}</div>
            <div>
              <div className="text-[18px] font-semibold text-gray-900">
                {title}
              </div>
            </div>
            <div className="col-span-2 mt-1 text-[13px] leading-5 text-gray-600">
              {description}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex items-center w-[72px] h-9 rounded-full cursor-pointer transition-all duration-200 border border-gray-200 bg-gray-100 px-1 select-none",
          className,
        )}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onModeChange(mode === "task" ? "concept" : "task")}
      >
        {/* 透明滑块（仅用于高亮选中位置，不包含图标） */}
        <div
          className={cn(
            "absolute top-[3px] left-[3px] w-[28px] h-[28px] rounded-full bg-white shadow-sm transition-transform duration-150",
            mode === "task" ? "translate-x-0" : "translate-x-[36px]",
          )}
        />

        {/* 始终显示两个图标，未选中更暗 */}
        <div className="relative z-10 w-[58px] h-full">
          {/* 左侧 Task 图标与提示 */}
          <div
            className="absolute left-[5px] top-1/2 -translate-y-1/2 flex w-4 h-4 transition-colors"
            onMouseEnter={() => setHovered("task")}
            onMouseLeave={() => setHovered(null)}
          >
            <ListTodo
              className={cn(
                "w-4 h-4 transition-colors",
                mode === "task" ? "font-serif text-gray-900" : "text-gray-400",
              )}
            />
            {hovered === "task" && (
              <TooltipBubble
                icon={<ListTodo className="h-5 w-6 text-gray-900" />}
                title="Task"
                description="Decompose any Task or Process into steps"
                align="left"
              />
            )}
          </div>

          {/* 右侧 Concept 图标与提示 */}
          <div
            className="absolute right-[1px] top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
            onMouseEnter={() => setHovered("concept")}
            onMouseLeave={() => setHovered(null)}
          >
            <Atom
              className={cn(
                "w-4 h-4 transition-colors",
                mode === "concept" ? "text-gray-900" : "text-gray-400",
              )}
            />
            {hovered === "concept" && (
              <TooltipBubble
                icon={<Atom className="h-5 w-6 text-gray-900" />}
                title="Concept"
                description="Decompose any Object or Concept into components"
                align="right"
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);
ModeToggle.displayName = "ModeToggle";

// 发送按钮组件（用于输入框右下角位置）
export interface SendButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export const SendButton = forwardRef<HTMLButtonElement, SendButtonProps>(
  ({ className, disabled, children, isLoading = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-700 text-white disabled:bg-gray-300 disabled:text-white/90 transition-transform active:translate-y-px select-none",
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {/* 若父级未传自定义child，默认展示 Send + 图标 */}
            {children ?? (
              <>
                <span className="text-[14px] font-semibold">Send</span>
                <CornerDownLeft className="w-4 h-4" />
              </>
            )}
          </>
        )}
      </button>
    );
  },
);
SendButton.displayName = "SendButton";

export { Button };

// ====== 专用动作按钮 ======
export interface ActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export const UpdateNodeButton = forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ className, isLoading = false, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="ghost"
      className={cn("bg-black text-white hover:bg-gray-900", className)}
      {...props}
    >
      <Save className="w-4 h-4 mr-2" />
      {isLoading ? (children ?? "Saving...") : (children ?? "Update Node")}
    </Button>
  );
});
UpdateNodeButton.displayName = "UpdateNodeButton";

export const RedecomposeButton = forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ className, isLoading = false, children, ...props }, ref) => {
  return (
    <Button ref={ref} variant="outline" className={cn(className)} {...props}>
      <RotateCcw className="w-4 h-4 mr-2" />
      {isLoading
        ? (children ?? "Decomposing...")
        : (children ?? "Re-decompose")}
    </Button>
  );
});
RedecomposeButton.displayName = "RedecomposeButton";

export const DeleteNodeButton = forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ className, isLoading = false, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="destructive"
      className={cn("", className)}
      {...props}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      {isLoading ? (children ?? "Deleting...") : (children ?? "Delete Node")}
    </Button>
  );
});
DeleteNodeButton.displayName = "DeleteNodeButton";

export const TerminateButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="destructive"
        size="sm"
        className={cn("flex items-center space-x-2", className)}
        {...props}
      >
        <CircleStop className="w-4 h-4" />
        <span>{children ?? "Stop Decompose"}</span>
      </Button>
    );
  },
);
TerminateButton.displayName = "TerminateButton";

// 新建项目按钮
export interface NewProjectButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  onNewProject?: () => void;
}

export const NewProjectButton = forwardRef<
  HTMLButtonElement,
  NewProjectButtonProps
>(({ className, onNewProject, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      onClick={onNewProject}
      className={cn(
        "w-full justify-center gap-2 bg-black text-white hover:bg-black/90 h-10 rounded-xl",
        className,
      )}
      variant="default"
      size="sm"
      {...props}
    >
      <Plus className="w-4 h-4" />
      {children ?? "New Project"}
    </Button>
  );
});
NewProjectButton.displayName = "NewProjectButton";
