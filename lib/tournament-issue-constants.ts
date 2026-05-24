// Tournament Issue Constants (separate file because "use server" files can only export async functions)

export const ISSUE_CATEGORIES = {
  pairing_failure: { label: "Pairing Failure", description: "Software failing to generate pairings" },
  round_generation: { label: "Round Generation", description: "Unable to generate new rounds" },
  top_cut_failure: { label: "Top Cut Failure", description: "Problems generating top cut brackets" },
  player_registration: { label: "Player Registration", description: "Issues with player sign-up or check-in" },
  player_data: { label: "Player Data", description: "Incorrect player info (age division, name, etc.)" },
  player_drop: { label: "Player Drop", description: "Unable to drop or re-add players" },
  system_freeze: { label: "System Freeze", description: "Software not responding or frozen" },
  timer_error: { label: "Timer Error", description: "Round timer not working correctly" },
  file_upload: { label: "File Upload", description: "Problems uploading tournament files" },
  decklist_mismatch: { label: "Decklist Mismatch", description: "Deck doesn't match registered list" },
  marked_cards: { label: "Marked Cards", description: "Damaged or identifiable sleeves/cards" },
  illegal_deck: { label: "Illegal Deck", description: "Invalid deck composition or banned cards" },
  judge_call: { label: "Judge Call", description: "Rules question or dispute requiring judge" },
  dispute: { label: "Dispute", description: "Player dispute or disagreement" },
  technical: { label: "Technical Issue", description: "Other technical problems" },
  other: { label: "Other", description: "Other issue type" },
} as const

export const ESCALATION_LEVELS = {
  1: { label: "Staff", role: "staff" },
  2: { label: "Tournament Organizer", role: "organizer" },
  3: { label: "Manager", role: "manager" },
} as const
