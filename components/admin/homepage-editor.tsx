"use client"

import { useState, useTransition } from "react"
import { 
  HomepageSections, 
  SiteInfo, 
  updateHomepageSections, 
  updateSiteInfo 
} from "@/lib/site-settings-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  Megaphone, 
  Sparkles,
  LayoutGrid,
  Calendar,
  Image as ImageIcon,
  MessageSquare,
  ArrowRight,
  Save,
  Loader2,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SECTION_CONFIG = {
  hero: { 
    label: "Hero Section", 
    description: "Main banner with tagline and CTA buttons",
    icon: Sparkles,
  },
  services: { 
    label: "Services", 
    description: "Service cards showing different offerings",
    icon: LayoutGrid,
  },
  upcoming_events: { 
    label: "Upcoming Events", 
    description: "Showcase upcoming events and tournaments",
    icon: Calendar,
  },
  gallery: { 
    label: "Event Gallery", 
    description: "Photo gallery from past events",
    icon: ImageIcon,
  },
  testimonials: { 
    label: "Testimonials", 
    description: "Customer reviews and feedback",
    icon: MessageSquare,
  },
  cta: { 
    label: "Call to Action", 
    description: "Final signup prompt at page bottom",
    icon: ArrowRight,
  },
}

type SectionKey = keyof typeof SECTION_CONFIG

export function HomepageEditor({
  initialSections,
  initialSiteInfo,
}: {
  initialSections: HomepageSections
  initialSiteInfo: SiteInfo
}) {
  const [sections, setSections] = useState(initialSections)
  const [siteInfo, setSiteInfo] = useState(initialSiteInfo)
  const [isPending, startTransition] = useTransition()
  const [hasChanges, setHasChanges] = useState(false)
  const [draggedItem, setDraggedItem] = useState<SectionKey | null>(null)

  // Sort sections by order
  const sortedSections = Object.entries(sections)
    .sort(([, a], [, b]) => a.order - b.order) as [SectionKey, HomepageSections[SectionKey]][]

  function toggleSection(key: SectionKey) {
    setSections(prev => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key].visible }
    }))
    setHasChanges(true)
  }

  function handleDragStart(key: SectionKey) {
    setDraggedItem(key)
  }

  function handleDragOver(e: React.DragEvent, targetKey: SectionKey) {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetKey) return

    const newSections = { ...sections }
    const draggedOrder = newSections[draggedItem].order
    const targetOrder = newSections[targetKey].order

    // Swap orders
    newSections[draggedItem] = { ...newSections[draggedItem], order: targetOrder }
    newSections[targetKey] = { ...newSections[targetKey], order: draggedOrder }

    setSections(newSections)
    setHasChanges(true)
  }

  function handleDragEnd() {
    setDraggedItem(null)
  }

  function handleSiteInfoChange(field: keyof SiteInfo, value: string | boolean | null) {
    setSiteInfo(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  async function saveChanges() {
    startTransition(async () => {
      const [sectionsResult, infoResult] = await Promise.all([
        updateHomepageSections(sections),
        updateSiteInfo(siteInfo),
      ])

      if (sectionsResult.error || infoResult.error) {
        toast.error(sectionsResult.error || infoResult.error)
      } else {
        toast.success("Site settings saved successfully")
        setHasChanges(false)
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Announcement Banner */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <CardTitle>Announcement Banner</CardTitle>
          </div>
          <CardDescription>
            Display a site-wide announcement at the top of the homepage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="announcement-visible">Show Banner</Label>
            <Switch
              id="announcement-visible"
              checked={siteInfo.announcement_visible}
              onCheckedChange={(checked) => handleSiteInfoChange("announcement_visible", checked)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcement-text">Banner Text</Label>
            <Input
              id="announcement-text"
              placeholder="Enter announcement message..."
              value={siteInfo.announcement_banner || ""}
              onChange={(e) => handleSiteInfoChange("announcement_banner", e.target.value || null)}
            />
          </div>
          {siteInfo.announcement_visible && siteInfo.announcement_banner && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              Preview: {siteInfo.announcement_banner}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Homepage Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Homepage Sections</CardTitle>
          <CardDescription>
            Toggle visibility and drag to reorder sections on the homepage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedSections.map(([key, section]) => {
              const config = SECTION_CONFIG[key]
              const Icon = config.icon

              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => handleDragStart(key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border bg-card p-4 transition-all",
                    draggedItem === key && "opacity-50 border-primary",
                    !section.visible && "opacity-60"
                  )}
                >
                  <button 
                    type="button"
                    className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="h-5 w-5" />
                  </button>
                  
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{config.label}</p>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => toggleSection(key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      section.visible
                        ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {section.visible ? (
                      <>
                        <Eye className="h-4 w-4" />
                        Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hidden
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Site Tagline */}
      <Card>
        <CardHeader>
          <CardTitle>Site Tagline</CardTitle>
          <CardDescription>
            The tagline displayed in the hero section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              placeholder="Gaming • Events • Community"
              value={siteInfo.tagline}
              onChange={(e) => handleSiteInfoChange("tagline", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          {hasChanges ? (
            <span className="text-amber-600">You have unsaved changes</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600">
              <Check className="h-4 w-4" />
              All changes saved
            </span>
          )}
        </div>
        <Button 
          onClick={saveChanges} 
          disabled={!hasChanges || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
