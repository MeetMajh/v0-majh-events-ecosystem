import { z } from "zod"

// =============================================================================
// FINANCIAL DATA SCHEMAS
// Runtime validation layer - ensures data integrity between API and UI
// =============================================================================

// ============================================
// CORE FINANCIAL TYPES
// ============================================

export const WalletSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  balance_cents: z.number().int(),
  is_frozen: z.boolean().optional().default(false),
  frozen_at: z.string().nullable().optional(),
  frozen_by: z.string().uuid().nullable().optional(),
  freeze_reason: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.enum(["deposit", "withdrawal", "entry_fee", "prize", "refund", "reversal", "adjustment"]),
  amount_cents: z.number().int(),
  status: z.enum(["pending", "processing", "completed", "failed", "rejected", "voided", "reversed"]),
  description: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  tournament_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const EscrowAccountSchema = z.object({
  id: z.string().uuid(),
  tournament_id: z.string().uuid(),
  funded_amount_cents: z.number().int(),
  status: z.enum(["pending", "funded", "released", "refunded", "disputed"]),
  is_test: z.boolean().optional().default(false),
  environment: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const PayoutSchema = z.object({
  id: z.string().uuid(),
  tournament_id: z.string().uuid(),
  user_id: z.string().uuid(),
  amount_cents: z.number().int(),
  position: z.number().int(),
  status: z.enum(["pending", "paid", "failed"]),
  paid_at: z.string().nullable().optional(),
  transaction_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

// ============================================
// RECONCILIATION SCHEMAS
// ============================================

export const SystemHealthSchema = z.object({
  isHealthy: z.boolean(),
  stripeTotalCents: z.number().int(),
  dbTotalCents: z.number().int(),
  walletsTotalCents: z.number().int(),
  calculatedWalletsTotalCents: z.number().int(),
  stripeDbDelta: z.number().int(),
  walletDelta: z.number().int(),
  missingFromDbCount: z.number().int(),
  walletMismatchCount: z.number().int(),
})

export const DepositReconciliationItemSchema = z.object({
  stripePaymentIntentId: z.string(),
  stripeAmount: z.number().int(),
  dbAmount: z.number().int().nullable(),
  status: z.enum(["matched", "missing_from_db", "amount_mismatch"]),
  createdAt: z.string(),
})

export const WalletMismatchSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().nullable().optional(),
  walletBalance: z.number().int(),
  transactionSum: z.number().int(),
  discrepancy: z.number().int(),
})

export const EscrowSummarySchema = z.object({
  tournamentId: z.string().uuid(),
  tournamentName: z.string(),
  fundedAmount: z.number().int(),
  participantCount: z.number().int(),
  status: z.string(),
  isTestMode: z.boolean(),
  environment: z.string(),
})

export const ReconciliationSummarySchema = z.object({
  totalStripePayments: z.number().int(),
  totalDbRecords: z.number().int(),
  totalWallets: z.number().int(),
  activeEscrows: z.number().int(),
})

export const ReconciliationDataSchema = z.object({
  systemHealth: SystemHealthSchema,
  depositReconciliation: z.array(DepositReconciliationItemSchema),
  walletMismatches: z.array(WalletMismatchSchema),
  escrows: z.array(EscrowSummarySchema),
  summary: ReconciliationSummarySchema,
})

// ============================================
// FINANCIAL HEALTH SCHEMAS
// ============================================

export const FinancialHealthDataSchema = z.object({
  totalWalletBalance: z.number().int(),
  totalDeposits: z.number().int(),
  totalWithdrawals: z.number().int(),
  totalEscrowHeld: z.number().int(),
  totalEscrowTest: z.number().int(),
  pendingPayouts: z.number().int(),
  netPosition: z.number().int(),
  isHealthy: z.boolean(),
  lastUpdated: z.string(),
})

// ============================================
// SYSTEM CONTROL SCHEMAS
// ============================================

export const SystemControlSchema = z.object({
  id: z.string().uuid(),
  control_type: z.string(),
  is_enabled: z.boolean(),
  threshold_value: z.number().int().nullable(),
  triggered_at: z.string().nullable(),
  triggered_by: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const SystemControlsArraySchema = z.array(SystemControlSchema)

// ============================================
// API RESPONSE SCHEMAS
// ============================================

export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  })

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export const ReconciliationApiResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    ...ReconciliationDataSchema.shape,
  }),
  ApiErrorResponseSchema,
])

// ============================================
// VALIDATION HELPERS
// ============================================

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; issues: z.ZodIssue[] }

