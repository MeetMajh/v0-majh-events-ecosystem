import Link from "next/link"
import { Logo } from "@/components/logo"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { CheckCircle } from "lucide-react"

export const metadata = { title: "Forgot Password" }

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error
  const success = searchParams.success

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {"Enter your email and we'll send you a reset link"}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-center text-sm text-destructive">{error}</p>
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-primary/30 bg-primary/5 p-6">
            <CheckCircle className="h-8 w-8 text-primary" />
            <p className="text-center text-sm text-muted-foreground">
              Check your email for a password reset link.
            </p>
          </div>
        ) : (
          <ForgotPasswordForm />
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-primary transition-colors hover:text-primary/80">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
