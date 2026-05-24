BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := '8dd63bc0-1742-478e-8743-dc55ce2b7127';
    v_esports_id UUID;
    v_carbadmv_id UUID;
    v_tradewinds_id UUID;
    v_trs_id UUID;
BEGIN
    -- Verify tenant exists; abort if not
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
        RAISE EXCEPTION 'MAJH Events tenant (%) not found. Cannot seed departments.', v_tenant_id;
    END IF;

    -- Seed the four MAJH departments
    INSERT INTO public.departments (tenant_id, slug, name, description, sort_order)
    VALUES 
        (v_tenant_id, 'esports', 'MAJH Esports', 
         'Tournaments, streaming, and esports operations layer.', 10),
        (v_tenant_id, 'carbadmv', 'CarBadMV', 
         'Mobile F&B, entertainment hub, and pop-up gaming events. US/DMV-focused.', 20),
        (v_tenant_id, 'tradewinds-rb', 'Tradewinds RB', 
         'F&B catering, logistics, transport, and concierge services. Caribbean-focused.', 30),
        (v_tenant_id, 'trs', 'The Rest Stop (T.R.S.)', 
         'Pop-up gaming cafe footprint. Turnkey retail deployments.', 40)
    ON CONFLICT (tenant_id, slug) DO UPDATE 
    SET name = EXCLUDED.name, 
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();

    -- Capture IDs for location seeding
    SELECT id INTO v_esports_id FROM public.departments 
        WHERE tenant_id = v_tenant_id AND slug = 'esports';
    SELECT id INTO v_carbadmv_id FROM public.departments 
        WHERE tenant_id = v_tenant_id AND slug = 'carbadmv';
    SELECT id INTO v_tradewinds_id FROM public.departments 
        WHERE tenant_id = v_tenant_id AND slug = 'tradewinds-rb';
    SELECT id INTO v_trs_id FROM public.departments 
        WHERE tenant_id = v_tenant_id AND slug = 'trs';

    -- Seed initial locations
    INSERT INTO public.locations (tenant_id, department_id, slug, name, currency, timezone, tax_rate)
    VALUES
        -- CarBadMV: DC Metro
        (v_tenant_id, v_carbadmv_id, 'dc-metro', 'DC Metro Area', 
         'USD', 'America/New_York', 0.0600),
        -- Tradewinds RB: Barbados HQ
        (v_tenant_id, v_tradewinds_id, 'barbados', 'Barbados HQ', 
         'BBD', 'America/Barbados', 0.1750),
        -- Tradewinds RB: St. Lucia (planned)
        (v_tenant_id, v_tradewinds_id, 'st-lucia', 'St. Lucia Hub', 
         'XCD', 'America/St_Lucia', 0.1250),
        -- T.R.S.: Barbados Airport (first kiosk concept)
        (v_tenant_id, v_trs_id, 'bgi-airport', 'Barbados Airport Kiosk', 
         'BBD', 'America/Barbados', 0.1750),
        -- MAJH Esports: Digital/online operations
        (v_tenant_id, v_esports_id, 'digital', 'Digital Operations', 
         'USD', 'America/New_York', 0.0000)
    ON CONFLICT (department_id, slug) DO UPDATE
    SET name = EXCLUDED.name, 
        currency = EXCLUDED.currency, 
        timezone = EXCLUDED.timezone, 
        tax_rate = EXCLUDED.tax_rate,
        updated_at = now();

    RAISE NOTICE 'MAJH OS departments and locations seeded successfully';
END $$;

COMMIT;
