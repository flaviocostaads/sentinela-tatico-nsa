import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Camera, Clock, CheckCircle, Circle, AlertTriangle, Navigation, QrCode, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ChecklistDialog from "./ChecklistDialog";
import RealTimeRoundMap from "./RealTimeRoundMap";
import BaseControlDialog from "./BaseControlDialog";

interface TacticRoundDetailProps {
  roundId: string;
  onBack: () => void;
}

interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  lat?: number;
  lng?: number;
  geofence_radius?: number;
  visited?: boolean;
  visit_time?: string;
  visit_duration?: number;
  qr_code?: string;
}

interface Round {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  end_time?: string;
  clients: {
    name: string;
    address: string;
  };
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
}

const TacticRoundDetail = ({ roundId, onBack }: TacticRoundDetailProps) => {
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState(0);
  const [showRealTimeMap, setShowRealTimeMap] = useState(false);
  const [baseControlDialogOpen, setBaseControlDialogOpen] = useState(false);
  const [baseControlType, setBaseControlType] = useState<'departure' | 'arrival'>('departure');
  const [hasLeftBase, setHasLeftBase] = useState(false);
  const [canStartCheckpoints, setCanStartCheckpoints] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoundDetails();
    getCurrentLocation();
    checkBaseControlStatus();
    
    // Check for QR scan result from sessionStorage
    const qrResult = sessionStorage.getItem('qrScanResult');
    if (qrResult) {
      sessionStorage.removeItem('qrScanResult');
      handleQrScan(qrResult);
    }
    
    // Setup location tracking for geofence
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentLocation(newLocation);
        checkGeofences(newLocation);
      },
      (error) => console.error("Location error:", error),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [roundId]);

  const fetchRoundDetails = async () => {
    try {
      // Fetch round details
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address),
          vehicles (license_plate, brand, model)
        `)
        .eq("id", roundId)
        .maybeSingle();

      if (roundError) throw roundError;
      
      if (!roundData) {
        toast({
          title: "Ronda não encontrada",
          description: "A ronda solicitada não foi encontrada",
          variant: "destructive",
        });
        return;
      }
      
      setRound(roundData);

      // Fetch checkpoints based on round template if available
      let checkpointsQuery = supabase
        .from("checkpoints")
        .select("*")
        .eq("active", true)
        .order("order_index");

      if (roundData.template_id) {
        // If round has a template, get checkpoints from template
        const { data: templateCheckpoints, error: templateError } = await supabase
          .from("round_template_checkpoints")
          .select(`
            *,
            clients (id, name, address)
          `)
          .eq("template_id", roundData.template_id)
          .order("order_index");

        if (templateError) throw templateError;

        // Convert template checkpoints to regular checkpoints format
        const formattedCheckpoints = (templateCheckpoints || []).map((tc, index) => ({
          id: `template_${tc.id}`,
          name: tc.clients.name,
          description: `Ronda em ${tc.clients.name}`,
          order_index: tc.order_index,
          client_id: tc.client_id,
          lat: null,
          lng: null,
          geofence_radius: 50,
          qr_code: `client_${tc.client_id}` // Generate QR code based on client
        }));

        // Fetch visits for template-based checkpoints
        const { data: visitsData, error: visitsError } = await supabase
          .from("checkpoint_visits")
          .select("*")
          .eq("round_id", roundId);

        if (visitsError) throw visitsError;

        const checkpointsWithVisits = formattedCheckpoints.map(checkpoint => {
          const visit = visitsData?.find(v => v.checkpoint_id === checkpoint.id);
          return {
            ...checkpoint,
            visited: !!visit,
            visit_time: visit?.visit_time,
            visit_duration: visit?.duration
          };
        });

        setCheckpoints(checkpointsWithVisits);
        
        // Set current checkpoint to first unvisited
        const firstUnvisited = checkpointsWithVisits.findIndex(cp => !cp.visited);
        setCurrentCheckpointIndex(firstUnvisited >= 0 ? firstUnvisited : 0);
        
      } else {
        // Fallback to client-based checkpoints
        const { data: checkpointsData, error: checkpointsError } = await supabase
          .from("checkpoints")
          .select("*")
          .eq("client_id", roundData.client_id)
          .eq("active", true)
          .order("order_index");

        if (checkpointsError) throw checkpointsError;

        const { data: visitsData, error: visitsError } = await supabase
          .from("checkpoint_visits")
          .select("*")
          .eq("round_id", roundId);

        if (visitsError) throw visitsError;

        const checkpointsWithVisits = (checkpointsData || []).map(checkpoint => {
          const visit = visitsData?.find(v => v.checkpoint_id === checkpoint.id);
          return {
            ...checkpoint,
            visited: !!visit,
            visit_time: visit?.visit_time,
            visit_duration: visit?.duration
          };
        });

        setCheckpoints(checkpointsWithVisits);
      }
    } catch (error) {
      console.error("Error fetching round details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ronda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(location);
          checkGeofences(location);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  };

  const checkGeofences = (location: { lat: number; lng: number }) => {
    let withinAnyGeofence = false;
    
    checkpoints.forEach(checkpoint => {
      if (checkpoint.lat && checkpoint.lng && !checkpoint.visited) {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          checkpoint.lat,
          checkpoint.lng
        );
        
        const radius = checkpoint.geofence_radius || 50;
        if (distance <= radius) {
          withinAnyGeofence = true;
          // Auto check-in
          handleAutoCheckin(checkpoint);
        }
      }
    });
    
    setIsWithinGeofence(withinAnyGeofence);
  };

  const handleAutoCheckin = async (checkpoint: Checkpoint) => {
    if (checkpoint.visited) return;

    try {
      await performCheckin(checkpoint, "Check-in automático por geofence");
      toast({
        title: "Check-in Automático",
        description: `Check-in realizado automaticamente em ${checkpoint.name}`,
      });
    } catch (error) {
      console.error("Error with auto check-in:", error);
    }
  };

  const handleQrScan = (qrCode: string) => {
    console.log("QR Code received:", qrCode);
    
    // Try to parse as JSON first (new format)
    try {
      const parsed = JSON.parse(qrCode);
      if (parsed.type === 'checkpoint') {
        // Valid checkpoint QR code - proceed with checkpoint completion
        toast({
          title: "QR Code válido",
          description: `Código de ${parsed.company} - ${parsed.checkpoint} validado`,
        });
        
        // Find the current checkpoint to complete
        const currentCheckpoint = checkpoints[currentCheckpointIndex];
        if (currentCheckpoint && !currentCheckpoint.visited) {
        setSelectedCheckpoint(currentCheckpoint);
        setChecklistDialogOpen(true);
      } else {
        toast({
          title: "Checkpoint já visitado",
          description: "Este checkpoint já foi concluído",
          variant: "destructive",
        });
      }
      return;
      }
    } catch (e) {
      // Not JSON, could be manual code
    }

    // Check if it's a 9-digit manual code
    if (/^\d{9}$/.test(qrCode)) {
      // Valid manual code - proceed with checkpoint completion
      toast({
        title: "Código manual válido",
        description: `Código ${qrCode} validado`,
      });
      
      // Find the current checkpoint to complete
      const currentCheckpoint = checkpoints[currentCheckpointIndex];
      if (currentCheckpoint && !currentCheckpoint.visited) {
        setSelectedCheckpoint(currentCheckpoint);
        setChecklistDialogOpen(true);
      } else {
        toast({
          title: "Checkpoint já visitado",
          description: "Este checkpoint já foi concluído",
          variant: "destructive",
        });
      }
      return;
    }

    // Invalid QR code format
    toast({
      title: "QR Code inválido",
      description: "Este QR code não corresponde a nenhum checkpoint desta ronda",
      variant: "destructive",
    });
  };

  const handleChecklistComplete = async (photo: string | null, observations: string, checklist: any[]) => {
    if (!selectedCheckpoint) return;

    try {
      const visitData = {
        round_id: roundId,
        checkpoint_id: selectedCheckpoint.id,
        visit_time: new Date().toISOString(),
        lat: currentLocation?.lat,
        lng: currentLocation?.lng,
        status: 'completed' as const,
        duration: 60
      };

      const { error } = await supabase
        .from("checkpoint_visits")
        .insert([visitData]);

      if (error) throw error;

      // Update checkpoint as visited in local state immediately
      setCheckpoints(prev => prev.map(cp => 
        cp.id === selectedCheckpoint.id 
          ? { ...cp, visited: true, visit_time: new Date().toISOString() }
          : cp
      ));

      // Update round's current checkpoint index
      const nextIndex = currentCheckpointIndex + 1;
      setCurrentCheckpointIndex(nextIndex);

      // Refresh data to ensure consistency
      await fetchRoundDetails();
      
      toast({
        title: "Checkpoint concluído",
        description: `${selectedCheckpoint.name} foi registrado com sucesso`,
      });

      setChecklistDialogOpen(false);
      setSelectedCheckpoint(null);

      // Check if this was the last checkpoint
      const allCompleted = checkpoints.every((cp, index) => 
        index < nextIndex || cp.visited
      );
      
      if (allCompleted && nextIndex >= checkpoints.length) {
        // Update round status to completed
        try {
          await supabase
            .from("rounds")
            .update({ 
              status: 'completed',
              end_time: new Date().toISOString()
            })
            .eq("id", roundId);
          
          toast({
            title: "Ronda completa",
            description: "Todos os checkpoints foram concluídos. Ronda finalizada com sucesso!",
          });
        } catch (error) {
          console.error("Error updating round status:", error);
        }
      }
    } catch (error) {
      console.error("Error completing checkpoint:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar checkpoint",
        variant: "destructive",
      });
    }
  };

  const handleManualCheckin = (checkpoint: Checkpoint) => {
    // Check if user has left base first
    if (!canStartCheckpoints) {
      toast({
        title: "Saída da base necessária",
        description: "Você deve registrar a saída da base antes de iniciar os checkpoints",
        variant: "destructive",
      });
      return;
    }

    const checkpointIndex = checkpoints.findIndex(cp => cp.id === checkpoint.id);
    
    // Only allow check-in for current checkpoint or if it's the next one in sequence
    if (checkpointIndex !== currentCheckpointIndex) {
      toast({
        title: "Sequência incorreta",
        description: "Você deve seguir a ordem dos checkpoints",
        variant: "destructive",
      });
      return;
    }

    setSelectedCheckpoint(checkpoint);
    navigate(`/qr-scanner?company=NSA Security&return=${encodeURIComponent(window.location.pathname)}`);
  };

  const performCheckin = async (checkpoint: Checkpoint, commentText?: string) => {
    if (!currentLocation) {
      toast({
        title: "Erro",
        description: "Localização não disponível",
        variant: "destructive",
      });
      return;
    }

    try {
      const visitData = {
        round_id: roundId,
        checkpoint_id: checkpoint.id,
        visit_time: new Date().toISOString(),
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        status: 'completed' as const,
        duration: 60 // Default 1 minute
      };

      const { error } = await supabase
        .from("checkpoint_visits")
        .insert([visitData]);

      if (error) throw error;

      // If comment provided, could save it to a comments table
      if (commentText) {
        console.log("Comment:", commentText);
      }

      await fetchRoundDetails(); // Refresh data
      
      toast({
        title: "Check-in realizado",
        description: `Check-in em ${checkpoint.name} registrado com sucesso`,
      });

      setCheckinDialogOpen(false);
      setComment("");
    } catch (error) {
      console.error("Error performing check-in:", error);
      toast({
        title: "Erro",
        description: "Erro ao realizar check-in",
        variant: "destructive",
      });
    }
  };

  const handleBaseControl = (type: 'departure' | 'arrival') => {
    setBaseControlType(type);
    setBaseControlDialogOpen(true);
  };

  const checkBaseControlStatus = async () => {
    try {
      console.log("Checking base control status for round:", roundId);
      
      // Check if round has departure record
      const { data: departureRecord, error } = await supabase
        .from("odometer_records")
        .select("*")
        .eq("round_id", roundId)
        .eq("record_type", "departure")
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error checking departure record:", error);
        return;
      }

      if (departureRecord) {
        console.log("Found departure record, enabling checkpoints");
        setHasLeftBase(true);
        setCanStartCheckpoints(true);
        
        // Update round status to active if it's still pending
        if (round?.status === 'pending') {
          await supabase
            .from("rounds")
            .update({ 
              status: 'active',
              start_time: new Date().toISOString()
            })
            .eq("id", roundId);
        }
      } else {
        console.log("No departure record found, checkpoints disabled");
        setHasLeftBase(false);
        setCanStartCheckpoints(false);
      }
      
      console.log("Base control status check complete");
    } catch (error) {
      console.error("Error checking base control status:", error);
    }
  };

  const handleDepartureFromBase = () => {
    setBaseControlType('departure');
    setBaseControlDialogOpen(true);
  };

  const handleArrivalAtBase = () => {
    setBaseControlType('arrival');
    setBaseControlDialogOpen(true);
  };

  const handleBaseControlComplete = () => {
    if (baseControlType === 'departure') {
      setHasLeftBase(true);
      setCanStartCheckpoints(true);
      toast({
        title: "Saída registrada",
        description: "Agora você pode iniciar os checkpoints da ronda",
      });
    } else {
      toast({
        title: "Chegada registrada",
        description: "Ronda finalizada com sucesso",
      });
    }
    setBaseControlDialogOpen(false);
    fetchRoundDetails(); // Refresh to get updated data
  };

  const completeRound = async () => {
    const allVisited = checkpoints.every(cp => cp.visited);
    
    if (!allVisited) {
      const unvisitedCount = checkpoints.filter(cp => !cp.visited).length;
      toast({
        title: "Ronda incompleta",
        description: `Ainda restam ${unvisitedCount} checkpoints obrigatórios para visitar antes de finalizar a ronda`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("rounds")
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq("id", roundId);

      if (error) throw error;

      toast({
        title: "Ronda finalizada",
        description: "A ronda foi concluída com sucesso",
      });

      onBack(); // Return to previous screen
    } catch (error) {
      console.error("Error completing round:", error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar ronda",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '--';
    return new Date(timeString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgress = () => {
    const visitedCount = checkpoints.filter(cp => cp.visited).length;
    return checkpoints.length > 0 ? (visitedCount / checkpoints.length) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ronda não encontrada</h3>
          <Button onClick={onBack} variant="outline">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const progress = getProgress();
  const allVisited = checkpoints.every(cp => cp.visited);

  // Show real-time map if requested
  if (showRealTimeMap) {
    return (
      <RealTimeRoundMap 
        roundId={roundId} 
        onBack={() => setShowRealTimeMap(false)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{round.clients.name}</h1>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{round.clients.address}</span>
              </div>
            </div>
          </div>
          
          <Badge className="bg-tactical-blue text-white">
            {Math.round(progress)}% Concluído
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Progress Card */}
        <Card className="tactical-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Progresso da Ronda</CardTitle>
              <div className="text-sm text-muted-foreground">
                {checkpoints.filter(cp => cp.visited).length} de {checkpoints.length} checkpoints
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-3 mb-4">
              <div 
                className="bg-tactical-green h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Início</p>
                <p className="font-medium">{formatTime(round.start_time)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Veículo</p>
                <p className="font-medium">
                  {round.vehicles?.license_plate || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Base Control Buttons */}
        <Card className="tactical-card">
          <CardHeader>
            <CardTitle>Controle da Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Show departure button if round hasn't left base yet */}
            {(!hasLeftBase || round.status === 'pending') && (
              <Button
                onClick={() => handleBaseControl('departure')}
                className="w-full bg-tactical-blue hover:bg-tactical-blue/90"
                size="lg"
              >
                <Home className="w-5 h-5 mr-2" />
                Registrar Saída da Base
              </Button>
            )}
            
            {/* Show status if already departed */}
            {hasLeftBase && (round.status === 'active' || round.start_time) && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-tactical-green">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Saída da base registrada</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Início: {formatTime(round.start_time)}
                </p>
              </div>
            )}
            
            {/* Show arrival button when all checkpoints are done */}
            {hasLeftBase && allVisited && round.status === 'active' && (
              <Button
                onClick={handleArrivalAtBase}
                className="w-full bg-tactical-green hover:bg-tactical-green/90"
                size="lg"
              >
                <Home className="w-5 h-5 mr-2" />
                Registrar Chegada na Base
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Checkpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Pontos Obrigatórios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkpoints.map((checkpoint, index) => (
              <div 
                key={checkpoint.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {checkpoint.visited ? (
                      <CheckCircle className="w-5 h-5 text-tactical-green" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                  </div>
                  
                  <div>
                    <p className="font-medium">{checkpoint.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {checkpoint.description}
                    </p>
                    {checkpoint.visited && (
                      <p className="text-xs text-tactical-green">
                        Visitado às {formatTime(checkpoint.visit_time)}
                      </p>
                    )}
                  </div>
                </div>

                {!checkpoint.visited && (
                  <div className="flex space-x-2">
                    {hasLeftBase && canStartCheckpoints && index === currentCheckpointIndex ? (
                      <Button
                        onClick={() => handleManualCheckin(checkpoint)}
                        size="sm"
                        className="bg-tactical-blue hover:bg-tactical-blue/90"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Escanear QR
                      </Button>
                    ) : !hasLeftBase ? (
                      <Badge variant="outline" className="text-xs">
                        Aguardando saída da base
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {index < currentCheckpointIndex ? 'Concluído' : 'Aguardando'}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Complete Round Button */}
        {hasLeftBase && round.status === 'active' && (
          <div className="sticky bottom-4">
            <Button
              onClick={completeRound}
              disabled={!allVisited}
              className="w-full h-12 bg-tactical-green hover:bg-tactical-green/90"
              size="lg"
            >
              <Navigation className="w-5 h-5 mr-2" />
              {allVisited ? 'Finalizar Ronda' : `Faltam ${checkpoints.filter(cp => !cp.visited).length} checkpoints`}
            </Button>
          </div>
        )}
      </div>

      {/* Base Control Dialog */}
        <BaseControlDialog
          open={baseControlDialogOpen}
          onClose={() => setBaseControlDialogOpen(false)}
          type={baseControlType}
          roundId={roundId}
          onComplete={handleBaseControlComplete}
        />

      {/* Checklist Dialog */}
      <ChecklistDialog
        open={checklistDialogOpen}
        onClose={() => setChecklistDialogOpen(false)}
        checkpointName={selectedCheckpoint?.name || ""}
        checkpointId={selectedCheckpoint?.id || ""}
        roundId={roundId}
        onComplete={handleChecklistComplete}
      />
    </div>
  );
};

export default TacticRoundDetail;