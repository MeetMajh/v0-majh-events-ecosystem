"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

interface RevenueChartProps {
  data: Array<{
    name: string
    events: number
    catering: number
    rentals: number
  }>
}

const chartConfig = {
  events: {
    label: "Events",
    color: "hsl(var(--primary))",
  },
  catering: {
    label: "Catering",
    color: "hsl(var(--chart-2))",
  },
  rentals: {
    label: "Rentals",
    color: "hsl(var(--chart-3))",
  },
}

export function RevenueChart({ data }: RevenueChartProps) {
  const hasData = data.some(d => d.events > 0 || d.catering > 0 || d.rentals > 0)

  if (!hasData) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No revenue data available yet
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="name" 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip 
            content={<ChartTooltipContent />} 
            cursor={{ fill: "hsl(var(--muted)/0.3)" }}
          />
          <Legend />
          <Bar 
            dataKey="events" 
            name="Events"
            fill="hsl(var(--primary))" 
            radius={[4, 4, 0, 0]} 
          />
          <Bar 
            dataKey="catering" 
            name="Catering"
            fill="hsl(var(--chart-2))" 
            radius={[4, 4, 0, 0]} 
          />
          <Bar 
            dataKey="rentals" 
            name="Rentals"
            fill="hsl(var(--chart-3))" 
            radius={[4, 4, 0, 0]} 
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
