-- Alterar a coluna user_id da tabela rounds para permitir NULL
ALTER TABLE public.rounds
ALTER COLUMN user_id DROP NOT NULL;

-- Atualizar a policy de visualização de rondas para táticos
DROP POLICY IF EXISTS "Users can view assigned rounds only" ON public.rounds;

CREATE POLICY "Users can view assigned rounds and unassigned rounds"
ON public.rounds
FOR SELECT
USING (
  -- Admin e operador podem ver tudo
  check_admin_or_operator_role(auth.uid()) 
  OR 
  -- Táticos podem ver suas rondas atribuídas
  (auth.uid() = user_id) 
  OR 
  -- Táticos podem ver rondas não atribuídas (user_id NULL)
  (user_id IS NULL AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'tatico'::user_role
  ))
  OR 
  -- Rondas com atribuição específica
  (EXISTS (
    SELECT 1 FROM round_assignments ra
    WHERE ra.round_id = rounds.id AND ra.user_id = auth.uid()
  ))
);

-- Atualizar a policy de criação de rondas
DROP POLICY IF EXISTS "Taticos can create rounds" ON public.rounds;

CREATE POLICY "Taticos can create rounds"
ON public.rounds
FOR INSERT
WITH CHECK (
  -- Admins e operadores podem criar rondas sem user_id
  (user_id IS NULL AND check_admin_or_operator_role(auth.uid()))
  OR
  -- Ou criar rondas atribuídas a si mesmos
  (auth.uid() = user_id)
  OR
  -- Ou se for admin/operador/tático e estiver criando
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'tatico'::user_role])
  ))
);

-- Atualizar a policy de update para permitir que táticos assumam rondas não atribuídas
DROP POLICY IF EXISTS "Taticos can update their own rounds" ON public.rounds;

CREATE POLICY "Taticos can update their own rounds"
ON public.rounds
FOR UPDATE
USING (
  -- Pode atualizar suas próprias rondas
  (auth.uid() = user_id)
  OR
  -- Ou rondas não atribuídas (para assumir a ronda)
  (user_id IS NULL AND EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'tatico'::user_role
  ))
  OR
  -- Admin e operador podem atualizar tudo
  check_admin_or_operator_role(auth.uid())
);