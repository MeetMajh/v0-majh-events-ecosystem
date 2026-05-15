"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, ChevronRight, Share2, Copy, Check } from "lucide-react"

interface StreamSource {
  id: string
  title: string
  description?: string
  platform: string
  embed_url: string
  channel_url?: string
  is_live: boolean
  priority: number
}

export default function WatchStreamPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [stream, setStream] = useState<StreamSource | null>(null)
  const [streams, setStreams] = useState<StreamSource[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStreams()
  }, [params.id])

  async function fetchStreams() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("stream_sources")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })

      if (error) throw error

      const sortedStreams = data || []
      setStreams(sortedStreams)

      const index = sortedStreams.findIndex(s => s.id === params.id)
      const streamIndex = index >= 0 ? index : 0

      setCurrentIndex(streamIndex)
      setStream(sortedStreams[streamIndex] || null)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching streams:", err)
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < streams.length - 1) {
      const nextStream = streams[currentIndex + 1]
      router.push(`/watch/stream/${nextStream.id}`)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevStream = streams[currentIndex - 1]
      router.push(`/watch/stream/${prevStream.id}`)
    }
  }

  const copyShareLink = () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://majhevents.com"}/watch/stream/${params.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!stream) {
    return <div className="flex items-center justify-center min-h-screen">Stream not found</div>
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/live">
            <Button variant="outline" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Live
            </Button>
          </Link>
          <div className="text-sm text-muted-foreground">
            Stream {currentIndex + 1} of {streams.length}
          </div>
        </div>

        {/* Stream Player */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 aspect-video bg-black relative">
            <iframe
              src={stream.embed_url}
              className="w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </CardContent>
        </Card>

        {/* Stream Info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{stream.title}</h1>
            {stream.description && (
              <p className="text-muted-foreground">{stream.description}</p>
            )}
            <div className="flex items-center gap-2 mt-4">
              {stream.is_live && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-sm font-semibold">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
              <span className="text-sm text-muted-foreground capitalize">
                {stream.platform}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={copyShareLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
            {stream.channel_url && (
              <a href={stream.channel_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Watch on {stream.platform}
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Stream
          </Button>

          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">
              Now Playing: {stream.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {currentIndex + 1} / {streams.length}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === streams.length - 1}
            className="gap-2"
          >
            Next Stream
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Stream List */}
        <div className="pt-4">
          <h2 className="text-lg font-semibold mb-4">All Streams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {streams.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => router.push(`/watch/stream/${s.id}`)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  s.id === stream.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium text-sm">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-1 capitalize">
                  {s.is_live ? (
                    <span className="text-red-500 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      Live
                    </span>
                  ) : (
                    s.platform
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
