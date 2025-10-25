-- ============================================
-- MIGRATION: Fix RLS for Tactical Users
-- Permite táticos visualizar clientes e checkpoints ativos
-- ============================================

-- 1. Remover políticas antigas restritivas de CLIENTS
DROP POLICY IF EXISTS "Tactical users can view clients from active round templates" ON public.clients;
DROP POLICY IF EXISTS "Users can view assigned clients only" ON public.clients;

-- 2. Criar nova política permissiva para CLIENTS
CREATE POLICY "Tactical users can view all active clients"
ON public.clients
FOR SELECT
USING (
  active = true 
  AND (
    check_admin_or_operator_role(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'tatico'::user_role
      AND active = true
    )
  )
);

-- 3. Remover política antiga restritiva de CHECKPOINTS
DROP POLICY IF EXISTS "Users can view checkpoints for assigned clients" ON public.checkpoints;

-- 4. Criar nova política permissiva para CHECKPOINTS
CREATE POLICY "Tactical users can view all active checkpoints"
ON public.checkpoints
FOR SELECT
USING (
  active = true 
  AND (
    check_admin_or_operator_role(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'tatico'::user_role
      AND active = true
    )
  )
);