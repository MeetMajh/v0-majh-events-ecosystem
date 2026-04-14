"use client"

import { useEffect, useState } from "react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts"

interface FinancialChartProps {
  type: "deposits" | "distribution" | "payouts"
  metrics?: {
    walletTotal: number
    liveEscrowTotal: number
    testEscrowTotal: number
    totalDeposits: number
  }
}

export function FinancialChart({ type, metrics }: FinancialChartProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500">
        Loading chart...
      </div>
    )
  }

  if (type === "deposits") {
    // Generate mock data for deposits over time
    const depositData = Array.from({ length: 14 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (13 - i))
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        amount: Math.floor(Math.random() * 50000) + 10000,
      }
    })

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={depositData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis 
            dataKey="date" 
            stroke="#71717a" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#71717a" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${(value / 100).toLocaleString()}`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "#18181b", 
              border: "1px solid #27272a",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value: number) => [`$${(value / 100).toLocaleString()}`, "Deposits"]}
          />
          <Line 
            type="monotone" 
            dataKey="amount" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ fill: "#10b981", strokeWidth: 0, r: 4 }}
            activeDot={{ fill: "#10b981", strokeWidth: 0, r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === "distribution" && metrics) {
    const distributionData = [
      { name: "Wallets", value: metrics.walletTotal, color: "#10b981" },
      { name: "Live Escrow", value: metrics.liveEscrowTotal, color: "#3b82f6" },
      { name: "Test Escrow", value: metrics.testEscrowTotal, color: "#f59e0b" },
    ].filter(d => d.value > 0)

    if (distributionData.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center text-zinc-500">
          No data to display
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={distributionData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis 
            type="number"
            stroke="#71717a" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${(value / 100).toLocaleString()}`}
          />
          <YAxis 
            type="category"
            dataKey="name"
            stroke="#71717a" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "#18181b", 
              border: "1px solid #27272a",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value: number) => [`$${(value / 100).toLocaleString()}`, "Balance"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {distributionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return null
}
