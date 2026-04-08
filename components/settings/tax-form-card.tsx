"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download,
  Calendar
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TaxForm {
  id: string
  form_type: string
  tax_year: number
  legal_name: string
  status: string
  created_at: string
}

interface Profile {
  id: string
  full_name: string | null
  country: string | null
}

interface Props {
  taxForm: TaxForm | null
  profile: Profile | null
  yearlyEarnings: number
}

export function TaxFormCard({ taxForm, profile, yearlyEarnings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    legalName: profile?.full_name ?? "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    ssnLastFour: "",
    certificationAccepted: false,
  })

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const threshold = 60000 // $600 in cents
  const progressPercent = Math.min((yearlyEarnings / threshold) * 100, 100)
  const thresholdReached = yearlyEarnings >= threshold

  const handleSubmitForm = () => {
    if (!formData.certificationAccepted) {
      toast.error("Please accept the certification")
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/tax/submit-w9", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalName: formData.legalName,
            addressLine1: formData.addressLine1,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            ssnLastFour: formData.ssnLastFour,
          }),
        })

        if (!res.ok) throw new Error("Failed to submit form")

        toast.success("W-9 submitted successfully")
        setDialogOpen(false)
        window.location.reload()
      } catch {
        toast.error("Failed to submit W-9")
      }
    })
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full",
              taxForm?.status === "verified" 
                ? "bg-emerald-500/10" 
                : thresholdReached 
                  ? "bg-amber-500/10"
                  : "bg-muted"
            )}>
              <FileText className={cn(
                "h-6 w-6",
                taxForm?.status === "verified" 
                  ? "text-emerald-500" 
                  : thresholdReached 
                    ? "text-amber-500"
                    : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Tax Information (W-9)
                {taxForm?.status === "verified" && (
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                    Verified
                  </Badge>
                )}
                {taxForm?.status === "submitted" && (
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">
                    Pending Review
                  </Badge>
                )}
                {!taxForm && thresholdReached && (
                  <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-500">
                    Required
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {thresholdReached 
                  ? "Required for US tax compliance when earning over $600"
                  : "Will be required when your earnings reach $600"}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Earnings Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{new Date().getFullYear()} Earnings</span>
            <span className="font-medium">{formatCurrency(yearlyEarnings)} / $600</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {!thresholdReached && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(threshold - yearlyEarnings)} more until W-9 is required
            </p>
          )}
        </div>

        {/* Status-specific content */}
        {taxForm?.status === "verified" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-500">Tax Form Verified</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your W-9 for {taxForm.tax_year} has been verified. Your 1099 will be available in January.
                </p>
              </div>
            </div>
          </div>
        )}

        {taxForm?.status === "submitted" && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500">Under Review</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your W-9 is being reviewed. This usually takes 1-2 business days.
                </p>
              </div>
            </div>
          </div>
        )}

        {!taxForm && thresholdReached && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-500">W-9 Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have earned over $600 this year. Please submit a W-9 form to continue receiving payouts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {(!taxForm || taxForm.status === "rejected") && thresholdReached && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Submit W-9
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Submit W-9 Form</DialogTitle>
                  <DialogDescription>
                    Provide your tax information for IRS reporting requirements.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Name</Label>
                    <Input
                      id="legalName"
                      value={formData.legalName}
                      onChange={(e) => setFormData(prev => ({ ...prev, legalName: e.target.value }))}
                      placeholder="As shown on your tax return"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressLine1: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        maxLength={2}
                        placeholder="CA"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input
                        id="zip"
                        value={formData.postalCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ssn">SSN (last 4)</Label>
                      <Input
                        id="ssn"
                        type="password"
                        value={formData.ssnLastFour}
                        onChange={(e) => setFormData(prev => ({ ...prev, ssnLastFour: e.target.value }))}
                        maxLength={4}
                        placeholder="••••"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox 
                      id="certification"
                      checked={formData.certificationAccepted}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, certificationAccepted: checked === true }))
                      }
                    />
                    <label htmlFor="certification" className="text-xs text-muted-foreground leading-tight">
                      Under penalties of perjury, I certify that the information provided is correct and I am a U.S. citizen or resident alien.
                    </label>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitForm} disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit W-9"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {taxForm?.status === "verified" && (
            <Button variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download 1099
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Your tax information is encrypted and only used for IRS reporting.
        </p>
      </CardContent>
    </Card>
  )
}
