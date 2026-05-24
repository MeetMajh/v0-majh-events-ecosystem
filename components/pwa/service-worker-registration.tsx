"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(async (registration) => {
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
          
          // Register for periodic background sync (if supported)
          if ("periodicSync" in registration) {
            try {
              await (registration as any).periodicSync.register("update-content", {
                minInterval: 24 * 60 * 60 * 1000, // Once per day
              })
            } catch {
              // Periodic sync not available or permission denied
            }
          }
          
          // Handle updates - auto-update silently
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New version available - update silently on next reload
                  newWorker.postMessage({ type: "SKIP_WAITING" })
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error("Service worker registration failed:", error)
        })
        
      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_COMPLETE") {
          // Could show a toast notification here
        }
      })
    }
  }, [])

  return null
}
