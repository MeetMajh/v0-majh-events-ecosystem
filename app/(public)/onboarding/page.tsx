"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Gamepad2, 
  Trophy, 
  Eye, 
  GraduationCap, 
  Video,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

// Game options
const GAMES = [
  { id: "mtg-arena", name: "MTG Arena", icon: "🃏" },
  { id: "pokemon", name: "Pokemon TCG", icon: "⚡" },
  { id: "yugioh", name: "Yu-Gi-Oh!", icon: "🎴" },
  { id: "smash", name: "Smash / FGC", icon: "🎮" },
  { id: "league", name: "League of Legends", icon: "⚔️" },
  { id: "valorant", name: "Valorant", icon: "🔫" },
  { id: "other", name: "Other", icon: "🎯" },
]

// Intent options
const INTENTS = [
  { id: "compete", name: "Compete", description: "Join tournaments and rank up", icon: Trophy },
  { id: "watch", name: "Watch", description: "Follow matches and highlights", icon: Eye },
  { id: "learn", name: "Learn", description: "Improve skills with tutorials", icon: GraduationCap },
  { id: "create", name: "Create", description: "Upload clips and build audience", icon: Video },
]

// Skill levels
const SKILL_LEVELS = [
  { id: "beginner", name: "Beginner", description: "Just getting started" },
  { id: "intermediate", name: "Intermediate", description: "Know the basics" },
  { id: "advanced", name: "Advanced", description: "Competitive level" },
  { id: "tournament", name: "Tournament Pro", description: "Top tier player" },
]

interface SuggestedPlayer {
  id: string
  name: string
  avatar_url: string | null
  game: string
  followers: number
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [selectedIntents, setSelectedIntents] = useState<string[]>([])
  const [skillLevel, setSkillLevel] = useState<string | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [suggestedPlayers, setSuggestedPlayers] = useState<SuggestedPlayer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      } else {
        // Allow anonymous onboarding for demo, or redirect to login
        // router.push("/login")
      }
    }
    getUser()
  }, [router])

  // Fetch suggested players when games are selected
  useEffect(() => {
    if (selectedGames.length > 0 && step === 4) {
      fetchSuggestedPlayers()
    }
  }, [selectedGames, step])

  const fetchSuggestedPlayers = async () => {
    // Mock data for now - would fetch from API
    const mockPlayers: SuggestedPlayer[] = [
      { id: "1", name: "ProPlayer1", avatar_url: null, game: selectedGames[0], followers: 15420 },
      { id: "2", name: "CardMaster99", avatar_url: null, game: selectedGames[0], followers: 8932 },
      { id: "3", name: "TourneyKing", avatar_url: null, game: selectedGames[0], followers: 23100 },
      { id: "4", name: "HighlightHero", avatar_url: null, game: selectedGames[0], followers: 5621 },
      { id: "5", name: "LocalLegend", avatar_url: null, game: selectedGames[0], followers: 1823 },
      { id: "6", name: "RisingChamp", avatar_url: null, game: selectedGames[0], followers: 982 },
    ]
    setSuggestedPlayers(mockPlayers)
  }

  const toggleGame = (gameId: string) => {
    setSelectedGames(prev => 
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    )
  }

  const toggleIntent = (intentId: string) => {
    setSelectedIntents(prev =>
      prev.includes(intentId)
        ? prev.filter(id => id !== intentId)
        : [...prev, intentId]
    )
  }

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  const canProceed = () => {
    switch (step) {
      case 1: return selectedGames.length > 0
      case 2: return selectedIntents.length > 0
      case 3: return true // Skill level is optional
      case 4: return true // Following players is optional
      default: return false
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          games: selectedGames,
          intents: selectedIntents,
          skill_level: skillLevel,
          followed_players: selectedPlayers,
        }),
      })

      if (response.ok) {
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([10, 50, 10, 50, 10])
        }
        router.push("/clips")
      }
    } catch (error) {
      console.error("Onboarding failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalSteps = 4

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${(step / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">MAJH</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Step {step} of {totalSteps}
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Step 1: Game Selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">What do you play?</h1>
                <p className="text-muted-foreground">
                  Select all games you are interested in
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 flex-1">
                {GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      "hover:border-primary/50 active:scale-[0.98]",
                      selectedGames.includes(game.id)
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                  >
                    <span className="text-2xl mb-2 block">{game.icon}</span>
                    <span className="font-medium">{game.name}</span>
                    {selectedGames.includes(game.id) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <Check className="h-5 w-5 text-primary" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Intent */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">What are you here for?</h1>
                <p className="text-muted-foreground">
                  Select all that apply
                </p>
              </div>

              <div className="space-y-3 flex-1">
                {INTENTS.map((intent) => (
                  <button
                    key={intent.id}
                    onClick={() => toggleIntent(intent.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4",
                      "hover:border-primary/50 active:scale-[0.99]",
                      selectedIntents.includes(intent.id)
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      selectedIntents.includes(intent.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <intent.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{intent.name}</div>
                      <div className="text-sm text-muted-foreground">{intent.description}</div>
                    </div>
                    {selectedIntents.includes(intent.id) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Skill Level */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">What is your skill level?</h1>
                <p className="text-muted-foreground">
                  This helps us recommend the right content (optional)
                </p>
              </div>

              <div className="space-y-3 flex-1">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setSkillLevel(level.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all",
                      "hover:border-primary/50 active:scale-[0.99]",
                      skillLevel === level.id
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                  >
                    <div className="font-medium">{level.name}</div>
                    <div className="text-sm text-muted-foreground">{level.description}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Follow Players */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Follow some players</h1>
                <p className="text-muted-foreground">
                  Get their clips in your feed (optional)
                </p>
              </div>

              <div className="space-y-3 flex-1">
                {suggestedPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player.id)}
                    className={cn(
                      "w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3",
                      "hover:border-primary/50 active:scale-[0.99]",
                      selectedPlayers.includes(player.id)
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                      {player.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {player.followers.toLocaleString()} followers
                      </div>
                    </div>
                    <Button
                      variant={selectedPlayers.includes(player.id) ? "default" : "outline"}
                      size="sm"
                      className="pointer-events-none"
                    >
                      {selectedPlayers.includes(player.id) ? "Following" : "Follow"}
                    </Button>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 pt-6 border-t border-border mt-auto">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          
          {step < totalSteps ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Setting up..." : "Start Exploring"}
              <Sparkles className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        {/* Skip option */}
        {step >= 3 && (
          <button
            onClick={() => step === 4 ? handleComplete() : setStep(step + 1)}
            className="text-sm text-muted-foreground text-center mt-3 hover:text-foreground"
          >
            Skip this step
          </button>
        )}
      </main>
    </div>
  )
}
