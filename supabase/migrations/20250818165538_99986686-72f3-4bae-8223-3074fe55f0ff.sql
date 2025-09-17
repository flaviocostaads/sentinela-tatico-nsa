-- Inserir dados de exemplo para teste
INSERT INTO public.clients (id, name, address, lat, lng, active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Condomínio Residencial Vila', 'Quadra 104 Norte, Palmas - TO', -10.1849, -48.3336, true),
('550e8400-e29b-41d4-a716-446655440002', 'Empresa Logística Express', 'Quadra 106 Sul, Palmas - TO', -10.2134, -48.3248, true),
('550e8400-e29b-41d4-a716-446655440003', 'Shopping Center Norte', 'Quadra 112 Norte, Palmas - TO', -10.1725, -48.3425, true),
('550e8400-e29b-41d4-a716-446655440004', 'Centro Empresarial Sul', 'Quadra 203 Sul, Palmas - TO', -10.2456, -48.3189, true)
ON CONFLICT (id) DO NOTHING;

-- Inserir checkpoints para os clientes
INSERT INTO public.checkpoints (id, client_id, name, description, lat, lng, order_index) VALUES
-- Condomínio Residencial Vila
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Portaria Principal', 'Checkpoint na entrada principal', -10.1849, -48.3336, 1),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Área de Lazer', 'Ronda na área de lazer', -10.1851, -48.3338, 2),
-- Empresa Logística Express
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'Depósito Principal', 'Verificação do depósito', -10.2134, -48.3248, 1),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Pátio de Manobras', 'Ronda no pátio', -10.2136, -48.3246, 2),
-- Shopping Center Norte
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Entrada Principal', 'Portaria do shopping', -10.1725, -48.3425, 1),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Praça de Alimentação', 'Ronda na praça', -10.1723, -48.3427, 2)
ON CONFLICT (id) DO NOTHING;

-- Inserir usuários táticos de exemplo
INSERT INTO public.profiles (id, user_id, name, email, role, active) VALUES
('770e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'José Silva', 'jose.silva@empresa.com', 'tatico', true),
('770e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000002', 'Maria Santos', 'maria.santos@empresa.com', 'tatico', true),
('770e8400-e29b-41d4-a716-446655440003', '00000000-0000-0000-0000-000000000003', 'Carlos Oliveira', 'carlos.oliveira@empresa.com', 'tatico', true)
ON CONFLICT (id) DO NOTHING;

-- Inserir rondas de exemplo
INSERT INTO public.rounds (id, client_id, user_id, vehicle, status, start_time, created_at) VALUES
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'car', 'active', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000002', 'motorcycle', 'active', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '00000000-0000-0000-0000-000000000003', 'car', 'incident', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'),
('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'car', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
('880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000002', 'motorcycle', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;