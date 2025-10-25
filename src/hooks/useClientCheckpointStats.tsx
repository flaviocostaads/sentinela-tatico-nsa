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

      console.log("🔍 [useClientCheckpointStats] Fetching stats for round:", roundId, "Round data:", roundData);

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
          console.error("❌ [useClientCheckpointStats] Error fetching template checkpoints:", checkpointsError);
        } else {
          templateCheckpoints = checkpointsData || [];
        }
      }

      console.log("📋 [useClientCheckpointStats] Template checkpoints fetched:", templateCheckpoints?.length || 0, "checkpoints");

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
        console.log('📊 [useClientCheckpointStats] Processing template checkpoints for stats:', templateCheckpoints.length);
        
        // Get unique client IDs from template
        const clientIds = [...new Set(templateCheckpoints.map((tc: any) => tc.client_id))];
        console.log('🏢 [useClientCheckpointStats] Unique client IDs from template:', clientIds);
        
        // For each client, count their PHYSICAL checkpoints (not template entries)
        for (const clientId of clientIds) {
          console.log(`🔍 [useClientCheckpointStats] Fetching physical checkpoints for client ${clientId}`);
          
          // Get ALL physical checkpoints for this client
          const { data: clientCheckpoints, error: checkpointsError } = await supabase
            .from("checkpoints")
            .select("id, name")
            .eq("client_id", clientId)
            .eq("active", true);

          if (checkpointsError) {
            console.error(`❌ [useClientCheckpointStats] Error fetching checkpoints for client ${clientId}:`, checkpointsError);
            continue;
          }

          let totalCheckpoints = clientCheckpoints?.length || 0;
          console.log(`📍 [useClientCheckpointStats] Client ${clientId} has ${totalCheckpoints} physical checkpoints:`, 
            clientCheckpoints?.map(c => `${c.name} (${c.id})`).join(', '));
          
          // ADICIONAR validação:
          if (totalCheckpoints > 0) {
            console.log(`✅ [useClientCheckpointStats] Will count ${totalCheckpoints} checkpoints for client`);
          } else {
            console.log(`⚠️ [useClientCheckpointStats] No checkpoints found, will use 1 virtual checkpoint`);
          }

          // If no physical checkpoints, we'll have 1 virtual checkpoint
          if (totalCheckpoints === 0) {
            console.log(`✨ [useClientCheckpointStats] Client ${clientId} has no physical checkpoints, counting 1 virtual checkpoint`);
            totalCheckpoints = 1;
            
            // Check if the virtual checkpoint was visited
            const templateCheckpoint = templateCheckpoints.find((tc: any) => tc.client_id === clientId);
            const virtualCheckpointId = templateCheckpoint ? `virtual_${templateCheckpoint.id}` : null;
            
            const completedCheckpoints = (visits && virtualCheckpointId && visits.some((v: any) => v.checkpoint_id === virtualCheckpointId)) ? 1 : 0;
            
            console.log(`📊 [useClientCheckpointStats] Virtual checkpoint stats - Total: 1, Completed: ${completedCheckpoints}`);
            
            clientStats[clientId] = {
              totalCheckpoints: 1,
              completedCheckpoints
            };
          } else {
            // Count completed visits for this client's checkpoints
            let completedCheckpoints = 0;
            if (visits && visits.length > 0 && clientCheckpoints) {
              const clientCheckpointIds = clientCheckpoints.map(c => c.id);
              const clientVisits = visits.filter((visit: any) => 
                clientCheckpointIds.includes(visit.checkpoint_id)
              );
              completedCheckpoints = clientVisits.length;
              
              console.log(`✅ [useClientCheckpointStats] Client ${clientId} has ${completedCheckpoints} completed visits out of ${totalCheckpoints}`);
              console.log(`   Completed checkpoint IDs:`, clientVisits.map((v: any) => v.checkpoint_id));
            } else {
              console.log(`⏳ [useClientCheckpointStats] Client ${clientId} has 0 completed visits`);
            }

            clientStats[clientId] = {
              totalCheckpoints,
              completedCheckpoints: Math.min(completedCheckpoints, totalCheckpoints)
            };
          }
          
          console.log(`📊 [useClientCheckpointStats] Stats for client ${clientId}:`, clientStats[clientId]);
        }

        console.log('✅ [useClientCheckpointStats] Final client stats calculated:', clientStats);
        console.log('📈 [useClientCheckpointStats] Summary:');
        Object.entries(clientStats).forEach(([clientId, stat]) => {
          console.log(`   Client ${clientId}: ${stat.completedCheckpoints}/${stat.totalCheckpoints} checkpoints`);
        });
      } else {
        console.log('⚠️ [useClientCheckpointStats] No template checkpoints found, checking for direct client round');
        
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