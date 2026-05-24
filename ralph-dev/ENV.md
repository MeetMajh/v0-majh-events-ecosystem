# ENV.md — Environment variables referenced in MAJH EVENTS

Generated: iteration 1 (Phase 1). Every `process.env.X` reference in the
codebase, grouped by purpose. `.env.example` (Phase 2) will be built from
this list.

## Supabase (Postgres + RLS)
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | yes | `lib/supabase/{client,server,middleware,introspection}.ts`, several routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon JWT (public) | yes | same as above |
| `SUPABASE_URL` | Service-role flavour of project URL (server-only) | yes | `app/api/setup-carbardmv/route.ts:5` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only) | yes | every route under `app/api/cron/*`, webhooks, `lib/wallet-actions.ts`, etc. |
| `POSTGRES_URL` | Direct Postgres connection (scripts only) | optional | `scripts/create-preregistrations.mjs:7` |

## Stripe
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret (server) | yes | `lib/stripe.ts:5`, KYC, refund, payouts, ticket purchase, webhook |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | yes | `app/api/stripe/webhook/route.ts:28` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js publishable key | yes | `components/carbardmv/{rental-catalog,invoice-payment,event-booking-wizard}.tsx` |

## Mux (live + VOD)
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `MUX_TOKEN_ID` | Mux API token id | yes | `lib/mux.ts:5`, `lib/go-live-actions.ts:425` |
| `MUX_TOKEN_SECRET` | Mux API token secret | yes | `lib/mux.ts:6`, `lib/go-live-actions.ts:425` |
| `MUX_WEBHOOK_SECRET` | Mux webhook signing secret | yes (prod) | `app/api/webhooks/mux/route.ts:24` |

## LiveKit (studio rooms)
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `LIVEKIT_API_KEY` | LiveKit API key | yes | `lib/majh-studio-actions.ts:87`, `app/api/livekit/token/route.ts:20` |
| `LIVEKIT_API_SECRET` | LiveKit API secret | yes | same as above |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit WSS URL (client) | yes | `lib/majh-studio-actions.ts:{100,121}`, `components/streaming/player-room.tsx:73` |

## RTMP / custom streaming
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `RTMP_ENABLED` | Toggle RTMP path | optional | `lib/streaming-config.ts:35` |
| `RTMP_SERVER_URL` | RTMP ingest URL | optional | `lib/streaming-config.ts:36` |
| `RTMP_PLAYBACK_URL` | RTMP playback URL | optional | `lib/streaming-config.ts:37` |

## Third-party streaming APIs
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `TWITCH_CLIENT_ID` | Twitch OAuth client id | optional | `lib/streaming-api.ts:{48,90,139}` |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth client secret | optional | `lib/streaming-api.ts:49` |
| `YOUTUBE_API_KEY` | YouTube Data v3 key | optional | `lib/streaming-api.ts:259` |
| `TOPDECK_API_KEY` | TopDeck tournament API | optional | `lib/topdeck-api.ts:{54,106}` |

## Email (Resend)
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `RESEND_API_KEY` | Resend transactional email | yes | `lib/email/send.ts:3`, `lib/email-notifications.ts:167`, `lib/booking-emails.ts:5`, `app/api/admin/send-reminder/route.ts:6`, `scripts/send-*.{js,mjs}` |

## Cron / job auth
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `CRON_SECRET` | Bearer token expected by cron routes | yes | `lib/cron-auth.ts:14`, `app/api/cron/*`, `app/api/moderation/process/route.ts:14`, `app/api/highlights/process/route.ts:14`, `app/api/notifications/trigger/route.ts:19`, `app/api/admin/send-reminder/route.ts:12` |

## Admin / AI
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `ADMIN_EMAILS` | Comma-separated admin emails | yes | `lib/auth/require-admin.ts:53` |
| `CLAUDE_API_KEY` | Claude API key (used by `/api/run`) | optional | `app/api/run/route.ts:26` |
| `ML_SERVICE_URL` | External ML / two-tower service URL | optional | `lib/two-tower-ml-service.ts:317` |

## URL / deployment
| Var | Purpose | Required | Refs |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical app origin (Stripe `success_url`, share links, emails) | yes | 30+ refs across `lib/*-actions.ts`, `lib/email/*`, ticket purchase, KYC, etc. |
| `NEXT_PUBLIC_SITE_URL` | Alt origin (legacy/login) | yes | `lib/actions.ts:{49,86}`, `app/api/checkout/create-session/route.ts:45`, `app/api/streams/share/route.ts:{26,42}` |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Dev-only OAuth redirect override | optional | `lib/actions.ts:48` |

## Vercel-provided (do not set in `.env`)
| Var | Source | Refs |
|---|---|---|
| `VERCEL_URL` | Vercel build env | `lib/carbardmv-actions.ts:139,260,939`, `scripts/predeploy-check.mjs` |
| `VERCEL_ENV` | Vercel build env | `lib/majh-studio-actions.ts:92` |
| `VERCEL_GIT_COMMIT_SHA` | Vercel build env | `scripts/predeploy-check.mjs:51` |
| `VERCEL_GIT_COMMIT_REF` | Vercel build env | `scripts/predeploy-check.mjs:52` |
| `NODE_ENV` | Node default | `lib/majh-studio-actions.ts:92`, dashboard layouts |

## Pre-deploy tooling (CI only)
| Var | Purpose | Refs |
|---|---|---|
| `PREDEPLOY_CHECK_URL` | Target for pre-deploy integrity check | `scripts/predeploy-check.mjs:18` |
| `PREDEPLOY_API_KEY` | Auth for pre-deploy check | `scripts/predeploy-check.mjs:{43,44}` |
| `SKIP_PREDEPLOY_CHECK` | Bypass flag | `scripts/predeploy-check.mjs:22` |
