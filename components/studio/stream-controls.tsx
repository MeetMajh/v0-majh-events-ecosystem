"use client"

import { useState } from "react"
import { useStudio } from "./studio-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Radio, 
  Square, 
  Users, 
  Copy, 
  Check,
  Settings,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function StreamControls() {
  const { isLive, streamKey, rtmpUrl, viewerCount, goLive, endStream } = useStudio()
  const [isStarting, setIsStarting] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const handleGoLive = async () => {
    setIsStarting(true)
    try {
      await goLive()
      toast.success("You are now LIVE!")
    } catch (error) {
      toast.error("Failed to start stream")
    } finally {
      setIsStarting(false)
    }
  }

  const handleEndStream = async () => {
    await endStream()
    toast.success("Stream ended")
  }

  const copyToClipboard = async (text: string, type: "key" | "url") => {
    await navigator.clipboard.writeText(text)
    if (type === "key") {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
    toast.success("Copied to clipboard")
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Stream</h3>
      
      {/* Live indicator and controls */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isLive ? "bg-red-500 animate-pulse" : "bg-muted"
            )} />
            <span className={cn(
              "text-sm font-bold",
              isLive ? "text-red-500" : "text-muted-foreground"
            )}>
              {isLive ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          
          {isLive && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{viewerCount}</span>
            </div>
          )}
        </div>

        {isLive ? (
          <Button
            onClick={handleEndStream}
            variant="destructive"
            className="w-full"
          >
            <Square className="h-4 w-4 mr-2" />
            End Stream
          </Button>
        ) : (
          <Button
            onClick={handleGoLive}
            disabled={isStarting}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            <Radio className="h-4 w-4 mr-2" />
            {isStarting ? "Starting..." : "Go Live"}
          </Button>
        )}
      </div>

      {/* Stream settings */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Stream Settings
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stream Configuration</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-xs">RTMP URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={rtmpUrl || "rtmp://live.majhevents.com/live"}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(rtmpUrl || "rtmp://live.majhevents.com/live", "url")}
                >
                  {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Stream Key</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="password"
                  value={streamKey || "Click Go Live to generate"}
                  readOnly
                  className="text-xs font-mono"
                />
                {streamKey && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(streamKey, "key")}
                  >
                    {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Never share your stream key with anyone
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium mb-2">Multistream (Coming Soon)</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-sm">MAJH Platform</span>
                  <span className="text-xs text-green-500">Primary</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50 opacity-50">
                  <span className="text-sm">YouTube Live</span>
                  <span className="text-xs text-muted-foreground">Not configured</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/50 opacity-50">
                  <span className="text-sm">Twitch</span>
                  <span className="text-xs text-muted-foreground">Not configured</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick actions */}
      {isLive && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <ExternalLink className="h-4 w-4 mr-1" />
            Watch
          </Button>
        </div>
      )}
    </div>
  )
}
