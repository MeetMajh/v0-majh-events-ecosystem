import Link from "next/link"
import { Logo } from "@/components/logo"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Check Your Email" }

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <Logo className="justify-center" />
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Check your email</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {"We've sent a confirmation link to your email address. Click the link to activate your MAJH EVENTS account and start exploring the ecosystem."}
          </p>
        </div>
        <Button variant="outline" asChild className="w-full">
          <Link href="/auth/login">Back to Login</Link>
        </Button>
      </div>
    </div>
  )
}
