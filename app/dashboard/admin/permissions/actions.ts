"use server"

import { createClient } from "@/lib/supabase/server"
import { getUserPermissions, getAssignableRoles, hasMinimumRole } from "@/lib/authorization"
import { revalidatePath } from "next/cache"

export async function updateUserRole(
  userId: string,
  newRole: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const permissions = await getUserPermissions()
    
    if (!permissions || !permissions.canManagePermissions) {
      return { success: false, error: "You do not have permission to manage roles" }
    }

    // Prevent self-modification
    if (userId === permissions.userId) {
      return { success: false, error: "You cannot change your own role" }
    }

    // Check if the new role is assignable by this user
    const assignableRoles = getAssignableRoles(permissions.unifiedRole)
    if (!assignableRoles.includes(newRole)) {
      return { success: false, error: "You cannot assign this role level" }
    }

    const supabase = await createClient()

    // Get current user's role to prevent escalation
    const { data: targetStaffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", userId)
      .single()

    // Check if target user has a higher role than current user
    if (targetStaffRole?.role && hasMinimumRole(targetStaffRole.role, permissions.unifiedRole || "user")) {
      // Target has equal or higher role - check if we're platform owner
      if (permissions.unifiedRole !== "PLATFORM_OWNER") {
        return { success: false, error: "You cannot modify users with equal or higher roles" }
      }
    }

    // Determine if this is a staff role (TENANT_*, PLATFORM_*) or profile role (organizer, user)
    const isStaffRole = newRole.startsWith("TENANT_") || newRole.startsWith("PLATFORM_")
    
    if (isStaffRole) {
      // Upsert into staff_roles table
      const { error: staffError } = await supabase
        .from("staff_roles")
        .upsert(
          { user_id: userId, role: newRole },
          { onConflict: "user_id" }
        )

      if (staffError) {
        console.error("Error updating staff role:", staffError)
        return { success: false, error: "Failed to update staff role" }
      }

      // Also update profile role to match
      const profileRole = newRole.includes("OWNER") || newRole.includes("ADMIN") 
        ? "admin" 
        : newRole.includes("MANAGER") 
          ? "staff"
          : "staff"

      await supabase
        .from("profiles")
        .update({ role: profileRole })
        .eq("id", userId)

    } else if (newRole === "organizer") {
      // Remove from staff_roles if exists
      await supabase
        .from("staff_roles")
        .delete()
        .eq("user_id", userId)

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          role: "organizer",
          is_organizer: true 
        })
        .eq("id", userId)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        return { success: false, error: "Failed to update profile" }
      }

    } else if (newRole === "user") {
      // Remove from staff_roles if exists
      await supabase
        .from("staff_roles")
        .delete()
        .eq("user_id", userId)

      // Reset profile to regular user
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          role: "user",
          is_organizer: false 
        })
        .eq("id", userId)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        return { success: false, error: "Failed to update profile" }
      }
    }

    // Log the role change for audit
    await supabase
      .from("audit_logs")
      .insert({
        action: "role_change",
        actor_id: permissions.userId,
        target_id: userId,
        details: {
          new_role: newRole,
          previous_staff_role: targetStaffRole?.role || null,
          changed_by_role: permissions.unifiedRole,
        },
      })
      .catch(() => {
        // Audit log failure should not block the operation
        console.warn("Failed to create audit log for role change")
      })

    revalidatePath("/dashboard/admin/permissions")
    revalidatePath("/dashboard")
    
    return { success: true }

  } catch (error) {
    console.error("Error in updateUserRole:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function grantOrganizerStatus(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const permissions = await getUserPermissions()
    
    if (!permissions || !permissions.canManagePermissions) {
      return { success: false, error: "You do not have permission to grant organizer status" }
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from("profiles")
      .update({ is_organizer: true })
      .eq("id", userId)

    if (error) {
      console.error("Error granting organizer status:", error)
      return { success: false, error: "Failed to grant organizer status" }
    }

    revalidatePath("/dashboard/admin/permissions")
    revalidatePath("/dashboard/admin/organizers")
    
    return { success: true }

  } catch (error) {
    console.error("Error in grantOrganizerStatus:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function revokeOrganizerStatus(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const permissions = await getUserPermissions()
    
    if (!permissions || !permissions.canManagePermissions) {
      return { success: false, error: "You do not have permission to revoke organizer status" }
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from("profiles")
      .update({ is_organizer: false })
      .eq("id", userId)

    if (error) {
      console.error("Error revoking organizer status:", error)
      return { success: false, error: "Failed to revoke organizer status" }
    }

    revalidatePath("/dashboard/admin/permissions")
    revalidatePath("/dashboard/admin/organizers")
    
    return { success: true }

  } catch (error) {
    console.error("Error in revokeOrganizerStatus:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
