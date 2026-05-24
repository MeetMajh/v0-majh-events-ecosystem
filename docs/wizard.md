What the Wizard is (Path C now, Path A semantic search next, Path B LLM tool-calling later)
The four tables (guide_categories, guide_articles, guide_article_chunks, guide_ui_contexts, guide_conversations, guide_messages, guide_interactions_feedback, guide_tools)
The three initial tools defined and what they're meant to do (read-only, gated by permission)
How to add a new article (insert into guide_categories if new category, insert into guide_articles, insert UI context mapping)
What's NOT built yet (UI surface, embedding generation pipeline, semantic search, LLM agent)

Here's /docs/wizard.md. Drop it in as a new file.

MAJH Guide (Wizard)
Status: Schema deployed May 18, 2026. UI not yet built. No active code reads from these tables.

What it is
The MAJH Guide is the platform's knowledge and assistance layer. It exists to answer questions, explain workflows, surface contextual help, and eventually take actions on behalf of users — all without requiring the founder to be in the loop.

The Guide is built in three progressive phases. Each phase reuses the data structures of the previous one. Phase C ships first because it provides the underlying knowledge that Phases A and B operate on.

Phase C — Embedded contextual help
Help articles surfaced inline on specific pages and UI elements. A user on /dashboard/admin/users sees a help drawer or "(?)" button that pulls the relevant article from guide_ui_contexts. Static, no AI required, ships value immediately.

Phase A — Semantic search
A searchable command-bar (CMD+K style) that lets users find articles by natural-language query. Powered by pgvector embeddings of article chunks. Same underlying article content as Phase C, indexed differently.

Phase B — Conversational LLM agent
An assistant that answers free-form questions, retrieves relevant article chunks via semantic search, and optionally calls registered tools to execute read-only queries (e.g., "what's CarBadMV's revenue this week?"). Uses guide_tools registry for safety-gated tool calling. Builds on the knowledge base populated by Phases C and A.

The architectural intent: every article written for Phase C becomes search-indexable for Phase A, and every search-indexable chunk becomes citable context for Phase B. Phase C builds the data Phase B needs.

Schema
The Guide consists of eight tables, all in the public schema, all with RLS enabled.

Knowledge base
guide_categories — top-level groupings (e.g., "Platform Administration", "Hospitality Operations").

tenant_id nullable: NULL = platform-wide category; set = tenant-specific category.
Owners of a tenant manage that tenant's categories.
guide_articles — individual help articles in markdown.

Belongs to a category. Articles inherit visibility from their category.
is_published controls visibility. Unpublished articles are owner-only.
needs_reindex flag signals when content has changed and embeddings need regeneration.
guide_article_chunks — articles split into ~500-1000 character chunks for embedding and LLM context injection.

One article produces multiple chunks, ordered by chunk_index.
embedding column (vector(1536)) populates when the chunking pipeline runs.
HNSW index on embedding for fast cosine-similarity search.
Chunks inherit access from their parent article.
Contextual help (Phase C)
guide_ui_contexts — maps UI routes (and optionally specific element IDs) to articles.

A page can have a page-level article (element_id NULL) and element-specific articles.
Readable by any authenticated user. Articles themselves still respect their own RLS.
Conversations (Phase B)
guide_conversations — top-level container for a user's chat session with the assistant.

User-owned. Strictly private — no shared conversations.
guide_messages — individual messages within a conversation.

sender is one of: 'user', 'assistant', 'system'.
source_chunks array references which guide_article_chunks were cited in the response.
tools_called JSONB logs which tools the assistant invoked, with arguments.
guide_interactions_feedback — thumbs-up/thumbs-down on assistant responses.

Rating is -1 or 1. Optional notes.
Used to detect drift and evaluate Guide quality over time.
Tool registry (Phase B)
guide_tools — registry of functions the LLM assistant is allowed to call.

name is the tool function name (must match a Next.js server action).
description is what the LLM sees when deciding whether to invoke. Write this carefully.
required_permission is the permission key the calling user must have for the tool to execute.
json_schema validates tool arguments before execution.
is_read_only flag separates safe lookups from state-mutating actions. Phase B launch is read-only only.
is_active allows disabling a tool without deletion.
Currently seeded content
As of May 18, 2026:

3 categories: platform-admin, hospitality-operations, esports-operations.

3 articles:

staff-role-assignments — how to grant tenant/department/location-scoped roles
menu-food-costing — recipe costing and margin management for F&B operations
stream-go-live — OBS configuration and MAJH Studio path
4 UI context mappings:

/dashboard/admin/users → role assignments article (page-level)
/dashboard/admin/users → role assignments article (assign-role-modal element)
/dashboard/stream → go-live article
/dashboard/go-live → go-live article
3 read-only tools defined (not yet callable — no execution layer wired):

