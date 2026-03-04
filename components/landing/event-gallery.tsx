import Image from "next/image"
import { IMAGES } from "@/lib/images"

const GALLERY_ITEMS = [
  {
    src: IMAGES.events.outdoor,
    alt: "MAJH EVENTS outdoor gaming tournament with crowd of players under green lights",
    label: "Outdoor Tournament",
  },
  {
    src: IMAGES.events.tournamentNight,
    alt: "Tournament night at MAJH EVENTS with players competing at tables",
    label: "Tournament Night",
  },
  {
    src: IMAGES.events.barGaming,
    alt: "Gaming and cocktails at the MAJH EVENTS bar with FIFA on screen",
    label: "Bar & Gaming",
  },
  {
    src: IMAGES.events.gamingSetup,
    alt: "Multi-screen gaming setup at MAJH EVENTS with Dragon Ball FighterZ",
    label: "Gaming Setup",
  },
  {
    src: IMAGES.events.consoleStation,
    alt: "Console gaming stations with monitors and controllers at MAJH EVENTS",
    label: "Console Stations",
  },
  {
    src: IMAGES.events.team,
    alt: "MAJH EVENTS team members in branded purple shirts",
    label: "The MAJH Team",
  },
]

export function EventGallery() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {GALLERY_ITEMS.map((item) => (
        <div
          key={item.label}
          className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border"
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 p-4">
            <span className="text-sm font-semibold text-foreground">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
