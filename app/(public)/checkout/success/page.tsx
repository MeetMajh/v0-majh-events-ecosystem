import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Calendar, Home, User } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { IMAGES } from "@/lib/images"

export default function CheckoutSuccessPage() {
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
            <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Thank you for your deposit payment. Your booking has been confirmed and
              our team will reach out within 24 hours to finalize the details.
            </p>

            <div className="rounded-lg bg-muted/50 p-4 text-left">
              <h3 className="mb-2 font-semibold">What happens next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                  You will receive a confirmation email with your booking details
                </li>
                <li className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0" />
                  An event coordinator will contact you to discuss your event
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Track your booking status in your dashboard
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href="/dashboard/events">
                  View My Bookings
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
