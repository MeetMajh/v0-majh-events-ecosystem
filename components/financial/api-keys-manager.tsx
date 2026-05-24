"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Key, 
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  AlertTriangle,
  Shield,
  Loader2,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ApiKey {
  id: string
  key_prefix: string
  name: string
  environment: string
  scopes: string[]
  last_used_at: string | null
  created_at: string
}

interface RevokedKey {
  id: string
  key_prefix: string
  name: string
  environment: string
  revoked_at: string
}

interface ApiKeysManagerProps {
  apiKeys: ApiKey[]
  revokedKeys: RevokedKey[]
  tenantId: string
  userRole: string
}

export function ApiKeysManager({ apiKeys, revokedKeys, tenantId, userRole }: ApiKeysManagerProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [newKeyVisible, setNewKeyVisible] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [keyName, setKeyName] = useState("")
  const [environment, setEnvironment] = useState("test")
  const [scopes, setScopes] = useState<string[]>(["read", "write"])

  const canCreateKeys = userRole === "owner" || userRole === "admin"

  const handleCreate = async () => {
    if (!keyName.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName,
          environment,
          scopes,
          tenant_id: tenantId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create API key")
      }

      setNewKey(data.key)
      setNewKeyVisible(true)
      setKeyName("")
      setEnvironment("test")
      setScopes(["read", "write"])
    } catch (error) {
      console.error("Failed to create API key:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!selectedKeyId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/api-keys?id=${selectedKeyId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to revoke API key")
      }

      setRevokeOpen(false)
      setSelectedKeyId(null)
      window.location.reload()
    } catch (error) {
      console.error("Failed to revoke API key:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleScope = (scope: string) => {
    if (scopes.includes(scope)) {
      setScopes(scopes.filter(s => s !== scope))
    } else {
      setScopes([...scopes, scope])
    }
  }

  const liveKeys = apiKeys.filter(k => k.environment === "live")
  const testKeys = apiKeys.filter(k => k.environment === "test")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">Manage API keys for programmatic access</p>
        </div>
        {canCreateKeys && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        )}
      </div>

      {/* New Key Display */}
      {newKey && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10">
          <Key className="h-4 w-4 text-emerald-500" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-emerald-600">Your new API key has been created!</p>
              <p className="text-sm text-muted-foreground">
                Make sure to copy it now. You won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-sm border">
                  {newKeyVisible ? newKey : "sk_************************************"}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNewKeyVisible(!newKeyVisible)}
                >
                  {newKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newKey, "new")}
                >
                  {copiedId === "new" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewKey(null)} className="mt-2">
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Production Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Production Keys</CardTitle>
            <Badge className="bg-emerald-500">Live</Badge>
          </div>
          <CardDescription>Use these keys for production API calls</CardDescription>
        </CardHeader>
        <CardContent>
          {liveKeys.length > 0 ? (
            <div className="space-y-3">
              {liveKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Key className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <code>{key.key_prefix}...****</code>
                        <span>|</span>
                        <span>{key.scopes.join(", ")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">
                        {key.last_used_at
                          ? `Used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`
                          : "Never used"}
                      </p>
                    </div>
                    {canCreateKeys && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedKeyId(key.id)
                          setRevokeOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No production keys created yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Test Keys</CardTitle>
            <Badge variant="secondary">Test</Badge>
          </div>
          <CardDescription>Use these keys for development and testing</CardDescription>
        </CardHeader>
        <CardContent>
          {testKeys.length > 0 ? (
            <div className="space-y-3">
              {testKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <code>{key.key_prefix}...****</code>
                        <span>|</span>
                        <span>{key.scopes.join(", ")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">
                        {key.last_used_at
                          ? `Used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`
                          : "Never used"}
                      </p>
                    </div>
                    {canCreateKeys && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedKeyId(key.id)
                          setRevokeOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <Key className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No test keys created yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoked Keys History */}
      {revokedKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revoked Keys</CardTitle>
            <CardDescription>Recently revoked API keys</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {revokedKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border border-dashed p-3 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{key.name}</span>
                    <code className="text-xs text-muted-foreground">{key.key_prefix}...</code>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Revoked {format(new Date(key.revoked_at), "MMM d, yyyy")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for programmatic access
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production Server, Mobile App"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="live">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="read"
                    checked={scopes.includes("read")}
                    onCheckedChange={() => toggleScope("read")}
                  />
                  <label htmlFor="read" className="text-sm">
                    Read - View data (wallets, transactions, events)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="write"
                    checked={scopes.includes("write")}
                    onCheckedChange={() => toggleScope("write")}
                  />
                  <label htmlFor="write" className="text-sm">
                    Write - Create and modify data
                  </label>
                </div>
              </div>
            </div>

            {environment === "live" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Production keys have access to real financial data. Keep them secure.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!keyName.trim() || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? Any applications using this key will
              immediately lose access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Key"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
