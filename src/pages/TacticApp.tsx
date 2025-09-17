import { useState, useEffect } from "react";
import TacticDashboard from "@/components/TacticApp/TacticDashboard";
import TacticMap from "@/components/TacticApp/TacticMap";
import TacticRounds from "@/components/TacticApp/TacticRounds";
import TacticRoundDetail from "@/components/TacticApp/TacticRoundDetail";
import TacticIncident from "@/components/TacticApp/TacticIncident";
import TacticHistory from "@/components/TacticApp/TacticHistory";
import RoundHistoryMap from "@/components/TacticApp/RoundHistoryMap";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useToast } from "@/hooks/use-toast";

type TacticView = 'dashboard' | 'map' | 'rounds' | 'roundDetail' | 'incident' | 'history' | 'historyMap';

const TacticApp = () => {
  const [currentView, setCurrentView] = useState<TacticView>('dashboard');
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize GPS tracking for tactical users - starts immediately
  const { 
    currentLocation, 
    isTracking, 
    hasActiveRound, 
    startTracking,
    startImmediateTracking 
  } = useGpsTracking({
    enableRealtime: true,
    autoStart: true,
    updateInterval: 3000
  });

  useEffect(() => {
    // Show tracking status to user
    if (isTracking) {
      toast({
        title: "GPS Ativo",
        description: "Localização sendo rastreada em tempo real",
      });
    }
  }, [isTracking]);

  useEffect(() => {
    // Enhanced tracking when user has active rounds
    if (hasActiveRound && !isTracking) {
      startTracking();
      toast({
        title: "Rastreamento de Ronda",
        description: "Localização sendo capturada para ronda ativa",
      });
    }
  }, [hasActiveRound]);

  const handleNavigate = (view: TacticView) => {
    setCurrentView(view);
  };

  const handleRoundSelect = (roundId: string) => {
    setSelectedRoundId(roundId);
    setCurrentView('roundDetail');
  };

  const handleBack = () => {
    if (currentView === 'roundDetail') {
      setCurrentView('rounds');
    } else {
      setCurrentView('dashboard');
    }
    setSelectedRoundId(null);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <TacticDashboard onNavigate={handleNavigate} />;
      
      case 'map':
        return <TacticMap onBack={handleBack} />;
      
      case 'rounds':
        return (
          <TacticRounds 
            onBack={handleBack} 
            onRoundSelect={handleRoundSelect} 
          />
        );
      
      case 'roundDetail':
        return selectedRoundId ? (
          <TacticRoundDetail 
            roundId={selectedRoundId}
            onBack={handleBack} 
          />
        ) : (
          <TacticDashboard onNavigate={handleNavigate} />
        );
      
      case 'incident':
        return <TacticIncident onBack={handleBack} />;
      
      case 'history':
        return <TacticHistory onBack={handleBack} />;
      
      case 'historyMap':
        return <RoundHistoryMap onBack={handleBack} />;
      
      default:
        return <TacticDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* GPS Tracking Status Indicator */}
      {currentLocation && (
        <div className="fixed top-2 right-2 z-50 bg-tactical-green text-white text-xs px-2 py-1 rounded">
          GPS: {isTracking ? 'Ativo' : 'Pausado'}
          {hasActiveRound && ' • Ronda Ativa'}
        </div>
      )}
      
      {renderCurrentView()}
    </div>
  );
};

export default TacticApp;