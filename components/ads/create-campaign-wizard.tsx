"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { 
  Eye, MousePointerClick, Download, Video, Users, ShoppingBag, 
  ArrowRight, ArrowLeft, Check, Loader2, Target, Layers, FileImage
} from "lucide-react"
import { createCampaign, createAdSet, createAd } from "@/lib/ads-manager-actions"

interface CreateCampaignWizardProps {
  games: Array<{ id: string; name: string; slug: string }>
}

const objectives = [
  { id: "awareness", label: "Awareness", description: "Increase brand awareness", icon: Eye },
  { id: "traffic", label: "Traffic", description: "Drive visitors to your site", icon: MousePointerClick },
  { id: "engagement", label: "Engagement", description: "Get more interactions", icon: Users },
  { id: "video_views", label: "Video Views", description: "Promote your video content", icon: Video },
  { id: "app_installs", label: "App Installs", description: "Drive mobile app downloads", icon: Download },
  { id: "conversions", label: "Conversions", description: "Drive valuable actions", icon: ShoppingBag },
]

const placements = [
  { id: "feed", label: "Feed", description: "Appear in the main content feed" },
  { id: "clips", label: "Clips", description: "Between short-form video clips" },
  { id: "tournament_pages", label: "Tournament Pages", description: "On tournament detail pages" },
  { id: "live_streams", label: "Live Streams", description: "During live tournament streams" },
  { id: "clutch_moments", label: "Clutch Moments", description: "Premium placement on highlight clips" },
]

const steps = [
  { id: "objective", label: "Objective", icon: Target },
  { id: "targeting", label: "Targeting", icon: Users },
  { id: "budget", label: "Budget", icon: Layers },
  { id: "creative", label: "Creative", icon: FileImage },
]

