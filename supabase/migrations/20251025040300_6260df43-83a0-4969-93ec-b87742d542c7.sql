-- Adicionar coluna is_base à tabela clients
ALTER TABLE clients ADD COLUMN is_base BOOLEAN DEFAULT false;

-- Criar índice para buscar a base rapidamente
CREATE INDEX idx_clients_is_base ON clients(is_base) WHERE is_base = true;

-- Garantir que só possa existir UMA base ativa
CREATE UNIQUE INDEX idx_clients_unique_active_base ON clients(is_base) WHERE is_base = true AND active = true;

-- Comentário na coluna
COMMENT ON COLUMN clients.is_base IS 'Identifica se o cliente é a BASE de operações (ponto de saída/retorno)';