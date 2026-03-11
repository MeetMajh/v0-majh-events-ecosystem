import Link from "next/link"
import { MessageSquare, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ChatIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-foreground">
        Welcome to Community Chat
      </h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Select a channel from the sidebar to start chatting with the MAJH community. 
        Discuss games, find groups, and stay up to date with announcements.
      </p>
      <Button asChild>
        <Link href="/community/chat/general">
          Go to General
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
