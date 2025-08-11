"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Minus, Focus, ImageDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  className?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onExportPNG: () => void | Promise<void>;
  onExportSVG: () => void | Promise<void>;
  isExporting?: boolean;
}

export function CanvasToolbar({
  className,
  onZoomIn,
  onZoomOut,
  onFitView,
  onExportPNG,
  onExportSVG,
  isExporting = false,
}: CanvasToolbarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className={cn("absolute bottom-4 left-4 z-18", className)}>
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-1.5">
        <button
          type="button"
          onClick={onZoomIn}
          className="h-8 w-8 rounded-2xl bg-white text-gray-800 hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="h-8 w-8 rounded-2xl bg-white text-gray-800 hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onFitView}
          className="h-8 w-8 rounded-2xl bg-white text-gray-800 hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Fit view"
        >
          <Focus className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={isExporting}
            className={cn(
              "h-8 rounded-xl px-3 bg-black text-white hover:bg-black/90 flex items-center gap-1.5 transition-colors text-sm",
              isExporting && "opacity-80 cursor-not-allowed",
            )}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <ImageDown className="w-4 h-4" />
            <span>{isExporting ? "exporting" : "export"}</span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 bottom-full mb-3 w-36 rounded-xl border border-gray-200 bg-white p-1"
            >
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                onClick={async () => {
                  setOpen(false);
                  await onExportPNG();
                }}
              >
                <span className="text-gray-800">Export as PNG</span>
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                onClick={async () => {
                  setOpen(false);
                  await onExportSVG();
                }}
              >
                <span className="text-gray-800">Export as SVG</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CanvasToolbar;
