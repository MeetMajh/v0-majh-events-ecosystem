import { redirect } from "next/navigation"

export default async function PlayerRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/esports/players/${id}`)
}
