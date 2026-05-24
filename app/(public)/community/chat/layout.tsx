import { getCommunityRooms } from "@/lib/community-actions"
import { createClient } from "@/lib/supabase/server"
import { ChatSidebar } from "@/components/community/chat-sidebar"

export const metadata = {
  title: "Community Chat | MAJH EVENTS",
  description: "Real-time chat rooms for the MAJH community",
}

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const rooms = await getCommunityRooms()

  // Group rooms by category
  const roomsByCategory = rooms.reduce((acc, room) => {
    const category = room.category || "general"
    if (!acc[category]) acc[category] = []
    acc[category].push(room)
    return acc
  }, {} as Record<string, typeof rooms>)

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <ChatSidebar 
        roomsByCategory={roomsByCategory} 
        isAuthenticated={!!user}
      />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
