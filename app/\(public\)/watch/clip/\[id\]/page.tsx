'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Share2, Eye } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ClipPage({ params }: { params: { id: string } }) {
  const [clip, setClip] = useState<any>(null);
  const [allClips, setAllClips] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewTracked, setViewTracked] = useState(false);
  const viewTrackTimeout = useRef<NodeJS.Timeout>();

  // Track view on page load (debounced to avoid duplicates)
  useEffect(() => {
    if (clip && !viewTracked) {
      // Debounce view tracking
      viewTrackTimeout.current = setTimeout(async () => {
        try {
          await fetch(`/api/clips/${clip.id}/view`, { method: 'POST' });
          setViewTracked(true);
        } catch (error) {
          console.error('[v0] Failed to track view:', error);
        }
      }, 1000);
    }

    return () => {
      if (viewTrackTimeout.current) clearTimeout(viewTrackTimeout.current);
    };
  }, [clip, viewTracked]);

  // Fetch current clip and all clips
  useEffect(() => {
    const fetchClips = async () => {
      try {
        // Fetch current clip
        const { data: currentClip, error: clipError } = await supabase
          .from('player_media')
          .select('*')
          .eq('id', params.id)
          .eq('visibility', 'public')
          .eq('moderation_status', 'approved')
          .single();

        if (clipError || !currentClip) {
          setLoading(false);
          return;
        }

        setClip(currentClip);

        // Fetch all public clips for navigation
        const { data: clips } = await supabase
          .from('player_media')
          .select('id, title, thumbnail, created_at')
          .eq('visibility', 'public')
          .eq('moderation_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50);

        if (clips) {
          setAllClips(clips);
          const index = clips.findIndex((c) => c.id === params.id);
          setCurrentIndex(index >= 0 ? index : 0);
        }

        setLoading(false);
      } catch (error) {
        console.error('[v0] Error fetching clips:', error);
        setLoading(false);
      }
    };

    fetchClips();
  }, [params.id]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevClip = allClips[currentIndex - 1];
      window.location.href = `/watch/clip/${prevClip.id}`;
    }
  };

  const handleNext = () => {
    if (currentIndex < allClips.length - 1) {
      const nextClip = allClips[currentIndex + 1];
      window.location.href = `/watch/clip/${nextClip.id}`;
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/watch/clip/${clip.id}`;
    navigator.clipboard.writeText(url);
    alert('Clip link copied to clipboard!');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading clip...</div>;
  }

  if (!clip) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p>Clip not found</p>
        <Link href="/clips">
          <Button>Back to Clips</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Video Player */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-6">
          {clip.url && (
            <video
              key={clip.id}
              src={clip.url}
              controls
              autoPlay
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Clip Info */}
        <div className="bg-card rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">{clip.title}</h1>
          
          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye size={16} />
              <span>{clip.views || 0} views</span>
            </div>
            <span>
              {new Date(clip.created_at).toLocaleDateString()}
            </span>
            {clip.category && (
              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                {clip.category}
              </span>
            )}
          </div>

          {clip.description && (
            <p className="text-foreground mb-4">{clip.description}</p>
          )}

          <Button
            onClick={copyShareLink}
            variant="outline"
            className="gap-2"
          >
            <Share2 size={16} />
            Copy Share Link
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            variant="outline"
            className="gap-2"
          >
            <ChevronLeft size={16} />
            Previous Clip
          </Button>

          <div className="text-sm text-muted-foreground">
            Clip {currentIndex + 1} of {allClips.length}
          </div>

          <Button
            onClick={handleNext}
            disabled={currentIndex === allClips.length - 1}
            variant="outline"
            className="gap-2"
          >
            Next Clip
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Recommended Clips */}
        <div>
          <h2 className="text-2xl font-bold mb-4">More Clips</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allClips.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/watch/clip/${c.id}`}>
                <div className="bg-card rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition">
                  {c.thumbnail && (
                    <img
                      src={c.thumbnail}
                      alt={c.title}
                      className="w-full aspect-video object-cover"
                    />
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold line-clamp-2">{c.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
