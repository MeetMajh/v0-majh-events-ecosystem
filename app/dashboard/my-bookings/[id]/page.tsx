"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getBookingById, cancelBooking } from "@/lib/carbardmv-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { 
  Calendar, Clock, Users, ArrowLeft, Mail, Phone, 
  Building2, CreditCard, CheckCircle2, AlertCircle,
  PartyPopper, Trophy, Gamepad2, Package, UtensilsCrossed,
  Loader2, XCircle
} from "lucide-react"
import { format, isPast } from "date-fns"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  inquiry: { label: "Inquiry Sent", variant: "secondary", color: "text-muted-foreground" },
  pending: { label: "Pending Review", variant: "outline", color: "text-yellow-500" },
  confirmed: { label: "Confirmed", variant: "default", color: "text-primary" },
  deposit_paid: { label: "Deposit Paid", variant: "default", color: "text-green-500" },
  completed: { label: "Completed", variant: "secondary", color: "text-green-500" },
  cancelled: { label: "Cancelled", variant: "destructive", color: "text-destructive" },
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [booking, setBooking] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchBooking() {
      const { id } = await params
      const result = await getBookingById(id)
      if (result.error || !result.booking) {
        toast({
          title: "Booking not found",
          description: "Unable to load booking details",
          variant: "destructive",
        })
        router.push("/dashboard/my-bookings")
        return
      }
      setBooking(result.booking)
      setPayments(result.payments || [])
      setLoading(false)
    }
    fetchBooking()
  }, [params, router, toast])

  const handleCancel = async () => {
    setCancelling(true)
    const result = await cancelBooking(booking.id)
    if (result.error) {
      toast({
        title: "Cannot cancel booking",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Booking cancelled",
        description: "Your booking has been cancelled",
      })
      router.push("/dashboard/my-bookings")
    }
    setCancelling(false)
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!booking) return null

  const status = statusConfig[booking.status] || statusConfig.inquiry
  const eventDate = new Date(booking.event_date)
  const canCancel = ["inquiry", "pending", "confirmed"].includes(booking.status) && !isPast(eventDate)
  const selectedAddons = booking.selected_addons || []
  const selectedCatering = booking.selected_catering || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/my-bookings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <p className="text-muted-foreground">
            Booking #{booking.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <Badge variant={status.variant} className="text-sm">
          {status.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                Event Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Package</p>
                  <p className="font-medium">{booking.cb_event_packages?.name || "Custom Event"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Event Type</p>
                  <p className="font-medium">{booking.event_type || "Private Event"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{format(eventDate, "EEEE, MMMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {booking.start_time?.slice(0, 5) || "TBD"}
                      {booking.end_time && ` - ${booking.end_time.slice(0, 5)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Guest Count</p>
                    <p className="font-medium">{booking.guest_count} guests</p>
                  </div>
                </div>
              </div>

              {booking.special_requests && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Special Requests</p>
                    <p className="mt-1 text-sm">{booking.special_requests}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Add-ons */}
          {selectedAddons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Add-ons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {selectedAddons.map((addon: any, i: number) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>{addon.name}</span>
                      <span className="font-medium">${(addon.price_cents / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Catering */}
          {selectedCatering.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  Catering
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {selectedCatering.map((item: any, i: number) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span className="font-medium">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {booking.contact_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-medium">{booking.contact_name}</p>
                  {booking.company_name && (
                    <p className="text-sm text-muted-foreground">{booking.company_name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${booking.contact_email}`} className="hover:underline">
                  {booking.contact_email}
                </a>
              </div>
              {booking.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${booking.contact_phone}`} className="hover:underline">
                    {booking.contact_phone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Payment Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <span>${((booking.base_price_cents || 0) / 100).toFixed(2)}</span>
                </div>
                {(booking.addons_price_cents || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span>${(booking.addons_price_cents / 100).toFixed(2)}</span>
                  </div>
                )}
                {(booking.catering_price_cents || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catering</span>
                    <span>${(booking.catering_price_cents / 100).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${((booking.subtotal_cents || 0) / 100).toFixed(2)}</span>
                </div>
                {(booking.tax_cents || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${(booking.tax_cents / 100).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>${((booking.total_cents || 0) / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Deposit Status */}
              <div className={`rounded-lg p-3 ${booking.deposit_paid ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
                <div className="flex items-center gap-2">
                  {booking.deposit_paid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {booking.deposit_paid ? "Deposit Paid" : "Deposit Required"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${((booking.deposit_cents || 0) / 100).toFixed(2)} (25%)
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Payment History</p>
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(payment.created_at), "MMM d, yyyy")}
                      </span>
                      <span className={payment.status === "succeeded" ? "text-green-500" : ""}>
                        ${(payment.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Button className="w-full" asChild>
                <a href="mailto:events@majhevents.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Support
                </a>
              </Button>
              
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel Booking
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. If you&apos;ve paid a deposit, please contact support for refund information.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, Cancel Booking
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
