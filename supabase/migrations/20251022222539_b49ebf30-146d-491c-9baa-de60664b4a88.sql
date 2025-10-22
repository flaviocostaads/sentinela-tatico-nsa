-- Fix RLS policy to allow tactical users to view template checkpoints for active templates
-- This is needed when creating new rounds, as they don't have an existing round yet

DROP POLICY IF EXISTS "Tactical users can view template checkpoints for their rounds" ON round_template_checkpoints;

-- New policy: Allow tactical users to view checkpoints from active templates
CREATE POLICY "Tactical users can view checkpoints from active templates"
ON round_template_checkpoints
FOR SELECT
USING (
  -- Admins and operators can view all
  check_admin_or_operator_role(auth.uid())
  OR
  -- Tactical users can view checkpoints from active templates
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'tatico'::user_role
    )
    AND
    EXISTS (
      SELECT 1 FROM round_templates
      WHERE round_templates.id = round_template_checkpoints.template_id
      AND round_templates.active = true
    )
  )
);