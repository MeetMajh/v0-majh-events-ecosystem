import Link from "next/link"
import { Logo } from "@/components/logo"
import { LoginForm } from "@/components/auth/login-form"

export const metadata = { title: "Log In" }

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your MAJH EVENTS account
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-center text-sm text-destructive">{error}</p>
          </div>
        )}

        <LoginForm />

        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="transition-colors hover:text-primary">
            Forgot your password?
          </Link>
          <p>
            {"Don't have an account? "}
            <Link href="/auth/sign-up" className="font-medium text-primary transition-colors hover:text-primary/80">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
