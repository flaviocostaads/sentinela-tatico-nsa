-- Remove a política que permite usuários autenticados verem integrações
DROP POLICY IF EXISTS "Authenticated users can view enabled integrations" ON public.api_integrations;

-- Garante que apenas admins podem visualizar integrações
CREATE POLICY "Only admins can view API integrations"
ON public.api_integrations
FOR SELECT
TO authenticated
USING (check_admin_role(auth.uid()));

-- A política de gerenciamento para admins já existe e está correta
-- Apenas reforçando que está cobrindo INSERT, UPDATE e DELETE