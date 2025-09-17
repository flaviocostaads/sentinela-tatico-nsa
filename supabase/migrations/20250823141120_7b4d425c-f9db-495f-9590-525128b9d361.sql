-- Create table for API integrations settings
CREATE TABLE public.api_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_name TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage API integrations" 
ON public.api_integrations 
FOR ALL 
USING (check_admin_role(auth.uid()));

CREATE POLICY "Everyone can view enabled integrations" 
ON public.api_integrations 
FOR SELECT 
USING (enabled = true);

-- Create table for notification templates
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'whatsapp', 'email', 'sms'
  subject TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for templates
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for templates
CREATE POLICY "Admins can manage notification templates" 
ON public.notification_templates 
FOR ALL 
USING (check_admin_role(auth.uid()));

CREATE POLICY "Users can view active templates" 
ON public.notification_templates 
FOR SELECT 
USING (active = true);

-- Create table for notification logs
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'delivered'
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for logs
CREATE POLICY "Admins can view all notification logs" 
ON public.notification_logs 
FOR SELECT 
USING (check_admin_role(auth.uid()));

-- Insert default integrations
INSERT INTO public.api_integrations (integration_name, config, enabled) VALUES
('whatsapp_business', '{"api_key": "", "phone_number": "", "webhook_url": ""}', false),
('sendgrid', '{"api_key": "", "from_email": "", "from_name": ""}', false),
('mailchimp', '{"api_key": "", "server_prefix": "", "list_id": ""}', false),
('google_maps', '{"api_key": ""}', false),
('automated_reports', '{"schedule": "daily", "recipients": [], "enabled_reports": []}', false);

-- Insert default notification templates
INSERT INTO public.notification_templates (template_name, template_type, subject, content, variables) VALUES
('round_started', 'whatsapp', null, 'Ronda iniciada: {{round_id}} por {{user_name}} às {{start_time}}', '["round_id", "user_name", "start_time"]'),
('round_completed', 'whatsapp', null, 'Ronda {{round_id}} finalizada às {{end_time}}. Duração: {{duration}}', '["round_id", "end_time", "duration"]'),
('emergency_alert', 'whatsapp', null, '🚨 EMERGÊNCIA: {{incident_type}} reportada por {{user_name}} em {{location}}', '["incident_type", "user_name", "location"]'),
('daily_report', 'email', 'Relatório Diário - {{date}}', 'Relatório de atividades do dia {{date}}<br>Rondas realizadas: {{rounds_count}}<br>Incidentes: {{incidents_count}}', '["date", "rounds_count", "incidents_count"]'),
('weekly_report', 'email', 'Relatório Semanal - Semana {{week}}', 'Resumo semanal das atividades de segurança', '["week", "total_rounds", "total_incidents"]');

-- Create trigger for updated_at
CREATE TRIGGER update_api_integrations_updated_at
BEFORE UPDATE ON public.api_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();