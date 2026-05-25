import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Monitor, Calendar, DollarSign, Package } from "lucide-react"
import Link from "next/link"

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  confirmed: { label: "Confirmed", variant: "default" },
  picked_up: { label: "Picked Up", variant: "default" },
  returned: { label: "Returned", variant: "secondary" },
  overdue: { label: "Overdue", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
}

export default async function MyRentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  // Get user's rental bookings with items
  const { data: rentals } = await supabase
    .from("cb_rental_bookings")
    .select(`
      *,
      items:cb_rental_booking_items(
        quantity,
        rate_type,
        line_total_cents,
        item:cb_rental_items(name)
      )
    `)
    .eq("client_id", user.id)
    .order("pickup_date", { ascending: false })

  const activeRentals = rentals?.filter((r) =>
    ["pending", "confirmed", "picked_up"].includes(r.status)
  ) || []

  const pastRentals = rentals?.filter((r) =>
    ["returned", "overdue", "cancelled"].includes(r.status)
  ) || []

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        title="My Rentals"
        description="View and manage your equipment rentals"
      />

      {rentals?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">No rental bookings yet</p>
            <p className="mb-4 text-muted-foreground">Rent AV equipment, gaming stations, and more</p>
            <Button asChild>
              <Link href="/rentals">Browse Rental Catalog</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeRentals.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Active Rentals</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeRentals.map((rental) => {
              const status = STATUS_BADGES[rental.status] || STATUS_BADGES.pending
              return (
                <Card key={rental.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        Rental #{rental.id.slice(0, 8).toUpperCase()}
                      </CardTitle>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(rental.pickup_date).toLocaleDateString()} - {new Date(rental.return_date).toLocaleDateString()}
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Items:
                        </p>
                        <ul className="ml-6 space-y-1 text-muted-foreground">
                          {rental.items?.map((item: { quantity: number; rate_type: string; item: { name: string } }, idx: number) => (
                            <li key={idx}>
                              {item.quantity}x {item.item?.name} ({item.rate_type})
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 pt-2 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        Total: ${(rental.total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        {rental.deposit_paid && (
                          <Badge variant="outline" className="ml-2">Deposit Paid</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {pastRentals.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Past Rentals</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pastRentals.map((rental) => {
              const status = STATUS_BADGES[rental.status] || STATUS_BADGES.pending
              return (
                <Card key={rental.id} className="opacity-75">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        Rental #{rental.id.slice(0, 8).toUpperCase()}
                      </CardTitle>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(rental.pickup_date).toLocaleDateString()} - {new Date(rental.return_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        {rental.items?.length || 0} items
                      </div>
                      <div className="flex items-center gap-2 pt-2 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        ${(rental.total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
