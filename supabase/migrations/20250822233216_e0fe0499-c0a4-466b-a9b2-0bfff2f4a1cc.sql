-- Secure round_templates and related checkpoints visibility
BEGIN;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.round_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_template_checkpoints ENABLE ROW LEVEL SECURITY;

-- Replace public-readable SELECT policy on round_templates with authenticated-only
DROP POLICY IF EXISTS "Táticos podem ver templates ativos" ON public.round_templates;

CREATE POLICY "Authenticated users can view active round templates"
ON public.round_templates
FOR SELECT
TO authenticated
USING (active = true);

-- Also secure template checkpoints to prevent indirect leakage
DROP POLICY IF EXISTS "Usuários podem ver checkpoints de templates" ON public.round_template_checkpoints;

CREATE POLICY "Authenticated users can view template checkpoints"
ON public.round_template_checkpoints
FOR SELECT
TO authenticated
USING (true);

COMMIT;