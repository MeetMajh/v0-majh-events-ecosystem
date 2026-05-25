import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { XCircle, ArrowLeft, Home, Phone } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { IMAGES } from "@/lib/images"

export default function CheckoutCancelPage() {
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <XCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Your payment was cancelled and no charges were made. Your booking
              request has been saved - you can complete payment anytime.
            </p>

            <div className="rounded-lg bg-muted/50 p-4 text-left">
              <h3 className="mb-2 font-semibold">Need help?</h3>
              <p className="text-sm text-muted-foreground">
                If you experienced any issues during checkout or have questions
                about your booking, our team is here to help.
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>Contact us: (301) 555-CARB</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href="/events">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Try Again
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
