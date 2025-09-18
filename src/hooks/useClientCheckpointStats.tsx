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

      // Calculate stats per client - count actual checkpoints per client
      const clientStats: ClientStats = {};

      if (templateCheckpoints.length > 0) {
        console.log('Processing template checkpoints for stats:', templateCheckpoints);
        
        // Get unique client IDs from template
        const clientIds = [...new Set(templateCheckpoints.map((tc: any) => tc.client_id))];
        
        // For each client, count their actual checkpoints from the checkpoints table
        for (const clientId of clientIds) {
          const { data: clientCheckpoints, error: checkpointsError } = await supabase
            .from("checkpoints")
            .select("id, name, active")
            .eq("client_id", clientId)
            .eq("active", true);

          if (!checkpointsError && clientCheckpoints) {
            clientStats[clientId] = {
              totalCheckpoints: clientCheckpoints.length,
              completedCheckpoints: 0
            };
            console.log(`Client ${clientId} has ${clientCheckpoints.length} checkpoints:`, clientCheckpoints.map(c => c.name));
          } else {
            console.error(`Error fetching checkpoints for client ${clientId}:`, checkpointsError);
            // Fallback to template count
            const templateCount = templateCheckpoints.filter((tc: any) => tc.client_id === clientId).length;
            clientStats[clientId] = {
              totalCheckpoints: templateCount,
              completedCheckpoints: 0
            };
          }
        }

        console.log('Total checkpoints per client (from actual checkpoints):', clientStats);

        // Now count completed checkpoints based on actual visits
        // For template-based rounds, visits have checkpoint_id as real checkpoint UUIDs
        
        // Get all checkpoint visits with their checkpoint info in one query
        const { data: visitCheckpoints, error: visitError } = await supabase
          .from("checkpoint_visits")
          .select(`
            checkpoint_id,
            checkpoints!inner(
              id,
              client_id,
              name
            )
          `)
          .eq("round_id", roundId);

        if (visitError) {
          console.error("Error fetching visit checkpoints:", visitError);
        } else if (visitCheckpoints) {
          console.log('Visit checkpoints data:', visitCheckpoints);
          
          // Count completed checkpoints per client
          visitCheckpoints.forEach((vc: any) => {
            const clientId = vc.checkpoints.client_id;
            if (clientStats[clientId]) {
              clientStats[clientId].completedCheckpoints += 1;
              console.log(`Added completed checkpoint for client ${clientId}: ${vc.checkpoints.name}`);
            }
          });
        }

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