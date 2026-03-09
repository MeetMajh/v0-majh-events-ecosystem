"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

interface BookingsChartProps {
  data: Record<string, number>
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: "#3b82f6",       // blue
  confirmed: "#22c55e",     // green
  deposit_paid: "#10b981",  // emerald
  in_progress: "#f59e0b",   // amber
  completed: "#6366f1",     // indigo
  cancelled: "#ef4444",     // red
}

const chartConfig = {
  inquiry: { label: "Inquiry", color: STATUS_COLORS.inquiry },
  confirmed: { label: "Confirmed", color: STATUS_COLORS.confirmed },
  deposit_paid: { label: "Deposit Paid", color: STATUS_COLORS.deposit_paid },
  in_progress: { label: "In Progress", color: STATUS_COLORS.in_progress },
  completed: { label: "Completed", color: STATUS_COLORS.completed },
  cancelled: { label: "Cancelled", color: STATUS_COLORS.cancelled },
}

export function BookingsChart({ data }: BookingsChartProps) {
  const chartData = Object.entries(data).map(([status, count]) => ({
    name: status.replace(/_/g, " "),
    value: count,
    color: STATUS_COLORS[status] || "#8884d8",
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No booking data available yet
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number, name: string) => [value, name]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
