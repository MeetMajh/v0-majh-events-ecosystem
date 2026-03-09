"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"
import { acceptProposal } from "@/lib/carbardmv-actions"
import { toast } from "sonner"

export function AcceptProposalButton({ proposalId, token }: { proposalId: string; token: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    setLoading(true)

    const result = await acceptProposal(proposalId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Proposal accepted! We'll be in touch shortly.")
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <Button onClick={handleAccept} disabled={loading} size="lg" className="gap-2">
      <CheckCircle className="h-4 w-4" />
      {loading ? "Processing..." : "Accept Proposal"}
    </Button>
  )
}
