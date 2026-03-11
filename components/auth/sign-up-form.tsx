"use client"

import { signUp } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "BB", name: "Barbados" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "GY", name: "Guyana" },
  { code: "BS", name: "Bahamas" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "GD", name: "Grenada" },
  { code: "DM", name: "Dominica" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "MX", name: "Mexico" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "IN", name: "India" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "OTHER", name: "Other" },
]

export function SignUpForm() {
  return (
    <form action={signUp} className="space-y-6">
      {/* Personal info */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Personal Information</legend>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
            <Input id="first_name" name="first_name" placeholder="First name" required />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="last_name">Last Name <span className="text-destructive">*</span></Label>
            <Input id="last_name" name="last_name" placeholder="Last name" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
          <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 123-4567" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthday">Birthday <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input id="birthday" name="birthday" type="date" />
        </div>
      </fieldset>

      {/* Address - Optional */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">
          Address <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select name="country" defaultValue="US">
            <SelectTrigger id="country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          <div className="w-32 space-y-2">
            <Label htmlFor="state">State/Province</Label>
            <Input id="state" name="state" placeholder="State" />
          </div>
          <div className="w-28 space-y-2">
            <Label htmlFor="zip_code">Postal Code</Label>
            <Input id="zip_code" name="zip_code" placeholder="12345" />
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
