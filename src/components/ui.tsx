import { AlertCircle, ArrowRight, Database, LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'green',
}: {
  children: ReactNode
  tone?: 'green' | 'orange' | 'neutral'
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EmptyState({
  type = 'empty',
  title,
  message,
  onRetry,
}: {
  type?: 'empty' | 'error' | 'loading'
  title: string
  message: string
  onRetry?: () => void
}) {
  const Icon = type === 'error' ? AlertCircle : type === 'loading' ? LoaderCircle : Database
  return (
    <section
      className={`empty-state state-${type}`}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <span className="state-icon">
        <Icon
          className={type === 'loading' ? 'spin' : ''}
          size={28}
        />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="secondary"
        >
          다시 시도하기 <ArrowRight size={16} />
        </Button>
      )}
    </section>
  )
}
