import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RoundCheckpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visited: boolean;
  round_id: string;
  client_id: string;
  order_index: number;
  qr_code?: string;
  manual_code?: string;
}

interface ActiveRound {
  id: string;
  user_id: string;
  template_id?: string;
}

export const useRoundCheckpoints = () => {
  const [checkpoints, setCheckpoints] = useState<RoundCheckpoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoundCheckpoints = async (activeRounds: ActiveRound[]) => {
    if (!activeRounds || activeRounds.length === 0) {
      setCheckpoints([]);
      return;
    }

    try {
      setLoading(true);
      
      const roundIds = activeRounds.map(r => r.id);
      const templateIds = activeRounds.filter(r => r.template_id).map(r => r.template_id);
      
      if (templateIds.length === 0) {
        // Try to get direct client checkpoints if no template
        const { data: roundsData, error: roundsError } = await supabase
          .from("rounds")
          .select(`
            id,
            client_id,
            template_id,
            clients (id, name, address, lat, lng)
          `)
          .in("id", roundIds);

        if (roundsError) throw roundsError;

        const formattedCheckpoints: RoundCheckpoint[] = [];
        
        for (const round of roundsData || []) {
          if (round.clients?.lat && round.clients?.lng) {
            formattedCheckpoints.push({
              id: `client_${round.client_id}`,
              name: round.clients.name,
              lat: round.clients.lat,
              lng: round.clients.lng,
              visited: false,
              round_id: round.id,
              client_id: round.client_id,
              order_index: 1
            });
          }
        }

        setCheckpoints(formattedCheckpoints);
        return;
      }

      // Get checkpoints from templates
      const { data: templateCheckpoints, error: templateError } = await supabase
        .from("round_template_checkpoints")
        .select(`
          id,
          template_id,
          client_id,
          order_index,
          required_signature
        `)
        .in("template_id", templateIds)
        .order("order_index");

      if (templateError) throw templateError;
      
      console.log("Raw template checkpoints from database:", templateCheckpoints);

      // Get all client IDs from template checkpoints
      const clientIds = [...new Set(templateCheckpoints?.map(tc => tc.client_id) || [])];
      
      // Get individual checkpoints for each client
      const { data: clientCheckpoints, error: clientCheckpointsError } = await supabase
        .from("checkpoints")
        .select(`
          id,
          name,
          client_id,
          lat,
          lng,
          qr_code,
          manual_code,
          order_index,
          active
        `)
        .in("client_id", clientIds)
        .eq("active", true)
        .order("order_index");

      if (clientCheckpointsError) throw clientCheckpointsError;
      
      console.log("Client checkpoints from database:", clientCheckpoints);

      // Get checkpoint visits for these rounds
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("checkpoint_id, round_id")
        .in("round_id", roundIds);

      if (visitsError) throw visitsError;

      const visitedCheckpoints = new Set(visits?.map(v => v.checkpoint_id) || []);

      // Format checkpoints with visit status
      const formattedCheckpoints: RoundCheckpoint[] = [];
      
      console.log("Processing template checkpoints:", templateCheckpoints?.length || 0);
      
      templateCheckpoints?.forEach((tc, index) => {
        console.log(`Processing template checkpoint ${index + 1}:`, tc);
        
        const activeRound = activeRounds.find(r => r.template_id === tc.template_id);
        if (!activeRound) {
          console.log("No active round found for template:", tc.template_id);
          return;
        }

        // Get all checkpoints for this client
        const checkpointsForClient = clientCheckpoints?.filter(cp => cp.client_id === tc.client_id) || [];
        
        console.log(`Found ${checkpointsForClient.length} checkpoints for client:`, tc.client_id);
        
        // Add each individual checkpoint to the round
        checkpointsForClient.forEach((checkpoint) => {
          if (checkpoint.lat && checkpoint.lng) {
            const checkpointId = `checkpoint_${checkpoint.id}`;
            const formattedCheckpoint = {
              id: checkpointId,
              name: checkpoint.name,
              lat: Number(checkpoint.lat),
              lng: Number(checkpoint.lng),
              visited: visitedCheckpoints.has(checkpointId),
              round_id: activeRound.id,
              client_id: tc.client_id,
              order_index: checkpoint.order_index,
              qr_code: checkpoint.qr_code,
              manual_code: checkpoint.manual_code
            };
            
            console.log("Adding checkpoint to list:", formattedCheckpoint);
            formattedCheckpoints.push(formattedCheckpoint);
          } else {
            console.log("Checkpoint has no valid coordinates:", checkpoint);
          }
        });
      });
      
      console.log("Final formatted checkpoints:", formattedCheckpoints);

      setCheckpoints(formattedCheckpoints);
    } catch (error) {
      console.error("Error fetching round checkpoints:", error);
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToCheckpointChanges = (onUpdate: () => void) => {
    const channel = supabase
      .channel('checkpoint-visits-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits'
      }, () => {
        console.log('Checkpoint visit update detected');
        onUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getCheckpointStats = () => {
    const total = checkpoints.length;
    const visited = checkpoints.filter(cp => cp.visited).length;
    const pending = total - visited;
    const progress = total > 0 ? Math.round((visited / total) * 100) : 0;

    return {
      total,
      visited,
      pending,
      progress
    };
  };

  return {
    checkpoints,
    loading,
    fetchRoundCheckpoints,
    subscribeToCheckpointChanges,
    getCheckpointStats
  };
};