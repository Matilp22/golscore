import type { ReactNode } from 'react'

type AdminTableProps = {
  children: ReactNode
}

export default function AdminTable({ children }: AdminTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8 bg-black/10">
      <table className="hf-table min-w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  )
}
