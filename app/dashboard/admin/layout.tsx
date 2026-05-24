import { requireRole } from "@/lib/roles"

export const metadata = { title: "Admin - MAJH EVENTS" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["owner", "manager", "staff", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_MANAGER", "DEPARTMENT_MANAGER", "DEPARTMENT_STAFF", "PLATFORM_OWNER"])
  return <>{children}</>
}
