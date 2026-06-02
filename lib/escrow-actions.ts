"use server"

import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireStaffAction } from "@/lib/auth/require-staff"
import { getUserPermissions } from "@/lib/authorization"
import type { PrizeDistribution } from "./tournament-financial-actions"

// Soft elevation check — returns true if user is manager+; does NOT redirect.
async function isManagerOrAbove(): Promise<boolean> {
  const permissions = await getUserPermissions()
  if (!permissions) return false
  if (permissions.isPlatformLevel) return true
  const role = permissions.unifiedRole ?? ""
  return [
    "owner", "manager",
    "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MANAGER",
  ].includes(role)
}

// Soft elevation check for organizer+ tier.
async function isOrganizerOrAbove(): Promise<boolean> {
  const permissions = await getUserPermissions()
  if (!permissions) return false
  if (permissions.isPlatformLevel) return true
  const role = permissions.unifiedRole ?? ""
  return [
    "owner", "manager", "organizer",
    "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MANAGER", "TENANT_STAFF",
  ].includes(role)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sponsored Tournament Creation
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateSponsoredTournamentData {
  name: string
  gameId: string
  description?: string
  format: string
  prizePoolCents: number
  entryFeeCents?: number
  minPlayers?: number
  minPlayersAction?: "cancel" | "refund" | "delay" | "reduce_prize"
  maxParticipants?: number
  startDate?: string
  registrationDeadline?: string
  rulesText?: string
  prizeDistributions: PrizeDistribution[]
  sponsorName?: string
  sponsorLogoUrl?: string
  fundingDeadline?: string
}

export async function createSponsoredTournament(data: CreateSponsoredTournamentData) {
  const { supabase, userId } = await requireStaffAction("organizer")

  // Validate prize distributions sum to 100%
  const totalPercentage = data.prizeDistributions.reduce((sum, d) => sum + d.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return { error: "Prize distributions must total 100%" }
  }

  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .insert({
      name: data.name,
      slug,
      game_id: data.gameId,
      description: data.description,
      format: data.format,
      tournament_type: "sponsored",
      entry_fee_cents: data.entryFeeCents ?? 0,
      prize_pool_cents: data.prizePoolCents,
      min_players: data.minPlayers,
      min_players_action: data.minPlayersAction ?? "cancel",
      max_participants: data.maxParticipants,
      start_date: data.startDate,
      registration_deadline: data.registrationDeadline,
      rules_text: data.rulesText,
      sponsor_name: data.sponsorName,
      sponsor_logo_url: data.sponsorLogoUrl,
      escrow_status: "pending",
      platform_fee_percent: 5.00,
      created_by: userId,
      status: "draft",
    })
    .select()
    .single()

  if (tournamentError) return { error: tournamentError.message }

  const { error: escrowError } = await supabase
    .from("escrow_accounts")
    .insert({
      tournament_id: tournament.id,
      funded_by: userId,
      amount_cents: data.prizePoolCents,
      funded_amount_cents: 0,
      status: "pending",
      funding_deadline: data.fundingDeadline,
    })

  if (escrowError) {
    await supabase.from("tournaments").delete().eq("id", tournament.id)
    return { error: escrowError.message }
  }

  const distributions = data.prizeDistributions.map((d) => ({
    tournament_id: tournament.id,
    placement: d.placement,
    percentage: d.percentage,
    fixed_amount_cents: d.fixedAmount,
  }))

  const { error: distError } = await supabase
    .from("prize_distributions")
    .insert(distributions)

  if (distError) {
    console.error("Failed to create prize distributions:", distError)
  }

  await supabase.from("tournament_phases").insert({
    tournament_id: tournament.id,
    name: "Main Bracket",
    phase_type: data.format,
    settings: {},
    sort_order: 0,
  })

  revalidatePath("/esports/tournaments")
  revalidatePath("/dashboard/tournaments")
  return { success: true, tournament }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Escrow Funding
// ═══════════════════════════════════════════════════════════════════════════════

export async function createEscrowFundingCheckout(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, prize_pool_cents, created_by, escrow_status")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }

  // Either the creator or a manager+ can fund the escrow
  const isCreator = tournament.created_by === user.id
  const isStaff = await isManagerOrAbove()

  if (!isCreator && !isStaff) {
    return { error: "Not authorized to fund this tournament" }
  }

  if (tournament.escrow_status === "funded") {
    return { error: "Escrow already funded" }
  }

  const { data: escrow } = await supabase
    .from("escrow_accounts")
    .select("*")
    .eq("tournament_id", tournamentId)
    .single()

  if (!escrow) return { error: "Escrow account not found" }

  const amountToFund = escrow.amount_cents - escrow.funded_amount_cents

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Prize Pool Escrow - ${tournament.name}`,
            description: `Funding the $${(amountToFund / 100).toFixed(2)} prize pool for ${tournament.name}`,
          },
          unit_amount: amountToFund,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "escrow_funding",
      tournament_id: tournamentId,
      escrow_id: escrow.id,
      funded_by: user.id,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tournaments/${tournamentId}?escrow=funded`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tournaments/${tournamentId}?escrow=cancelled`,
  })

  await supabase
    .from("escrow_accounts")
    .update({
      stripe_payment_intent_id: session.payment_intent as string,
      updated_at: new Date().toISOString(),
    })
    .eq("id", escrow.id)

  return { success: true, checkoutUrl: session.url }
}

export async function confirmEscrowFunded(tournamentId: string, paymentIntentId: string) {
  const supabase = await createClient()

  // Verify payment with Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.status !== "succeeded") {
    return { error: "Payment not completed" }
  }

  const { error: escrowError } = await supabase
    .from("escrow_accounts")
    .update({
      status: "funded",
      funded_amount_cents: paymentIntent.amount,
      funded_at: new Date().toISOString(),
      funding_method: "card",
      verification_status: "verified",
    })
    .eq("tournament_id", tournamentId)

  if (escrowError) return { error: escrowError.message }

  const { error: tournamentError } = await supabase
    .from("tournaments")
    .update({
      escrow_status: "funded",
      escrow_funded_at: new Date().toISOString(),
      status: "registration",
    })
    .eq("id", tournamentId)

  if (tournamentError) return { error: tournamentError.message }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("created_by, name")
    .eq("id", tournamentId)
    .single()

  if (tournament) {
    await supabase.from("financial_alerts").insert({
      user_id: tournament.created_by,
      tournament_id: tournamentId,
      alert_type: "escrow_funded",
      severity: "info",
      title: "Prize Pool Funded",
      message: `The $${(paymentIntent.amount / 100).toFixed(2)} prize pool for ${tournament.name} has been successfully funded. The tournament is now open for registration.`,
      action_url: `/dashboard/tournaments/${tournamentId}`,
    })
  }

  revalidatePath(`/esports/tournaments`)
  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// External Funds Verification (for sponsors who fund externally)
// ═══════════════════════════════════════════════════════════════════════════════

export async function submitExternalFundsProof(
  tournamentId: string,
  proofUrl: string,
  notes?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("created_by")
    .eq("id", tournamentId)
    .single()

  if (!tournament || tournament.created_by !== user.id) {
    return { error: "Not authorized" }
  }

  const { error } = await supabase
    .from("escrow_accounts")
    .update({
      funding_method: "external_verified",
      proof_of_funds_url: proofUrl,
      verification_status: "pending_review",
      admin_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq("tournament_id", tournamentId)

  if (error) return { error: error.message }

  await supabase.from("financial_alerts").insert({
    tournament_id: tournamentId,
    alert_type: "escrow_funded",
    severity: "warning",
    title: "External Funds Verification Required",
    message: `Tournament requires manual verification of external prize pool funding.`,
    action_url: `/dashboard/admin/financials?verify=${tournamentId}`,
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function verifyExternalFunds(
  tournamentId: string,
  approved: boolean,
  notes?: string
) {
  const { supabase, userId } = await requireStaffAction("manager")

  if (approved) {
    await supabase
      .from("escrow_accounts")
      .update({
        status: "funded",
        verification_status: "verified",
        verified_by: userId,
        verified_at: new Date().toISOString(),
        admin_notes: notes,
      })
      .eq("tournament_id", tournamentId)

    await supabase
      .from("tournaments")
      .update({
        escrow_status: "funded",
        escrow_funded_at: new Date().toISOString(),
        status: "registration",
      })
      .eq("id", tournamentId)
  } else {
    await supabase
      .from("escrow_accounts")
      .update({
        verification_status: "rejected",
        verified_by: userId,
        verified_at: new Date().toISOString(),
        admin_notes: notes,
      })
      .eq("tournament_id", tournamentId)
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("created_by, name")
    .eq("id", tournamentId)
    .single()

  if (tournament) {
    await supabase.from("financial_alerts").insert({
      user_id: tournament.created_by,
      tournament_id: tournamentId,
      alert_type: approved ? "escrow_funded" : "escrow_deadline",
      severity: approved ? "info" : "error",
      title: approved ? "Funds Verified" : "Funds Verification Rejected",
      message: approved
        ? `Your prize pool for ${tournament.name} has been verified. The tournament is now open for registration.`
        : `Your prize pool verification for ${tournament.name} was rejected. ${notes || "Please contact support."}`,
      action_url: `/dashboard/tournaments/${tournamentId}`,
    })
  }

  revalidatePath(`/dashboard/admin/financials`)
  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prize Distribution & Release
// ═══════════════════════════════════════════════════════════════════════════════

export async function createPrizePayouts(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, prize_pool_cents, escrow_status, status, created_by, platform_fee_percent")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (tournament.status !== "completed") {
    return { error: "Tournament must be completed first" }
  }
  if (tournament.escrow_status !== "funded") {
    return { error: "Escrow not funded" }
  }

  // Tournament organizer (creator) OR manager+ can release payouts
  const isOrganizer = tournament.created_by === user.id
  const isAdmin = await isManagerOrAbove()

  if (!isOrganizer && !isAdmin) {
    return { error: "Not authorized" }
  }

  const { data: distributions } = await supabase
    .from("prize_distributions")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("placement")

  if (!distributions?.length) {
    return { error: "No prize distributions configured" }
  }

  const { data: standings } = await supabase
    .from("tournament_registrations")
    .select("player_id, final_placement")
    .eq("tournament_id", tournamentId)
    .not("final_placement", "is", null)
    .order("final_placement")

  if (!standings?.length) {
    return { error: "No final placements recorded" }
  }

  const { data: escrow } = await supabase
    .from("escrow_accounts")
    .select("id")
    .eq("tournament_id", tournamentId)
    .single()

  const payouts = []
  for (const dist of distributions) {
    const winner = standings.find((s) => s.final_placement === dist.placement)
    if (!winner) continue

    const grossAmount = dist.fixed_amount_cents ?? Math.floor(tournament.prize_pool_cents * dist.percentage / 100)
    const platformFee = Math.floor(grossAmount * (tournament.platform_fee_percent ?? 5) / 100)
    const netAmount = grossAmount - platformFee

    payouts.push({
      tournament_id: tournamentId,
      user_id: winner.player_id,
      escrow_id: escrow?.id,
      placement: dist.placement,
      gross_amount_cents: grossAmount,
      platform_fee_cents: platformFee,
      net_amount_cents: netAmount,
      payout_method: "platform_balance",
      status: "awaiting_details",
    })
  }

  if (!payouts.length) {
    return { error: "No eligible winners found" }
  }

  const { error: insertError } = await supabase
    .from("player_payouts")
    .insert(payouts)

  if (insertError) return { error: insertError.message }

  await supabase
    .from("escrow_accounts")
    .update({ status: "releasing" })
    .eq("tournament_id", tournamentId)

  await supabase
    .from("tournaments")
    .update({ escrow_status: "releasing" })
    .eq("id", tournamentId)

  for (const payout of payouts) {
    await supabase.from("financial_alerts").insert({
      user_id: payout.user_id,
      tournament_id: tournamentId,
      alert_type: "payout_ready",
      severity: "info",
      title: "Prize Winnings Ready!",
      message: `Congratulations! You won $${(payout.net_amount_cents / 100).toFixed(2)} in ${tournament.name}. Select your payout method to receive your winnings.`,
      action_url: `/dashboard/financials/claim?tournament=${tournamentId}`,
    })
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, payoutsCreated: payouts.length }
}

export async function getEscrowStatus(tournamentId: string) {
  const supabase = await createClient()

  const { data: escrow } = await supabase
    .from("escrow_accounts")
    .select("*")
    .eq("tournament_id", tournamentId)
    .single()

  if (!escrow) return null

  const { data: payouts } = await supabase
    .from("player_payouts")
    .select("status, net_amount_cents")
    .eq("tournament_id", tournamentId)

  const pendingPayouts = payouts?.filter((p) => ["pending", "awaiting_details", "processing"].includes(p.status)) ?? []
  const completedPayouts = payouts?.filter((p) => p.status === "completed") ?? []

  return {
    ...escrow,
    pendingPayoutsCount: pendingPayouts.length,
    completedPayoutsCount: completedPayouts.length,
    pendingPayoutsCents: pendingPayouts.reduce((sum, p) => sum + p.net_amount_cents, 0),
    completedPayoutsCents: completedPayouts.reduce((sum, p) => sum + p.net_amount_cents, 0),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Minimum Players Check & Actions
// ═══════════════════════════════════════════════════════════════════════════════

export async function checkMinimumPlayersAndAct(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, min_players, min_players_action, tournament_type, escrow_status, created_by")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }

  // Tournament organizer (creator) OR manager+ can perform this check
  const isOrganizer = tournament.created_by === user.id
  const isAdmin = await isManagerOrAbove()

  if (!isOrganizer && !isAdmin) {
    return { error: "Not authorized" }
  }

  if (!tournament.min_players) {
    return { canStart: true, currentPlayers: 0, minPlayers: 0 }
  }

  const { count } = await supabase
    .from("tournament_registrations")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .in("status", ["registered", "checked_in"])

  const currentPlayers = count ?? 0
  const minMet = currentPlayers >= tournament.min_players

  if (!minMet) {
    return {
      canStart: false,
      currentPlayers,
      minPlayers: tournament.min_players,
      action: tournament.min_players_action,
    }
  }

  return {
    canStart: true,
    currentPlayers,
    minPlayers: tournament.min_players,
  }
}

export async function handleMinimumNotMet(
  tournamentId: string,
  action: "cancel" | "refund" | "delay"
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, tournament_type")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }

  if (action === "cancel" || action === "refund") {
    const { data: registrations } = await supabase
      .from("tournament_registrations")
      .select("id, player_id, payment_status, payment_amount_cents, stripe_payment_intent")
      .eq("tournament_id", tournamentId)
      .eq("payment_status", "paid")

    if (registrations?.length) {
      for (const reg of registrations) {
        if (reg.stripe_payment_intent) {
          try {
            await stripe.refunds.create({
              payment_intent: reg.stripe_payment_intent,
              reason: "requested_by_customer",
            })
          } catch (err) {
            console.error("Refund failed for registration:", reg.id, err)
          }
        }

        await supabase
          .from("tournament_registrations")
          .update({
            payment_status: "refunded",
            status: "dropped",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reg.id)

        await supabase.from("financial_alerts").insert({
          user_id: reg.player_id,
          tournament_id: tournamentId,
          alert_type: "refund_issued",
          severity: "info",
          title: "Tournament Cancelled - Refund Issued",
          message: `${tournament.name} was cancelled due to minimum player requirement not being met. Your entry fee has been refunded.`,
        })
      }
    }

    if (tournament.tournament_type === "sponsored") {
      const { data: escrow } = await supabase
        .from("escrow_accounts")
        .select("stripe_payment_intent_id, funded_amount_cents")
        .eq("tournament_id", tournamentId)
        .single()

      if (escrow?.stripe_payment_intent_id && escrow.funded_amount_cents > 0) {
        try {
          await stripe.refunds.create({
            payment_intent: escrow.stripe_payment_intent_id,
          })
        } catch (err) {
          console.error("Escrow refund failed:", err)
        }
      }

      await supabase
        .from("escrow_accounts")
        .update({ status: "refunded" })
        .eq("tournament_id", tournamentId)
    }

    await supabase
      .from("tournaments")
      .update({
        status: "cancelled",
        escrow_status: tournament.tournament_type === "sponsored" ? "refunded" : null,
      })
      .eq("id", tournamentId)
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  revalidatePath("/esports/tournaments")
  return { success: true }
}
