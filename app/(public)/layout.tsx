import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MobileNav, MobileNavSpacer } from "@/components/esports/mobile-nav"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileNav />
      <MobileNavSpacer />
    </div>
  )
}
