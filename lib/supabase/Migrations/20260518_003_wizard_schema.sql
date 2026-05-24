BEGIN;

-- ==========================================
-- 1. Knowledge base
-- ==========================================

CREATE TABLE IF NOT EXISTS public.guide_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_tenant_category_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.guide_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.guide_categories(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    is_published BOOLEAN DEFAULT true,
    needs_reindex BOOLEAN DEFAULT true,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_category_article_slug UNIQUE (category_id, slug)
);

CREATE TABLE IF NOT EXISTS public.guide_article_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.guide_articles(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_article_chunk_index UNIQUE (article_id, chunk_index)
);

-- HNSW index for fast semantic search (only useful once embeddings populated)
CREATE INDEX IF NOT EXISTS idx_guide_chunks_embedding 
    ON public.guide_article_chunks 
    USING hnsw (embedding vector_cosine_ops);

-- ==========================================
-- 2. Contextual help (Path C)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.guide_ui_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_pattern TEXT NOT NULL,
    element_id TEXT,
    article_id UUID NOT NULL REFERENCES public.guide_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_route_element UNIQUE (route_pattern, element_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_contexts_route 
    ON public.guide_ui_contexts(route_pattern);

-- ==========================================
-- 3. Conversations and feedback (Path B)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.guide_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guide_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.guide_conversations(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    source_chunks UUID[] DEFAULT ARRAY[]::UUID[],
    tools_called JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guide_messages_conversation 
    ON public.guide_messages(conversation_id);

CREATE TABLE IF NOT EXISTS public.guide_interactions_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.guide_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
    feedback_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 4. Tool registry (Path B action layer)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.guide_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    required_permission TEXT NOT NULL,
    json_schema JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_read_only BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 5. RLS policies
-- ==========================================

-- Categories and articles: members can read, owners can manage
ALTER TABLE public.guide_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_article_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_ui_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_interactions_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_tools ENABLE ROW LEVEL SECURITY;

-- Categories: any authenticated user can read platform-wide or their tenant's
CREATE POLICY "Users can view applicable categories"
    ON public.guide_categories FOR SELECT
    USING (
        tenant_id IS NULL  -- Platform-wide categories
        OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = guide_categories.tenant_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
        )
    );

CREATE POLICY "Tenant owners manage categories"
    ON public.guide_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = guide_categories.tenant_id
              AND om.user_id = auth.uid()
              AND om.role_key = 'owner'
              AND om.is_active = true
        )
    );

-- Articles inherit visibility from their category
CREATE POLICY "Users can view articles in accessible categories"
    ON public.guide_articles FOR SELECT
    USING (
        is_published = true
        AND EXISTS (
            SELECT 1 FROM public.guide_categories gc
            WHERE gc.id = guide_articles.category_id
              AND (
                  gc.tenant_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM public.organization_members om
                      WHERE om.tenant_id = gc.tenant_id
                        AND om.user_id = auth.uid()
                        AND om.is_active = true
                  )
              )
        )
    );

CREATE POLICY "Tenant owners manage articles"
    ON public.guide_articles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.guide_categories gc
            JOIN public.organization_members om ON om.tenant_id = gc.tenant_id
            WHERE gc.id = guide_articles.category_id
              AND om.user_id = auth.uid()
              AND om.role_key = 'owner'
              AND om.is_active = true
        )
    );

-- Article chunks: same access as parent article
CREATE POLICY "Chunks inherit article access"
    ON public.guide_article_chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.guide_articles ga
            WHERE ga.id = guide_article_chunks.article_id
              AND ga.is_published = true
        )
    );

-- UI contexts: readable by anyone authenticated (they're just pointers)
CREATE POLICY "Authenticated users read ui contexts"
    ON public.guide_ui_contexts FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Conversations: user-owned, strictly private
CREATE POLICY "Users own their conversations"
    ON public.guide_conversations FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Users access messages in their conversations"
    ON public.guide_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.guide_conversations gc
            WHERE gc.id = guide_messages.conversation_id
              AND gc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users own their feedback"
    ON public.guide_interactions_feedback FOR ALL
    USING (user_id = auth.uid());

-- Tools: read-only catalog visible to authenticated users
CREATE POLICY "Authenticated users read tools"
    ON public.guide_tools FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_active = true);

COMMIT;
