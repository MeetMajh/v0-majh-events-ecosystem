import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { updateShiftStatus, deleteStaffShift } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, Trash2 } from "lucide-react"
import { NewShiftForm } from "@/components/carbardmv/new-shift-form"

export const metadata = { title: "Staff Schedule | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400",
  confirmed: "bg-green-500/10 text-green-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-yellow-500/10 text-yellow-400",
}

export default async function StaffSchedulePage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [{ data: shifts }, { data: staffMembers }] = await Promise.all([
    supabase
      .from("cb_staff_shifts")
      .select("*, profiles(first_name, last_name), cb_bookings(contact_name)")
      .order("shift_date", { ascending: false })
      .limit(50),
    supabase
      .from("staff_roles")
      .select("user_id, role, profiles(first_name, last_name)")
      .order("role"),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Schedule</h1>
          <p className="text-sm text-muted-foreground">Manage shifts for events and operations</p>
        </div>
        <NewShiftForm staffMembers={staffMembers ?? []} />
      </div>

      <div className="space-y-3">
        {shifts?.map((shift: Record<string, any>) => {
          const profile = shift.profiles as any
          const staffName = profile ? `${profile.first_name} ${profile.last_name}` : "Unassigned"
          return (
            <div key={shift.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{staffName}</h3>
                    <Badge variant="outline" className={STATUS_COLORS[shift.status]}>
                      {shift.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{shift.role}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(shift.shift_date)} {shift.start_time} - {shift.end_time}
                    </span>
                    {shift.location && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {shift.location}</span>
                    )}
                  </div>
                  {shift.cb_bookings && (
                    <p className="text-xs text-primary">Event: {(shift.cb_bookings as any).contact_name}</p>
                  )}
                  {shift.notes && <p className="text-xs text-muted-foreground italic">{shift.notes}</p>}
                </div>
              </div>

              {shift.status === "scheduled" && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  <form action={async () => { "use server"; await updateShiftStatus(shift.id, "confirmed") }}>
                    <Button size="sm" type="submit">Confirm</Button>
                  </form>
                  <form action={async () => { "use server"; await updateShiftStatus(shift.id, "cancelled") }}>
                    <Button size="sm" variant="outline" type="submit">Cancel</Button>
                  </form>
                  <form action={async () => { "use server"; await deleteStaffShift(shift.id) }}>
                    <Button size="sm" variant="ghost" type="submit" className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </form>
                </div>
              )}
              {shift.status === "confirmed" && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  <form action={async () => { "use server"; await updateShiftStatus(shift.id, "completed") }}>
                    <Button size="sm" type="submit">Mark Completed</Button>
                  </form>
                  <form action={async () => { "use server"; await updateShiftStatus(shift.id, "no_show") }}>
                    <Button size="sm" variant="destructive" type="submit">No Show</Button>
                  </form>
                </div>
              )}
            </div>
          )
        })}

        {(!shifts || shifts.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No shifts scheduled. Create a new shift above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
