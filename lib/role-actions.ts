'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function submitRoleRequest(requestedRole: string, reason: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get current profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Check if there's already a pending request
  const { data: pendingRequest } = await supabase
    .from('role_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (pendingRequest) {
    return { error: 'You already have a pending role request. Please wait for admin review.' }
  }

  // Submit the request
  const { data, error } = await supabase
    .from('role_requests')
    .insert({
      user_id: user.id,
      current_role: profile?.role || null,
      requested_role: requestedRole,
      reason: reason,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data, success: true }
}

export async function getUserRoleRequest(userId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('role_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is expected
    console.error('Error fetching role request:', error)
  }

  return { data }
}

export async function getUserProfile(userId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, first_name, last_name')
    .eq('id', userId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: profile }
}

export async function approveRoleRequest(requestId: string, newRole: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Verify admin privileges
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile || !['admin', 'owner'].includes(adminProfile.role)) {
    return { error: 'You do not have permission to approve role requests' }
  }

  // Get the request
  const { data: request } = await supabase
    .from('role_requests')
    .select('user_id')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: 'Request not found' }
  }

  // Update the request status
  const { error: updateError } = await supabase
    .from('role_requests')
    .update({
      status: 'approved',
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Update the user's profile role
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', request.user_id)

  if (profileError) {
    return { error: profileError.message }
  }

  return { success: true }
}

export async function denyRoleRequest(requestId: string, reason: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Verify admin privileges
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile || !['admin', 'owner'].includes(adminProfile.role)) {
    return { error: 'You do not have permission to deny role requests' }
  }

  // Update the request status
  const { error } = await supabase
    .from('role_requests')
    .update({
      status: 'denied',
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString(),
      review_note: reason,
    })
    .eq('id', requestId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
