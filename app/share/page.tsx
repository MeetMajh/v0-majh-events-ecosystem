import { redirect } from "next/navigation"

interface SharePageProps {
  searchParams: Promise<{
    title?: string
    text?: string
    url?: string
  }>
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams
  
  // If a URL was shared, try to extract relevant info
  if (params.url) {
    // Check if it's a tournament link
    if (params.url.includes("/esports/") || params.url.includes("tournament")) {
      redirect("/esports")
    }
    // Check if it's an event link
    if (params.url.includes("/events")) {
      redirect("/events")
    }
  }
  
  // Default: redirect to home with the shared content
  redirect("/")
}
