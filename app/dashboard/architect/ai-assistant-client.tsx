"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Bot, User, Loader2, Database, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import ReactMarkdown from "react-markdown"

type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

export default function AIAssistantClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: userMsg.content })
      })
      if (!res.ok) throw new Error(await res.text())
      
      const data = await res.json()
      
      // In the legacy route, the response comes back in data.result
      const content = data.result?.content?.[0]?.text || data.result?.text || JSON.stringify(data.result) || "No response."
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: typeof content === 'string' ? content : JSON.stringify(content)
      }])
    } catch (err: any) {
      console.error(err)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `**Error:** ${err.message}`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[700px] border border-border rounded-md bg-card">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Bot className="h-5 w-5" />
          MAJH Architect
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><Database className="h-3 w-3"/> Live Schema Active</div>
          <div className="flex items-center gap-1"><ShieldAlert className="h-3 w-3"/> Live RLS Active</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <Bot className="h-16 w-16 mb-4" />
            <h3 className="text-lg font-medium">How can I help you build MAJH?</h3>
            <p className="text-sm max-w-sm mt-2">I have live access to your database schema and RLS policies. Ask me to write migrations, review security, or design new features.</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role !== "user" && (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`px-4 py-3 rounded-lg max-w-[85%] overflow-x-auto ${m.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted border border-border prose prose-sm dark:prose-invert"}`}>
              {m.role === "user" ? <div className="whitespace-pre-wrap text-sm">{m.content}</div> : <ReactMarkdown>{m.content}</ReactMarkdown>}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div className="px-4 py-3 rounded-lg bg-muted border border-border text-sm text-muted-foreground flex items-center">
              Analyzing schema and generating response...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-muted/10">
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Architect to write a migration, verify an RLS policy, or plan a feature..."
            className="min-h-[60px] max-h-[200px] flex-1 resize-y bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (input.trim()) handleSubmit(e as any)
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="self-end">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
