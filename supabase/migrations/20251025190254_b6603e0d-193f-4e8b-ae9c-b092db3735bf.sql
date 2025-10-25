-- Adicionar colunas para fotos e problemas relatados nas inspeções
ALTER TABLE vehicle_inspections
ADD COLUMN IF NOT EXISTS general_issues_photos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reported_problems JSONB DEFAULT '[]'::jsonb;

-- Adicionar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_inspector ON vehicle_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle ON vehicle_inspections(vehicle_id);

-- Criar política RLS para táticos visualizarem apenas suas próprias inspeções
DROP POLICY IF EXISTS "taticos_view_own_inspections" ON vehicle_inspections;
CREATE POLICY "taticos_view_own_inspections"
ON vehicle_inspections FOR SELECT
USING (
  inspector_id = auth.uid() 
  OR check_admin_or_operator_role(auth.uid())
);

-- Criar política RLS para táticos criarem inspeções
DROP POLICY IF EXISTS "taticos_create_inspections" ON vehicle_inspections;
CREATE POLICY "taticos_create_inspections"
ON vehicle_inspections FOR INSERT
WITH CHECK (inspector_id = auth.uid());

-- Apenas admins podem atualizar inspeções
DROP POLICY IF EXISTS "admins_update_inspections" ON vehicle_inspections;
CREATE POLICY "admins_update_inspections"
ON vehicle_inspections FOR UPDATE
USING (check_admin_role(auth.uid()));

-- Apenas admins podem deletar inspeções
DROP POLICY IF EXISTS "admins_delete_inspections" ON vehicle_inspections;
CREATE POLICY "admins_delete_inspections"
ON vehicle_inspections FOR DELETE
USING (check_admin_role(auth.uid()));

-- Comentários explicativos
COMMENT ON COLUMN vehicle_inspections.general_issues_photos IS 'Array de URLs de fotos de avarias gerais do veículo';
COMMENT ON COLUMN vehicle_inspections.reported_problems IS 'JSON array com problemas relatados em itens específicos do checklist';

-- Exemplo de estrutura do reported_problems:
-- [
--   {
--     "item_id": "oil_level",
--     "category": "motor",
--     "problem_description": "Óleo escuro, necessita troca",
--     "severity": "medium",
--     "photo_urls": ["url1", "url2"]
--   }
-- ]