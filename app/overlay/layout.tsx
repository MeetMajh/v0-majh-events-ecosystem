import { Inter } from "next/font/google"
import "@/app/globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "MAJH Events Overlay",
  description: "OBS Broadcast Overlay",
}

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Minimal layout with no navigation - just the overlay content
  // Background is transparent for OBS browser source
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-transparent`}>
        {children}
      </body>
    </html>
  )
}
