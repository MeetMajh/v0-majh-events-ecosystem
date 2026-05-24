BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := '8dd63bc0-1742-478e-8743-dc55ce2b7127';
    v_admin_cat_id UUID;
    v_catering_cat_id UUID;
    v_esports_cat_id UUID;
    v_role_article_id UUID;
    v_menu_article_id UUID;
    v_stream_article_id UUID;
BEGIN
    -- Categories
    INSERT INTO public.guide_categories (tenant_id, slug, name, description, icon, sort_order)
    VALUES 
        (v_tenant_id, 'platform-admin', 'Platform Administration',
         'User management, roles, permissions, and tenant configuration.', 'shield-check', 10),
        (v_tenant_id, 'hospitality-operations', 'Hospitality & F&B Operations',
         'Catering, menu management, inventory, and event service.', 'utensils', 20),
        (v_tenant_id, 'esports-operations', 'Esports Operations',
         'Streaming, tournaments, brackets, and player management.', 'gamepad', 30)
    ON CONFLICT (tenant_id, slug) DO UPDATE 
    SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon;

    SELECT id INTO v_admin_cat_id FROM public.guide_categories 
        WHERE tenant_id = v_tenant_id AND slug = 'platform-admin';
    SELECT id INTO v_catering_cat_id FROM public.guide_categories 
        WHERE tenant_id = v_tenant_id AND slug = 'hospitality-operations';
    SELECT id INTO v_esports_cat_id FROM public.guide_categories 
        WHERE tenant_id = v_tenant_id AND slug = 'esports-operations';

    -- Articles (starter SOPs - expand over time)
    INSERT INTO public.guide_articles (category_id, slug, title, summary, content)
    VALUES 
        (v_admin_cat_id, 'staff-role-assignments', 
         'Assigning Roles to Staff Members',
         'How to grant tenant, department, and location-scoped roles.',
         E'# Assigning Roles\n\nThe MAJH OS uses scoped role assignments:\n\n- **Tenant-level**: Role applies across all departments (e.g., MAJH OS owner)\n- **Department-level**: Role scoped to one department (e.g., CarBadMV manager)\n- **Location-level**: Role scoped to a single location (e.g., DC Metro bartender)\n\n## Steps\n\n1. Navigate to Settings → Users\n2. Select the user\n3. Click "Modify Roles"\n4. Choose scope: Tenant, Department, or Location\n5. Select role template\n6. Save\n\nNote: You can only grant roles within scopes where you have owner permissions.'),
        
        (v_catering_cat_id, 'menu-food-costing', 
         'Menu Management and Food Costing',
         'How to maintain accurate menus, ingredient costs, and pricing.',
         E'# Menu & Food Costing\n\nFood costing protects margins. Every menu item must be costed from ingredient up.\n\n## Setup Per Location\n\nEach location operates in its own currency:\n- Barbados (BBD)\n- St. Lucia (XCD)\n- DC Metro (USD)\n\nIngredient costs are stored per-location to match local supplier prices.\n\n## Target Margins\n\n- F&B baseline: 65% gross margin\n- Premium/specialty: 70%+\n- Loss-leaders (intentional): document the reason\n\nAudit recipes weekly. Reorder when stock drops below par level.'),

        (v_esports_cat_id, 'stream-go-live',
         'Going Live with OBS or MAJH Studio',
         'How to start a stream that broadcasts to majhevents.com viewers.',
         E'# Going Live\n\n## Option 1: OBS (recommended for tournaments)\n\n1. Go to Dashboard → Stream\n2. Click "Create Stream"\n3. Copy the RTMP URL and stream key\n4. In OBS: Settings → Stream → paste credentials\n5. Add your sources (display capture, webcam, etc.)\n6. Click Start Streaming in OBS\n\nThe stream will appear on /live within 10-30 seconds.\n\n## Option 2: MAJH Studio (browser-based)\n\nIn progress — browser-based streaming pipeline being built.\n\n## After the Stream\n\nVODs auto-save when you end the stream. View them at /live or /watch/vod/[id].')
    ON CONFLICT (category_id, slug) DO UPDATE 
    SET title = EXCLUDED.title, content = EXCLUDED.content, needs_reindex = true;

    SELECT id INTO v_role_article_id FROM public.guide_articles 
        WHERE category_id = v_admin_cat_id AND slug = 'staff-role-assignments';
    SELECT id INTO v_menu_article_id FROM public.guide_articles 
        WHERE category_id = v_catering_cat_id AND slug = 'menu-food-costing';
    SELECT id INTO v_stream_article_id FROM public.guide_articles 
        WHERE category_id = v_esports_cat_id AND slug = 'stream-go-live';

    -- UI context mappings (Path C: which articles appear on which pages)
    INSERT INTO public.guide_ui_contexts (route_pattern, element_id, article_id)
    VALUES 
        ('/dashboard/admin/users', NULL, v_role_article_id),
        ('/dashboard/admin/users', 'assign-role-modal', v_role_article_id),
        ('/dashboard/stream', NULL, v_stream_article_id),
        ('/dashboard/go-live', NULL, v_stream_article_id)
    ON CONFLICT (route_pattern, element_id) DO UPDATE 
    SET article_id = EXCLUDED.article_id;

    -- Initial read-only tools for future Path B
    INSERT INTO public.guide_tools (name, description, required_permission, json_schema, is_read_only)
    VALUES 
        ('get_department_summary',
         'Retrieves operational summary for a department in the current tenant. Use when user asks about department status, performance, or current state.',
         'view_financial_reports',
         '{"type": "object", "properties": {"department_slug": {"type": "string", "description": "Slug of the department (esports, carbadmv, tradewinds-rb, trs)"}}, "required": ["department_slug"]}'::jsonb,
         true),
         
        (' get_location_inventory',
         'Lists current inventory for a specific location. Use when user asks what stock is on hand at a location.',
         'view_inventory',
         '{"type": "object", "properties": {"location_slug": {"type": "string"}, "category_filter": {"type": "string"}}, "required": ["location_slug"]}'::jsonb,
         true),

        ('get_active_staff_at_location',
         'Lists staff currently assigned or scheduled at a location. Use when user asks who is working or who is on shift.',
         'view_staff_schedule',
         '{"type": "object", "properties": {"location_slug": {"type": "string"}, "include_inactive": {"type": "boolean", "default": false}}, "required": ["location_slug"]}'::jsonb,
         true)
    ON CONFLICT (name) DO UPDATE 
    SET description = EXCLUDED.description, 
        json_schema = EXCLUDED.json_schema;

    RAISE NOTICE 'Wizard knowledge base seeded with initial categories, articles, contexts, and tools';
END $$;

COMMIT;
