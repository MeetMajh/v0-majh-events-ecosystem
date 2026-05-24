import Link from "next/link"
import { getUpcomingExternalTournaments } from "@/lib/external-tournament-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  MapPin, 
  Users, 
  ExternalLink,
  Globe,
  Gamepad2,
} from "lucide-react"
import { formatDate } from "@/lib/format"

const GAME_COLORS: Record<string, string> = {
  magic: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  pokemon: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  yugioh: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  lorcana: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  fab: "bg-red-500/10 text-red-600 border-red-500/20",
  onepiece: "bg-red-500/10 text-red-600 border-red-500/20",
  starwars: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
}

const GAME_LABELS: Record<string, string> = {
  magic: "MTG",
  pokemon: "Pokemon",
  yugioh: "Yu-Gi-Oh!",
  lorcana: "Lorcana",
  fab: "FAB",
  onepiece: "One Piece",
  starwars: "Star Wars",
  weiss: "Weiss",
  digimon: "Digimon",
  dragonball: "DBS",
}

export async function ExternalTournaments() {
  const tournaments = await getUpcomingExternalTournaments(6)

  if (tournaments.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Upcoming TCG Events
          </h2>
          <p className="text-sm text-muted-foreground">
            Community tournaments from across the region
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/esports/tournaments">
            View All
            <ExternalLink className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>
    </section>
  )
}

function TournamentCard({ tournament }: { tournament: any }) {
  const gameColor = GAME_COLORS[tournament.game] || "bg-muted text-muted-foreground"
  const gameLabel = GAME_LABELS[tournament.game] || tournament.game

  return (
    <div className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="mb-3 flex items-start justify-between gap-2">
        <Badge variant="outline" className={gameColor}>
          {gameLabel}
        </Badge>
        {tournament.format && (
          <Badge variant="secondary" className="text-[10px]">
            {tournament.format}
          </Badge>
        )}
      </div>

      <h3 className="mb-2 font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
        {tournament.name}
      </h3>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span>{formatDate(tournament.start_date)}</span>
        </div>

        {tournament.location ? (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{tournament.location}</span>
          </div>
        ) : tournament.is_online && (
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 flex-shrink-0" />
            <span>Online Event</span>
          </div>
        )}

        {tournament.max_players && (
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3 flex-shrink-0" />
            <span>
              {tournament.registered_players || 0} / {tournament.max_players} players
            </span>
          </div>
        )}
      </div>

      {tournament.entry_fee_cents && (
        <div className="mt-3 text-sm font-medium text-foreground">
          ${(tournament.entry_fee_cents / 100).toFixed(2)} entry
        </div>
      )}

      {tournament.external_url && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-3 w-full text-xs" 
          asChild
        >
          <a 
            href={tournament.external_url} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            View on {tournament.source === "topdeck" ? "TopDeck.gg" : "Source"}
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </a>
        </Button>
      )}

      {tournament.organizer_name && (
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          by {tournament.organizer_name}
        </p>
      )}
    </div>
  )
}
