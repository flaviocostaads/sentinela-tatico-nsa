import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CheckpointStats {
  totalCheckpoints: number;
  completedCheckpoints: number;
}

interface ClientStats {
  [clientId: string]: CheckpointStats;
}

export const useClientCheckpointStats = (roundId: string) => {
  const [stats, setStats] = useState<ClientStats>({});
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    if (!roundId) return;

    try {
      setLoading(true);

      // Get round data with template
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select(`
          id,
          template_id,
          user_id,
          client_id,
          round_templates (
            id,
            name
          )
        `)
        .eq("id", roundId)
        .single();

      if (roundError) {
        console.error("Error fetching round data:", roundError);
        throw roundError;
      }

      console.log("Fetching stats for round:", roundId, "Round data:", roundData);

      // Fetch template checkpoints separately if template_id exists
      let templateCheckpoints = [];
      if (roundData.template_id) {
        const { data: checkpointsData, error: checkpointsError } = await supabase
          .from("round_template_checkpoints")
          .select(`
            id,
            client_id,
            order_index,
            clients (id, name)
          `)
          .eq("template_id", roundData.template_id)
          .order("order_index");

        if (checkpointsError) {
          console.error("Error fetching template checkpoints:", checkpointsError);
        } else {
          templateCheckpoints = checkpointsData || [];
        }
      }

      console.log("Template checkpoints fetched:", templateCheckpoints);

      // Get completed visits for this round
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select(`
          checkpoint_id,
          round_id
        `)
        .eq("round_id", roundId);

      if (visitsError) {
        console.error("Error fetching visits:", visitsError);
        throw visitsError;
      }
      
      console.log("Checkpoint visits for stats:", visits);

      // Calculate stats per client - count template checkpoints per client
      const clientStats: ClientStats = {};

      if (templateCheckpoints.length > 0) {
        console.log('Processing template checkpoints for stats:', templateCheckpoints);
        
        // First, count total checkpoints per client from the template
        templateCheckpoints.forEach((templateCheckpoint: any) => {
          const clientId = templateCheckpoint.client_id;
          
          if (!clientStats[clientId]) {
            clientStats[clientId] = {
              totalCheckpoints: 0,
              completedCheckpoints: 0
            };
          }
          
          clientStats[clientId].totalCheckpoints += 1;
        });

        console.log('Total checkpoints per client (from template):', clientStats);

        // Now count completed checkpoints based on actual visits
        // For template-based rounds, visits have checkpoint_id format: "template_{template_checkpoint_id}"
        visits?.forEach(visit => {
          const checkpointId = visit.checkpoint_id;
          console.log('Processing visit with checkpoint_id:', checkpointId);
          
          // Find which template checkpoint this visit corresponds to
          templateCheckpoints.forEach((tc: any) => {
            const templateCheckpointId = `template_${tc.id}`;
            
            if (checkpointId === templateCheckpointId) {
              const clientId = tc.client_id;
              console.log(`Visit matched template checkpoint ${tc.id} for client ${clientId}`);
              
              if (clientStats[clientId]) {
                clientStats[clientId].completedCheckpoints += 1;
              }
            }
          });
        });

        // Ensure completed doesn't exceed total
        Object.keys(clientStats).forEach(clientId => {
          if (clientStats[clientId].completedCheckpoints > clientStats[clientId].totalCheckpoints) {
            clientStats[clientId].completedCheckpoints = clientStats[clientId].totalCheckpoints;
          }
        });
      } else {
        console.log('No template checkpoints found, checking for direct client round');
        
        // For direct client rounds (fallback)
        if (roundData?.client_id) {
          const clientId = roundData.client_id;
          clientStats[clientId] = {
            totalCheckpoints: 1,
            completedCheckpoints: visits?.length || 0
          };
          console.log('Direct client round stats:', clientStats);
        }
      }

      console.log('Final checkpoint stats calculated:', clientStats);
      setStats(clientStats);
    } catch (error) {
      console.error("Error fetching checkpoint stats:", error);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`checkpoint-stats-${roundId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits',
        filter: `round_id=eq.${roundId}`
      }, () => {
        console.log('Checkpoint visit updated, refreshing stats');
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const getClientProgress = (clientId: string) => {
    const clientStat = stats[clientId];
    if (!clientStat || clientStat.totalCheckpoints === 0) return 0;
    return Math.round((clientStat.completedCheckpoints / clientStat.totalCheckpoints) * 100);
  };

  const isClientCompleted = (clientId: string) => {
    const clientStat = stats[clientId];
    return clientStat && clientStat.completedCheckpoints === clientStat.totalCheckpoints && clientStat.totalCheckpoints > 0;
  };

  const getTotalStats = () => {
    const total = Object.values(stats).reduce((sum, stat) => sum + stat.totalCheckpoints, 0);
    const completed = Object.values(stats).reduce((sum, stat) => sum + stat.completedCheckpoints, 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, progress };
  };

  return {
    stats,
    loading,
    getClientProgress,
    isClientCompleted,
    getTotalStats,
    refetch: fetchStats
  };
};