import { createClient } from "@/lib/supabase/server"
import { getUserPermissions } from "@/lib/authorization"
import { generateInvoicePDF } from "@/lib/pdf-utils"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const permissions = await getUserPermissions()
  const allowedRoles = [
    "owner", "manager", "staff",
    "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MANAGER", "TENANT_STAFF",
  ]
  const isAllowed =
    permissions?.isPlatformLevel ||
    (permissions?.unifiedRole && allowedRoles.includes(permissions.unifiedRole))

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
