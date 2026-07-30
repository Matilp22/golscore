import type { ReactNode } from 'react'

type AdminTableProps = {
  children: ReactNode
}

export default function AdminTable({ children }: AdminTableProps) {
  return (
    <div className="hf-admin-table-wrap">
      <table className="hf-admin-table">
        {children}
      </table>
    </div>
  )
}
