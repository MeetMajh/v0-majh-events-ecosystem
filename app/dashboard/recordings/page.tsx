'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Video, Trash2, Share2, Eye, Calendar, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface Recording {
  id: string
  title: string
  description: string
  playback_url: string
  duration?: number
  view_count: number
  created_at: string
  mux_playback_id: string
}

export default function RecordingsPage() {
  const supabase = createClient()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadRecordings() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_streams')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ended')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setRecordings(data)
      }
      setIsLoading(false)
    }

    loadRecordings()
  }, [])

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('user_streams')
      .update({ playback_url: null })
      .eq('id', id)

    if (!error) {
      setRecordings(recordings.filter(r => r.id !== id))
      toast.success('Recording deleted')
    } else {
      toast.error('Failed to delete recording')
    }
  }

  const handleShare = (recordingId: string) => {
    const url = `${window.location.origin}/watch/vod/${recordingId}`
    navigator.clipboard.writeText(url)
    toast.success('Recording link copied to clipboard')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p>Loading your recordings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Recordings</h1>
          <p className="text-muted-foreground mt-2">
            Manage all your VODs and past streams in one place
          </p>
        </div>
        <Link href="/live/vods">
          <Button variant="outline">
            Browse All VODs
          </Button>
        </Link>
      </div>

      {recordings.length === 0 ? (
        <Card className="py-12 px-6 text-center">
          <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No recordings yet</p>
          <p className="text-muted-foreground mt-2">
            Your finished streams will appear here as VODs
          </p>
          <Link href="/dashboard/stream">
            <Button className="mt-4">Start a Stream</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <Card key={recording.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div className="aspect-video bg-muted relative group overflow-hidden">
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/watch/vod/${recording.id}`}>
                    <Button size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Watch
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold line-clamp-2">{recording.title}</h3>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(recording.created_at), 'MMM d')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {recording.view_count || 0} views
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleShare(recording.id)}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDelete(recording.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
