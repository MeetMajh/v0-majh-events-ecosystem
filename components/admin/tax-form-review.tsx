"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Search, 
  Filter, 
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type TaxForm = {
  id: string
  user_id: string
  form_type: string
  tax_year: number
  legal_name: string
  business_name: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string | null
  postal_code: string
  country: string
  ssn_last_four: string | null
  signature_date: string
  certification_accepted: boolean
  status: "submitted" | "verified" | "rejected"
  created_at: string
  verified_at: string | null
  profiles: {
    username: string
    display_name: string
    email: string
  }
}

const formTypeLabels: Record<string, string> = {
  w9: "W-9 (US Taxpayer)",
  w8ben: "W-8BEN (Non-US Individual)",
  w8bene: "W-8BEN-E (Non-US Entity)",
}

export function TaxFormReview() {
  const [statusFilter, setStatusFilter] = useState<string>("submitted")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedForm, setSelectedForm] = useState<TaxForm | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewAction, setReviewAction] = useState<"verify" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()

  const { data, error, mutate } = useSWR<{ forms: TaxForm[] }>(
    `/api/admin/tax/forms?status=${statusFilter}&year=${yearFilter}&search=${searchQuery}`,
    fetcher,
    { refreshInterval: 60000 }
  )

  const forms = data?.forms || []
  const isLoading = !data && !error

  const handleReview = async () => {
    if (!selectedForm || !reviewAction) return
    
    setProcessing(true)
    try {
      const response = await fetch("/api/admin/tax/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: selectedForm.id,
          action: reviewAction,
          rejectionReason: reviewAction === "reject" ? rejectionReason : undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast({
        title: reviewAction === "verify" ? "Form Verified" : "Form Rejected",
        description: `Tax form for ${selectedForm.profiles.display_name || selectedForm.profiles.username} has been ${reviewAction === "verify" ? "verified" : "rejected"}.`,
      })

      setShowReviewDialog(false)
      setSelectedForm(null)
      setReviewAction(null)
      setRejectionReason("")
      mutate()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to process review",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>
      case "submitted":
        return <Badge variant="secondary">Pending Review</Badge>
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tax Form Review
            </CardTitle>
            <CardDescription>Review submitted tax documentation (W-9, W-8BEN)</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-[150px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
                <SelectItem value={String(currentYear - 1)}>{currentYear - 1}</SelectItem>
                <SelectItem value={String(currentYear - 2)}>{currentYear - 2}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : forms.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No Tax Forms</h3>
            <p className="text-sm text-muted-foreground">
              No tax forms match the selected filters
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Form Type</TableHead>
                  <TableHead>Tax Year</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {form.profiles?.display_name || form.profiles?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">{form.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {form.form_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{form.tax_year}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{form.legal_name}</p>
                        {form.ssn_last_four && (
                          <p className="text-xs text-muted-foreground">SSN: ***-**-{form.ssn_last_four}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(form.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(form.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedForm(form)
                          setShowReviewDialog(true)
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Tax Form</DialogTitle>
            <DialogDescription>
              {selectedForm && formTypeLabels[selectedForm.form_type]} for {selectedForm?.profiles?.display_name || selectedForm?.profiles?.username}
            </DialogDescription>
          </DialogHeader>

          {selectedForm && (
            <div className="space-y-4">
              {/* Form Info */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Form Type</span>
                    <span className="font-medium uppercase">{selectedForm.form_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax Year</span>
                    <span className="font-medium">{selectedForm.tax_year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Legal Name</span>
                    <span className="font-medium">{selectedForm.legal_name}</span>
                  </div>
                  {selectedForm.business_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Business Name</span>
                      <span className="font-medium">{selectedForm.business_name}</span>
                    </div>
                  )}
                  {selectedForm.ssn_last_four && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SSN (Last 4)</span>
                      <span className="font-medium">***-**-{selectedForm.ssn_last_four}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <Label className="text-muted-foreground">Address</Label>
                <p className="mt-1 text-sm">
                  {selectedForm.address_line1}
                  {selectedForm.address_line2 && <>, {selectedForm.address_line2}</>}
                  <br />
                  {selectedForm.city}, {selectedForm.state} {selectedForm.postal_code}
                  <br />
                  {selectedForm.country}
                </p>
              </div>

              {/* Signature Info */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Certification Signed</span>
                </div>
                <p className="mt-1 text-sm text-blue-600">
                  Signed on {new Date(selectedForm.signature_date).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              {selectedForm.status === "submitted" && (
                <>
                  <div className="space-y-2">
                    <Label>Decision</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={reviewAction === "verify" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setReviewAction("verify")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Verify
                      </Button>
                      <Button
                        variant={reviewAction === "reject" ? "destructive" : "outline"}
                        className="flex-1"
                        onClick={() => setReviewAction("reject")}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>

                  {reviewAction === "reject" && (
                    <div className="space-y-2">
                      <Label htmlFor="rejection-reason">Rejection Reason</Label>
                      <Textarea
                        id="rejection-reason"
                        placeholder="Provide a reason for rejection..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Already Verified */}
              {selectedForm.status === "verified" && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Form Verified</span>
                  </div>
                  {selectedForm.verified_at && (
                    <p className="mt-1 text-sm text-green-600">
                      Verified on {new Date(selectedForm.verified_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Close
            </Button>
            {selectedForm?.status === "submitted" && (
              <Button
                onClick={handleReview}
                disabled={!reviewAction || (reviewAction === "reject" && !rejectionReason) || processing}
              >
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {reviewAction === "verify" ? "Verify Form" : "Reject Form"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
