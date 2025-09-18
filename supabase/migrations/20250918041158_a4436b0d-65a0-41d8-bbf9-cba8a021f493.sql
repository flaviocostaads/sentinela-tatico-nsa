-- Fix inconsistent manual codes for better validation
UPDATE checkpoints 
SET manual_code = '828194563' 
WHERE name LIKE '%Bolos do Cerrado - Palmas Brasil Sul%' 
AND (manual_code IS NULL OR manual_code = '');

-- Ensure all checkpoints have proper manual codes
UPDATE checkpoints 
SET manual_code = COALESCE(manual_code, LPAD((RANDOM() * 999999999)::INTEGER::TEXT, 9, '0'))
WHERE manual_code IS NULL OR manual_code = '';

-- Add index for faster manual code lookups
CREATE INDEX IF NOT EXISTS idx_checkpoints_manual_code ON checkpoints(manual_code);
CREATE INDEX IF NOT EXISTS idx_checkpoint_visits_lookup ON checkpoint_visits(checkpoint_id, round_id);