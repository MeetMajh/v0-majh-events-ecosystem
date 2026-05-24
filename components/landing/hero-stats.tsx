const STATS = [
  { value: "500+", label: "Active Gamers" },
  { value: "50+", label: "Tournaments" },
  { value: "10K+", label: "Rewards Redeemed" },
  { value: "100+", label: "Events Hosted" },
]

export function HeroStats() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-8 md:gap-12">
      {STATS.map((stat) => (
        <div key={stat.label} className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-foreground md:text-3xl">{stat.value}</span>
          <span className="text-xs text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}
