"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { BracketView } from "@/components/esports/bracket-view"
import { Shield, Users, Trophy, ScrollText } from "lucide-react"

type TabKey = "bracket" | "participants" | "rules" | "results"

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "bracket", label: "Bracket", icon: Trophy },
  { key: "participants", label: "Participants", icon: Users },
  { key: "rules", label: "Rules", icon: ScrollText },
  { key: "results", label: "Results", icon: Shield },
]

export function TournamentTabs({
  tournament,
  matches,
  participants,
}: {
  tournament: any
  matches: any[]
  participants: any[]
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("bracket")

  const showResults = tournament.status === "completed"

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
        {TABS.filter((t) => t.key !== "results" || showResults).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bracket" && (
        <BracketView
          matches={matches}
          participants={participants}
          format={tournament.format}
        />
      )}

      {activeTab === "participants" && (
        <ParticipantsList participants={participants} />
      )}

      {activeTab === "rules" && (
        <RulesView rules={tournament.rules_text} />
      )}

      {activeTab === "results" && showResults && (
        <ResultsView tournamentId={tournament.id} />
      )}
    </div>
  )
}

function ParticipantsList({ participants }: { participants: any[] }) {
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No participants yet. Be the first to register!</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Seed</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p: any, idx: number) => (
            <tr key={p.id} className="border-b border-border/50">
              <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.seed_number ?? idx + 1}</td>
              <td className="px-4 py-2.5">
                {p.profiles ? (
                  <Link
                    href={`/esports/players/${p.profiles.id || p.user_id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {p.profiles.display_name || p.profiles.full_name || "Player"}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Unknown Player</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                <StatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    registered: "bg-chart-3/10 text-chart-3",
    checked_in: "bg-primary/10 text-primary",
    eliminated: "bg-destructive/10 text-destructive",
    winner: "bg-primary/10 text-primary",
    disqualified: "bg-muted text-muted-foreground",
  }
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", styles[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

function RulesView({ rules }: { rules: string | null }) {
  if (!rules) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No rules have been published for this tournament yet.</p>
      </div>
    )
  }

  return (
    <div className="prose prose-invert max-w-none rounded-xl border border-border bg-card p-6">
      <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{rules}</div>
    </div>
  )
}

function ResultsView({ tournamentId }: { tournamentId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <Trophy className="mx-auto mb-3 h-8 w-8 text-primary" />
      <p className="text-muted-foreground">Tournament results will be displayed here after completion.</p>
    </div>
  )
}
