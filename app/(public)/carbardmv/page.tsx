import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IMAGES } from "@/lib/images"
import { 
  Truck, 
  PartyPopper, 
  UtensilsCrossed, 
  Monitor, 
  ArrowRight, 
  Calendar,
  Users,
  Star,
  MapPin,
  CheckCircle2
} from "lucide-react"

export const metadata = {
  title: "CARBARDMV - Mobile Entertainment Hub | MAJH EVENTS",
  description: "The ultimate mobile entertainment experience. Book events, order catering, and rent premium AV and gaming equipment throughout the DMV area.",
}

const SERVICES = [
  {
    title: "Events",
    description: "Full-service mobile bar and entertainment packages for any occasion. From intimate gatherings to large festivals.",
    href: "/events",
    icon: PartyPopper,
    features: ["Custom packages", "Professional bartenders", "DJ & lighting", "Full setup included"],
    image: IMAGES.events.outdoor,
  },
  {
    title: "Catering",
    description: "Delicious food for your event. BBQ, soul food, appetizers, and more -- crafted by our culinary team.",
    href: "/catering",
    icon: UtensilsCrossed,
    features: ["Full menu options", "Dietary accommodations", "Per-person pricing", "Custom quotes"],
    image: IMAGES.events.barGaming,
  },
  {
    title: "Rentals",
    description: "Premium AV equipment, gaming setups, and event furniture available for daily, weekend, or weekly rental.",
    href: "/rentals",
    icon: Monitor,
    features: ["PA systems", "Gaming consoles", "LED lighting", "Furniture sets"],
    image: IMAGES.events.consoleStation,
  },
]

const STATS = [
  { value: "500+", label: "Events Completed" },
  { value: "50K+", label: "Guests Served" },
  { value: "4.9", label: "Average Rating" },
  { value: "DMV", label: "Service Area" },
]

const TESTIMONIALS = [
  {
    quote: "CARBARDMV made our corporate event unforgettable. Professional service from start to finish.",
    author: "Sarah M.",
    role: "Event Coordinator",
    rating: 5,
  },
  {
    quote: "The mobile bar setup was incredible. Our guests are still talking about it weeks later!",
    author: "Marcus T.",
    role: "Birthday Host",
    rating: 5,
  },
  {
    quote: "Rented their gaming equipment for our son's party. Setup was seamless and the kids loved it.",
    author: "Jennifer L.",
    role: "Parent",
    rating: 5,
  },
]

export default function CarbardmvPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <Image
            src={IMAGES.events.outdoor}
            alt="CARBARDMV mobile entertainment event"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-24 md:py-32">
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 w-fit">
            <Truck className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">Mobile Entertainment Hub</span>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
              CARBARDMV
            </h1>
            <p className="mt-2 text-xl font-medium text-primary md:text-2xl">
              We Bring the Party to You
            </p>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
              The ultimate mobile entertainment experience serving the DC, Maryland, and Virginia area.
              Full-service event packages, premium catering, and equipment rentals -- all under one roof.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/events">
                Book an Event
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/catering">View Catering Menu</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <p className="text-3xl font-bold text-primary md:text-4xl">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-4">Our Services</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Everything You Need for the Perfect Event
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            From intimate gatherings to large-scale festivals, CARBARDMV delivers premium entertainment experiences tailored to your vision.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {SERVICES.map((service) => (
            <Card key={service.title} className="group overflow-hidden border-border bg-card hover:border-primary/30 transition-colors">
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
                    <service.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">{service.title}</span>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <p className="text-muted-foreground mb-4">{service.description}</p>
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full">
                  <Link href={service.href}>
                    Explore {service.title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Simple Booking Process
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-4">
            {[
              { step: "1", title: "Choose Your Package", description: "Select from our curated event packages or build your own custom experience.", icon: PartyPopper },
              { step: "2", title: "Customize Add-Ons", description: "Enhance with extra bartenders, lighting, photo booths, and more.", icon: Star },
              { step: "3", title: "Add Catering", description: "Pick from our delicious menu items to feed your guests in style.", icon: UtensilsCrossed },
              { step: "4", title: "Book with Deposit", description: "Secure your date with a 25% deposit. We handle everything else.", icon: Calendar },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground md:right-auto md:left-1/2 md:-translate-x-1/2">
                  {item.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-4">Testimonials</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            What Our Clients Say
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <Card key={testimonial.author} className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground mb-4 italic">&quot;{testimonial.quote}&quot;</p>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Service Area Section */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <Badge variant="outline" className="mb-4">Service Area</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Serving the DMV Area
              </h2>
              <p className="mt-4 text-muted-foreground">
                We proudly serve Washington DC, Maryland, and Northern Virginia. Our mobile setup means we come to you -- whether it's a backyard party, corporate venue, or outdoor festival space.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Washington DC", "Maryland", "Northern Virginia", "Baltimore", "Annapolis", "Alexandria"].map((area) => (
                  <Badge key={area} variant="secondary" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button size="lg" asChild>
                <Link href="/events">
                  Get a Free Quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground text-center">No obligation, fast response</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.45_0.18_300)_0%,transparent_70%)] opacity-15" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
          <Users className="h-12 w-12 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Ready to Elevate Your Event?
          </h2>
          <p className="text-muted-foreground max-w-lg">
            Let CARBARDMV bring the ultimate entertainment experience to your next gathering. 
            Contact us today for a custom quote.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/events">
                Book Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/rentals">Browse Rentals</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
