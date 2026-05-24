import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      legalName,
      addressLine1,
      city,
      state,
      postalCode,
      ssnLastFour,
    } = body

    // Validate required fields
    if (!legalName || !addressLine1 || !city || !state || !postalCode || !ssnLastFour) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Validate SSN format (last 4 digits)
    if (!/^\d{4}$/.test(ssnLastFour)) {
      return NextResponse.json(
        { error: "Invalid SSN format" },
        { status: 400 }
      )
    }

    const currentYear = new Date().getFullYear()

    // Check if user already has a W9 for this year
    const { data: existingForm } = await supabase
      .from("tax_forms")
      .select("id")
      .eq("user_id", user.id)
      .eq("tax_year", currentYear)
      .eq("form_type", "w9")
      .single()

    if (existingForm) {
      // Update existing form
      const { error } = await supabase
        .from("tax_forms")
        .update({
          legal_name: legalName,
          address_line1: addressLine1,
          city,
          state,
          postal_code: postalCode,
          ssn_last_four: ssnLastFour,
          signature_date: new Date().toISOString().split("T")[0],
          certification_accepted: true,
          status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingForm.id)

      if (error) throw error
    } else {
      // Insert new form
      const { error } = await supabase
        .from("tax_forms")
        .insert({
          user_id: user.id,
          form_type: "w9",
          tax_year: currentYear,
          legal_name: legalName,
          address_line1: addressLine1,
          city,
          state,
          postal_code: postalCode,
          country: "US",
          ssn_last_four: ssnLastFour,
          signature_date: new Date().toISOString().split("T")[0],
          certification_accepted: true,
          status: "submitted",
        })

      if (error) throw error
    }

    // Update profile tax form status
    await supabase
      .from("profiles")
      .update({
        tax_form_status: "submitted",
        ssn_last_four: ssnLastFour,
      })
      .eq("id", user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("W9 submission error:", error)
    return NextResponse.json(
      { error: "Failed to submit W9" },
      { status: 500 }
    )
  }
}
