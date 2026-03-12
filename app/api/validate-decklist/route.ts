import { NextResponse } from "next/server"
import { parseDecklistText, validateDecklist, type Format } from "@/lib/scryfall"

export async function POST(request: Request) {
  try {
    const { decklist, format } = await request.json()
    
    if (!decklist || typeof decklist !== "string") {
      return NextResponse.json(
        { error: "Decklist is required" },
        { status: 400 }
      )
    }
    
    if (!format) {
      return NextResponse.json(
        { error: "Format is required" },
        { status: 400 }
      )
    }
    
    // Parse the decklist text into entries
    const entries = parseDecklistText(decklist)
    
    if (entries.length === 0) {
      return NextResponse.json({
        isValid: false,
        errors: ["No valid cards found in decklist. Check your format."],
        warnings: [],
        cards: [],
        stats: { totalCards: 0, mainboardCount: 0, sideboardCount: 0, uniqueCards: 0 },
      })
    }
    
    // Validate against Scryfall
    const result = await validateDecklist(entries, format as Format)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Decklist validation error:", error)
    return NextResponse.json(
      { error: "Failed to validate decklist" },
      { status: 500 }
    )
  }
}
