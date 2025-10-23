import { useState, useEffect } from "react";
import { ArrowLeft, Navigation, Clock, MapPin, Play, CheckCircle, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import CreateRoundDialog from "./CreateRoundDialog";
import OdometerDialog from "./OdometerDialog";
import RoundCompaniesProgress from "./RoundCompaniesProgress";
import VehicleSelectionDialog from "./VehicleSelectionDialog";

interface TacticRoundsProps {
  onBack: () => void;
  onRoundSelect: (roundId: string) => void;
}

interface Round {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  end_time?: string;
  created_at: string;
  vehicle_id?: string;
  clients: {
    id: string;
    name: string;
    address: string;
  };
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
  template_id?: string;
  round_templates?: {
    name: string;
  };
}

const TacticRounds = ({ onBack, onRoundSelect }: TacticRoundsProps) => {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showOdometerDialog, setShowOdometerDialog] = useState(false);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [selectedVehicleData, setSelectedVehicleData] = useState<{
    vehicleId: string | null;
    vehicleType: 'car' | 'motorcycle' | 'on_foot' | null;
    vehiclePlate?: string;
  } | null>(null);
  const [showCheckpointsList, setShowCheckpointsList] = useState(false);
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const { toast } = useToast();

  // Fetch user profile
  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Check if user is admin
  const isAdmin = profile?.role === 'admin';

  const handleDeleteRound = async (round: Round, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAdmin) {
      toast({
        title: "Erro",
        description: "Apenas administradores podem excluir rondas",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Tem certeza que deseja excluir a ronda "${round.clients.name}"?`)) {
      try {
        const { error } = await supabase.rpc('delete_round_with_audit', {
          p_round_id: round.id,
          p_admin_user_id: user?.id,
          p_admin_name: profile?.name || 'Admin'
        });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Ronda excluída com sucesso",
        });

        fetchRounds(); // Refresh the list
      } catch (error) {
        console.error("Error deleting round:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir ronda",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const fetchRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar rondas atribuídas ao tático OU rondas não atribuídas (user_id NULL)
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (id, name, address),
          vehicles (license_plate, brand, model),
          round_templates (name)
        `)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .in("status", ["pending", "active", "incident"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Error fetching rounds:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar rondas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartRound = (round: Round) => {
    setSelectedRound(round);
    setShowVehicleDialog(true);
  };

  const handleVehicleSelected = (vehicleId: string | null, vehicleType: 'car' | 'motorcycle' | 'on_foot' | null, vehiclePlate?: string) => {
    setSelectedVehicleData({ vehicleId, vehicleType, vehiclePlate });
    setShowVehicleDialog(false);
    
    // Se for a pé, inicia direto sem odômetro
    if (vehicleType === 'on_foot') {
      handleStartRoundOnFoot();
    } else {
      // Se for com veículo, abre dialog de odômetro
      setShowOdometerDialog(true);
    }
  };

  const handleStartRoundOnFoot = async () => {
    if (!selectedRound) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('rounds')
        .update({
          status: 'active',
          user_id: user.id,
          start_time: new Date().toISOString(),
          vehicle_id: null,
          vehicle: 'on_foot' as any, // Type will be updated after database migration
          initial_odometer: null,
        })
        .eq('id', selectedRound.id);

      if (updateError) throw updateError;

      toast({
        title: "Ronda iniciada",
        description: "Ronda iniciada com sucesso a pé",
      });

      fetchRounds();
      setSelectedRound(null);
      setSelectedVehicleData(null);
    } catch (error) {
      console.error('Error starting round on foot:', error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar ronda",
        variant: "destructive",
      });
    }
  };

  const handleOdometerComplete = async (odometer: number, photo: string) => {
    if (!selectedRound || !selectedVehicleData) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('rounds')
        .update({
          status: 'active',
          user_id: user.id,
          start_time: new Date().toISOString(),
          initial_odometer: odometer,
          vehicle_id: selectedVehicleData.vehicleId,
          vehicle: selectedVehicleData.vehicleType as any, // Type will be updated after database migration
        })
        .eq('id', selectedRound.id);

      if (updateError) throw updateError;

      toast({
        title: "Ronda iniciada",
        description: "Ronda iniciada com sucesso",
      });

      fetchRounds();
      setSelectedRound(null);
      setSelectedVehicleData(null);
      setShowOdometerDialog(false);
    } catch (error) {
      console.error('Error completing odometer:', error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar ronda",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-tactical-blue text-white';
      case 'pending': return 'bg-tactical-amber text-white';
      case 'completed': return 'bg-tactical-green text-white';
      case 'incident': return 'bg-tactical-red text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Em Andamento';
      case 'pending': return 'Pendente';
      case 'completed': return 'Concluída';
      case 'incident': return 'Incidente';
      default: return status;
    }
  };

  const handleCheckpointSelect = (checkpointId: string) => {
    // Forward checkpoint selection to parent or handle QR scanning flow
    onRoundSelect(checkpointId); // This will trigger navigation to checkpoint screen
  };

  const handleBackFromCheckpoints = () => {
    setShowCheckpointsList(false);
    setSelectedRound(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Navigation className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'incident': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (showCheckpointsList && selectedRound) {
    return (
      <RoundCompaniesProgress
        roundId={selectedRound.id}
        onBack={handleBackFromCheckpoints}
        onCheckpointSelect={handleCheckpointSelect}
      />
    );
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '--';
    
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diff = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando rondas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="hover:bg-muted mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Rondas Ativas</h1>
        </div>
        
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-tactical-green hover:bg-tactical-green/90 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Criar Ronda
        </Button>
      </div>

      {/* Rounds List */}
      <div className="p-4 space-y-3">
        {rounds.length === 0 ? (
          <div className="text-center py-12">
            <Navigation className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma ronda encontrada</h3>
            <p className="text-muted-foreground">
              Não há rondas agendadas para hoje.
            </p>
          </div>
        ) : (
          rounds.map((round) => (
            <div 
              key={round.id}
              className="bg-card border rounded-xl p-4"
            >
              {/* Client Info */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {round.round_templates?.name || round.clients.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {round.round_templates ? 'Template' : 'Ronda personalizada'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={`${getStatusColor(round.status)} text-white`}>
                    {getStatusLabel(round.status)}
                  </Badge>
                </div>
              </div>

              {/* Status Info - Only show essential info */}
              <div className="text-sm text-muted-foreground mb-4">
                {round.status === 'pending' && "Pendente"}
                {round.status === 'active' && round.start_time && 
                  `Iniciada às ${formatTime(round.start_time)}`
                }
                {round.status === 'completed' && round.end_time && 
                  `Concluída às ${formatTime(round.end_time)}`
                }
              </div>

                {/* Action Buttons - Show appropriate actions based on user role */}
                <div className="flex space-x-2">
                  {round.status === 'pending' && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRound(round);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Ronda
                    </Button>
                  )}
                  
                  {round.status !== 'pending' && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRound(round);
                        setShowCheckpointsList(true);
                      }}
                      className="bg-tactical-blue hover:bg-tactical-blue/90 text-white flex-1"
                      size="sm"
                    >
                      Ver Detalhes
                    </Button>
                  )}
                  
                  {/* Delete button for admins */}
                  {isAdmin && (
                    <Button
                      onClick={(e) => handleDeleteRound(round, e)}
                      variant="destructive"
                      size="sm"
                      className="px-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {round.status === 'pending' && !isAdmin && (
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Complete o odômetro para ver detalhes
                      </p>
                    </div>
                  )}
                </div>
            </div>
          ))
        )}
      </div>

      {/* Base info - similar to mockup */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Base</h3>
            <p className="text-sm text-muted-foreground">Central de Comando</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{rounds.length} ronda{rounds.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Create Round Dialog */}
      <CreateRoundDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onRoundCreated={() => {
          fetchRounds();
          setShowCreateDialog(false);
        }}
      />

      {/* Vehicle Selection Dialog */}
      <VehicleSelectionDialog
        open={showVehicleDialog}
        onClose={() => {
          setShowVehicleDialog(false);
          setSelectedRound(null);
        }}
        onVehicleSelected={handleVehicleSelected}
      />

      {/* Odometer Dialog */}
      <OdometerDialog
        open={showOdometerDialog}
        onClose={() => {
          setShowOdometerDialog(false);
          setSelectedRound(null);
          setSelectedVehicleData(null);
        }}
        onComplete={handleOdometerComplete}
        vehiclePlate={selectedVehicleData?.vehiclePlate || 'N/A'}
        roundId={selectedRound?.id}
        vehicleId={selectedVehicleData?.vehicleId ?? undefined}
      />
    </div>
  );
};

export default TacticRounds;