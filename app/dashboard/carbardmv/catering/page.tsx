import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { updateInquiryStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, Mail, Phone } from "lucide-react"

export const metadata = { title: "Catering Management | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400",
  contacted: "bg-yellow-500/10 text-yellow-400",
  quoted: "bg-cyan-500/10 text-cyan-400",
  booked: "bg-green-500/10 text-green-400",
  closed: "bg-muted text-muted-foreground",
}

export default async function CateringManagementPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const { data: inquiries } = await supabase
    .from("cb_catering_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catering Inquiries</h1>
        <p className="text-sm text-muted-foreground">Manage catering requests and convert them to bookings</p>
      </div>

      <div className="space-y-3">
        {inquiries?.map((inq: Record<string, any>) => (
          <div key={inq.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">{inq.name}</h3>
                  <Badge variant="outline" className={STATUS_COLORS[inq.status] || STATUS_COLORS.new}>
                    {inq.status}
                  </Badge>
                  {inq.event_type && (
                    <Badge variant="secondary" className="text-[10px]">{inq.event_type}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {inq.email}</span>
                  {inq.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {inq.phone}</span>}
                  {inq.guest_count && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {inq.guest_count} guests</span>}
                  {inq.event_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(inq.event_date)}</span>}
                </div>
                {inq.dietary_needs && (
                  <p className="text-xs text-muted-foreground">Dietary: {inq.dietary_needs}</p>
                )}
                {inq.message && (
                  <p className="mt-1 text-sm text-foreground/80">{inq.message}</p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{formatDate(inq.created_at)}</p>
            </div>

            <div className="mt-4 flex gap-2 border-t border-border pt-4">
              {inq.status === "new" && (
                <>
                  <form action={async () => { "use server"; await updateInquiryStatus(inq.id, "contacted") }}>
                    <Button size="sm" type="submit">Mark Contacted</Button>
                  </form>
                  <form action={async () => { "use server"; await updateInquiryStatus(inq.id, "closed") }}>
                    <Button size="sm" variant="outline" type="submit">Close</Button>
                  </form>
                </>
              )}
              {inq.status === "contacted" && (
                <form action={async () => { "use server"; await updateInquiryStatus(inq.id, "quoted") }}>
                  <Button size="sm" type="submit">Mark Quoted</Button>
                </form>
              )}
              {inq.status === "quoted" && (
                <form action={async () => { "use server"; await updateInquiryStatus(inq.id, "booked") }}>
                  <Button size="sm" type="submit">Mark Booked</Button>
                </form>
              )}
            </div>
          </div>
        ))}

        {(!inquiries || inquiries.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No catering inquiries yet. Inquiries from the catering page will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
