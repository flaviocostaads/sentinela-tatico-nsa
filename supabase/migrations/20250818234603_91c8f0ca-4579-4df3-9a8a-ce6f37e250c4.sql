-- Criar tabela para templates de rondas (trajetos definidos pelo admin)
CREATE TABLE public.round_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('diurno', 'noturno')),
  rounds_per_shift INTEGER NOT NULL DEFAULT 3,
  interval_hours INTEGER NOT NULL DEFAULT 4,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Criar tabela para os checkpoints do template (empresas em ordem)
CREATE TABLE public.round_template_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.round_templates(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  estimated_duration_minutes INTEGER DEFAULT 15,
  required_signature BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para agendamento de rondas (alertas automáticos)
CREATE TABLE public.round_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.round_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Modificar a tabela rounds para incluir template e progresso
ALTER TABLE public.rounds ADD COLUMN template_id UUID REFERENCES public.round_templates(id);
ALTER TABLE public.rounds ADD COLUMN current_checkpoint_index INTEGER DEFAULT 0;
ALTER TABLE public.rounds ADD COLUMN round_number INTEGER DEFAULT 1;

-- Habilitar RLS
ALTER TABLE public.round_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_template_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para round_templates
CREATE POLICY "Admins e operadores podem gerenciar templates" 
ON public.round_templates 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'operador')
));

CREATE POLICY "Táticos podem ver templates ativos" 
ON public.round_templates 
FOR SELECT 
USING (active = true);

-- Políticas RLS para round_template_checkpoints
CREATE POLICY "Usuários podem ver checkpoints de templates" 
ON public.round_template_checkpoints 
FOR SELECT 
USING (true);

CREATE POLICY "Admins e operadores podem gerenciar checkpoints" 
ON public.round_template_checkpoints 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'operador')
));

-- Políticas RLS para round_schedules
CREATE POLICY "Usuários podem ver seus agendamentos" 
ON public.round_schedules 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins e operadores podem gerenciar agendamentos" 
ON public.round_schedules 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'operador')
));

-- Criar triggers para atualizar updated_at
CREATE TRIGGER update_round_templates_updated_at
  BEFORE UPDATE ON public.round_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_round_templates_active ON public.round_templates(active);
CREATE INDEX idx_round_template_checkpoints_template ON public.round_template_checkpoints(template_id, order_index);
CREATE INDEX idx_round_schedules_user ON public.round_schedules(user_id, active);
CREATE INDEX idx_rounds_template ON public.rounds(template_id);