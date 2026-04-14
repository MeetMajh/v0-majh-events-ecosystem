-- Atomic join tournament function
-- All operations succeed or all fail together

CREATE OR REPLACE FUNCTION join_tournament(
  p_user_id UUID,
  p_tournament_id UUID
) RETURNS JSON AS $$
DECLARE
  v_tournament RECORD;
  v_wallet RECORD;
  v_participant_count INT;
  v_new_balance INT;
BEGIN
  -- 1. Get tournament details
  SELECT id, name, entry_fee_cents, max_participants, status
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
  END IF;

  -- 5. Insert participant
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
  -- Any error will rollback the entire transaction
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION join_tournament(UUID, UUID) TO authenticated;
