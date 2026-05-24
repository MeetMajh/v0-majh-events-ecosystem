'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Share2, Copy, Check } from 'lucide-react'
import Link from 'next/link'

export default function ClipViewerPage({ params }: { params: { id: string } }) {
  const [clip, setClip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [allClips, setAllClips] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const fetchClips = async () => {
      // Fetch all public clips
      const { data: clips } = await supabase
        .from('player_media')
        .select('*')
        .eq('visibility', 'public')
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })

      if (clips) {
        setAllClips(clips)
        const index = clips.findIndex(c => c.id === params.id)
        setCurrentIndex(index >= 0 ? index : 0)
        
        // Fetch current clip
        const currentClip = clips[index >= 0 ? index : 0]
        setClip(currentClip)
        
        // Track view with debounce
        if (currentClip) {
          setTimeout(() => {
            fetch(`/api/clips/${currentClip.id}/view`, { method: 'POST' })
          }, 1000)
        }
      }
      setLoading(false)
    }

    fetchClips()
  }, [params.id, supabase])

  const handleNext = () => {
    if (currentIndex < allClips.length - 1) {
      const nextClip = allClips[currentIndex + 1]
      setCurrentIndex(currentIndex + 1)
      setClip(nextClip)
      window.history.pushState({}, '', `/watch/clip/${nextClip.id}`)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevClip = allClips[currentIndex - 1]
      setCurrentIndex(currentIndex - 1)
      setClip(prevClip)
      window.history.pushState({}, '', `/watch/clip/${prevClip.id}`)
    }
  }

  const copyToClipboard = () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/watch/clip/${clip.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">Loading clip...</div>
      </div>
    )
  }

  if (!clip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-muted-foreground">Clip not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <Link href="/clips">
          <Button variant="ghost" className="mb-6">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Clips
          </Button>
        </Link>

        {/* Video Player */}
        <div className="bg-black rounded-lg overflow-hidden mb-6 aspect-video flex items-center justify-center">
          <video
            src={clip.url}
            controls
            className="w-full h-full"
            autoPlay
            onPlay={() => {
              // Track view on play
              fetch(`/api/clips/${clip.id}/view`, { method: 'POST' })
            }}
          />
        </div>

        {/* Clip Info */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{clip.title}</h1>
              {clip.description && (
                <p className="text-muted-foreground mb-4">{clip.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{clip.views || 0} views</span>
                {clip.category && <span>{clip.category}</span>}
                <span>{new Date(clip.created_at).toLocaleDateString()}</span>
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
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            variant="outline"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Clip {currentIndex + 1} of {allClips.length}
          </span>
          <Button
            onClick={handleNext}
            disabled={currentIndex === allClips.length - 1}
            variant="outline"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* All Clips Sidebar */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="font-semibold mb-4">All Clips</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
            {allClips.map((c, index) => (
              <button
                key={c.id}
                onClick={() => {
                  setClip(c)
                  setCurrentIndex(index)
                  window.history.pushState({}, '', `/watch/clip/${c.id}`)
                }}
                className={`relative group rounded overflow-hidden border-2 transition ${
                  c.id === clip.id ? 'border-primary' : 'border-muted hover:border-primary'
                }`}
              >
                {c.url && (
                  <video src={c.url} className="w-full aspect-video object-cover" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{c.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
