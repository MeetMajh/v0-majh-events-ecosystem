"use client"

import { updatePassword } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function UpdatePasswordForm() {
  return (
    <form action={updatePassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Minimum 6 characters"
          required
          autoComplete="new-password"
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full">
        Update Password
      </Button>
    </form>
  )
}
