import { useState, useEffect } from "react";
import { Shield, Clock, Navigation, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface TacticHeaderProps {
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  onProfileClick?: () => void;
  roundsData?: {
    active: number;
    pending: number;
    completed: number;
  };
  shiftStartTime?: string;
}

const TacticHeader = ({ 
  userName, 
  userRole, 
  userAvatar, 
  onProfileClick,
  roundsData,
  shiftStartTime 
}: TacticHeaderProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { settings } = useCompanySettings();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShiftDuration = () => {
    if (!shiftStartTime) return "00:00";
    
    const start = new Date(shiftStartTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'dia';
    if (hour < 18) return 'tarde';
    return 'noite';
  };

  return (
    <div className="bg-background border-b">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b">
        {/* Company Logo and Name */}
        <div className="flex items-center space-x-3">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="w-10 h-10 rounded-lg object-contain bg-muted p-1"
            />
          ) : (
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {settings?.companyName || 'Sentinela Tático'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Sistema de Rondas
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            className="p-1 h-auto hover:bg-muted/50"
            onClick={onProfileClick}
          >
            <Avatar className="w-12 h-12 border-2 border-border">
              <AvatarImage src={userAvatar} />
              <AvatarFallback className="bg-muted text-foreground font-medium">
                {userName?.split(' ').map(n => n[0]).join('').toUpperCase() || <User className="w-5 h-5" />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </div>

      {/* Main Header Content */}
      <div className="p-4 pb-6">
        {/* Greeting */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-1 text-foreground">
            Boa {getGreeting()}, {userName?.split(' ')[0] || 'Operador'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {userRole === 'admin' ? 'Administrador' : 
             userRole === 'operador' ? 'Operador' : 'Tático'} • Escala Atual
          </p>
        </div>

        {/* Time and Shift Info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-card border rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Hora Atual</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{formatTime(currentTime)}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Navigation className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tempo de Serviço</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{formatShiftDuration()}</p>
          </div>
        </div>

        {/* Rounds Stats */}
        {roundsData && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold text-tactical-amber">
                {roundsData.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </div>
            
            <div className="text-center bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold text-tactical-blue">
                {roundsData.active}
              </div>
              <div className="text-xs text-muted-foreground">Em Andamento</div>
            </div>
            
            <div className="text-center bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold text-tactical-green">
                {roundsData.completed}
              </div>
              <div className="text-xs text-muted-foreground">Finalizadas</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TacticHeader;