import { getLivestreams } from "@/lib/content-actions"
import { Badge } from "@/components/ui/badge"
import { Radio, ExternalLink } from "lucide-react"

export const metadata = { title: "Live | MAJH EVENTS" }

export default async function LivePage() {
  const streams = await getLivestreams()
  const liveStreams = streams.filter((s) => s.is_live)
  const scheduledStreams = streams.filter((s) => !s.is_live)

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
          <Radio className="h-3 w-3 animate-pulse" />
          Livestreams
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Now</h1>
        <p className="mt-2 text-muted-foreground">Watch MAJH EVENTS competitions live on Twitch, YouTube, and Kick.</p>
      </div>

      {/* Live Now */}
      {liveStreams.length > 0 ? (
        <section className="mb-12">
          <div className="grid gap-4">
            {liveStreams.map((stream) => (
              <div key={stream.id} className="overflow-hidden rounded-xl border border-destructive/20 bg-card">
                <div className="aspect-video w-full">
                  <iframe
                    src={stream.embed_url}
                    title={stream.title}
                    className="h-full w-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse inline-block" />
                        LIVE
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">{stream.platform}</Badge>
                    </div>
                    <h3 className="font-semibold text-foreground">{stream.title}</h3>
                    {stream.channel_name && (
                      <p className="text-xs text-muted-foreground">{stream.channel_name}</p>
                    )}
                  </div>
                  <a href={stream.embed_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">Open in new tab</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="mb-12 rounded-xl border border-dashed border-border p-12 text-center">
          <Radio className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No one is live right now</p>
          <p className="text-sm text-muted-foreground">Check back during scheduled events.</p>
        </div>
      )}

      {/* Upcoming */}
      {scheduledStreams.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-foreground">Upcoming Streams</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scheduledStreams.map((stream) => (
              <div key={stream.id} className="rounded-xl border border-border bg-card p-5">
                <Badge variant="outline" className="mb-2 text-xs capitalize">{stream.platform}</Badge>
                <h3 className="font-semibold text-foreground">{stream.title}</h3>
                {stream.channel_name && (
                  <p className="text-xs text-muted-foreground">{stream.channel_name}</p>
                )}
                {stream.scheduled_at && (
                  <p className="mt-2 text-xs text-primary">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(stream.scheduled_at))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
