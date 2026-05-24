"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { HelpCircle, BookOpen, Sparkles, Loader2 } from "lucide-react"
import { getContextualHelp, type GuideArticle } from "@/lib/wizard/actions"
import ReactMarkdown from "react-markdown"

export function WizardDrawer() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [articles, setArticles] = useState<GuideArticle[]>([])

  useEffect(() => {
    async function loadHelp() {
      if (!isOpen) return
      setIsLoading(true)
      try {
        const pageArticles = await getContextualHelp(pathname)
        setArticles(pageArticles)
      } catch (err) {
        console.error("Failed to load Wizard articles", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadHelp()
  }, [pathname, isOpen])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg border-primary/20 bg-background/95 backdrop-blur hover:bg-primary/10 transition-all z-50"
        >
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="sr-only">Open MAJH Guide</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l-primary/20">
        <SheetHeader className="mb-6 pb-6 border-b">
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-5 w-5 text-primary" />
            MAJH Guide
          </SheetTitle>
          <SheetDescription>
            Contextual help and operational guidance for this page.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Consulting the knowledge base...</p>
            </div>
          ) : articles.length > 0 ? (
            articles.map((article) => (
              <div key={article.id} className="prose prose-sm dark:prose-invert max-w-none">
                <div className="flex items-center gap-2 mb-2 text-primary font-medium text-xs uppercase tracking-wider">
                  <BookOpen className="h-3 w-3" />
                  {article.category.slug.replace('-', ' ')}
                </div>
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground">No specific guidance found</p>
              <p className="text-sm mt-2">There are currently no contextual articles mapped to this specific workflow ({pathname}).</p>
              
              <div className="mt-8 p-4 bg-muted/50 rounded-lg text-sm text-left">
                <p className="font-medium text-foreground mb-2">Future Feature (Phase A & B)</p>
                <p>Soon, you will be able to search the entire MAJH knowledge base or ask the Wizard questions about CarBadMV operations directly from this panel.</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
