Auth Check for Your API Routes
Good — your architect page exists and looks clean. The problem right now is that anyone on the internet who hits /api/ai/run or /api/ai/context gets your full schema and RLS rules. That's a recon goldmine for an attacker. Let's lock it down.
I'll give you a layered approach: a reusable auth helper, then the updated routes, then a small change to your page so it actually authenticates correctly.

Step 1: Create the Auth Helper
Create lib/auth/require-admin.ts:
typescript// lib/auth/require-admin.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Requires the request to come from an authenticated admin user.
 * Returns either { user } on success or a NextResponse on failure
 * that the route handler should return immediately.
 *
 * Admin status is determined by either:
 *   1. Email matching ADMIN_EMAILS env var (comma-separated), OR
 *   2. A row in the public.admins table with the user's id
 *
 * Either mechanism works — pick whichever fits your model.
 */
export async function requireAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase Auth — do not trust getSession()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized — sign in required" },
        { status: 401 }
      ),
    };
  }

  // Path 1: env-var allowlist (simplest, good for solo founder)
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length > 0 && user.email) {
    if (allowlist.includes(user.email.toLowerCase())) {
      return { user };
    }
  }

  // Path 2: admins table lookup (better for multi-admin teams later)
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminRow) {
    return { user };
  }

  return {
    error: NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    ),
  };
}
A few things to notice about this helper:
It uses getUser() not getSession(). getSession() reads the cookie and trusts it; getUser() actually validates the JWT against Supabase. For an admin check, you want the validated version — always.
It supports two admin mechanisms. The env-var allowlist is the fastest to set up: add ADMIN_EMAILS=you@majhevents.com to your Vercel env vars and you're done. The admins table is more flexible if you ever onboard a co-founder or contractor who needs architect access.

Step 2: Optional — Create the Admins Table
Skip this if you're going env-var-only. If you want the table approach, run in Supabase SQL editor:
sqlcreate table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  added_at timestamptz default now(),
  added_by uuid references auth.users(id),
  notes text
);

alter table public.admins enable row level security;

-- Only admins can read the admins table; nobody can write via API
-- (you add admins manually in SQL editor)
create policy "admins can read admins"
  on public.admins for select
  using (auth.uid() in (select user_id from public.admins));

-- Seed yourself
insert into public.admins (user_id, email, notes)
values ('YOUR-AUTH-USER-UUID-HERE', 'you@majhevents.com', 'founder')
on conflict (user_id) do nothing;
You can find your auth user UUID in Supabase Dashboard → Authentication → Users.

Step 3: Update Your API Routes
app/api/ai/context/route.ts:
typescriptimport { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { scope } = await req.json();
  const response: Record<string, unknown> = {};

  if (scope?.includes("db.schema")) {
    response.schema = await getSchema();
  }

  if (scope?.includes("rls")) {
    const raw = await getRLS();
    response.rls = (raw ?? []).map((p: any) => ({
      table: p.tablename,
      policy: p.policyname,
      command: p.cmd,
      rule: p.qual?.includes("auth.uid()")
        ? "User owns this data"
        : "Custom policy",
    }));
  }

  return NextResponse.json(response);
}
app/api/ai/run/route.ts gets the same treatment — add the same two lines at the top of the handler:
typescriptimport { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";
import { requireAdmin } from "@/lib/auth/require-admin";

// ... your buildSchemaDNA function stays as-is ...

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  // ... rest of your existing handler ...
}

Step 4: Protect the Architect Page Itself
Right now, your page renders for anyone — the API will reject them, but they shouldn't even see the UI. Update app/dashboard/architect/page.tsx to gate at the page level:
typescript// app/dashboard/architect/page.tsx
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import ArchitectClient from "./architect-client";

export default async function ArchitectPage() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    redirect("/login?next=/dashboard/architect");
  }
  return <ArchitectClient />;
}
Then move your existing client code into app/dashboard/architect/architect-client.tsx:
typescript// app/dashboard/architect/architect-client.tsx
"use client";
import { useState } from "react";

export default function ArchitectClient() {
  const [task, setTask] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      if (res.status === 401 || res.status === 403) {
        setResult("Not authorized. Sign in as an admin.");
        return;
      }
      const data = await res.json();
      setResult(JSON.stringify(data.result ?? data, null, 2));
    } catch {
      setResult("Error running architect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">MAJH Architect OS</h1>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="What do you want to build?"
        className="w-full h-40 border p-2 mb-4"
      />
      <button onClick={run} className="bg-black text-white px-4 py-2">
        {loading ? "Running..." : "Run"}
      </button>
      <pre className="mt-4 bg-gray-100 p-4 whitespace-pre-wrap">{result}</pre>
    </div>
  );
}
The split matters: server components do the auth check (so unauthorized users never get the JS bundle), client components handle interactivity.

Step 5: Set the Env Var in Vercel
In your Vercel project: Settings → Environment Variables → add ADMIN_EMAILS set to your email (or comma-separated list). Apply to Production, Preview, and Development. Redeploy.

What You've Got Now
After this, the security model is: unauthenticated requests get 401, authenticated non-admin requests get 403, only emails on your allowlist (or rows in admins) can hit the introspection endpoints or see the page. The service-role key never leaves the server. The endpoints return schema and policy metadata only — no row data, no PII, no secrets — exactly the constraint your engineering agent named.
One thing I want to flag before you ship: make sure @supabase/ssr is in your package.json. If it isn't, run pnpm add @supabase/ssr first or the build will fail on the import. You can check by searching package.json in your repo for it.
Want me to draft the /api/ai/run handler in full next, or the export-as-markdown button for the architect page that bridges output into Claude?