export function CreateCampaignWizard({ games }: CreateCampaignWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)
  
  // Form state
  const [campaignData, setCampaignData] = useState({
    name: "",
    objective: "traffic",
  })
  
  const [adSetData, setAdSetData] = useState({
    name: "",
    optimization_goal: "link_clicks",
    targeting: {
      age_min: 18,
      age_max: 65,
      genders: ["all"],
      games: [] as string[],
      tournament_viewers: false,
      skill_levels: [] as string[],
    },
    placements: ["feed", "clips"],
    bid_amount_cents: 500, // $5 CPM
  })
  
  const [budgetData, setBudgetData] = useState({
    budget_type: "daily" as "daily" | "lifetime",
    budget_cents: 5000, // $50
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  })
  
  const [adData, setAdData] = useState({
    name: "",
    format: "image",
    headline: "",
    primary_text: "",
    description: "",
    call_to_action: "learn_more",
    destination_url: "",
    media_urls: [] as string[],
  })

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    startTransition(async () => {
      // Create campaign
      const campaignResult = await createCampaign({
        name: campaignData.name || "New Campaign",
        objective: campaignData.objective,
        budget_type: budgetData.budget_type,
        budget_cents: budgetData.budget_cents,
        start_date: budgetData.start_date,
        end_date: budgetData.end_date || undefined,
      })

      if (campaignResult.error || !campaignResult.campaign) {
        console.error("Failed to create campaign:", campaignResult.error)
        return
      }

      // Create ad set
      const adSetResult = await createAdSet({
        campaign_id: campaignResult.campaign.id,
        name: adSetData.name || `${campaignData.name} - Ad Set`,
        optimization_goal: adSetData.optimization_goal,
        targeting: adSetData.targeting,
        placements: adSetData.placements,
        bid_amount_cents: adSetData.bid_amount_cents,
      })

      if (adSetResult.error || !adSetResult.adSet) {
        console.error("Failed to create ad set:", adSetResult.error)
        return
      }

      // Create ad
      const adResult = await createAd({
        ad_set_id: adSetResult.adSet.id,
        name: adData.name || `${campaignData.name} - Ad`,
        format: adData.format,
        headline: adData.headline,
        primary_text: adData.primary_text,
        description: adData.description,
        call_to_action: adData.call_to_action,
        destination_url: adData.destination_url || "https://example.com",
        media_urls: adData.media_urls.length > 0 ? adData.media_urls : ["https://placehold.co/1200x628"],
      })

      if (adResult.error) {
        console.error("Failed to create ad:", adResult.error)
        return
      }

      router.push("/dashboard/ads")
    })
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return campaignData.name.length > 0
      case 1: return adSetData.placements.length > 0
      case 2: return budgetData.budget_cents > 0
      case 3: return adData.destination_url.length > 0
      default: return true
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          
          return (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
                isActive && "bg-primary/10",
                isCompleted && "text-primary"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isActive && "text-foreground",
                  !isActive && "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-12 h-0.5 mx-2",
                  isCompleted ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        {/* Step 0: Objective */}
        {currentStep === 0 && (
          <>
            <CardHeader>
              <CardTitle>Choose your campaign objective</CardTitle>
              <CardDescription>What do you want to achieve with this campaign?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="Enter campaign name"
                  value={campaignData.name}
                  onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Objective</Label>
                <RadioGroup
                  value={campaignData.objective}
                  onValueChange={(value) => setCampaignData({ ...campaignData, objective: value })}
                  className="grid grid-cols-2 gap-4 mt-2"
                >
                  {objectives.map((obj) => {
                    const Icon = obj.icon
                    return (
                      <Label
                        key={obj.id}
                        htmlFor={obj.id}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                          campaignData.objective === obj.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <RadioGroupItem value={obj.id} id={obj.id} className="mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="font-medium">{obj.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{obj.description}</p>
                        </div>
                      </Label>
                    )
                  })}
                </RadioGroup>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 1: Targeting */}
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle>Define your audience</CardTitle>
              <CardDescription>Choose who should see your ads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="adset-name">Ad Set Name</Label>
                <Input
                  id="adset-name"
                  placeholder="Enter ad set name"
                  value={adSetData.name}
                  onChange={(e) => setAdSetData({ ...adSetData, name: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age Range</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      min={13}
                      max={65}
                      value={adSetData.targeting.age_min}
                      onChange={(e) => setAdSetData({
                        ...adSetData,
                        targeting: { ...adSetData.targeting, age_min: parseInt(e.target.value) || 18 }
                      })}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={13}
                      max={65}
                      value={adSetData.targeting.age_max}
                      onChange={(e) => setAdSetData({
                        ...adSetData,
                        targeting: { ...adSetData.targeting, age_max: parseInt(e.target.value) || 65 }
                      })}
                      className="w-20"
                    />
                  </div>
                </div>

                <div>
                  <Label>Gender</Label>
                  <Select
                    value={adSetData.targeting.genders[0]}
                    onValueChange={(value) => setAdSetData({
                      ...adSetData,
                      targeting: { ...adSetData.targeting, genders: [value] }
                    })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Games (Interests)</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {games.slice(0, 9).map((game) => (
                    <Label
                      key={game.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                        adSetData.targeting.games.includes(game.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Checkbox
                        checked={adSetData.targeting.games.includes(game.id)}
                        onCheckedChange={(checked) => {
                          const games = checked
                            ? [...adSetData.targeting.games, game.id]
                            : adSetData.targeting.games.filter(g => g !== game.id)
                          setAdSetData({
                            ...adSetData,
                            targeting: { ...adSetData.targeting, games }
                          })
                        }}
                      />
                      <span className="text-sm">{game.name}</span>
                    </Label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Placements</Label>
                <div className="space-y-2 mt-2">
                  {placements.map((placement) => (
                    <Label
                      key={placement.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors",
                        adSetData.placements.includes(placement.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Checkbox
                        checked={adSetData.placements.includes(placement.id)}
                        onCheckedChange={(checked) => {
                          const placements = checked
                            ? [...adSetData.placements, placement.id]
                            : adSetData.placements.filter(p => p !== placement.id)
                          setAdSetData({ ...adSetData, placements })
                        }}
                      />
                      <div>
                        <span className="font-medium">{placement.label}</span>
                        <p className="text-sm text-muted-foreground">{placement.description}</p>
                      </div>
                    </Label>
                  ))}
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Budget */}
        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle>Set your budget</CardTitle>
              <CardDescription>Define how much you want to spend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Budget Type</Label>
                <RadioGroup
                  value={budgetData.budget_type}
                  onValueChange={(value) => setBudgetData({ ...budgetData, budget_type: value as "daily" | "lifetime" })}
                  className="flex gap-4 mt-2"
                >
                  <Label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded border cursor-pointer",
                    budgetData.budget_type === "daily" ? "border-primary bg-primary/5" : "border-border"
                  )}>
                    <RadioGroupItem value="daily" />
                    Daily Budget
                  </Label>
                  <Label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded border cursor-pointer",
                    budgetData.budget_type === "lifetime" ? "border-primary bg-primary/5" : "border-border"
                  )}>
                    <RadioGroupItem value="lifetime" />
                    Lifetime Budget
                  </Label>
                </RadioGroup>
              </div>

              <div>
                <Label>Budget Amount</Label>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-2xl font-bold">$</span>
                  <Input
                    type="number"
                    min={1}
                    value={budgetData.budget_cents / 100}
                    onChange={(e) => setBudgetData({ ...budgetData, budget_cents: (parseFloat(e.target.value) || 0) * 100 })}
                    className="w-32 text-2xl font-bold"
                  />
                  <span className="text-muted-foreground">
                    {budgetData.budget_type === "daily" ? "per day" : "total"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={budgetData.start_date}
                    onChange={(e) => setBudgetData({ ...budgetData, start_date: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={budgetData.end_date}
                    onChange={(e) => setBudgetData({ ...budgetData, end_date: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>Bid Amount (CPM)</Label>
                <div className="space-y-4 mt-2">
                  <Slider
                    value={[adSetData.bid_amount_cents / 100]}
                    onValueChange={([value]) => setAdSetData({ ...adSetData, bid_amount_cents: value * 100 })}
                    min={1}
                    max={50}
                    step={0.5}
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">$1.00</span>
                    <span className="font-medium">${(adSetData.bid_amount_cents / 100).toFixed(2)} CPM</span>
                    <span className="text-muted-foreground">$50.00</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Creative */}
        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle>Create your ad</CardTitle>
              <CardDescription>Design the creative for your campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="ad-name">Ad Name</Label>
                <Input
                  id="ad-name"
                  placeholder="Enter ad name"
                  value={adData.name}
                  onChange={(e) => setAdData({ ...adData, name: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Format</Label>
                <RadioGroup
                  value={adData.format}
                  onValueChange={(value) => setAdData({ ...adData, format: value })}
                  className="flex gap-4 mt-2"
                >
                  {["image", "video", "carousel"].map((format) => (
                    <Label key={format} className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded border cursor-pointer capitalize",
                      adData.format === format ? "border-primary bg-primary/5" : "border-border"
                    )}>
                      <RadioGroupItem value={format} />
                      {format}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  placeholder="Enter headline"
                  maxLength={40}
                  value={adData.headline}
                  onChange={(e) => setAdData({ ...adData, headline: e.target.value })}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">{adData.headline.length}/40 characters</p>
              </div>

              <div>
                <Label htmlFor="primary-text">Primary Text</Label>
                <Textarea
                  id="primary-text"
                  placeholder="Enter primary text"
                  maxLength={125}
                  value={adData.primary_text}
                  onChange={(e) => setAdData({ ...adData, primary_text: e.target.value })}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">{adData.primary_text.length}/125 characters</p>
              </div>

              <div>
                <Label>Call to Action</Label>
                <Select
                  value={adData.call_to_action}
                  onValueChange={(value) => setAdData({ ...adData, call_to_action: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="learn_more">Learn More</SelectItem>
                    <SelectItem value="shop_now">Shop Now</SelectItem>
                    <SelectItem value="sign_up">Sign Up</SelectItem>
                    <SelectItem value="watch_more">Watch More</SelectItem>
                    <SelectItem value="download">Download</SelectItem>
                    <SelectItem value="get_offer">Get Offer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="destination-url">Destination URL</Label>
                <Input
                  id="destination-url"
                  type="url"
                  placeholder="https://yoursite.com/landing-page"
                  value={adData.destination_url}
                  onChange={(e) => setAdData({ ...adData, destination_url: e.target.value })}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isPending || !canProceed()}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Campaign
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
