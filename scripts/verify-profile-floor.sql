-- verify-profile-floor.sql
--
-- Does the proposed column floor on public.profiles break anything?
--
-- Run this BEFORE applying the floor, and again AFTER. It applies the
-- proposed grant for real, exercises every query shape the application
-- actually runs, asserts the privacy outcome, and then ALWAYS rolls back by
-- raising an exception. There is no code path in which the grant change
-- persists: the final RAISE is unconditional, and Postgres rolls back DDL
-- and DCL with the transaction like anything else.
--
-- The output arrives AS the error message. That is intended. An error here
-- means the simulation completed and undid itself; read `pass=` and `fail=`.
--
--   pass=N fail=0   the floor is safe to apply
--   fail>0          the named flow breaks; fix it before applying
--
-- Why this works rather than merely looking safe: column privileges are
-- checked BEFORE row-level security, so a query that returns zero rows has
-- already passed the column check. Row visibility and column privilege are
-- independent, and this script tests the second one.
--
-- Zero configuration. It picks its own subjects, so it keeps working as the
-- data changes and for a tenant that does not exist yet. Override with:
--   select set_config('verify.self',  '<uuid>', false);
--   select set_config('verify.other', '<uuid>', false);
--
-- Companion: scripts/check-profile-reads.py checks the APPLICATION for reads
-- of withheld columns. This checks the DATABASE. Migration 047 passed a
-- careful application analysis and still broke eight tables, because the
-- dependency was in RLS policies rather than in any TypeScript file. Run
-- both.

do $$
declare
  -- The proposed grant, declared ONCE. Keep in step with the floor
  -- migration and with check-profile-reads.py.
  cols constant text :=
    'id, username, display_name, first_name, last_name, avatar_url, country, '
    'created_at, rating, career_wins, career_losses, career_tournaments, '
    'prediction_points, predictions_correct, predictions_total, '
    'follower_count, following_count, total_uploads, approved_uploads, '
    'is_organizer, '
    -- each of the three below is required by a real user-scoped read:
    'role, '        -- lib/authorization.ts        select("role, is_organizer")
    'is_admin, '    -- lib/wallet-actions.ts x7    select("is_admin")
    'tenant_id';    -- admin/financials + 3 components

  self  uuid;
  other uuid;
  out   text := E'\n';
  n     bigint;
  pass  int := 0;
  fail  int := 0;
