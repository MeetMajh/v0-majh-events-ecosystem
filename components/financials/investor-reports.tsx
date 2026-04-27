"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts"
import { 
  FileText, Download, TrendingUp, TrendingDown, DollarSign, 
  Users, AlertTriangle, Banknote, CalendarIcon, RefreshCw
} from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"

interface InvestorReportsProps {
  tenantId: string
}

export function InvestorReports({ tenantId }: InvestorReportsProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState<string>("monthly")
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(subMonths(new Date(), 1)),
    end: endOfMonth(subMonths(new Date(), 1))
  })
  const supabase = createClient()

  useEffect(() => {
    fetchReports()
  }, [tenantId, reportType])

  const fetchReports = async () => {
    try {
      const { data: result, error } = await supabase.rpc("get_investor_reports", {
        p_tenant_id: tenantId,
        p_report_type: reportType === "all" ? null : reportType,
        p_limit: 12
      })
      if (error) throw error
      setData(result)
    } catch (error) {
      console.error("Error fetching reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    setGenerating(true)
    try {
      const { data: result, error } = await supabase.rpc("generate_financial_report", {
        p_tenant_id: tenantId,
        p_period_start: format(dateRange.start, "yyyy-MM-dd"),
        p_period_end: format(dateRange.end, "yyyy-MM-dd"),
        p_report_type: "custom"
      })
      if (error) throw error
      await fetchReports()
    } catch (error) {
      console.error("Error generating report:", error)
    } finally {
      setGenerating(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(cents / 100)
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading reports...</p>
        </CardContent>
      </Card>
    )
  }

  const reports = data?.reports || []
  const summary = data?.all_time_summary || {}

  // Chart data from reports
  const revenueChartData = reports.slice(0, 6).map((r: any) => ({
    period: format(new Date(r.period_start), "MMM yyyy"),
    gross: r.gross_revenue_cents / 100,
    net: r.net_revenue_cents / 100,
    fees: r.platform_fees_cents / 100
  })).reverse()

  const transactionChartData = reports.slice(0, 6).map((r: any) => ({
    period: format(new Date(r.period_start), "MMM yyyy"),
    transactions: r.transaction_count,
    buyers: r.unique_buyers,
    organizers: r.unique_organizers
  })).reverse()

  const riskChartData = reports.slice(0, 6).map((r: any) => ({
    period: format(new Date(r.period_start), "MMM yyyy"),
    disputes: r.dispute_count,
    refunds: r.refund_count,
    disputeRate: r.dispute_rate * 100
  })).reverse()

  const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)"]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Investor Reports</h2>
          <p className="text-muted-foreground">Comprehensive financial analytics and KPIs</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateReport} disabled={generating}>
            {generating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {/* All-Time Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue_cents || 0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Platform Fees</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_platform_fees_cents || 0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Transactions</span>
            </div>
            <p className="text-2xl font-bold">{(summary.total_transactions || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Total Disputes</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.total_disputes || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Capital Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Capital Program Performance</p>
              <p className="text-3xl font-bold">{formatCurrency(summary.total_advance_fees_cents || 0)}</p>
              <p className="text-sm text-muted-foreground">Total advance fee revenue</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Advances Issued</p>
              <p className="text-2xl font-semibold">{formatCurrency(summary.total_advances_issued_cents || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Average Take Rate</p>
              <p className="text-2xl font-semibold">{formatPercent(summary.avg_take_rate || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="risk">Risk Metrics</TabsTrigger>
          <TabsTrigger value="reports">Report History</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Gross revenue, platform fees, and net revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                      contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Bar dataKey="gross" name="Gross Revenue" fill="hsl(var(--primary))" />
                    <Bar dataKey="fees" name="Platform Fees" fill="hsl(142 76% 36%)" />
                    <Bar dataKey="net" name="Net Revenue" fill="hsl(262 83% 58%)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No revenue data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Volume</CardTitle>
              <CardDescription>Transaction count, unique buyers, and active organizers</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={transactionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="transactions" name="Transactions" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="buyers" name="Unique Buyers" stroke="hsl(142 76% 36%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="organizers" name="Active Organizers" stroke="hsl(38 92% 50%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No transaction data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle>Risk Metrics</CardTitle>
              <CardDescription>Disputes, refunds, and dispute rate trends</CardDescription>
            </CardHeader>
            <CardContent>
              {riskChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={riskChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="disputes" name="Disputes" fill="hsl(0 84% 60%)" />
                    <Bar yAxisId="left" dataKey="refunds" name="Refunds" fill="hsl(38 92% 50%)" />
                    <Line yAxisId="right" type="monotone" dataKey="disputeRate" name="Dispute Rate %" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No risk data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>Historical financial reports</CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length > 0 ? (
                <div className="space-y-3">
                  {reports.map((report: any) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {format(new Date(report.period_start), "MMM d")} - {format(new Date(report.period_end), "MMM d, yyyy")}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{report.report_type}</Badge>
                            {report.is_finalized && <Badge variant="secondary">Finalized</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-8 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="font-medium">{formatCurrency(report.gross_revenue_cents)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Transactions</p>
                          <p className="font-medium">{report.transaction_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Take Rate</p>
                          <p className="font-medium">{formatPercent(report.take_rate)}</p>
                        </div>
                        <div>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No reports generated yet</p>
                  <p className="text-sm text-muted-foreground">Click &quot;Generate Report&quot; to create your first report</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
