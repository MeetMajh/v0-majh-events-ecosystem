import Link from "next/link"

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
        <span className="font-mono text-sm font-bold text-primary-foreground">M</span>
      </div>
      <span className="text-lg font-bold tracking-tight text-foreground">
        MAJH <span className="text-primary">EVENTS</span>
      </span>
    </Link>
  )
}
