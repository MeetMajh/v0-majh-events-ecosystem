'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react'
import Link from 'next/link'

export default function StreamViewerPage({ params }: { params: { id: string } }) {
  const [stream, setStream] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [allStreams, setAllStreams] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const fetchStreams = async () => {
      // Fetch all stream sources ordered by priority
      const { data: streams } = await supabase
        .from('stream_sources')
        .select('*')
        .order('priority', { ascending: false })
        .order('id')

      if (streams) {
        setAllStreams(streams)
        const index = streams.findIndex(s => s.id === params.id)
        setCurrentIndex(index >= 0 ? index : 0)
        setStream(streams[index >= 0 ? index : 0])
      }
      setLoading(false)
    }

    fetchStreams()
  }, [params.id, supabase])

  const handleNext = () => {
    if (currentIndex < allStreams.length - 1) {
      const nextStream = allStreams[currentIndex + 1]
      setCurrentIndex(currentIndex + 1)
      setStream(nextStream)
      window.history.pushState({}, '', `/watch/stream/${nextStream.id}`)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevStream = allStreams[currentIndex - 1]
      setCurrentIndex(currentIndex - 1)
      setStream(prevStream)
      window.history.pushState({}, '', `/watch/stream/${prevStream.id}`)
    }
  }

  const copyToClipboard = () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/watch/stream/${stream.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">Loading stream...</div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">Stream not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <Link href="/live">
          <Button variant="ghost" className="mb-6">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Live
          </Button>
        </Link>

        <div className="grid grid-cols-3 gap-6">
          {/* Main Stream */}
          <div className="col-span-2">
            {/* Stream Embed/Iframe */}
            <div className="bg-black rounded-lg overflow-hidden mb-6 aspect-video">
              {stream.embed_code ? (
                <div
                  dangerouslySetInnerHTML={{ __html: stream.embed_code }}
                  className="w-full h-full"
                />
              ) : stream.embed_url ? (
                <iframe
                  src={stream.embed_url}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No stream embed available
                </div>
              )}
            </div>

            {/* Stream Info */}
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{stream.title}</h1>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      stream.is_live
                        ? 'bg-red-500/20 text-red-600'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {stream.is_live ? '🔴 LIVE' : 'Offline'}
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {stream.platform || 'Custom Stream'}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <Button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                variant="outline"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Stream {currentIndex + 1} of {allStreams.length}
              </span>
              <Button
                onClick={handleNext}
                disabled={currentIndex === allStreams.length - 1}
                variant="outline"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Sidebar - All Streams */}
          <div className="bg-card border rounded-lg p-4 h-fit">
            <h2 className="font-semibold mb-4">All Streams</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allStreams.map((s, index) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStream(s)
                    setCurrentIndex(index)
                    window.history.pushState({}, '', `/watch/stream/${s.id}`)
                  }}
                  className={`w-full text-left px-4 py-3 rounded border-2 transition ${
                    s.id === stream.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {s.platform || 'Custom'}
                      </p>
                    </div>
                    {s.is_live && (
                      <span className="text-xs font-bold text-red-600">LIVE</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
