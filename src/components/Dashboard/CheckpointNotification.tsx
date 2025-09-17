import { useEffect } from 'react';
import { CheckCircle, MapPin, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CheckpointNotificationProps {
  enabled?: boolean;
}

interface CheckpointVisitNotification {
  id: string;
  checkpoint_id: string;
  round_id: string;
  visit_time: string;
  checkpoints?: {
    name: string;
    clients?: {
      name: string;
    };
  };
  rounds?: {
    user_id: string;
    profiles?: {
      name: string;
    };
  };
}

const CheckpointNotification = ({ enabled = true }: CheckpointNotificationProps) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('checkpoint-visit-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'checkpoint_visits'
      }, async (payload) => {
        console.log('New checkpoint visit:', payload);
        
        // Get detailed information about the visit
        try {
          const { data: visitData, error } = await supabase
            .from('checkpoint_visits')
            .select(`
              *,
              rounds!inner (
                user_id,
                profiles!inner (name)
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (error) throw error;

          const visit = visitData as any;
          
          // Try to get checkpoint name from template checkpoints
          let checkpointName = 'Checkpoint';
          
          if (visit.checkpoint_id.startsWith('template_')) {
            const templateId = visit.checkpoint_id.replace('template_', '');
            const { data: templateData } = await supabase
              .from('round_template_checkpoints')
              .select(`
                clients (name)
              `)
              .eq('id', templateId)
              .single();
            
            if (templateData?.clients?.name) {
              checkpointName = templateData.clients.name;
            }
          }

          toast({
            title: "✓ Checkpoint Visitado",
            description: `${visit.rounds.profiles.name} completou ${checkpointName}`,
            duration: 4000,
            className: "bg-tactical-green/10 border-tactical-green text-tactical-green",
          });

        } catch (error) {
          console.error('Error fetching visit details:', error);
          
          // Fallback notification
          toast({
            title: "✓ Checkpoint Visitado",
            description: "Um tático completou um checkpoint da ronda",
            duration: 3000,
            className: "bg-tactical-green/10 border-tactical-green text-tactical-green",
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, toast]);

  return null; // This is a notification-only component
};

export default CheckpointNotification;