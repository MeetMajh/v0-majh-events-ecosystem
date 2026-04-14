/**
 * Financial Integrity Monitor
 * Client-side utility for detecting, reporting, and responding to data integrity failures
 */

import { 
  validateReconciliationData, 
  determineHealthState,
  type IntegrityCheckResult,
  type IntegrityIssue 
} from "./financial-schemas"

type AlertSeverity = "info" | "warning" | "critical" | "emergency"

interface AlertPayload {
  type: string
  severity: AlertSeverity
  source: string
  message: string
  details?: Record<string, unknown>
  triggerLockdown?: boolean
}

// Track if lockdown has been triggered to prevent duplicate calls
let lockdownTriggered = false

/**
 * Report a system alert to the backend
 */
export async function reportSystemAlert(payload: AlertPayload): Promise<{ success: boolean; alertId?: string; error?: string }> {
  try {
    const response = await fetch("/api/admin/system-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[IntegrityMonitor] Failed to report alert:", error)
    return { success: false, error: String(error) }
  }
}

/**
 * Report a data integrity failure
 * Automatically determines severity and whether to trigger lockdown
 */
export async function reportIntegrityFailure(
  source: string,
  message: string,
  issues: IntegrityIssue[],
  autoLockOnCritical: boolean = true
): Promise<{ success: boolean; lockdownTriggered: boolean }> {
  const hasCritical = issues.some(i => i.severity === "critical")
  const severity: AlertSeverity = hasCritical ? "critical" : "warning"
  
  // Build detailed payload
  const details: Record<string, unknown> = {
    issues: issues.map(i => ({
      type: i.type,
      severity: i.severity,
      message: i.message,
      value: i.value,
      affectedEntity: i.affectedEntity,
    })),
    issueCount: issues.length,
    criticalCount: issues.filter(i => i.severity === "critical").length,
    warningCount: issues.filter(i => i.severity === "warning").length,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
  }

  // Determine if we should trigger lockdown
  const shouldLockdown = autoLockOnCritical && hasCritical && !lockdownTriggered

  const result = await reportSystemAlert({
    type: "DATA_INTEGRITY_FAILURE",
    severity: shouldLockdown ? "emergency" : severity,
    source,
    message,
    details,
    triggerLockdown: shouldLockdown,
  })

  if (shouldLockdown && result.success) {
    lockdownTriggered = true
  }

  return {
    success: result.success,
    lockdownTriggered: shouldLockdown && result.success,
  }
}

/**
 * Report validation failure (when Zod schema validation fails)
 */
export async function reportValidationFailure(
  source: string,
  schemaName: string,
  issues: Array<{ path: (string | number)[]; message: string }>,
  rawData?: unknown
): Promise<void> {
  await reportSystemAlert({
    type: "SCHEMA_VALIDATION_FAILURE",
    severity: "critical",
    source,
    message: `${schemaName} validation failed - data structure does not match expected schema`,
    details: {
      schemaName,
      issues,
      rawDataSnapshot: rawData ? JSON.stringify(rawData).slice(0, 1000) : null,
      timestamp: new Date().toISOString(),
    },
    triggerLockdown: false, // Don't auto-lock on validation failures, just report
  })
}

/**
 * Validate and check reconciliation data integrity
 * Returns integrity check result and reports any issues to backend
 */
export async function validateAndCheckIntegrity(
  data: unknown,
  source: string,
  autoLockOnCritical: boolean = false
): Promise<IntegrityCheckResult | null> {
  // First validate the data structure
  const validation = validateReconciliationData(data)
  
  if (!validation.success) {
    // Report validation failure
    await reportValidationFailure(source, "ReconciliationData", validation.issues, data)
    return null
  }

  // Then check for integrity issues
  const integrityResult = determineHealthState(validation.data)
  
  // If there are issues, report them
  if (integrityResult.issues.length > 0) {
    await reportIntegrityFailure(
      source,
      `Financial integrity check found ${integrityResult.issues.length} issue(s)`,
      integrityResult.issues,
      autoLockOnCritical
    )
  }

  return integrityResult
}

/**
 * Report API error that could indicate system issues
 */
export async function reportApiError(
  source: string,
  endpoint: string,
  error: string,
  statusCode?: number
): Promise<void> {
  const severity: AlertSeverity = statusCode === 500 ? "critical" : "warning"
  
  await reportSystemAlert({
    type: "API_ERROR",
    severity,
    source,
    message: `API error on ${endpoint}: ${error}`,
    details: {
      endpoint,
      error,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Check if system is in lockdown mode
 */
export async function checkSystemLockdown(): Promise<{ isLocked: boolean; controls: Record<string, boolean> }> {
  try {
    const response = await fetch("/api/admin/controls")
    const data = await response.json()
    
    if (!data.success) {
      return { isLocked: false, controls: {} }
    }

    const controls: Record<string, boolean> = {}
    let anyDisabled = false
    
    for (const control of data.controls || []) {
      controls[control.control_type] = control.is_enabled
      if (!control.is_enabled && control.control_type.includes("enabled")) {
        anyDisabled = true
      }
    }

    return { isLocked: anyDisabled, controls }
  } catch {
    return { isLocked: false, controls: {} }
  }
}

/**
 * Reset lockdown tracking (for use after admin manually re-enables operations)
 */
export function resetLockdownTracking(): void {
  lockdownTriggered = false
}

/**
 * Get current lockdown state
 */
export function isLockdownTriggered(): boolean {
  return lockdownTriggered
}
