"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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

interface DepositDataPoint {
  date: string
  amount: number
}

export function FinancialChart({ type, metrics }: FinancialChartProps) {
  const [mounted, setMounted] = useState(false)
  const [depositData, setDepositData] = useState<DepositDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    
    if (type === "deposits") {
      fetchDepositData()
    } else {
      setLoading(false)
    }
  }, [type])

  async function fetchDepositData() {
    try {
      const supabase = createClient()
      
      // Get deposits for the last 14 days grouped by day
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("amount_cents, created_at")
        .eq("type", "deposit")
        .eq("status", "completed")
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching deposit data:", error)
        setLoading(false)
        return
      }

      // Group by date
      const grouped: Record<string, number> = {}
      
      // Initialize all 14 days with 0
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        grouped[dateKey] = 0
      }

      // Sum deposits by day
      data?.forEach((tx) => {
        const date = new Date(tx.created_at)
        const dateKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        if (grouped[dateKey] !== undefined) {
          grouped[dateKey] += Math.abs(tx.amount_cents || 0)
        }
      })

      // Convert to array
      const chartData = Object.entries(grouped).map(([date, amount]) => ({
        date,
        amount,
      }))

      setDepositData(chartData)
    } catch (err) {
      console.error("[v0] Chart data fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500">
        <div className="animate-pulse">Loading chart...</div>
      </div>
    )
  }

  if (type === "deposits") {
    if (depositData.length === 0 || depositData.every(d => d.amount === 0)) {
      return (
        <div className="h-[300px] flex items-center justify-center text-zinc-500">
          No deposit data for the last 14 days
        </div>
      )
    }

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
