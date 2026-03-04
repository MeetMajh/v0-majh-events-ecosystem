import Link from "next/link"
import { Logo } from "@/components/logo"
import { SignUpForm } from "@/components/auth/sign-up-form"

export const metadata = { title: "Sign Up" }

export default async function SignUpPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Join MAJH EVENTS</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your account and unlock the full ecosystem
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-center text-sm text-destructive">{error}</p>
          </div>
        )}

        <SignUpForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-primary transition-colors hover:text-primary/80">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
