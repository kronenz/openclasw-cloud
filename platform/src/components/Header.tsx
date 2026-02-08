import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  children?: ReactNode
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </header>
  )
}
