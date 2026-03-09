"use client"

import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface TopClientsTableProps {
  clients: Array<{
    id: string
    contact_name: string
    email: string
    company_name?: string | null
    status: string
    total_revenue_cents: number
  }>
}

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-blue-500/10 text-blue-400",
  active: "bg-green-500/10 text-green-400",
  inactive: "bg-muted text-muted-foreground",
  vip: "bg-primary/10 text-primary",
}

export function TopClientsTable({ clients }: TopClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        No client data available yet
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 text-xs font-medium text-muted-foreground">#</th>
            <th className="pb-3 text-xs font-medium text-muted-foreground">Client</th>
            <th className="pb-3 text-xs font-medium text-muted-foreground">Status</th>
            <th className="pb-3 text-right text-xs font-medium text-muted-foreground">Lifetime Value</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, idx) => (
            <tr key={client.id} className="border-b border-border/50 last:border-0">
              <td className="py-3 text-sm text-muted-foreground">{idx + 1}</td>
              <td className="py-3">
                <Link 
                  href={`/dashboard/carbardmv/clients/${client.id}`}
                  className="group"
                >
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    {client.contact_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {client.company_name || client.email}
                  </p>
                </Link>
              </td>
              <td className="py-3">
                <Badge variant="outline" className={STATUS_COLORS[client.status] || STATUS_COLORS.lead}>
                  {client.status}
                </Badge>
              </td>
              <td className="py-3 text-right">
                <span className="text-sm font-semibold">
                  ${(client.total_revenue_cents / 100).toLocaleString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
