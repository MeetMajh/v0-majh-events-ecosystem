"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Play,
  Flame,
  Clock,
  Trophy,
  Gamepad2,
  TrendingUp,
  Loader2,
  Upload,
} from "lucide-react"
import { MediaCard, MediaGrid } from "@/components/media/media-card"
import { MediaUploadForm } from "@/components/media/media-upload-form"
import {
  getTrendingMedia,
  getRecentMedia,
  getFeaturedMedia,
  type PlayerMedia,
} from "@/lib/media-actions"
import { createClient } from "@/lib/supabase/client"

export default function MediaBrowsePage() {
  const [activeTab, setActiveTab] = useState("trending")
  const [trendingMedia, setTrendingMedia] = useState<PlayerMedia[]>([])
  const [recentMedia, setRecentMedia] = useState<PlayerMedia[]>([])
  const [featuredMedia, setFeaturedMedia] = useState<PlayerMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "all">("week")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  // Games for filtering
  const [games, setGames] = useState<{ id: string; name: string }[]>([])
  const [selectedGame, setSelectedGame] = useState<string>("all")
  
  useEffect(() => {
    async function load() {
      setLoading(true)
      
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
      
      // Load games
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, name")
        .order("name")
      setGames(gamesData || [])
      
      // Load media
      const [trending, recent, featured] = await Promise.all([
        getTrendingMedia({ 
          timeframe, 
          limit: 20,
          gameId: selectedGame !== "all" ? selectedGame : undefined 
        }),
        getRecentMedia(20),
        getFeaturedMedia(5),
      ])
      
      setTrendingMedia(trending)
      setRecentMedia(recent)
      setFeaturedMedia(featured)
      setLoading(false)
    }
    load()
  }, [timeframe, selectedGame])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-panel-darker border-b border-border/30">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="badge-featured mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold">
                <Play className="h-4 w-4" />
                MAJH CLIPS
              </div>
              <h1 className="esports-heading text-4xl text-foreground">Media Hub</h1>
              <p className="mt-2 text-muted-foreground">
                Watch clips, highlights, and gameplay from the community
              </p>
            </div>
            
            {isLoggedIn && (
              <MediaUploadForm
                trigger={
                  <Button size="lg">
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Clip
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>
      
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Featured carousel */}
        {featuredMedia.length > 0 && (
          <section className="mb-8 glass-panel rounded-xl p-6 glow-featured">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500 animate-pulse-glow" />
              <h2 className="esports-subheading text-muted-foreground">Featured Clips</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredMedia.slice(0, 3).map((media) => (
                <MediaCard key={media.id} media={media} variant="featured" />
              ))}
            </div>
          </section>
        )}
        
        {/* Main content with tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="bg-background/50 backdrop-blur-sm">
              <TabsTrigger value="trending" className="gap-1.5">
                <Flame className="h-4 w-4" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-1.5">
                <Clock className="h-4 w-4" />
                Recent
              </TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              {/* Game filter */}
              <Select value={selectedGame} onValueChange={setSelectedGame}>
                <SelectTrigger className="w-[150px]">
                  <Gamepad2 className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Games</SelectItem>
                  {games.map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Timeframe filter (only for trending) */}
              {activeTab === "trending" && (
                <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="trending" className="mt-0">
                {trendingMedia.length === 0 ? (
                  <Card className="glass-panel border-0 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-lg font-medium">No trending clips yet</p>
                      <p className="text-sm text-muted-foreground">
                        Be the first to upload a clip!
                      </p>
                      {isLoggedIn && (
                        <MediaUploadForm
                          trigger={
                            <Button className="mt-4">
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Now
                            </Button>
                          }
                        />
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <MediaGrid media={trendingMedia} columns={4} />
                )}
              </TabsContent>
              
              <TabsContent value="recent" className="mt-0">
                {recentMedia.length === 0 ? (
                  <Card className="glass-panel border-0 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Clock className="mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-lg font-medium">No clips yet</p>
                      <p className="text-sm text-muted-foreground">
                        The community is waiting for content!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <MediaGrid media={recentMedia} columns={4} />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
        
        {/* Guidelines */}
        <Card className="glass-panel border-0 mt-8">
          <CardHeader>
            <CardTitle className="esports-subheading text-muted-foreground">Community Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Gamepad2, text: "Gaming/esports content only" },
                { icon: Trophy, text: "Tag your game and tournament" },
                { icon: Flame, text: "No spam or repetitive content" },
                { icon: Play, text: "Respect copyright" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
