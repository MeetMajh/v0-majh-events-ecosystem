"use client"

import { StudioProvider, useStudio } from "@/components/studio/studio-context"
import { StudioCanvas } from "@/components/studio/studio-canvas"
import { SceneSwitcher } from "@/components/studio/scene-switcher"
import { SourceManager } from "@/components/studio/source-manager"
import { AudioMixer } from "@/components/studio/audio-mixer"
import { StreamControls } from "@/components/studio/stream-controls"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Radio, 
  ArrowLeft, 
  Settings,
  Keyboard,
  HelpCircle,
  ArrowRight,
  Layers,
  MessageSquare,
  Scissors,
  Clock
} from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

function StudioProContent() {
  const { 
    isLive, 
    activeSceneId, 
    previewSceneId, 
    switchToPreview,
    viewerCount 
  } = useStudio()

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="text-neutral-400 hover:text-white">
            <Link href="/dashboard/studio">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Studio
            </Link>
          </Button>
          <div className="h-4 w-px bg-neutral-700" />
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-amber-500" />
            <span className="font-bold text-lg">MAJH Studio Pro</span>
          </div>
          {isLive && (
            <Badge variant="destructive" className="animate-pulse font-bold">
              LIVE
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-800 rounded-full text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>{viewerCount} viewers</span>
            </div>
          )}
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">
                <Keyboard className="h-4 w-4 mr-2" />
                Hotkeys
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800">
              <DialogHeader>
                <DialogTitle>Keyboard Shortcuts</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Select Scene 1-9</span>
                  <kbd className="px-2 py-1 bg-neutral-800 rounded text-xs font-mono">1-9</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Transition to Preview</span>
                  <kbd className="px-2 py-1 bg-neutral-800 rounded text-xs font-mono">Space</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Toggle Mute</span>
                  <kbd className="px-2 py-1 bg-neutral-800 rounded text-xs font-mono">M</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Start/Stop Stream</span>
                  <kbd className="px-2 py-1 bg-neutral-800 rounded text-xs font-mono">Ctrl+Enter</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Quick Cut</span>
                  <kbd className="px-2 py-1 bg-neutral-800 rounded text-xs font-mono">Enter</kbd>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white">
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white">
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Sources & Audio */}
        <aside className="w-72 border-r border-neutral-800 flex flex-col bg-neutral-900/50">
          <Tabs defaultValue="sources" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-neutral-800 bg-transparent h-10 px-2">
              <TabsTrigger value="sources" className="data-[state=active]:bg-neutral-800 text-xs">
                <Layers className="h-3 w-3 mr-1" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="audio" className="data-[state=active]:bg-neutral-800 text-xs">
                Audio
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sources" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <SourceManager />
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="audio" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <AudioMixer />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center - Preview & Program */}
        <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {/* Preview & Program Row */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Preview Panel */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">PREVIEW</span>
                </div>
                {previewSceneId && (
                  <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                    Ready
                  </Badge>
                )}
              </div>
              <div className="flex-1 rounded-lg border-2 border-amber-500/30 overflow-hidden bg-black">
                <StudioCanvas 
                  sceneId={previewSceneId || activeSceneId} 
                  isPreview={true}
                  className="w-full h-full"
                />
              </div>
            </div>
            
            {/* Transition Controls */}
            <div className="flex flex-col items-center justify-center gap-3 w-20">
              <Button
                size="lg"
                className={cn(
                  "w-full h-14 font-bold transition-all",
                  previewSceneId && previewSceneId !== activeSceneId
                    ? "bg-amber-500 hover:bg-amber-600 text-black"
                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                )}
                onClick={switchToPreview}
                disabled={!previewSceneId || previewSceneId === activeSceneId}
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                Transition
              </span>
            </div>

            {/* Program Panel */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    isLive ? "bg-red-500 animate-pulse" : "bg-red-500/50"
                  )} />
                  <span className="text-sm font-semibold text-red-500">
                    PROGRAM {isLive && "(LIVE)"}
                  </span>
                </div>
                {isLive && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    ON AIR
                  </Badge>
                )}
              </div>
              <div className={cn(
                "flex-1 rounded-lg border-2 overflow-hidden bg-black",
                isLive ? "border-red-500" : "border-red-500/30"
              )}>
                <StudioCanvas 
                  sceneId={activeSceneId} 
                  isPreview={false}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-center gap-2 py-2">
            <Button variant="outline" size="sm" className="text-xs border-neutral-700">
              <Scissors className="h-3 w-3 mr-1" />
              Create Clip
            </Button>
            <Button variant="outline" size="sm" className="text-xs border-neutral-700">
              <Clock className="h-3 w-3 mr-1" />
              Instant Replay
            </Button>
            <Button variant="outline" size="sm" className="text-xs border-neutral-700">
              <MessageSquare className="h-3 w-3 mr-1" />
              Show Chat
            </Button>
          </div>
        </main>

        {/* Right Sidebar - Scenes & Stream */}
        <aside className="w-80 border-l border-neutral-800 flex flex-col bg-neutral-900/50">
          <Tabs defaultValue="scenes" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-neutral-800 bg-transparent h-10 px-2">
              <TabsTrigger value="scenes" className="data-[state=active]:bg-neutral-800 text-xs">
                Scenes
              </TabsTrigger>
              <TabsTrigger value="stream" className="data-[state=active]:bg-neutral-800 text-xs">
                Stream
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="scenes" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <SceneSwitcher />
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="stream" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <StreamControls />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  )
}

export default function StudioProPage() {
  return (
    <StudioProvider>
      <StudioProContent />
    </StudioProvider>
  )
}
