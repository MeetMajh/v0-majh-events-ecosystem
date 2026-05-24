"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { createTournament } from "@/lib/esports-actions"
import { createTournamentPhase } from "@/lib/tournament-controller-actions"

interface Game {
  id: string
  name: string
  slug: string
  category: string
}

const FORMATS = [
  { value: "swiss", label: "Swiss", description: "Best for 8-64 players. All players compete in multiple rounds." },
  { value: "single_elimination", label: "Single Elimination", description: "Lose once and you're out. Fast and dramatic." },
  { value: "double_elimination", label: "Double Elimination", description: "Players must lose twice to be eliminated." },
  { value: "round_robin", label: "Round Robin", description: "Every player faces every other player once." },
]

export function CreateTournamentForm({ games, userId }: { games: Game[]; userId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState({
    name: "",
    game_id: "",
    format: "swiss",
    description: "",
    rules_text: "",
    max_participants: "",
    entry_fee: "0",
    prize_description: "",
    start_date: "",
    start_time: "",
    registration_deadline: "",
    check_in_required: true,
    decklist_required: false,
    rounds_count: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.game_id) {
      toast.error("Name and game are required")
      return
    }

    startTransition(async () => {
      const formDataObj = new FormData()
      formDataObj.set("name", formData.name)
      formDataObj.set("game_id", formData.game_id)
      formDataObj.set("format", formData.format)
      formDataObj.set("description", formData.description)
      formDataObj.set("rules_text", formData.rules_text)
      formDataObj.set("prize_description", formData.prize_description)
      formDataObj.set("entry_fee", formData.entry_fee)

      if (formData.max_participants) {
        formDataObj.set("max_participants", formData.max_participants)
      }

      if (formData.start_date) {
        const dateTime = formData.start_time 
          ? `${formData.start_date}T${formData.start_time}:00`
          : `${formData.start_date}T12:00:00`
        formDataObj.set("start_date", dateTime)
      }

      if (formData.registration_deadline) {
        formDataObj.set("registration_deadline", `${formData.registration_deadline}T23:59:59`)
      }

      const result = await createTournament(formDataObj)

      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Tournament created!")
      
      // Redirect to the tournament management page
      if (result.id) {
        router.push(`/dashboard/tournaments/${result.id}`)
      } else {
        router.push("/dashboard/tournaments")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Set up the core details of your tournament
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Weekly Smash Bros Tournament"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="game">Game *</Label>
            <Select
              value={formData.game_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, game_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Tournament Format *</Label>
            <Select
              value={formData.format}
              onValueChange={(value) => setFormData(prev => ({ ...prev, format: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    <div>
                      <span className="font-medium">{format.label}</span>
                      <span className="block text-xs text-muted-foreground">{format.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.format === "swiss" && (
            <div className="space-y-2">
              <Label htmlFor="rounds">Number of Swiss Rounds</Label>
              <Input
                id="rounds"
                type="number"
                min="1"
                max="15"
                placeholder="Auto-calculated based on players"
                value={formData.rounds_count}
                onChange={(e) => setFormData(prev => ({ ...prev, rounds_count: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-calculate based on player count
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell players what this tournament is about..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registration_deadline">Registration Deadline</Label>
            <Input
              id="registration_deadline"
              type="date"
              value={formData.registration_deadline}
              onChange={(e) => setFormData(prev => ({ ...prev, registration_deadline: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Players won't be able to register after this date
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registration & Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max_participants">Maximum Players</Label>
              <Input
                id="max_participants"
                type="number"
                min="2"
                placeholder="Unlimited"
                value={formData.max_participants}
                onChange={(e) => setFormData(prev => ({ ...prev, max_participants: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_fee">Entry Fee ($)</Label>
              <Input
                id="entry_fee"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.entry_fee}
                onChange={(e) => setFormData(prev => ({ ...prev, entry_fee: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="check_in">Require Check-in</Label>
              <p className="text-sm text-muted-foreground">
                Players must check in before the tournament starts
              </p>
            </div>
            <Switch
              id="check_in"
              checked={formData.check_in_required}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, check_in_required: checked }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="decklist">Require Decklist</Label>
              <p className="text-sm text-muted-foreground">
                Players must submit a decklist before playing (for TCG tournaments)
              </p>
            </div>
            <Switch
              id="decklist"
              checked={formData.decklist_required}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, decklist_required: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prizes & Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prize">Prize Description</Label>
            <Textarea
              id="prize"
              placeholder="e.g., 1st: $100, 2nd: $50, 3rd: $25"
              value={formData.prize_description}
              onChange={(e) => setFormData(prev => ({ ...prev, prize_description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rules">Tournament Rules</Label>
            <Textarea
              id="rules"
              placeholder="Specific rules and regulations for this tournament..."
              value={formData.rules_text}
              onChange={(e) => setFormData(prev => ({ ...prev, rules_text: e.target.value }))}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Tournament"}
        </Button>
      </div>
    </form>
  )
}
