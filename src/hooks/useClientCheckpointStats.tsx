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
          round_templates (
            round_template_checkpoints (
              id,
              client_id,
              clients (id, name)
            )
          )
        `)
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;

      // Get completed visits for this round with proper join
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select(`
          checkpoint_id,
          checkpoints (
            id,
            client_id,
            name
          )
        `)
        .eq("round_id", roundId);

      if (visitsError) throw visitsError;

      // Create a map of completed checkpoints by client
      const completedCheckpointsByClient = new Map<string, Set<string>>();
      visits?.forEach(visit => {
        const clientId = visit.checkpoints?.client_id;
        const checkpointId = visit.checkpoint_id;
        
        if (clientId && checkpointId) {
          if (!completedCheckpointsByClient.has(clientId)) {
            completedCheckpointsByClient.set(clientId, new Set());
          }
          completedCheckpointsByClient.get(clientId)?.add(checkpointId);
        }
      });

      console.log('Completed checkpoints by client:', Object.fromEntries(
        Array.from(completedCheckpointsByClient.entries()).map(([clientId, checkpoints]) => [
          clientId, Array.from(checkpoints)
        ])
      ));

      // Calculate stats per client - now tracking individual checkpoints
      const clientStats: ClientStats = {};

      if (roundData?.round_templates?.round_template_checkpoints) {
        console.log('Processing template checkpoints for stats:', roundData.round_templates.round_template_checkpoints);
        
        // First, count total checkpoints per client from the template
        roundData.round_templates.round_template_checkpoints.forEach((templateCheckpoint: any) => {
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
        visits?.forEach(visit => {
          const clientId = visit.checkpoints?.client_id;
          
          if (clientId && clientStats[clientId]) {
            // Increment completed count for this client
            clientStats[clientId].completedCheckpoints += 1;
          }
        });

        // Ensure completed doesn't exceed total
        Object.keys(clientStats).forEach(clientId => {
          if (clientStats[clientId].completedCheckpoints > clientStats[clientId].totalCheckpoints) {
            clientStats[clientId].completedCheckpoints = clientStats[clientId].totalCheckpoints;
          }
        });
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