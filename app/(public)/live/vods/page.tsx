'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { VODLibrary } from '@/components/streaming/vod-library'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Search, Filter, Download, Share2, Eye, Calendar, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface VOD {
  id: string
  title: string
  description?: string
  started_at?: string
  ended_at?: string
  duration_seconds?: number
  status: string
  mux_playback_id?: string
  playback_url?: string
  total_views: number
  is_public: boolean
  user?: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string
  }
}

export default function VODsPage() {
  const [vods, setVods] = useState<VOD[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('recent')

  useEffect(() => {
    fetchVODs()
  }, [])

  const fetchVODs = async () => {
    try {
      const supabase = await createClient()
      
      const { data, error } = await supabase
        .from('user_streams')
        .select('*')
        .eq('status', 'ended')
        .eq('is_public', true)
        .not('mux_playback_id', 'is', null)
        .order('ended_at', { ascending: false })

      if (error) throw error
      setVods(data || [])
    } catch (error) {
      console.error('[v0] Error fetching VODs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredVODs = vods.filter(vod =>
    vod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vod.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedVODs = [...filteredVODs].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.ended_at || '').getTime() - new Date(a.ended_at || '').getTime()
      case 'popular':
        return (b.total_views || 0) - (a.total_views || 0)
      case 'longest':
        return (b.duration_seconds || 0) - (a.duration_seconds || 0)
      default:
        return 0
    }
  })

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatViewCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/live" className="p-2 hover:bg-accent rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">VOD Library</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredVODs.length} {filteredVODs.length === 1 ? 'recording' : 'recordings'} available
              </p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search VODs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'recent' ? 'default' : 'outline'}
                onClick={() => setSortBy('recent')}
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Recent
              </Button>
              <Button
                variant={sortBy === 'popular' ? 'default' : 'outline'}
                onClick={() => setSortBy('popular')}
                size="sm"
              >
                <Eye className="h-4 w-4 mr-2" />
                Popular
              </Button>
              <Button
                variant={sortBy === 'longest' ? 'default' : 'outline'}
                onClick={() => setSortBy('longest')}
                size="sm"
              >
                <Clock className="h-4 w-4 mr-2" />
                Longest
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-video rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : sortedVODs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border">
            <Film className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No VODs match your search' : 'No VODs available yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedVODs.map((vod) => (
              <Link key={vod.id} href={`/watch/vod/${vod.id}`}>
                <Card className="overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all group cursor-pointer h-full">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-card relative overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Play className="h-12 w-12 text-primary/30 group-hover:text-primary/50 transition-colors" />
                    </div>
                    {/* Duration Badge */}
                    <Badge className="absolute bottom-2 right-2 bg-black/80 text-white border-0">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDuration(vod.duration_seconds)}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {vod.title}
                      </h3>
                      {vod.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {vod.description}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatViewCount(vod.total_views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(vod.ended_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.preventDefault()
                          navigator.share?.({
                            title: vod.title,
                            url: `${window.location.origin}/watch/vod/${vod.id}`,
                          })
                        }}
                      >
                        <Share2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Import at top
import { Film, Play } from 'lucide-react'
