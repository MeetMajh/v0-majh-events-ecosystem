import { createClient } from "@/lib/supabase/server"
import { generateProposalPDF } from "@/lib/pdf-utils"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check if user is staff
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["admin", "staff"].includes(staffRole.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch proposal with items and client
  const { data: proposal, error } = await supabase
    .from("cb_proposals")
    .select(`
      *,
      client:cb_clients(contact_name, company_name, email),
      items:cb_proposal_items(*)
    `)
    .eq("id", id)
    .single()

  if (error || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  }

  try {
    const pdfBuffer = await generateProposalPDF(proposal)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${proposal.proposal_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
