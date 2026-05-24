import { execSync } from "child_process";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const branches = execSync("git branch --all").toString();
    const lastCommits = execSync("git log -5 --oneline").toString();

    return NextResponse.json({
      branches,
      lastCommits
    });
  } catch {
    return NextResponse.json({ error: "Git access failed" });
  }
}
