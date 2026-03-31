"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check,
  User,
  Mail,
  FileText,
  Users,
  Trophy,
  Gamepad2,
  Bug
} from "lucide-react"
import { toast } from "sonner"

interface DebugData {
  userId: string
  userEmail: string | undefined
  registrationRecords: any[]
  registrationsError: string | null
  participantData: any[]
  tournamentIdsFromMatches: string[]
  tournamentIdsFromParticipants: string[]
  tournamentIds: string[]
  matchCount: number
}

interface DebugPanelProps {
  debugData: DebugData
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copied to clipboard`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  )
}

function DataRow({ 
  icon: Icon, 
  label, 
  value, 
  status,
  copyValue 
}: { 
  icon: React.ElementType
  label: string
  value: string | number
  status?: "success" | "warning" | "error" | "neutral"
  copyValue?: string
}) {
  const statusColors = {
    success: "text-green-500",
    warning: "text-yellow-500",
    error: "text-red-500",
    neutral: "text-muted-foreground"
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-md bg-background/50">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-sm font-medium ${status ? statusColors[status] : "text-foreground"}`}>
            {value}
          </p>
        </div>
      </div>
      {copyValue && <CopyButton value={copyValue} label={label} />}
    </div>
  )
}

function DataSection({ 
  title, 
  count, 
  status,
  data,
  emptyMessage 
}: { 
  title: string
  count: number
  status: "success" | "warning" | "error"
  data: any[]
  emptyMessage: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const jsonData = JSON.stringify(data, null, 2)

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={
              status === "success" ? "border-green-500/50 text-green-500" :
              status === "warning" ? "border-yellow-500/50 text-yellow-500" :
              "border-red-500/50 text-red-500"
            }
          >
            {count}
          </Badge>
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <CopyButton value={jsonData} label={title} />
          )}
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <>Hide <ChevronUp className="h-3 w-3 ml-1" /></>
              ) : (
                <>View <ChevronDown className="h-3 w-3 ml-1" /></>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {count === 0 ? (
        <div className="p-3 text-sm text-red-400 bg-red-500/5">
          {emptyMessage}
        </div>
      ) : isOpen && (
        <div className="p-3 bg-background/50 border-t border-border/50">
          <pre className="text-xs text-muted-foreground overflow-auto max-h-48 font-mono">
            {jsonData}
          </pre>
        </div>
      )}
    </div>
  )
}

export function DebugPanel({ debugData }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasRegistrations = debugData.registrationRecords.length > 0
  const hasParticipants = debugData.participantData.length > 0
  const hasMatches = debugData.matchCount > 0
  const hasTournaments = debugData.tournamentIds.length > 0

  // Determine overall status
  const overallStatus = hasMatches && hasTournaments ? "success" : 
                        hasParticipants || hasRegistrations ? "warning" : "error"

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border-border/50 ${
        overallStatus === "success" ? "bg-green-500/5" :
        overallStatus === "warning" ? "bg-yellow-500/5" :
        "bg-red-500/5"
      }`}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  overallStatus === "success" ? "bg-green-500/10" :
                  overallStatus === "warning" ? "bg-yellow-500/10" :
                  "bg-red-500/10"
                }`}>
                  <Bug className={`h-4 w-4 ${
                    overallStatus === "success" ? "text-green-500" :
                    overallStatus === "warning" ? "text-yellow-500" :
                    "text-red-500"
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium">Debug Info</p>
                  <p className="text-xs text-muted-foreground">
                    {debugData.tournamentIds.length} tournaments, {debugData.matchCount} matches
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={
                  overallStatus === "success" ? "border-green-500/50 text-green-500" :
                  overallStatus === "warning" ? "border-yellow-500/50 text-yellow-500" :
                  "border-red-500/50 text-red-500"
                }>
                  {overallStatus === "success" ? "All Good" :
                   overallStatus === "warning" ? "Partial Data" :
                   "No Data"}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* User Info */}
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User Info</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <DataRow 
                  icon={User}
                  label="User ID"
                  value={debugData.userId.slice(0, 8) + "..."}
                  copyValue={debugData.userId}
                />
                <DataRow 
                  icon={Mail}
                  label="Email"
                  value={debugData.userEmail || "Not set"}
                  copyValue={debugData.userEmail}
                />
              </div>
            </div>

            {/* Data Sources */}
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Sources</p>
              <div className="grid gap-2">
                <DataSection
                  title="Tournament Registrations"
                  count={debugData.registrationRecords.length}
                  status={hasRegistrations ? "success" : "error"}
                  data={debugData.registrationRecords}
                  emptyMessage="No records in tournament_registrations for this user"
                />
                <DataSection
                  title="Tournament Participants"
                  count={debugData.participantData.length}
                  status={hasParticipants ? "success" : "error"}
                  data={debugData.participantData}
                  emptyMessage="No records in tournament_participants for this user"
                />
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</p>
              <div className="grid sm:grid-cols-3 gap-2">
                <DataRow 
                  icon={Trophy}
                  label="Tournaments Found"
                  value={debugData.tournamentIds.length}
                  status={hasTournaments ? "success" : "error"}
                />
                <DataRow 
                  icon={Gamepad2}
                  label="Matches Found"
                  value={debugData.matchCount}
                  status={hasMatches ? "success" : "warning"}
                />
                <DataRow 
                  icon={FileText}
                  label="From Participants"
                  value={debugData.tournamentIdsFromParticipants.length}
                  status={debugData.tournamentIdsFromParticipants.length > 0 ? "success" : "neutral"}
                />
              </div>
            </div>

            {/* Tournament IDs */}
            {debugData.tournamentIds.length > 0 && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tournament IDs</p>
                  <CopyButton 
                    value={debugData.tournamentIds.join("\n")} 
                    label="Tournament IDs" 
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {debugData.tournamentIds.map((id, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-mono">
                      {id.slice(0, 8)}...
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {debugData.registrationsError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-500">{debugData.registrationsError}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
