import { RecruitmentForm } from "@/components/community/recruitment-form"
import { UserPlus } from "lucide-react"

export const metadata = { title: "Join Us | MAJH EVENTS" }

export default function RecruitmentPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <UserPlus className="h-3 w-3" />
          Recruitment
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Join the Team</h1>
        <p className="mt-2 text-muted-foreground">
          We are always looking for passionate players, casters, staff, and volunteers to help grow the MAJH EVENTS community.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <RoleCard title="Player" description="Compete in tournaments across all game categories." />
        <RoleCard title="Staff" description="Help run events, manage brackets, and moderate forums." />
        <RoleCard title="Volunteer" description="Assist at in-person events and community outreach." />
        <RoleCard title="Caster" description="Provide live commentary for tournaments and streams." />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Apply Now</h2>
        <RecruitmentForm />
      </div>
    </div>
  )
}

function RoleCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
