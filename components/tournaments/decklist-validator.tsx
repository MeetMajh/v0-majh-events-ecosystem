"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Format = "standard" | "modern" | "legacy" | "vintage" | "pioneer" | "pauper" | "commander" | "brawl" | "historic" | "alchemy"

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  cards: {
    entry: { quantity: number; cardName: string; isSideboard?: boolean }
    card: { name: string; type_line: string; mana_cost?: string; image_uris?: { small: string } } | null
    issues: string[]
  }[]
  stats: {
    totalCards: number
    mainboardCount: number
    sideboardCount: number
    uniqueCards: number
  }
}

const FORMAT_OPTIONS: { value: Format; label: string; minMain: number; maxSide: number }[] = [
  { value: "standard", label: "Standard", minMain: 60, maxSide: 15 },
  { value: "modern", label: "Modern", minMain: 60, maxSide: 15 },
  { value: "pioneer", label: "Pioneer", minMain: 60, maxSide: 15 },
  { value: "legacy", label: "Legacy", minMain: 60, maxSide: 15 },
  { value: "vintage", label: "Vintage", minMain: 60, maxSide: 15 },
  { value: "pauper", label: "Pauper", minMain: 60, maxSide: 15 },
  { value: "commander", label: "Commander", minMain: 100, maxSide: 0 },
  { value: "brawl", label: "Brawl", minMain: 60, maxSide: 0 },
  { value: "historic", label: "Historic", minMain: 60, maxSide: 15 },
  { value: "alchemy", label: "Alchemy", minMain: 60, maxSide: 15 },
]

export function DecklistValidator({
  initialDecklist = "",
  defaultFormat = "standard",
  onValidationComplete,
}: {
  initialDecklist?: string
  defaultFormat?: Format
  onValidationComplete?: (result: ValidationResult) => void
}) {
  const [decklist, setDecklist] = useState(initialDecklist)
  const [format, setFormat] = useState<Format>(defaultFormat)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const validateDecklist = async () => {
    if (!decklist.trim()) return

    startTransition(async () => {
      try {
        const response = await fetch("/api/validate-decklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decklist, format }),
        })

        const data = await response.json()
        setResult(data)
        onValidationComplete?.(data)
      } catch {
        setResult({
          isValid: false,
          errors: ["Failed to validate decklist. Please try again."],
          warnings: [],
          cards: [],
          stats: { totalCards: 0, mainboardCount: 0, sideboardCount: 0, uniqueCards: 0 },
        })
      }
    })
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Decklist Validator
          </CardTitle>
          <CardDescription>
            Paste your decklist below to validate it against Scryfall&apos;s card database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="inline h-3 w-3 mr-1" />
                {FORMAT_OPTIONS.find((f) => f.value === format)?.minMain} card minimum,{" "}
                {FORMAT_OPTIONS.find((f) => f.value === format)?.maxSide} card sideboard max
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Decklist</Label>
            <Textarea
              value={decklist}
              onChange={(e) => setDecklist(e.target.value)}
              placeholder={`Paste your decklist here...

Format:
4 Lightning Bolt
4 Monastery Swiftspear
20 Mountain

Sideboard:
2 Smash to Smithereens`}
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={validateDecklist} disabled={isPending || !decklist.trim()} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Validate Decklist
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className={cn("border-border", result.isValid ? "bg-green-500/5" : "bg-red-500/5")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.isValid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">Decklist is Valid</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-600">Validation Failed</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.stats.totalCards}</p>
                <p className="text-xs text-muted-foreground">Total Cards</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.stats.mainboardCount}</p>
                <p className="text-xs text-muted-foreground">Mainboard</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.stats.sideboardCount}</p>
                <p className="text-xs text-muted-foreground">Sideboard</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.stats.uniqueCards}</p>
                <p className="text-xs text-muted-foreground">Unique Cards</p>
              </div>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Errors ({result.errors.length})
                </h4>
                <ul className="space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i} className="text-sm text-red-600 bg-red-500/10 rounded px-3 py-2">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({result.warnings.length})
                </h4>
                <ul className="space-y-1">
                  {result.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-yellow-600 bg-yellow-500/10 rounded px-3 py-2">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Card List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Card Breakdown</h4>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {result.cards.map((item, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between rounded px-3 py-2 text-sm",
                      item.issues.length > 0 ? "bg-red-500/10" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground w-6">{item.entry.quantity}x</span>
                      <span className={item.card ? "text-foreground" : "text-red-500"}>
                        {item.card?.name || item.entry.cardName}
                      </span>
                      {item.entry.isSideboard && (
                        <Badge variant="outline" className="text-[10px]">
                          SB
                        </Badge>
                      )}
                    </div>
                    {item.issues.length > 0 ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : item.card ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
