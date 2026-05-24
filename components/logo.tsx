import Link from "next/link"
import Image from "next/image"
import { IMAGES } from "@/lib/images"

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src={IMAGES.brand.graphic}
        alt="MAJH EVENTS Logo"
        width={36}
        height={36}
        className="rounded-md h-auto"
      />
      <span className="text-lg font-bold tracking-tight text-foreground">
        MAJH <span className="text-primary">EVENTS</span>
      </span>
    </Link>
  )
}
