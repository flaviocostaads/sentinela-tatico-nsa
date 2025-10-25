-- Atualizar checkpoints existentes que não têm coordenadas
-- Copiar coordenadas do cliente para o checkpoint
UPDATE checkpoints c
SET 
  lat = cl.lat,
  lng = cl.lng
FROM clients cl
WHERE c.client_id = cl.id
  AND (c.lat IS NULL OR c.lng IS NULL)
  AND cl.lat IS NOT NULL
  AND cl.lng IS NOT NULL;