import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChecklistItem {
  id: string;
  name: string;
  required: boolean;
}

interface ChecklistCategory {
  category: string;
  categoryLabel: string;
  items: ChecklistItem[];
}

export interface InspectionTemplate {
  id: string;
  name: string;
  vehicle_type: string;
  items: ChecklistCategory[];
  active: boolean;
}

export const useInspectionTemplates = () => {
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (vehicleType?: string) => {
    try {
      let query = supabase
        .from('vehicle_inspection_templates')
        .select('*')
        .eq('active', true);

      if (vehicleType) {
        query = query.eq('vehicle_type', vehicleType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTemplates((data as any) || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates de checklist",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTemplateByVehicleType = (vehicleType: string): InspectionTemplate | null => {
    return templates.find(t => t.vehicle_type === vehicleType) || null;
  };

  return {
    templates,
    loading,
    fetchTemplates,
    getTemplateByVehicleType
  };
};
