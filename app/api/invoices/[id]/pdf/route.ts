import { createClient } from "@/lib/supabase/server"
import { generateInvoicePDF } from "@/lib/pdf-utils"
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

  // Fetch invoice with items and client
  const { data: invoice, error } = await supabase
    .from("cb_invoices")
    .select(`
      *,
      client:cb_clients(contact_name, company_name, email, address, city, state, zip),
      items:cb_invoice_items(*)
    `)
    .eq("id", id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  try {
    const pdfBuffer = await generateInvoicePDF(invoice)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
