-- ============================================
-- ESCROW SYSTEM FOR TOURNAMENTS
-- ============================================

-- 1. Link escrow_accounts to tournaments
ALTER TABLE escrow_accounts
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);

CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tournament 
ON escrow_accounts(tournament_id);

-- 2. Create tournament_payouts table
CREATE TABLE IF NOT EXISTS tournament_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  position INTEGER NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_payouts_tournament ON tournament_payouts(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payouts_user ON tournament_payouts(user_id);

-- RLS for tournament_payouts
ALTER TABLE tournament_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payouts" ON tournament_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage payouts" ON tournament_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- ============================================
-- UPDATED JOIN TOURNAMENT FUNCTION (WITH ESCROW)
-- ============================================

CREATE OR REPLACE FUNCTION join_tournament(
  p_user_id UUID,
  p_tournament_id UUID
) RETURNS JSON AS $$
DECLARE
  v_tournament RECORD;
  v_wallet RECORD;
  v_escrow RECORD;
  v_participant_count INT;
  v_new_balance INT;
BEGIN
  -- 1. Get tournament details
  SELECT id, name, entry_fee_cents, max_participants, status, prize_pool_cents
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;

  IF v_tournament IS NULL THEN
    RETURN json_build_object('error', 'Tournament not found');
  END IF;

  IF v_tournament.status != 'registration' THEN
    RETURN json_build_object('error', 'Tournament is not open for registration');
  END IF;

  -- 2. Check if already registered
  IF EXISTS (
    SELECT 1 FROM tournament_participants 
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id
  ) THEN
    RETURN json_build_object('error', 'Already registered for this tournament');
  END IF;

  -- 3. Check capacity
  IF v_tournament.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_participant_count
    FROM tournament_participants
    WHERE tournament_id = p_tournament_id;

    IF v_participant_count >= v_tournament.max_participants THEN
      RETURN json_build_object('error', 'Tournament is full');
    END IF;
  END IF;

  -- 4. Handle payment if entry fee exists
  IF v_tournament.entry_fee_cents > 0 THEN
    -- Get wallet with row lock
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_wallet IS NULL THEN
      RETURN json_build_object('error', 'No wallet found. Please add funds first.');
    END IF;

    IF v_wallet.balance_cents < v_tournament.entry_fee_cents THEN
      RETURN json_build_object(
        'error', 'Insufficient funds',
        'insufficientFunds', true,
        'balanceCents', v_wallet.balance_cents,
        'requiredCents', v_tournament.entry_fee_cents
      );
    END IF;

    -- Deduct from wallet
    v_new_balance := v_wallet.balance_cents - v_tournament.entry_fee_cents;
    
    UPDATE wallets
    SET balance_cents = v_new_balance, updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Record transaction
    INSERT INTO financial_transactions (
      user_id,
      amount_cents,
      type,
      status,
      description,
      reference_type,
      reference_id
    ) VALUES (
      p_user_id,
      -v_tournament.entry_fee_cents,
      'entry_fee',
      'completed',
      'Entry fee for ' || v_tournament.name,
      'tournament',
      p_tournament_id
    );

    -- 5. Fund escrow (NEW STEP)
    -- Get or create escrow account for this tournament
    SELECT * INTO v_escrow
    FROM escrow_accounts
    WHERE tournament_id = p_tournament_id
    FOR UPDATE;

    IF v_escrow IS NULL THEN
      -- Create escrow account for tournament
      INSERT INTO escrow_accounts (
        tournament_id,
        amount_cents,
        funded_amount_cents,
        status
      ) VALUES (
        p_tournament_id,
        COALESCE(v_tournament.prize_pool_cents, 0),
        v_tournament.entry_fee_cents,
        'pending'
      );
    ELSE
      -- Update existing escrow
      UPDATE escrow_accounts
      SET 
        funded_amount_cents = funded_amount_cents + v_tournament.entry_fee_cents,
        updated_at = NOW(),
        status = CASE 
          WHEN funded_amount_cents + v_tournament.entry_fee_cents >= amount_cents THEN 'funded'
          ELSE status
        END
      WHERE tournament_id = p_tournament_id;
    END IF;
  END IF;

  -- 6. Insert participant
  INSERT INTO tournament_participants (
    tournament_id,
    user_id,
    status,
    payment_status,
    registered_at
  ) VALUES (
    p_tournament_id,
    p_user_id,
    'registered',
    CASE WHEN v_tournament.entry_fee_cents > 0 THEN 'paid' ELSE 'free' END,
    NOW()
  );

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PAYOUT DISTRIBUTION FUNCTION (ATOMIC)
-- ============================================

CREATE OR REPLACE FUNCTION distribute_tournament_payouts(
  p_tournament_id UUID,
  p_payouts JSONB  -- Array of {user_id, amount_cents, position}
) RETURNS JSON AS $$
DECLARE
  v_tournament RECORD;
  v_escrow RECORD;
  v_payout RECORD;
  v_total_payout INT := 0;
  v_platform_fee INT := 0;
  v_platform_fee_percent NUMERIC;
BEGIN
  -- 1. Get tournament
  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;

  IF v_tournament IS NULL THEN
    RETURN json_build_object('error', 'Tournament not found');
  END IF;

  IF v_tournament.status != 'completed' THEN
    RETURN json_build_object('error', 'Tournament must be completed before payouts');
  END IF;

  -- 2. Get escrow with lock
  SELECT * INTO v_escrow
  FROM escrow_accounts
  WHERE tournament_id = p_tournament_id
  FOR UPDATE;

  IF v_escrow IS NULL THEN
    RETURN json_build_object('error', 'No escrow account found for tournament');
  END IF;

  IF v_escrow.status = 'released' THEN
    RETURN json_build_object('error', 'Payouts already distributed');
  END IF;

  -- 3. Calculate platform fee (default 5% if not set)
  v_platform_fee_percent := COALESCE(v_tournament.platform_fee_percent, 5);
  v_platform_fee := (v_escrow.funded_amount_cents * v_platform_fee_percent / 100)::INT;

  -- 4. Process each payout
  FOR v_payout IN SELECT * FROM jsonb_to_recordset(p_payouts) AS x(user_id UUID, amount_cents INT, position INT)
  LOOP
    v_total_payout := v_total_payout + v_payout.amount_cents;

    -- Insert payout record
    INSERT INTO tournament_payouts (
      tournament_id,
      user_id,
      amount_cents,
      position,
      paid,
      paid_at
    ) VALUES (
      p_tournament_id,
      v_payout.user_id,
      v_payout.amount_cents,
      v_payout.position,
      TRUE,
      NOW()
    );

    -- Credit winner's wallet
    UPDATE wallets
    SET balance_cents = balance_cents + v_payout.amount_cents,
        updated_at = NOW()
    WHERE user_id = v_payout.user_id;

    -- If wallet doesn't exist, create it
    IF NOT FOUND THEN
      INSERT INTO wallets (user_id, balance_cents)
      VALUES (v_payout.user_id, v_payout.amount_cents);
    END IF;

    -- Record transaction
    INSERT INTO financial_transactions (
      user_id,
      amount_cents,
      type,
      status,
      description,
      reference_type,
      reference_id
    ) VALUES (
      v_payout.user_id,
      v_payout.amount_cents,
      'prize',
      'completed',
      'Prize for ' || v_tournament.name || ' (Position: ' || v_payout.position || ')',
      'tournament',
      p_tournament_id
    );
  END LOOP;

  -- 5. Validate total doesn't exceed escrow
  IF v_total_payout > (v_escrow.funded_amount_cents - v_platform_fee) THEN
    RAISE EXCEPTION 'Total payouts exceed available escrow funds';
  END IF;

  -- 6. Mark escrow as released
  UPDATE escrow_accounts
  SET 
    status = 'released',
    released_at = NOW(),
    updated_at = NOW()
  WHERE tournament_id = p_tournament_id;

  -- 7. Record platform fee transaction (if any)
  IF v_platform_fee > 0 THEN
    INSERT INTO financial_transactions (
      user_id,
      amount_cents,
      type,
      status,
      description,
      reference_type,
      reference_id
    ) VALUES (
      -- Platform account (use first admin or system account)
      (SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1),
      v_platform_fee,
      'platform_fee',
      'completed',
      'Platform fee from ' || v_tournament.name,
      'tournament',
      p_tournament_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'totalPayout', v_total_payout,
    'platformFee', v_platform_fee,
    'payoutsCount', jsonb_array_length(p_payouts)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION join_tournament(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION distribute_tournament_payouts(UUID, JSONB) TO authenticated;
