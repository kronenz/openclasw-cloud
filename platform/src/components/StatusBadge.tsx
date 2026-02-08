import { CheckCircle, AlertTriangle, AlertCircle, Info, Circle } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}

const variantConfig = {
  success: {
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    Icon: CheckCircle,
  },
  warning: {
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    Icon: AlertTriangle,
  },
  error: {
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    Icon: AlertCircle,
  },
  info: {
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    Icon: Info,
  },
  neutral: {
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    Icon: Circle,
  },
}

export function StatusBadge({ status, variant = 'neutral' }: StatusBadgeProps) {
  const config = variantConfig[variant]
  const { Icon } = config

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </span>
  )
}
