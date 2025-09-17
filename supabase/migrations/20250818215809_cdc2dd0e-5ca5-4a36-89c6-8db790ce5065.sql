-- Remover dados de exemplo/mock (José, Maria, Carlos)
DELETE FROM route_points WHERE round_id IN (
  SELECT id FROM rounds WHERE user_id IN (
    SELECT user_id FROM profiles WHERE name IN ('José Silva', 'Maria Santos', 'Carlos Oliveira')
  )
);

DELETE FROM checkpoint_visits WHERE round_id IN (
  SELECT id FROM rounds WHERE user_id IN (
    SELECT user_id FROM profiles WHERE name IN ('José Silva', 'Maria Santos', 'Carlos Oliveira')
  )
);

DELETE FROM incidents WHERE round_id IN (
  SELECT id FROM rounds WHERE user_id IN (
    SELECT user_id FROM profiles WHERE name IN ('José Silva', 'Maria Santos', 'Carlos Oliveira')
  )
);

DELETE FROM photos WHERE round_id IN (
  SELECT id FROM rounds WHERE user_id IN (
    SELECT user_id FROM profiles WHERE name IN ('José Silva', 'Maria Santos', 'Carlos Oliveira')
  )
);

DELETE FROM rounds WHERE user_id IN (
  SELECT user_id FROM profiles WHERE name IN ('José Silva', 'Maria Santos', 'Carlos Oliveira')
);

-- Não deletar os profiles pois podem ser usuários reais que foram cadastrados