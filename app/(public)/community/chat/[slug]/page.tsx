import { notFound } from "next/navigation"
import { getCommunityRoom, getRoomMessages } from "@/lib/community-actions"
import { createClient } from "@/lib/supabase/server"
import { ChatRoom } from "@/components/community/chat-room"

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const room = await getCommunityRoom(slug)
  
  return {
    title: room ? `#${room.name} | MAJH Community` : "Chat Room",
  }
}

export default async function ChatRoomPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const room = await getCommunityRoom(slug)
  
  if (!room) {
    notFound()
  }
  
  const messages = await getRoomMessages(room.id)
  
  // Get current user's profile
  let currentUserProfile = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", user.id)
      .single()
    currentUserProfile = profile
  }

  return (
    <ChatRoom 
      room={room}
      initialMessages={messages}
      currentUser={currentUserProfile}
      isAuthenticated={!!user}
    />
  )
}
