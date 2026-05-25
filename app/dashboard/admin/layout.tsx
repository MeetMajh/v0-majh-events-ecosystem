import { requireRole } from "@/lib/roles"

export const metadata = { title: "Admin - MAJH EVENTS" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // await requireRole(["owner", "manager", "staff"])  // Temporarily disabled for debugging
  return <>{children}</>
}
