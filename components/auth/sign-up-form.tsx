"use client"

import { signUp } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export function SignUpForm() {
  return (
    <form action={signUp} className="space-y-6">
      {/* Personal info */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Personal Information</legend>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input id="first_name" name="first_name" placeholder="First name" required />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input id="last_name" name="last_name" placeholder="Last name" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" type="tel" placeholder="(555) 123-4567" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthday">Birthday</Label>
          <Input id="birthday" name="birthday" type="date" />
        </div>
      </fieldset>

      {/* Address */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Address</legend>
        <div className="space-y-2">
          <Label htmlFor="address_line1">Address Line 1</Label>
          <Input id="address_line1" name="address_line1" placeholder="123 Main St" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_line2">Address Line 2</Label>
          <Input id="address_line2" name="address_line2" placeholder="Apt, suite, etc." />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" placeholder="City" />
          </div>
          <div className="w-24 space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" placeholder="MD" maxLength={2} />
          </div>
          <div className="w-28 space-y-2">
            <Label htmlFor="zip_code">Zip</Label>
            <Input id="zip_code" name="zip_code" placeholder="20001" />
          </div>
        </div>
      </fieldset>

      {/* Account credentials */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Account Credentials</legend>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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
      </fieldset>

      {/* Marketing opt-ins */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Stay Connected</legend>
        <div className="flex items-center gap-2">
          <Checkbox id="marketing_email_opt_in" name="marketing_email_opt_in" />
          <Label htmlFor="marketing_email_opt_in" className="text-sm font-normal text-muted-foreground">
            Send me email updates about events, promotions, and rewards
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="marketing_sms_opt_in" name="marketing_sms_opt_in" />
          <Label htmlFor="marketing_sms_opt_in" className="text-sm font-normal text-muted-foreground">
            Send me text notifications for upcoming events and offers
          </Label>
        </div>
      </fieldset>

      <Button type="submit" className="w-full">
        Create Account
      </Button>
    </form>
  )
}
