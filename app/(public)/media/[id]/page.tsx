"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import {
  Play,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Flag,
  MoreVertical,
  Clock,
  Gamepad2,
  Trophy,
  ChevronRight,
  Send,
  Flame,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  UserPlus,
  UserMinus,
} from "lucide-react"
import {
  getMediaById,
  getMediaReactions,
  getMediaComments,
  addMediaReaction,
  removeMediaReaction,
  addMediaComment,
  trackMediaView,
  reportMedia,
  getPlayerMedia,
  type PlayerMedia,
  type ReactionType,
} from "@/lib/media-actions"
import { followPlayer, unfollowPlayer, isFollowingPlayer } from "@/lib/tournament-controller-actions"
import { MediaCard } from "@/components/media/media-card"
import { createClient } from "@/lib/supabase/client"

export default function MediaWatchPage() {
  const params = useParams()
  const mediaId = params.id as string
  
  const [media, setMedia] = useState<PlayerMedia | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Engagement state
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null)
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  
  // Follow state
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  
  // Related media
  const [relatedMedia, setRelatedMedia] = useState<PlayerMedia[]>([])
  
  // Report dialog
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportDetails, setReportDetails] = useState("")
  const [reportLoading, setReportLoading] = useState(false)
  
  // Load media data
  useEffect(() => {
    async function load() {
      setLoading(true)
      
      // Get current user
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
      
      // Get media
      const mediaData = await getMediaById(mediaId)
      setMedia(mediaData)
      
      if (mediaData) {
        // Track view
        trackMediaView(mediaId)
        
        // Get reactions
        const { counts, userReaction: ur } = await getMediaReactions(mediaId)
        setReactionCounts(counts)
        setUserReaction(ur)
        
        // Get comments
        const commentsData = await getMediaComments(mediaId)
        setComments(commentsData)
        
        // Check if following
        if (user && mediaData.player_id !== user.id) {
          const following = await isFollowingPlayer(mediaData.player_id)
          setIsFollowing(following)
        }
        
        // Get related media from same player
        const related = await getPlayerMedia(mediaData.player_id, { limit: 4 })
        setRelatedMedia(related.filter(m => m.id !== mediaId))
      }
      
      setLoading(false)
    }
    load()
  }, [mediaId])
  
  const handleReaction = async (type: ReactionType) => {
    if (!currentUserId) return
    
    if (userReaction === type) {
      await removeMediaReaction(mediaId, type)
      setUserReaction(null)
      setReactionCounts(prev => ({ ...prev, [type]: Math.max(0, (prev[type] || 0) - 1) }))
    } else {
      if (userReaction) {
        await removeMediaReaction(mediaId, userReaction)
        setReactionCounts(prev => ({ ...prev, [userReaction!]: Math.max(0, (prev[userReaction!] || 0) - 1) }))
      }
      await addMediaReaction(mediaId, type)
      setUserReaction(type)
      setReactionCounts(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }))
    }
  }
  
  const handleComment = async () => {
    if (!currentUserId || !newComment.trim()) return
    
    setSubmittingComment(true)
    const result = await addMediaComment(mediaId, newComment)
    if (result.commentId) {
      const commentsData = await getMediaComments(mediaId)
      setComments(commentsData)
      setNewComment("")
    }
    setSubmittingComment(false)
  }
  
  const handleFollow = async () => {
    if (!media || !currentUserId) return
    
    setFollowLoading(true)
    if (isFollowing) {
      await unfollowPlayer(media.player_id)
      setIsFollowing(false)
    } else {
      await followPlayer(media.player_id)
      setIsFollowing(true)
    }
    setFollowLoading(false)
  }
  
  const handleReport = async () => {
    if (!reportReason) return
    
    setReportLoading(true)
    await reportMedia(mediaId, reportReason, reportDetails)
    setReportLoading(false)
    setReportOpen(false)
    setReportReason("")
    setReportDetails("")
  }
  
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (!media) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <Play className="mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Media Not Found</h1>
        <p className="text-muted-foreground">This content may have been removed or made private</p>
        <Button asChild className="mt-4">
          <Link href="/media">Browse Media</Link>
        </Button>
      </div>
    )
  }
  
  const likeCount = reactionCounts["like"] || 0
  const dislikeCount = reactionCounts["dislike"] || 0

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {media.embed_url ? (
                <iframe
                  src={media.embed_url}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : media.video_url ? (
                <video
                  src={media.video_url}
                  controls
                  className="h-full w-full"
                  poster={media.thumbnail_url || undefined}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Play className="h-16 w-16 text-white/50" />
                </div>
              )}
            </div>
            
            {/* Title & Actions */}
            <div>
              <h1 className="text-2xl font-bold">{media.title}</h1>
              
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {media.view_count} views
                  </span>
                  <span>
                    {new Date(media.created_at).toLocaleDateString()}
                  </span>
                  {media.game && (
                    <Badge variant="secondary" className="gap-1">
                      <Gamepad2 className="h-3 w-3" />
                      {media.game.name}
                    </Badge>
                  )}
                </div>
                
                {/* Reaction buttons */}
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "gap-1.5 rounded-l-full rounded-r-none border-r",
                        userReaction === "like" && "bg-primary/10 text-primary"
                      )}
                      onClick={() => handleReaction("like")}
                      disabled={!currentUserId}
                    >
                      <ThumbsUp className={cn("h-4 w-4", userReaction === "like" && "fill-current")} />
                      {likeCount}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "gap-1.5 rounded-l-none rounded-r-full",
                        userReaction === "dislike" && "bg-primary/10 text-primary"
                      )}
                      onClick={() => handleReaction("dislike")}
                      disabled={!currentUserId}
                    >
                      <ThumbsDown className={cn("h-4 w-4", userReaction === "dislike" && "fill-current")} />
                      {dislikeCount > 0 && dislikeCount}
                    </Button>
                  </div>
                  
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setReportOpen(true)}>
                        <Flag className="mr-2 h-4 w-4" />
                        Report
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            
            {/* Player info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <Link href={`/players/${media.player_id}`} className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={media.player?.avatar_url || undefined} />
                      <AvatarFallback>
                        {media.player?.first_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold hover:text-primary">
                        {media.player?.first_name} {media.player?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">View Profile</p>
                    </div>
                  </Link>
                  
                  {currentUserId && currentUserId !== media.player_id && (
                    <Button
                      variant={isFollowing ? "outline" : "default"}
                      size="sm"
                      onClick={handleFollow}
                      disabled={followLoading}
                    >
                      {followLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isFollowing ? (
                        <UserMinus className="mr-2 h-4 w-4" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      {isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                  )}
                </div>
                
                {media.description && (
                  <>
                    <Separator className="my-4" />
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {media.description}
                    </p>
                  </>
                )}
                
                {/* Context badges */}
                {(media.tournament || media.match_id) && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex flex-wrap gap-2">
                      {media.tournament && (
                        <Link href={`/esports/tournaments/${media.tournament.slug}`}>
                          <Badge variant="outline" className="gap-1 hover:bg-accent">
                            <Trophy className="h-3 w-3" />
                            {media.tournament.name}
                            <ChevronRight className="h-3 w-3" />
                          </Badge>
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {comments.length} Comments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Comment input */}
                {currentUserId ? (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={2}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleComment}
                          disabled={!newComment.trim() || submittingComment}
                        >
                          {submittingComment ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      <Link href="/login" className="text-primary hover:underline">Sign in</Link> to leave a comment
                    </p>
                  </div>
                )}
                
                <Separator />
                
                {/* Comment list */}
                {comments.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No comments yet. Be the first!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={comment.user?.avatar_url} />
                          <AvatarFallback>
                            {comment.user?.first_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.user?.first_name} {comment.user?.last_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1 text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick reactions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Reactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(["fire", "clap", "shocked", "laugh", "pog", "gg"] as ReactionType[]).map((type) => {
                    const icons: Record<string, string> = {
                      fire: "🔥",
                      clap: "👏",
                      shocked: "😱",
                      laugh: "😂",
                      pog: "🎮",
                      gg: "🏆",
                    }
                    return (
                      <Button
                        key={type}
                        variant={userReaction === type ? "default" : "outline"}
                        size="sm"
                        className="gap-1"
                        onClick={() => handleReaction(type)}
                        disabled={!currentUserId}
                      >
                        {icons[type]}
                        {(reactionCounts[type] || 0) > 0 && reactionCounts[type]}
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
            
            {/* More from player */}
            {relatedMedia.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">More from {media.player?.first_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {relatedMedia.slice(0, 4).map((item) => (
                    <MediaCard key={item.id} media={item} variant="compact" showPlayer={false} />
                  ))}
                  <Button asChild variant="ghost" className="w-full">
                    <Link href={`/players/${media.player_id}`}>
                      View all clips
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
            <DialogDescription>
              Help us keep the community safe by reporting content that violates our guidelines
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <RadioGroup value={reportReason} onValueChange={setReportReason}>
              {[
                { value: "spam", label: "Spam or misleading" },
                { value: "not_esports", label: "Not gaming/esports related" },
                { value: "harassment", label: "Harassment or bullying" },
                { value: "hate_speech", label: "Hate speech" },
                { value: "nudity", label: "Nudity or sexual content" },
                { value: "violence", label: "Graphic violence" },
                { value: "copyright", label: "Copyright infringement" },
                { value: "other", label: "Other" },
              ].map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value}>{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
            
            <div className="space-y-2">
              <Label>Additional details (optional)</Label>
              <Textarea
                placeholder="Provide more context..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReport} disabled={!reportReason || reportLoading}>
              {reportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
