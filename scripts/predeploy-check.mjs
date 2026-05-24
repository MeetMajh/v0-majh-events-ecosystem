#!/usr/bin/env node

/**
 * Pre-Deployment Integrity Check Script
 * 
 * This script runs the financial integrity check before deployment.
 * If the check fails, the deployment is blocked (exit code 1).
 * 
 * Usage:
 *   node scripts/predeploy-check.mjs
 * 
 * Environment Variables:
 *   PREDEPLOY_CHECK_URL - The URL to run the check against (defaults to production)
 *   PREDEPLOY_API_KEY - Optional API key for authentication
 *   SKIP_PREDEPLOY_CHECK - Set to "true" to skip the check (not recommended)
 */

const PREDEPLOY_CHECK_URL = process.env.PREDEPLOY_CHECK_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/admin/predeploy-check`
  : "http://localhost:3000/api/admin/predeploy-check"

const SKIP_CHECK = process.env.SKIP_PREDEPLOY_CHECK === "true"

async function runPreDeployCheck() {
  console.log("\n========================================")
  console.log("  PRE-DEPLOYMENT INTEGRITY CHECK")
  console.log("========================================\n")

  if (SKIP_CHECK) {
    console.log("WARNING: SKIP_PREDEPLOY_CHECK is set to true")
    console.log("Skipping integrity check - NOT RECOMMENDED FOR PRODUCTION\n")
    process.exit(0)
  }

  console.log(`Checking: ${PREDEPLOY_CHECK_URL}\n`)

  try {
    const headers = {
      "Content-Type": "application/json",
    }

    // Add API key if provided
    if (process.env.PREDEPLOY_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.PREDEPLOY_API_KEY}`
    }

    const response = await fetch(PREDEPLOY_CHECK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        git_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        git_branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.log("DEPLOYMENT BLOCKED")
      console.log("----------------------------------------")
      console.log(`Status: ${response.status}`)
      console.log(`Error: ${data.error || data.message || "Unknown error"}`)
      
      if (data.failures && data.failures.length > 0) {
        console.log("\nFailed Checks:")
        data.failures.forEach((failure, idx) => {
          console.log(`  ${idx + 1}. ${failure.test}: ${failure.error}`)
        })
      }
      
      console.log("\n========================================")
      console.log("  DEPLOYMENT FAILED - FIX ISSUES FIRST")
      console.log("========================================\n")
      
      process.exit(1)
    }

    if (!data.deploy_allowed) {
      console.log("DEPLOYMENT BLOCKED")
      console.log("----------------------------------------")
      console.log(`Message: ${data.message}`)
      console.log(`Tests Run: ${data.tests_run}`)
      console.log(`Tests Failed: ${data.tests_failed}`)
      
      if (data.failures && data.failures.length > 0) {
        console.log("\nFailed Checks:")
        data.failures.forEach((failure, idx) => {
          console.log(`  ${idx + 1}. ${failure.test}: ${failure.error}`)
        })
      }
      
      console.log("\n========================================")
      console.log("  DEPLOYMENT FAILED - FIX ISSUES FIRST")
      console.log("========================================\n")
      
      process.exit(1)
    }

    // Success
    console.log("INTEGRITY CHECK PASSED")
    console.log("----------------------------------------")
    console.log(`Message: ${data.message}`)
    console.log(`Tests Run: ${data.tests_run}`)
    console.log(`Run ID: ${data.run_id}`)
    
    if (data.results && data.results.length > 0) {
      console.log("\nTest Results:")
      data.results.forEach((result) => {
        const status = result.passed ? "PASS" : "FAIL"
        const icon = result.passed ? "[OK]" : "[X]"
        console.log(`  ${icon} ${result.test}: ${status}`)
      })
    }
    
    console.log("\n========================================")
    console.log("  SAFE TO DEPLOY")
    console.log("========================================\n")
    
    process.exit(0)

  } catch (error) {
    console.log("DEPLOYMENT CHECK ERROR")
    console.log("----------------------------------------")
    console.log(`Error: ${error.message}`)
    console.log("\nThis could mean:")
    console.log("  - The server is not running")
    console.log("  - The URL is incorrect")
    console.log("  - Network connectivity issues")
    console.log("\n========================================")
    console.log("  DEPLOYMENT BLOCKED - CHECK FAILED")
    console.log("========================================\n")
    
    process.exit(1)
  }
}

runPreDeployCheck()
