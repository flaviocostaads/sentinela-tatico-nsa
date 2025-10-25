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
      
      console.log("Fetching individual checkpoints for clients:", clientIds);
      
      // Get client details with their coordinates
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, address, lat, lng")
        .in("id", clientIds);

      if (clientsError) throw clientsError;

      // Create a map of client coordinates for fallback
      const clientCoordinates = new Map(
        clientsData?.map(client => [
          client.id,
          { lat: client.lat, lng: client.lng, name: client.name, address: client.address }
        ]) || []
      );

      console.log("Client coordinates fetched:", clientCoordinates);
      
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
        .order("client_id, order_index");

      if (clientCheckpointsError) throw clientCheckpointsError;
      
      console.log("Client checkpoints fetched from database:", clientCheckpoints);
      console.log("Total checkpoints found:", clientCheckpoints?.length || 0);

      // Get checkpoint visits for these rounds
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("checkpoint_id, round_id")
        .in("round_id", roundIds);

      if (visitsError) throw visitsError;

      console.log("Checkpoint visits:", visits);

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
        
        console.log(`Found ${checkpointsForClient.length} checkpoints for client ${tc.client_id}:`, checkpointsForClient);
        
        // Add each individual checkpoint to the round
        checkpointsForClient.forEach((checkpoint, cpIndex) => {
          console.log(`  Processing individual checkpoint ${cpIndex + 1}:`, checkpoint);
          
          // Use checkpoint coordinates if available, otherwise fallback to client coordinates
          const clientCoords = clientCoordinates.get(tc.client_id);
          const checkpointLat = checkpoint.lat || clientCoords?.lat;
          const checkpointLng = checkpoint.lng || clientCoords?.lng;
          
          if (checkpointLat && checkpointLng) {
            const checkpointId = checkpoint.id;
            const isVisited = visits?.some(v => v.checkpoint_id === checkpointId && v.round_id === activeRound.id) || false;
            
            const formattedCheckpoint = {
              id: checkpointId,
              name: checkpoint.name,
              lat: Number(checkpointLat),
              lng: Number(checkpointLng),
              visited: isVisited,
              round_id: activeRound.id,
              client_id: tc.client_id,
              order_index: checkpoint.order_index,
              qr_code: checkpoint.qr_code,
              manual_code: checkpoint.manual_code
            };
            
            console.log("  Adding checkpoint to list:", formattedCheckpoint);
            console.log(`    Using ${checkpoint.lat ? 'checkpoint' : 'client'} coordinates`);
            formattedCheckpoints.push(formattedCheckpoint);
          } else {
            console.warn(`  ⚠️ Checkpoint ${checkpoint.name} has no coordinates and client ${tc.client_id} also has no coordinates!`);
          }
        });
        
        // If no individual checkpoints found for this client, log warning
        if (checkpointsForClient.length === 0) {
          console.warn(`WARNING: No checkpoints found for client ${tc.client_id}. This client needs checkpoints created in the Checkpoints table.`);
        }
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