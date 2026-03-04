import { Logo } from "@/components/logo"
import { UpdatePasswordForm } from "@/components/auth/update-password-form"

export const metadata = { title: "Update Password" }

export default async function UpdatePasswordPage(props: {
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your new password below
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-center text-sm text-destructive">{error}</p>
          </div>
        )}

        <UpdatePasswordForm />
      </div>
    </div>
  )
}
