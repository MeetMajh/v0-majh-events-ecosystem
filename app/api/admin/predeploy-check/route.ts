import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  
  // Check admin access
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
    
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // Get deployment check history
  const { data, error } = await supabase.rpc("get_deployment_check_history", {
    p_limit: 20
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ history: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  // Check admin access
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ 
      success: false, 
      deploy_allowed: false,
      error: "Unauthorized" 
    }, { status: 401 })
  }
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()
    
  if (!profile?.is_admin) {
    return NextResponse.json({ 
      success: false, 
      deploy_allowed: false,
      error: "Admin access required" 
    }, { status: 403 })
  }

  // Parse optional git info from body
  let gitSha: string | null = null
  let gitBranch: string | null = null
  
  try {
    const body = await request.json()
    gitSha = body.git_sha || null
    gitBranch = body.git_branch || null
  } catch {
    // No body provided, that's fine
  }

  // Run the pre-deployment integrity check
  const { data, error } = await supabase.rpc("run_predeployment_integrity_check", {
    p_admin_id: user.id,
    p_git_sha: gitSha,
    p_git_branch: gitBranch
  })

  if (error) {
    return NextResponse.json({ 
      success: false, 
      deploy_allowed: false,
      error: error.message 
    }, { status: 500 })
  }

  // Return result with explicit deploy_allowed flag
  const result = data as {
    success: boolean
    run_id: string
    tests_run: number
    tests_failed: number
    failures?: unknown[]
    results?: unknown[]
    deploy_allowed: boolean
    message: string
  }

  if (!result.success) {
    return NextResponse.json({
      success: false,
      deploy_allowed: false,
      run_id: result.run_id,
      tests_run: result.tests_run,
      tests_failed: result.tests_failed,
      failures: result.failures,
      results: result.results,
      message: result.message
    }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    deploy_allowed: true,
    run_id: result.run_id,
    tests_run: result.tests_run,
    tests_failed: 0,
    results: result.results,
    message: result.message
  })
}
