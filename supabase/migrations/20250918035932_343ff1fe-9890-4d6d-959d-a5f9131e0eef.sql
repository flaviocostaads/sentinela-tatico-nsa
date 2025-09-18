-- Usar um código único para o Bolos do Cerrado - Palmas Brasil Sul
UPDATE checkpoints 
SET 
  qr_code = '{"company":"Bolos do Cerrado - Palmas Brasil Sul","checkpoint":"Loja 01","manualCode":"852963741","type":"checkpoint"}',
  manual_code = '852963741'
WHERE client_id = 'e42805f7-e2d1-44d6-8a6a-cc32609ca026' 
AND name = 'Loja 01';