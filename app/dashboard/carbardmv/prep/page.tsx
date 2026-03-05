import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { updatePrepTaskStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertTriangle, Circle } from "lucide-react"
import { NewPrepTaskForm } from "@/components/carbardmv/new-prep-task-form"

export const metadata = { title: "Prep Lists | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  in_progress: "bg-blue-500/10 text-blue-400",
  done: "bg-green-500/10 text-green-400",
  skipped: "bg-muted text-muted-foreground",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-destructive",
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  skipped: AlertTriangle,
}

export default async function PrepListsPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [{ data: tasks }, { data: staffMembers }] = await Promise.all([
    supabase
      .from("cb_prep_tasks")
      .select("*, profiles(first_name, last_name), cb_bookings(contact_name)")
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true })
      .limit(100),
    supabase.from("staff_roles").select("user_id, role, profiles(first_name, last_name)").order("role"),
  ])

  // Group by status
  const grouped = {
    pending: tasks?.filter((t: any) => t.status === "pending") ?? [],
    in_progress: tasks?.filter((t: any) => t.status === "in_progress") ?? [],
    done: tasks?.filter((t: any) => t.status === "done") ?? [],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prep Lists</h1>
          <p className="text-sm text-muted-foreground">Event preparation tasks and checklists</p>
        </div>
        <NewPrepTaskForm staffMembers={staffMembers ?? []} />
      </div>

      {/* Kanban-style columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {(["pending", "in_progress", "done"] as const).map((status) => {
          const StatusIcon = STATUS_ICONS[status]
          return (
            <div key={status} className="rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <StatusIcon className={`h-4 w-4 ${STATUS_COLORS[status].split(" ")[1]}`} />
                <h2 className="text-sm font-semibold capitalize text-foreground">
                  {status.replace("_", " ")}
                </h2>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {grouped[status].length}
                </span>
              </div>
              <div className="space-y-2 p-3">
                {grouped[status].map((task: Record<string, any>) => {
                  const profile = task.profiles as any
                  return (
                    <div key={task.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-foreground">{task.title}</h4>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        {profile && <span>{profile.first_name} {profile.last_name}</span>}
                        {task.category && <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>}
                        {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                      </div>
                      {status === "pending" && (
                        <div className="mt-2 flex gap-1">
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "in_progress") }}>
                            <Button size="sm" variant="outline" className="h-6 text-[10px]" type="submit">Start</Button>
                          </form>
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "skipped") }}>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" type="submit">Skip</Button>
                          </form>
                        </div>
                      )}
                      {status === "in_progress" && (
                        <div className="mt-2">
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "done") }}>
                            <Button size="sm" className="h-6 text-[10px]" type="submit">Mark Done</Button>
                          </form>
                        </div>
                      )}
                    </div>
                  )
                })}
                {grouped[status].length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">No tasks</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
