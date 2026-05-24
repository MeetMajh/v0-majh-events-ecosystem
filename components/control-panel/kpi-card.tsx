"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  trend?: number
  icon: LucideIcon
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple"
}

export function KPICard({ title, value, subtitle, trend, icon: Icon, variant = "default" }: KPICardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          iconBg: "bg-emerald-500/20",
          iconColor: "text-emerald-400",
          valueColor: "text-emerald-400",
        }
      case "warning":
        return {
          iconBg: "bg-amber-500/20",
          iconColor: "text-amber-400",
          valueColor: "text-amber-400",
        }
      case "danger":
        return {
          iconBg: "bg-red-500/20",
          iconColor: "text-red-400",
          valueColor: "text-red-400",
        }
      case "info":
        return {
          iconBg: "bg-blue-500/20",
          iconColor: "text-blue-400",
          valueColor: "text-blue-400",
        }
      case "purple":
        return {
          iconBg: "bg-purple-500/20",
          iconColor: "text-purple-400",
          valueColor: "text-purple-400",
        }
      default:
        return {
          iconBg: "bg-zinc-700",
          iconColor: "text-zinc-400",
          valueColor: "text-zinc-100",
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.iconColor)} />
          </div>
          {trend !== undefined && trend !== 0 && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend > 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-sm text-zinc-500">{title}</p>
          <p className={cn("text-2xl font-bold mt-1", styles.valueColor)}>{value}</p>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