begin
  -- ---- subjects ---------------------------------------------------------
  self := nullif(current_setting('verify.self', true), '')::uuid;
  other := nullif(current_setting('verify.other', true), '')::uuid;

  if self is null then
    select id into self from public.profiles order by created_at nulls last limit 1;
  end if;
  if other is null then
    select id into other from public.profiles where id <> self limit 1;
  end if;
  if self is null or other is null then
    raise exception 'verify-profile-floor: need at least two profile rows '
                    '(self=%, other=%)', self, other;
  end if;

  -- ---- apply the proposed floor ----------------------------------------
  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
  out := out || format('floor applied: %s columns to authenticated%s',
                       array_length(string_to_array(cols, ','), 1), E'\n');
  out := out || format('subjects: self=%s other=%s%s', self, other, E'\n\n');

  -- =======================================================================
  -- FUNCTIONALITY: every shape the application actually runs
  -- =======================================================================

  -- 1. financials -- own row through the view, and the tenant lookup
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    select count(*) into n from public.my_profile;
    if n <> 1 then raise exception 'my_profile returned % rows, expected 1', n; end if;
    out := out || 'PASS  financials      my_profile own row' || E'\n'; pass := pass + 1;
  exception when others then
    out := out || format('FAIL  financials      my_profile -> %s %s%s',
                         sqlstate, left(sqlerrm, 50), E'\n'); fail := fail + 1;
  end; reset role;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform id, tenant_id from public.profiles where id = self;
    out := out || 'PASS  financials      profiles id,tenant_id' || E'\n'; pass := pass + 1;
  exception when others then
    out := out || format('FAIL  financials      id,tenant_id -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  -- 2. withdraw
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform id, kyc_verified, stripe_connect_account_id,
            stripe_connect_payouts_enabled from public.my_profile;
    out := out || 'PASS  withdraw        my_profile kyc + connect columns' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  withdraw        my_profile -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform id, is_admin from public.profiles where id = self;
    out := out || 'PASS  withdraw        profiles id,is_admin' || E'\n'; pass := pass + 1;
  exception when others then
    out := out || format('FAIL  withdraw        id,is_admin -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  -- 3. payout methods
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform id, stripe_connect_account_id, stripe_connect_payouts_enabled,
            stripe_connect_status, preferred_payout_method
       from public.my_profile;
    out := out || 'PASS  payout methods  my_profile connect columns' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  payout methods  my_profile -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  -- 4. admin user list -- the SERVICE acting, must be untouched by the grant
  begin
    set local role service_role;
    select count(*) into n from public.profiles;
    perform * from public.profiles limit 1;
    out := out || format('PASS  admin users     service_role select * (%s rows)%s',
                         n, E'\n'); pass := pass + 1;
  exception when others then
    out := out || format('FAIL  admin users     service_role select * -> %s%s',
                         sqlstate, E'\n'); fail := fail + 1;
  end; reset role;

  -- 5. compliance -- counting BY a withheld column, as the service
  begin
    set local role service_role;
    select count(*) into n from public.profiles where kyc_status = 'pending';
    out := out || 'PASS  compliance      service_role count by kyc_status' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  compliance      kyc_status count -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform display_name, username from public.profiles limit 1;
    out := out || 'PASS  compliance      embedded display_name,username' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  compliance      embed -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  -- 6. analytics -- a count, and a filter+order on a granted column
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    select count(*) into n from public.profiles;
    out := out || 'PASS  analytics       count' || E'\n'; pass := pass + 1;
  exception when others then
    out := out || format('FAIL  analytics       count -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform id, created_at from public.profiles
      where created_at > now() - interval '30 days' order by created_at;
    out := out || 'PASS  analytics       id,created_at filter + order' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  analytics       created_at filter/order -> %s%s',
                         sqlstate, E'\n'); fail := fail + 1;
  end; reset role;

  -- 7. authorization.ts -- central, read by many pages
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform role, is_organizer from public.profiles where id = self;
    out := out || 'PASS  authorization   profiles role,is_organizer' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  authorization   role,is_organizer -> %s%s', sqlstate, E'\n');
    fail := fail + 1;
  end; reset role;

  -- 8. the eight tables whose POLICIES read profiles (migration 049).
  --    Anonymous reachability is what 047 broke, so it is asserted here too.
  declare
    t text;
    tbls text[] := array['analytics_events','dismissed_stripe_payments',
                         'player_media','role_change_logs','role_requests',
                         'staff_roles','stream_sources','user_streams'];
    broke int := 0;
  begin
    foreach t in array tbls loop
      begin
        set local role anon;
        execute format('select count(*) from public.%I', t) into n;
      exception when others then broke := broke + 1;
      end;
      reset role;
    end loop;
    if broke = 0 then
      out := out || 'PASS  policy tables   all 8 readable by anon (049 holding)' || E'\n';
      pass := pass + 1;
    else
      out := out || format('FAIL  policy tables   %s of 8 refuse anon%s', broke, E'\n');
      fail := fail + 1;
    end if;
  end;

  -- =======================================================================
  -- PRIVACY: a PASS here means the floor actually does its job
  -- =======================================================================
  out := out || E'\n';

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform phone from public.profiles where id = other;
    out := out || 'FAIL  privacy         another user''s phone STILL READABLE' || E'\n';
    fail := fail + 1;
  exception when insufficient_privilege then
    out := out || 'PASS  privacy         another user''s phone refused (42501)' || E'\n';
    pass := pass + 1;
  when others then
    out := out || format('????  privacy         phone -> %s%s', sqlstate, E'\n');
  end; reset role;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform * from public.profiles where id = other;
    out := out || 'FAIL  privacy         select * on another row STILL WORKS' || E'\n';
    fail := fail + 1;
  exception when insufficient_privilege then
    out := out || 'PASS  privacy         select * refused (42501)' || E'\n';
    pass := pass + 1;
  when others then
    out := out || format('????  privacy         select * -> %s%s', sqlstate, E'\n');
  end; reset role;

  -- a FILTER on a withheld column must fail too, not just a select of it
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    select count(*) into n from public.profiles where ssn_last_four is not null;
    out := out || 'FAIL  privacy         FILTER on ssn_last_four STILL WORKS' || E'\n';
    fail := fail + 1;
  exception when insufficient_privilege then
    out := out || 'PASS  privacy         filter on ssn_last_four refused (42501)' || E'\n';
    pass := pass + 1;
  when others then
    out := out || format('????  privacy         ssn filter -> %s%s', sqlstate, E'\n');
  end; reset role;

  -- and the owner must still reach their own withheld columns
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', self::text, true);
    perform phone, address_line1, ssn_last_four from public.my_profile;
    out := out || 'PASS  privacy         own withheld columns via my_profile OK' || E'\n';
    pass := pass + 1;
  exception when others then
    out := out || format('FAIL  privacy         own row via my_profile -> %s%s',
                         sqlstate, E'\n'); fail := fail + 1;
  end; reset role;

  perform set_config('request.jwt.claim.sub', '', true);

  -- ---- unconditional rollback ------------------------------------------
  raise exception E'VERIFY PROFILE FLOOR  pass=% fail=%  [grants ROLLED BACK]%',
                  pass, fail, out;
end $$;
