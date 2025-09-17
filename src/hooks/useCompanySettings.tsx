import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanySettings {
  id?: string;
  companyName: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
}

export const useCompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: 'Sentinela Tático NSA',
    description: 'Sistema de Gestão de Rondas Táticas', 
    address: '',
    phone: '',
    email: '',
    logoUrl: ''
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: companySettings, error } = await supabase
        .from("company_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && companySettings) {
        setSettings({
          id: companySettings.id,
          companyName: companySettings.company_name || 'Sentinela Tático NSA',
          description: companySettings.description || 'Sistema de Gestão de Rondas Táticas',
          address: companySettings.address || '',
          phone: companySettings.phone || '',
          email: companySettings.email || '',
          logoUrl: companySettings.logo_url || '',
        });
      }
    } catch (error) {
      console.error("Error loading company settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    refresh: loadSettings
  };
};