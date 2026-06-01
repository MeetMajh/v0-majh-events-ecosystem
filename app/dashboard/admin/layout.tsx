import { requireStaff } from "@/lib/auth/require-staff"

export const metadata = { title: "Admin - MAJH EVENTS" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("staff")
  return <>{children}</>
}
