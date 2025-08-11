import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // 等待动画完成
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
        type === 'success' 
          ? "bg-green-50 border border-green-200 text-green-800"
          : "bg-red-50 border border-red-200 text-red-800"
      )}
    >
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-green-600" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-600" />
      )}
      
      <span className="text-sm font-medium">{message}</span>
      
      <button
        onClick={handleClose}
        className={cn(
          "p-1 rounded hover:bg-opacity-20 transition-colors",
          type === 'success' ? "hover:bg-green-600" : "hover:bg-red-600"
        )}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}