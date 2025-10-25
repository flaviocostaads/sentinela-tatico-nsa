import { useState, useEffect } from "react";
import { MapPin, Navigation, Clock, Shield, Fuel, Wrench, AlertTriangle, User, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import ViewModeToggle from "./ViewModeToggle";
import ProfileSettings from "./ProfileSettings";
import CreateRoundDialog from "./CreateRoundDialog";
import FuelDialog from "./FuelDialog";
import MaintenanceDialog from "./MaintenanceDialog";
import TacticHeader from "./TacticHeader";
import ShiftControlDialog from "./ShiftControlDialog";
import PanicButton from "./PanicButton";
import VehicleInspectionDialogWizard from "./VehicleInspectionDialogWizard";


interface DashboardProps {
  onNavigate: (view: 'map' | 'rounds' | 'incident' | 'history' | 'historyMap') => void;
}

interface UserProfile {
  name: string;
  role: string;
  avatar_url?: string;
}

interface DashboardStats {
  pendingRounds: number;
  activeRounds: number;
  completedToday: number;
  shiftStart: string;
}

const TacticDashboard = ({ onNavigate }: DashboardProps) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    pendingRounds: 0,
    activeRounds: 0,
    completedToday: 0,
    shiftStart: ''
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(true);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showCreateRound, setShowCreateRound] = useState(false);
  const [showFuelDialog, setShowFuelDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [shiftType, setShiftType] = useState<'entrada' | 'saida'>('entrada');
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    fetchDashboardStats();
    
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("name, role, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (profile) {
        // Type assertion to handle the avatar_url column that may not be in generated types yet
        setUserProfile(profile as UserProfile);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Try fallback without avatar_url if column doesn't exist yet
      try {
        const { data: { user: fallbackUser } } = await supabase.auth.getUser();
        if (!fallbackUser) return;
        
        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from("profiles")
          .select("name, role")
          .eq("user_id", fallbackUser.id)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        if (fallbackProfile) {
          setUserProfile(fallbackProfile as UserProfile);
        }
      } catch (fallbackError) {
        console.error("Error fetching fallback profile:", fallbackError);
      }
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      // Get pending rounds
      const { data: pendingRounds, error: pendingError } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (pendingError) throw pendingError;

      // Get active rounds
      const { data: activeRounds, error: activeError } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (activeError) throw activeError;

      // Get completed today
      const { data: completedToday, error: completedError } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", today + "T00:00:00.000Z")
        .lt("created_at", today + "T23:59:59.999Z");

      if (completedError) throw completedError;

      // Get shift start time (first pending round created today)
      const { data: shiftData, error: shiftError } = await supabase
        .from("rounds")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", today + "T00:00:00.000Z")
        .order("created_at", { ascending: true })
        .limit(1);

      if (shiftError) throw shiftError;

      setStats({
        pendingRounds: pendingRounds?.length || 0,
        activeRounds: activeRounds?.length || 0,
        completedToday: completedToday?.length || 0,
        shiftStart: shiftData?.[0]?.created_at || ''
      });
      
      // Auto-refresh stats every 30 seconds
      setTimeout(() => {
        if (user) fetchDashboardStats();
      }, 30000);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShiftDuration = () => {
    if (!stats.shiftStart) return "00:00";
    
    const start = new Date(stats.shiftStart);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Enhanced Header */}
        <TacticHeader
          userName={userProfile?.name}
          userRole={userProfile?.role}
          userAvatar={userProfile?.avatar_url}
          onProfileClick={() => setShowProfileSettings(true)}
          roundsData={{
            active: stats.activeRounds,
            pending: stats.pendingRounds,
            completed: stats.completedToday
          }}
          shiftStartTime={stats.shiftStart}
        />


          {/* Action Buttons */}
          <div className="px-6 space-y-4">
            <Button
              onClick={() => onNavigate('map')}
              className="w-full h-16 bg-card hover:bg-accent border rounded-xl flex items-center justify-start px-6 shadow-sm transition-colors group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mr-4 group-hover:bg-primary/20 transition-colors">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <span className="text-lg font-semibold block text-foreground">Mapa em Tempo Real</span>
                <span className="text-sm text-muted-foreground">Visualizar localização atual</span>
              </div>
            </Button>

            <Button
              onClick={() => onNavigate('rounds')}
              className="w-full h-16 bg-card hover:bg-accent border rounded-xl flex items-center justify-start px-6 shadow-sm transition-colors group"
            >
              <div className="w-12 h-12 bg-tactical-blue/10 rounded-xl flex items-center justify-center mr-4 group-hover:bg-tactical-blue/20 transition-colors">
                <Navigation className="w-6 h-6 text-tactical-blue" />
              </div>
              <div className="text-left">
                <span className="text-lg font-semibold block text-foreground">Rondas Ativas</span>
                <span className="text-sm text-muted-foreground">Gerenciar rondas em progresso</span>
              </div>
            </Button>

            {/* Show only rounds in progress if any active rounds exist */}
            {stats.activeRounds > 0 && (
              <div className="bg-tactical-amber/10 border border-tactical-amber/20 rounded-xl p-4 mb-4">
                <Button
                  onClick={() => onNavigate('rounds')}
                  className="w-full h-16 bg-card hover:bg-accent border rounded-xl flex items-center justify-start px-6 shadow-sm transition-colors group pulse-tactical"
                >
                  <div className="w-12 h-12 bg-tactical-amber/10 rounded-xl flex items-center justify-center mr-4 group-hover:bg-tactical-amber/20 transition-colors">
                    <Clock className="w-6 h-6 text-tactical-amber" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold block text-foreground">Rondas em Andamento</span>
                    <span className="text-sm text-muted-foreground">{stats.activeRounds} rondas ativas</span>
                  </div>
                </Button>
              </div>
            )}

            {/* Checklist Veicular Button */}
            <Button
              onClick={() => setShowInspectionDialog(true)}
              className="w-full h-16 bg-card hover:bg-accent border rounded-xl flex items-center justify-start px-6 shadow-sm transition-colors group"
            >
              <div className="w-12 h-12 bg-tactical-blue/10 rounded-xl flex items-center justify-center mr-4 group-hover:bg-tactical-blue/20 transition-colors">
                <ClipboardCheck className="w-6 h-6 text-tactical-blue" />
              </div>
              <div className="text-left">
                <span className="text-lg font-semibold block text-foreground">Checklist Veicular</span>
                <span className="text-sm text-muted-foreground">Inspeção pré-plantão</span>
              </div>
            </Button>

            {/* Create Round Button */}
            <Button
              onClick={() => setShowCreateRound(true)}
              className="w-full h-16 bg-card hover:bg-accent border rounded-xl flex items-center justify-start px-6 shadow-sm transition-colors group"
            >
              <div className="w-12 h-12 bg-tactical-green/10 rounded-xl flex items-center justify-center mr-4 group-hover:bg-tactical-green/20 transition-colors">
                <Navigation className="w-6 h-6 text-tactical-green" />
              </div>
              <div className="text-left">
                <span className="text-lg font-semibold block text-foreground">Criar Ronda</span>
                <span className="text-sm text-muted-foreground">Iniciar nova ronda</span>
              </div>
            </Button>

            {/* Fuel and Maintenance Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setShowFuelDialog(true)}
                className="h-20 bg-card hover:bg-accent border rounded-xl flex flex-col items-center justify-center shadow-sm transition-colors group"
              >
                <div className="w-10 h-10 bg-tactical-blue/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-tactical-blue/20 transition-colors">
                  <Fuel className="w-5 h-5 text-tactical-blue" />
                </div>
                <span className="text-sm font-semibold text-foreground">Abastecimento</span>
                <span className="text-xs text-muted-foreground">Registrar combustível</span>
              </Button>
              
              <Button
                onClick={() => setShowMaintenanceDialog(true)}
                className="h-20 bg-card hover:bg-accent border rounded-xl flex flex-col items-center justify-center shadow-sm transition-colors group"
              >
                <div className="w-10 h-10 bg-tactical-amber/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-tactical-amber/20 transition-colors">
                  <Wrench className="w-5 h-5 text-tactical-amber" />
                </div>
                <span className="text-sm font-semibold text-foreground">Manutenção</span>
                <span className="text-xs text-muted-foreground">Registrar serviço</span>
              </Button>
            </div>

            {/* Panic/Emergency Button */}
            <PanicButton onNavigate={onNavigate} />
          </div>

          {/* Bottom padding for mobile navigation */}
          <div className="h-8"></div>
      </div>

      {/* Profile Settings Modal */}
      <ProfileSettings 
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        userProfile={userProfile}
        onProfileUpdate={fetchUserProfile}
      />

      {/* Create Round Dialog */}
      <CreateRoundDialog 
        isOpen={showCreateRound}
        onClose={() => setShowCreateRound(false)}
        onRoundCreated={() => {
          fetchDashboardStats();
          setShowCreateRound(false);
        }}
      />

      {/* Fuel Dialog */}
      <FuelDialog 
        open={showFuelDialog}
        onOpenChange={setShowFuelDialog}
      />

      {/* Maintenance Dialog */}
      <MaintenanceDialog 
        open={showMaintenanceDialog}
        onOpenChange={setShowMaintenanceDialog}
      />

      {/* Vehicle Inspection Dialog */}
      {showInspectionDialog && (
        <VehicleInspectionDialogWizard
          open={showInspectionDialog}
          onClose={() => setShowInspectionDialog(false)}
        />
      )}

    </>
  );
};

export default TacticDashboard;