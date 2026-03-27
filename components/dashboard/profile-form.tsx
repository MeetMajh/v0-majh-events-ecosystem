"use client"

import { useState, useEffect, useCallback } from "react"
import { updateProfile } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface ProfileData {
  first_name: string
  last_name: string
  username: string
  phone: string
  birthday: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  marketing_email_opt_in: boolean
  marketing_sms_opt_in: boolean
}

export function ProfileForm({ profile, email }: { profile: ProfileData; email: string }) {
  const [username, setUsername] = useState(profile.username || "")
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [usernameError, setUsernameError] = useState<string | null>(null)

  const checkUsername = useCallback(async (value: string) => {
    if (!value || value === profile.username) {
      setUsernameStatus("idle")
      setUsernameError(null)
      return
    }

    if (value.length < 3) {
      setUsernameStatus("invalid")
      setUsernameError("Username must be at least 3 characters")
      return
    }

    setUsernameStatus("checking")
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(value)}`)
      const data = await res.json()
      
      if (data.available) {
        setUsernameStatus("available")
        setUsernameError(null)
      } else {
        setUsernameStatus(data.error?.includes("taken") ? "taken" : "invalid")
        setUsernameError(data.error)
      }
    } catch {
      setUsernameStatus("idle")
      setUsernameError("Could not check username")
    }
  }, [profile.username])

  useEffect(() => {
    const timer = setTimeout(() => {
      checkUsername(username)
    }, 500)
    return () => clearTimeout(timer)
  }, [username, checkUsername])

  return (
    <form action={updateProfile} className="max-w-2xl space-y-6">
      {/* Email (read-only) */}
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Contact support to change your email address</p>
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <Input 
            id="username" 
            name="username" 
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="Choose a unique username"
            className={
              usernameStatus === "available" ? "border-green-500 pr-10" :
              usernameStatus === "taken" || usernameStatus === "invalid" ? "border-red-500 pr-10" :
              "pr-10"
            }
            minLength={3}
            maxLength={30}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {usernameStatus === "available" && <CheckCircle className="h-4 w-4 text-green-500" />}
            {(usernameStatus === "taken" || usernameStatus === "invalid") && <XCircle className="h-4 w-4 text-red-500" />}
          </div>
        </div>
        {usernameError ? (
          <p className="text-xs text-red-500">{usernameError}</p>
        ) : usernameStatus === "available" ? (
          <p className="text-xs text-green-500">Username is available!</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Your public display name. Letters, numbers, underscores, and hyphens only. 3-30 characters.
          </p>
        )}
      </div>

      {/* Personal info */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Personal Information</legend>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input id="first_name" name="first_name" defaultValue={profile.first_name} />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input id="last_name" name="last_name" defaultValue={profile.last_name} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={profile.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthday">Birthday</Label>
          <Input id="birthday" name="birthday" type="date" defaultValue={profile.birthday} />
        </div>
      </fieldset>

      {/* Address */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Address</legend>
        <div className="space-y-2">
          <Label htmlFor="address_line1">Address Line 1</Label>
          <Input id="address_line1" name="address_line1" defaultValue={profile.address_line1} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_line2">Address Line 2</Label>
          <Input id="address_line2" name="address_line2" defaultValue={profile.address_line2} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={profile.city} />
          </div>
          <div className="w-24 space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" maxLength={2} defaultValue={profile.state} />
          </div>
          <div className="w-28 space-y-2">
            <Label htmlFor="zip_code">Zip</Label>
            <Input id="zip_code" name="zip_code" defaultValue={profile.zip_code} />
          </div>
        </div>
      </fieldset>

      {/* Marketing */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Communication Preferences</legend>
        <div className="flex items-center gap-2">
          <Checkbox
            id="marketing_email_opt_in"
            name="marketing_email_opt_in"
            defaultChecked={profile.marketing_email_opt_in}
          />
          <Label htmlFor="marketing_email_opt_in" className="text-sm font-normal text-muted-foreground">
            Email updates about events, promotions, and rewards
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="marketing_sms_opt_in"
            name="marketing_sms_opt_in"
            defaultChecked={profile.marketing_sms_opt_in}
          />
          <Label htmlFor="marketing_sms_opt_in" className="text-sm font-normal text-muted-foreground">
            Text notifications for upcoming events and offers
          </Label>
        </div>
      </fieldset>

      <Button type="submit">Save Changes</Button>
    </form>
  )
}
