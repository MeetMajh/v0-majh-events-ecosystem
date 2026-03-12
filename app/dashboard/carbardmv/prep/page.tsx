import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { updatePrepTaskStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertTriangle, Circle, User, Calendar, Timer, Tag } from "lucide-react"
import { NewPrepTaskForm } from "@/components/carbardmv/new-prep-task-form"

export const metadata = { title: "Prep Lists | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  in_progress: "bg-blue-500/10 text-blue-400",
  done: "bg-green-500/10 text-green-400",
  completed: "bg-green-500/10 text-green-400",
  skipped: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground border-muted-foreground/30",
  medium: "text-blue-400 border-blue-400/30",
  high: "text-orange-400 border-orange-400/30",
  urgent: "text-destructive border-destructive/30",
}

const CATEGORY_COLORS: Record<string, string> = {
  food_prep: "bg-orange-500/20 text-orange-400",
  setup: "bg-blue-500/20 text-blue-400",
  cleaning: "bg-green-500/20 text-green-400",
  inventory: "bg-purple-500/20 text-purple-400",
  transport: "bg-cyan-500/20 text-cyan-400",
  equipment: "bg-yellow-500/20 text-yellow-400",
  other: "bg-muted text-muted-foreground",
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  completed: CheckCircle2,
  skipped: AlertTriangle,
  cancelled: AlertTriangle,
}

export default async function PrepListsPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [{ data: tasks }, { data: staffMembers }, { data: bookings }] = await Promise.all([
    supabase
      .from("cb_prep_tasks")
      .select("*, profiles(first_name, last_name), cb_bookings(contact_name, event_date)")
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true })
      .limit(100),
    supabase.from("staff_roles").select("user_id, role, profiles(first_name, last_name)").order("role"),
    supabase.from("cb_bookings").select("id, contact_name, event_date").gte("event_date", new Date().toISOString().split("T")[0]).order("event_date").limit(20),
  ])

  // Group by status - treat 'completed' same as 'done'
  const grouped = {
    pending: tasks?.filter((t: any) => t.status === "pending") ?? [],
    in_progress: tasks?.filter((t: any) => t.status === "in_progress") ?? [],
    done: tasks?.filter((t: any) => t.status === "done" || t.status === "completed") ?? [],
  }

  const totalTasks = (tasks?.length ?? 0)
  const completedTasks = grouped.done.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prep Lists</h1>
          <p className="text-sm text-muted-foreground">
            Event preparation tasks and checklists
            {totalTasks > 0 && (
              <span className="ml-2 text-muted-foreground/70">
                ({completedTasks}/{totalTasks} completed)
              </span>
            )}
          </p>
        </div>
        <NewPrepTaskForm staffMembers={staffMembers ?? []} bookings={bookings ?? []} />
      </div>

      {/* Kanban-style columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {(["pending", "in_progress", "done"] as const).map((status) => {
          const StatusIcon = STATUS_ICONS[status]
          return (
            <div key={status} className="rounded-xl border border-border bg-card/50 min-h-[300px]">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <StatusIcon className={`h-4 w-4 ${STATUS_COLORS[status].split(" ")[1]}`} />
                <h2 className="text-sm font-semibold capitalize text-foreground">
                  {status === "done" ? "Completed" : status.replace("_", " ")}
                </h2>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {grouped[status].length}
                </span>
              </div>
              <div className="space-y-2 p-3">
                {grouped[status].map((task: Record<string, any>) => {
                  const profile = task.profiles as any
                  const booking = task.cb_bookings as any
                  const taskTags = task.tags as string[] | null
                  return (
                    <div key={task.id} className="rounded-lg border border-border bg-card p-3 text-sm hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-foreground leading-tight">{task.title}</h4>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {task.category && (
                          <Badge variant="secondary" className={`text-[10px] ${CATEGORY_COLORS[task.category] || ""}`}>
                            {task.category.replace("_", " ")}
                          </Badge>
                        )}
                        {taskTags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            <Tag className="h-2.5 w-2.5 mr-0.5" />
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        {profile && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {profile.first_name} {profile.last_name}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(task.due_date)}
                            {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                          </span>
                        )}
                        {task.time_estimate_minutes && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {task.time_estimate_minutes}m
                          </span>
                        )}
                      </div>

                      {booking && (
                        <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
                          Linked: {booking.contact_name}
                        </div>
                      )}

                      {status === "pending" && (
                        <div className="mt-3 flex gap-1 border-t border-border/50 pt-2">
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "in_progress") }}>
                            <Button size="sm" variant="outline" className="h-6 text-[10px]" type="submit">Start</Button>
                          </form>
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "done") }}>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" type="submit">Done</Button>
                          </form>
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "cancelled") }}>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" type="submit">Skip</Button>
                          </form>
                        </div>
                      )}
                      {status === "in_progress" && (
                        <div className="mt-3 border-t border-border/50 pt-2">
                          <form action={async () => { "use server"; await updatePrepTaskStatus(task.id, "done") }}>
                            <Button size="sm" className="h-6 text-[10px]" type="submit">Mark Done</Button>
                          </form>
                        </div>
                      )}
                    </div>
                  )
                })}
                {grouped[status].length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">No tasks</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
