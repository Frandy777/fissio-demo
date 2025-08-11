import { ReactNode } from 'react'

interface CanvasProps {
  children: ReactNode
  className?: string
  progressBar?: ReactNode
}

export function Canvas({ children, className = '', progressBar }: CanvasProps) {
  return (
    <main className={`flex-1 bg-gray-50 relative overflow-hidden flex flex-col ${className}`}>
      {/* 进度栏区域 */}
      {progressBar && (
        <div className="relative z-10 flex-shrink-0">
          {progressBar}
        </div>
      )}
      
      {/* 画布容器 */}
      <div className="flex-1 relative">
        {children}
      </div>
      
      {/* 背景网格（可选） */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          top: progressBar ? '64px' : '0'
        }}
      />
    </main>
  )
} 