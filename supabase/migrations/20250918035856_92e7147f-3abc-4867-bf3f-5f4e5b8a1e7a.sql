-- Corrigir dados inconsistentes dos QR codes para os clientes Bolos do Cerrado
-- Atualizar o checkpoint do "Bolos do Cerrado - Palmas Brasil Sul" com dados corretos
UPDATE checkpoints 
SET 
  qr_code = '{"company":"Bolos do Cerrado - Palmas Brasil Sul","checkpoint":"Loja 01","manualCode":"828194563","type":"checkpoint"}',
  manual_code = '828194563'
WHERE client_id = 'e42805f7-e2d1-44d6-8a6a-cc32609ca026' 
AND name = 'Loja 01';

-- Atualizar outros checkpoints com nomes de empresa corretos
UPDATE checkpoints 
SET qr_code = jsonb_set(
  qr_code::jsonb,
  '{company}',
  to_jsonb(c.name)
)
FROM clients c
WHERE checkpoints.client_id = c.id 
AND checkpoints.qr_code::jsonb->>'company' != c.name;