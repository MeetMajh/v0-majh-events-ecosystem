-- T-008: Audit dismissed_stripe_payments rows
-- Run this to understand what exists before planning deletion

-- 1. Check if table exists and get row count
SELECT 
  'dismissed_stripe_payments' as table_name,
  COUNT(*) as total_rows
FROM dismissed_stripe_payments;

-- 2. Get sample of rows with key fields
SELECT 
  id,
  payment_intent_id,
  reason,
  dismissed_at,
  dismissed_by,
  created_at
FROM dismissed_stripe_payments
ORDER BY created_at DESC
LIMIT 20;

-- 3. Breakdown by reason
SELECT 
  reason,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM dismissed_stripe_payments
GROUP BY reason
ORDER BY count DESC;

-- 4. Check for any foreign key dependencies
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (tc.table_name = 'dismissed_stripe_payments' 
       OR ccu.table_name = 'dismissed_stripe_payments');

-- 5. Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'dismissed_stripe_payments';

-- 6. List any policies on the table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'dismissed_stripe_payments';
