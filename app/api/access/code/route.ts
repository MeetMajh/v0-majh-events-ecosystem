import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const { filePath, search } = await req.json();

  try {
    // 🔍 Read specific file
    if (filePath) {
      const fullPath = path.join(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, "utf-8");

      return NextResponse.json({ content });
    }

    // 🔍 Basic search (grep-lite)
    if (search) {
      const results: any[] = [];

      function scan(dir: string) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const full = path.join(dir, file);

          if (fs.statSync(full).isDirectory()) {
            scan(full);
          } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
            const content = fs.readFileSync(full, "utf-8");

            if (content.includes(search)) {
              results.push({ file: full });
            }
          }
        }
      }

      scan(process.cwd());

      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "No query provided" });

  } catch (err) {
    return NextResponse.json({ error: "Failed to read codebase" });
  }
}