export function validateReconciliationData(data: unknown): ValidationResult<z.infer<typeof ReconciliationDataSchema>> {
  const result = ReconciliationDataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: "Reconciliation data validation failed",
    issues: result.error.issues,
  }
}

export function validateFinancialHealthData(data: unknown): ValidationResult<z.infer<typeof FinancialHealthDataSchema>> {
  const result = FinancialHealthDataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: "Financial health data validation failed",
    issues: result.error.issues,
  }
}

export function validateSystemControls(data: unknown): ValidationResult<z.infer<typeof SystemControlsArraySchema>> {
  const result = SystemControlsArraySchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: "System controls data validation failed",
    issues: result.error.issues,
  }
}

// ============================================
// INTEGRITY CHECK TYPES
// ============================================

export type FinancialHealthState = "healthy" | "warning" | "critical"

export interface IntegrityCheckResult {
  state: FinancialHealthState
  issues: IntegrityIssue[]
  timestamp: string
  canProceed: boolean
}

export interface IntegrityIssue {
  severity: "warning" | "critical"
  type: string
  message: string
  affectedEntity?: string
  value?: number
}

export function determineHealthState(data: z.infer<typeof ReconciliationDataSchema>): IntegrityCheckResult {
  const issues: IntegrityIssue[] = []
  const timestamp = new Date().toISOString()

  // Check for wallet mismatches
  if (data.walletMismatches.length > 0) {
    const totalDiscrepancy = data.walletMismatches.reduce((sum, w) => sum + Math.abs(w.discrepancy), 0)
    issues.push({
      severity: totalDiscrepancy > 10000 ? "critical" : "warning", // > $100 is critical
      type: "WALLET_MISMATCH",
      message: `${data.walletMismatches.length} wallet(s) with balance discrepancy`,
      value: totalDiscrepancy,
    })
  }

  // Check for missing deposits in DB
  const missingDeposits = data.depositReconciliation.filter(d => d.status === "missing_from_db")
  if (missingDeposits.length > 0) {
    const totalMissing = missingDeposits.reduce((sum, d) => sum + d.stripeAmount, 0)
    issues.push({
      severity: "critical",
      type: "MISSING_DEPOSITS",
      message: `${missingDeposits.length} Stripe payment(s) missing from database`,
      value: totalMissing,
    })
  }

  // Check for amount mismatches
  const amountMismatches = data.depositReconciliation.filter(d => d.status === "amount_mismatch")
  if (amountMismatches.length > 0) {
    issues.push({
      severity: "critical",
      type: "AMOUNT_MISMATCH",
      message: `${amountMismatches.length} payment(s) with amount mismatch between Stripe and database`,
    })
  }

  // Check Stripe-DB delta
  if (Math.abs(data.systemHealth.stripeDbDelta) > 100) { // > $1 delta
    issues.push({
      severity: Math.abs(data.systemHealth.stripeDbDelta) > 10000 ? "critical" : "warning",
      type: "STRIPE_DB_DELTA",
      message: `Stripe total differs from database by ${(data.systemHealth.stripeDbDelta / 100).toFixed(2)}`,
      value: data.systemHealth.stripeDbDelta,
    })
  }

  // Check wallet delta
  if (Math.abs(data.systemHealth.walletDelta) > 100) { // > $1 delta
    issues.push({
      severity: Math.abs(data.systemHealth.walletDelta) > 10000 ? "critical" : "warning",
      type: "WALLET_DELTA",
      message: `Wallet balances differ from calculated sum by ${(data.systemHealth.walletDelta / 100).toFixed(2)}`,
      value: data.systemHealth.walletDelta,
    })
  }

  // Determine overall state
  const hasCritical = issues.some(i => i.severity === "critical")
  const hasWarning = issues.some(i => i.severity === "warning")

  let state: FinancialHealthState = "healthy"
  if (hasCritical) state = "critical"
  else if (hasWarning) state = "warning"

  return {
    state,
    issues,
    timestamp,
    canProceed: !hasCritical,
  }
}

// Type exports
export type Wallet = z.infer<typeof WalletSchema>
export type Transaction = z.infer<typeof TransactionSchema>
export type EscrowAccount = z.infer<typeof EscrowAccountSchema>
export type Payout = z.infer<typeof PayoutSchema>
export type SystemHealth = z.infer<typeof SystemHealthSchema>
export type ReconciliationData = z.infer<typeof ReconciliationDataSchema>
export type FinancialHealthData = z.infer<typeof FinancialHealthDataSchema>
export type SystemControl = z.infer<typeof SystemControlSchema>
