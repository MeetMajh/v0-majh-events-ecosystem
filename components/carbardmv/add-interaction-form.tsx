"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addClientInteraction } from "@/lib/carbardmv-actions"
import { Loader2, Mail, Phone, CalendarCheck, MessageSquare } from "lucide-react"

const INTERACTION_TYPES = [
  { value: "email", label: "Email", icon: Mail },
  { value: "call", label: "Phone Call", icon: Phone },
  { value: "meeting", label: "Meeting", icon: CalendarCheck },
  { value: "note", label: "Note", icon: MessageSquare },
]

export function AddInteractionForm({ clientId }: { clientId: string }) {
  const [pending, setPending] = useState(false)
  const [type, setType] = useState("note")
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setPending(true)
    formData.set("client_id", clientId)
    formData.set("type", type)
    const result = await addClientInteraction(formData)
    setPending(false)
    if (result.success) {
      router.refresh()
      // Reset form
      const form = document.getElementById("interaction-form") as HTMLFormElement
      form?.reset()
      setType("note")
    }
  }

  return (
    <form id="interaction-form" action={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        {INTERACTION_TYPES.map((t) => (
          <Button
            key={t.value}
            type="button"
            variant={type === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => setType(t.value)}
            className="gap-1.5"
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Button>
        ))}
      </div>
      <Input name="subject" placeholder="Subject (optional)" className="bg-background" />
      <Textarea name="body" placeholder="Notes or details..." rows={3} className="bg-background" />
      <Button type="submit" disabled={pending} size="sm">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log Interaction
      </Button>
    </form>
  )
}
