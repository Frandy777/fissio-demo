import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-normal leading-5 ring-offset-white file:border-0 file:bg-transparent file:text-[15px] file:font-medium placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[88px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] font-normal leading-6 ring-offset-white placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Input, Textarea } 