get_department_summary — operational summary for a department
get_location_inventory — current inventory at a location
get_active_staff_at_location — staff scheduled at a location
How to add a new article
Decide the category. If existing (platform-admin, hospitality-operations, esports-operations), use its UUID. If new, insert into guide_categories first.
Write the article in markdown. Keep it focused — one task, one workflow, one concept per article. Aim for 200-800 words. Reference real UI paths (/dashboard/...), real role names, real terminology from the platform.
Insert into guide_articles:
sql
   INSERT INTO public.guide_articles (category_id, slug, title, summary, content)
   VALUES (
     '<category_uuid>',
     'kebab-case-slug',
     'Display Title',
     'One-sentence summary used in search results.',
     E'# Article Body\n\nMarkdown content here...'
   );
Setting needs_reindex = true (default) signals that chunks need to be regenerated.

Map it to UI routes. If the article is for a specific page, insert into guide_ui_contexts:
sql
   INSERT INTO public.guide_ui_contexts (route_pattern, element_id, article_id)
   VALUES ('/dashboard/some-route', NULL, '<article_uuid>');
Use element_id for element-specific help; NULL for page-level.

Verify: the Phase C UI (once built) will surface the article on the matching route. Until the UI ships, the article lives in the DB and is searchable via direct query.
How to add a new tool (Phase B prep)
Tools are not yet executable, but the registry is the right place to declare them as you design features.

Identify the operation. It must be implementable as a single server action that takes structured arguments and returns structured data. Start read-only.
Define the permission key. Must match an entry in permission_definitions (or be created in permission_definitions first).
Write a JSON schema for the arguments. Standard JSON Schema syntax. The LLM uses this schema to construct valid calls.
Insert:
sql
   INSERT INTO public.guide_tools (name, description, required_permission, json_schema, is_read_only)
   VALUES (
     'tool_name',
     'Description for LLM: when to use this, what it returns, what it does NOT do.',
     'permission.key',
     '{"type": "object", "properties": {...}, "required": [...]}'::jsonb,
     true
   );
Description is critical. The LLM decides whether to call a tool based on this description. Vague descriptions cause wrong tool calls. Be specific about when the tool applies and what arguments it expects.
What's not built yet
Tracking these as backlog items so they don't drift:

Wizard UI (T-202): The page-level help drawer, "(?)" buttons, article rendering. Phase C surface.
Semantic search RPC (T-203): Edge function or RPC that takes a query, embeds it, and returns top-K matching chunks. Phase A surface.
Embedding generation pipeline (T-203): Background job that processes needs_reindex = true articles, chunks them, generates embeddings via OpenAI or similar, populates guide_article_chunks.embedding, flips needs_reindex = false.
LLM orchestration layer (Phase B): Reads conversation context, embeds user query, retrieves chunks, constructs system prompt, executes tool calls if needed, persists messages.
Tool execution layer (Phase B): Server-side dispatcher that takes a guide_tools row and a validated argument object, runs the corresponding server action with the user's permissions, returns the result.
RLS summary
Table	Read access	Write access
guide_categories	Members of tenant (or platform-wide if tenant_id NULL)	Tenant owners
guide_articles	Same as parent category, plus is_published = true	Tenant owners
guide_article_chunks	Inherits from article	Tenant owners (via article)
guide_ui_contexts	Any authenticated user	Tenant owners
guide_conversations	User who owns it	User who owns it
guide_messages	User who owns the parent conversation	User who owns it
guide_interactions_feedback	User who gave it	User who gave it
guide_tools	Any authenticated user (read-only catalog)	Service role only
Design principles
A few decisions worth preserving here so future-you doesn't second-guess them:

1. Tenant-scoped knowledge is supported but not required. Most articles will be platform-wide (tenant_id NULL). A specific tenant might write their own SOPs for their staff — that's why categories can be tenant-scoped. Default to platform-wide unless there's a clear tenant-specific reason.

2. Articles are markdown, not WYSIWYG. Easier to edit, easier to diff, easier to embed in version control if needed. The UI renders the markdown.

3. Chunks are derived, not authored. A pipeline generates chunks from articles. Don't manually insert into guide_article_chunks — write articles, let the chunker process them.

4. Tools are declarative, not implemented in this table. guide_tools is the LLM-facing registry. Each tool's actual code lives in lib/wizard-tools/*.ts (or similar) and is invoked by name. The registry only describes the interface.

5. Feedback is structured, not freeform. Thumbs up/down with optional notes. This is the raw material for evaluating Guide quality. Build dashboards from this once you have volume.

6. Read-only first, always. Phase B's first version cannot mutate state. Tools return data. They do not modify it. Mutating tools come later and require explicit user confirmation in the UI before each call.

File locations (as of May 18, 2026)
Schema: supabase/migrations/20260518_003_wizard_schema.sql
Seed: supabase/migrations/20260518_004_seed_wizard_initial.sql
Documentation: this file (docs/wizard.md)
UI components: not yet built
Server actions / tool implementations: not yet built
