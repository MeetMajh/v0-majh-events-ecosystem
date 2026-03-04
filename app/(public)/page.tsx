import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ServiceCards } from "@/components/landing/service-cards"
import { HeroStats } from "@/components/landing/hero-stats"
import { Gamepad2, ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.07]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-24 text-center md:py-32">
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">The Future of Esports Entertainment</span>
          </div>

          <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Game. Eat. Drink.{" "}
            <span className="text-primary">Celebrate.</span>
          </h1>

          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
            MAJH EVENTS is your all-in-one esports and entertainment platform. Compete in tournaments, grab a drink,
            book a mobile entertainment hub, or rent equipment -- all through one account.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/esports">Explore Esports</Link>
            </Button>
          </div>

          <HeroStats />
        </div>
      </section>

      {/* Services Section */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            One Platform, Endless Experiences
          </h2>
          <p className="mt-3 text-muted-foreground">
            Everything you need for the ultimate entertainment experience
          </p>
        </div>
        <ServiceCards />
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Ready to Level Up?
          </h2>
          <p className="text-muted-foreground">
            Join the MAJH EVENTS community. Create your free account and start earning points with every interaction across our ecosystem.
          </p>
          <Button size="lg" asChild>
            <Link href="/auth/sign-up">
              Create Your Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
