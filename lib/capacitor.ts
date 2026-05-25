// Capacitor utilities for native mobile features
// These work on both web and native platforms

/**
 * Check if running inside a Capacitor native app
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return (window as any).Capacitor?.getPlatform?.() === 'ios'
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  return (window as any).Capacitor?.getPlatform?.() === 'android'
}

/**
 * Check if running on web (not native)
 */
export function isWeb(): boolean {
  if (typeof window === 'undefined') return true
  return (window as any).Capacitor?.getPlatform?.() === 'web' || !isNativePlatform()
}

/**
 * Get the current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'
  return (window as any).Capacitor?.getPlatform?.() || 'web'
}

/**
 * Safe area insets for notched devices
 */
export function getSafeAreaInsets(): {
  top: number
  bottom: number
  left: number
  right: number
} {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }
  
  const style = getComputedStyle(document.documentElement)
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
    left: parseInt(style.getPropertyValue('--sal') || '0', 10),
    right: parseInt(style.getPropertyValue('--sar') || '0', 10),
  }
}

/**
 * Open external URL in system browser (not in-app)
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
    } catch {
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}

/**
 * Share content using native share sheet
 */
export async function shareContent(options: {
  title?: string
  text?: string
  url?: string
}): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share(options)
      return true
    } catch {
      return false
    }
  } else if (navigator.share) {
    try {
      await navigator.share(options)
      return true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Trigger haptic feedback (native only)
 */
export async function hapticFeedback(
  type: 'light' | 'medium' | 'heavy' = 'medium'
): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }
      await Haptics.impact({ style: styleMap[type] })
    } catch {
      // Haptics not available
    }
  }
}

/**
 * Show native toast notification
 */
export async function showToast(message: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Toast } = await import('@capacitor/toast')
      await Toast.show({ text: message, duration: 'short' })
    } catch {
      // Fallback handled by UI
    }
  }
}

/**
 * Request push notification permissions
 */
export async function requestPushPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const result = await PushNotifications.requestPermissions()
      return result.receive
    } catch {
      return 'denied'
    }
  } else if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission as 'granted' | 'denied' | 'prompt'
  }
  return 'denied'
}

/**
 * Get device info
 */
export async function getDeviceInfo(): Promise<{
  platform: string
  model: string
  osVersion: string
  isVirtual: boolean
} | null> {
  if (isNativePlatform()) {
    try {
      const { Device } = await import('@capacitor/device')
      const info = await Device.getInfo()
      return {
        platform: info.platform,
        model: info.model,
        osVersion: info.osVersion,
        isVirtual: info.isVirtual,
      }
    } catch {
      return null
    }
  }
  return null
}
