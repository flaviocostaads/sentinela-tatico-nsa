import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ApiIntegration {
  id: string;
  integration_name: string;
  config: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  template_name: string;
  template_type: string;
  subject?: string;
  content: string;
  variables: string[];
  active: boolean;
}

export const useApiIntegrations = () => {
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('*')
        .order('integration_name');

      if (error) throw error;
      setIntegrations((data || []).map(item => ({
        ...item,
        config: item.config as Record<string, any>
      })));
    } catch (error) {
      console.error('Error loading integrations:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar integrações",
        variant: "destructive",
      });
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('template_name');

      if (error) throw error;
      setTemplates((data || []).map(item => ({
        ...item,
        variables: item.variables as string[]
      })));
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Erro", 
        description: "Falha ao carregar templates",
        variant: "destructive",
      });
    }
  };

  const updateIntegration = async (integrationName: string, config: Record<string, any>, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('api_integrations')
        .update({ config, enabled })
        .eq('integration_name', integrationName);

      if (error) throw error;
      
      await loadIntegrations();
      toast({
        title: "Sucesso",
        description: "Integração atualizada com sucesso",
      });
    } catch (error) {
      console.error('Error updating integration:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar integração",
        variant: "destructive",
      });
    }
  };

  const testWhatsApp = async (phone: string, message: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone,
          message,
          template_name: 'test_message'
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Mensagem WhatsApp enviada com sucesso",
      });
      
      return data;
    } catch (error) {
      console.error('Error testing WhatsApp:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem WhatsApp",
        variant: "destructive",
      });
      throw error;
    }
  };

  const testEmail = async (email: string, subject: string, content: string, provider: string = 'sendgrid') => {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject,
          html: content,
          template_name: 'test_email',
          provider
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Email enviado com sucesso",
      });
      
      return data;
    } catch (error) {
      console.error('Error testing email:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar email",
        variant: "destructive",
      });
      throw error;
    }
  };

  const generateReport = async (type: string, startDate: string, endDate: string, recipients?: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          report_type: type,
          start_date: startDate,
          end_date: endDate,
          recipients
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Relatório gerado e enviado com sucesso",
      });
      
      return data;
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro", 
        description: "Falha ao gerar relatório",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await Promise.all([loadIntegrations(), loadTemplates()]);
      setLoading(false);
    };

    initialize();
  }, []);

  return {
    integrations,
    templates,
    loading,
    updateIntegration,
    testWhatsApp,
    testEmail,
    generateReport,
    refreshData: () => Promise.all([loadIntegrations(), loadTemplates()])
  };
};