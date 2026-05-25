import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Calendar, Home, User, Package, Receipt } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import { stripe } from "@/lib/stripe"
import { redirect } from "next/navigation"

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  let bookingType: "event" | "rental" | "invoice" | "unknown" = "unknown"
  let sessionValid = false

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      if (session.payment_status === "paid") {
        sessionValid = true
        const type = session.metadata?.type
        if (type === "event_booking") bookingType = "event"
        else if (type === "rental_booking") bookingType = "rental"
        else if (type === "invoice_payment") bookingType = "invoice"
      }
    } catch {
      // Invalid session, show generic success
    }
  }

  // If no session_id or invalid, redirect to home
  if (!session_id) {
    redirect("/")
  }

  const titles = {
    event: "Event Booking Confirmed!",
    rental: "Rental Booking Confirmed!",
    invoice: "Payment Received!",
    unknown: "Payment Successful!",
  }

  const descriptions = {
    event: "Thank you for your deposit payment. Your event booking has been confirmed and our team will reach out within 24 hours to finalize the details.",
    rental: "Thank you for your deposit payment. Your equipment rental has been confirmed. We will contact you with pickup instructions.",
    invoice: "Thank you for your payment. Your invoice has been updated and a receipt will be emailed to you shortly.",
    unknown: "Thank you for your payment. We have received your payment and will process your order shortly.",
  }

  const dashboardLinks = {
    event: { href: "/dashboard/events", label: "View My Events" },
    rental: { href: "/dashboard/rentals", label: "View My Rentals" },
    invoice: { href: "/", label: "Back to Home" },
    unknown: { href: "/dashboard", label: "Go to Dashboard" },
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={IMAGES.logo}
              alt="CARBARDMV"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-xl font-bold">CARBARDMV</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-12">
        <Card className="w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">{titles[bookingType]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              {descriptions[bookingType]}
            </p>

            {bookingType !== "invoice" && (
              <div className="rounded-lg bg-muted/50 p-4 text-left">
                <h3 className="mb-2 font-semibold">What happens next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
                    You will receive a confirmation email with your booking details
                  </li>
                  <li className="flex items-start gap-2">
                    <User className="mt-0.5 h-4 w-4 shrink-0" />
                    {bookingType === "event" 
                      ? "An event coordinator will contact you to discuss your event"
                      : "Our team will contact you with pickup/delivery information"}
                  </li>
                  <li className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                    Track your booking status in your dashboard
                  </li>
                </ul>
              </div>
            )}

            {bookingType === "invoice" && (
              <div className="rounded-lg bg-muted/50 p-4 text-left">
                <h3 className="mb-2 font-semibold">Payment Details</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
                    A payment receipt will be sent to your email
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Your invoice has been marked as paid
                  </li>
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href={dashboardLinks[bookingType].href}>
                  <Package className="mr-2 h-4 w-4" />
                  {dashboardLinks[bookingType].label}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
