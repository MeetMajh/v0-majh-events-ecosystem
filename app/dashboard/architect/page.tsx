import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth/require-admin"
import ArchitectClient from "./architect-client"

export default async function ArchitectPage() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    redirect("/auth/login?next=/dashboard/architect")
  }

  return <ArchitectClient />
}
