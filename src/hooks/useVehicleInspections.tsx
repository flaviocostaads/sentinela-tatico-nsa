import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VehicleInspection {
  id: string;
  vehicle_id: string;
  inspector_id: string;
  template_id: string | null;
  inspection_type: string;
  checklist_data: any;
  odometer_reading: number;
  fuel_level: number;
  overall_status: string;
  issues_reported: any;
  notes: string | null;
  signature_data: string | null;
  inspection_date: string;
  shift_start_time: string | null;
  created_at: string;
  vehicles?: {
    license_plate: string;
    model: string;
    brand: string;
  };
  inspector?: {
    name: string;
  };
}

interface InspectionFilters {
  vehicleId?: string;
  inspectorId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const useVehicleInspections = () => {
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async (filters?: InspectionFilters) => {
    try {
      let query = supabase
        .from('vehicle_inspections')
        .select(`
          *,
          vehicles:vehicle_id(license_plate, model, brand),
          inspector:inspector_id(name)
        `)
        .order('inspection_date', { ascending: false });

      if (filters?.vehicleId) {
        query = query.eq('vehicle_id', filters.vehicleId);
      }
      if (filters?.inspectorId) {
        query = query.eq('inspector_id', filters.inspectorId);
      }
      if (filters?.status) {
        query = query.eq('overall_status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('inspection_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('inspection_date', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInspections((data as any) || []);
    } catch (error) {
      console.error('Error fetching inspections:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar inspeções",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createInspection = async (inspectionData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('vehicle_inspections')
        .insert({
          ...inspectionData,
          inspector_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // ===== INTEGRAÇÃO 6: Notificações de Inspeções Críticas =====
      const issuesArray = Array.isArray(data.issues_reported) ? data.issues_reported : [];
      if (data.overall_status === 'rejected' || 
          issuesArray.some((issue: any) => issue.severity === 'critical')) {
        
        // Buscar admins e operadores para notificar
        const { data: managers } = await supabase
          .from('profiles')
          .select('email, name')
          .in('role', ['admin', 'operador']);

        // Enviar notificação por email
        if (managers && managers.length > 0) {
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                to: managers.map(m => m.email),
                subject: `⚠️ Inspeção Crítica - Veículo ${inspectionData.vehicle_id}`,
                html: `
                  <h2>Inspeção Veicular com Problemas Detectados</h2>
                  <p><strong>Status:</strong> ${data.overall_status === 'rejected' ? 'REPROVADO' : 'COM PROBLEMAS CRÍTICOS'}</p>
                  <p><strong>Veículo:</strong> ${inspectionData.vehicle_id}</p>
                  <p><strong>Odômetro:</strong> ${data.odometer_reading} km</p>
                  <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                  <br>
                  <p><strong>Ação Necessária:</strong> Verifique os detalhes da inspeção no sistema imediatamente.</p>
                `,
                template_name: 'critical_inspection'
              }
            });
          } catch (emailError) {
            console.error('Error sending inspection notification email:', emailError);
          }
        }
      }

      // ===== INTEGRAÇÃO 7: Link com Manutenção =====
      const issuesForMaintenance = Array.isArray(inspectionData.issues_reported) ? inspectionData.issues_reported : [];
      const criticalIssues = issuesForMaintenance.filter(
        (issue: any) => issue.severity === 'critical'
      );

      if (criticalIssues && criticalIssues.length > 0) {
        const maintenanceDescription = criticalIssues
          .map((issue: any) => `- ${issue.item_name}: ${issue.description}`)
          .join('\n');

        // Criar solicitação de manutenção automática
        await supabase
          .from('vehicle_maintenance_logs')
          .insert({
            vehicle_id: inspectionData.vehicle_id,
            service_type: 'corretiva',
            maintenance_type: 'emergency',
            description: `🔴 URGENTE - Problemas encontrados na inspeção veicular:\n\n${maintenanceDescription}\n\nInspeção ID: ${data.id}`,
            odometer_reading: data.odometer_reading,
            created_by: user.id,
            start_time: new Date().toISOString(),
            status: 'pending'
          });

        toast({
          title: "⚠️ Manutenção Solicitada",
          description: "Problemas críticos geraram solicitação automática de manutenção",
          variant: "default"
        });
      }

      toast({
        title: "Sucesso",
        description: "Inspeção registrada com sucesso"
      });

      fetchInspections();
      return data;
    } catch (error) {
      console.error('Error creating inspection:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar inspeção",
        variant: "destructive"
      });
      throw error;
    }
  };

  const getInspectionById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_inspections')
        .select(`
          *,
          vehicles:vehicle_id(license_plate, model, brand, type),
          inspector:inspector_id(name, email),
          vehicle_inspection_photos(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching inspection:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da inspeção",
        variant: "destructive"
      });
      return null;
    }
  };

  const checkVehicleHasValidInspection = async (vehicleId: string): Promise<boolean> => {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('vehicle_inspections')
        .select('id, overall_status')
        .eq('vehicle_id', vehicleId)
        .in('overall_status', ['approved', 'approved_with_issues'])
        .gte('inspection_date', twentyFourHoursAgo.toISOString())
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0);
    } catch (error) {
      console.error('Error checking vehicle inspection:', error);
      return false;
    }
  };

  const getInspectionStats = () => {
    const total = inspections.length;
    const approved = inspections.filter(i => i.overall_status === 'approved').length;
    const withIssues = inspections.filter(i => i.overall_status === 'approved_with_issues').length;
    const rejected = inspections.filter(i => i.overall_status === 'rejected').length;

    return { total, approved, withIssues, rejected };
  };

  return {
    inspections,
    loading,
    fetchInspections,
    createInspection,
    getInspectionById,
    checkVehicleHasValidInspection,
    getInspectionStats
  };
};
