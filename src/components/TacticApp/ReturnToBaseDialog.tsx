import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Home, MapPin, Clock, Gauge, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ReturnToBaseDialogProps {
  open: boolean;
  onClose: () => void;
  roundId: string;
  onComplete: (finalOdometer: number, observations: string) => void;
}

const ReturnToBaseDialog = ({ open, onClose, roundId, onComplete }: ReturnToBaseDialogProps) => {
  const [finalOdometer, setFinalOdometer] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAtBase, setIsAtBase] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { toast } = useToast();

  // Base location (should be fetched from company settings)
  const baseLocation = { lat: -23.5505, lng: -46.6333 }; // Default São Paulo
  const geofenceRadius = 100; // metros

  useEffect(() => {
    if (open) {
      startTimer();
      checkLocation();
      const locationInterval = setInterval(checkLocation, 5000); // Check every 5 seconds
      
      return () => {
        clearInterval(locationInterval);
      };
    }
  }, [open]);

  const startTimer = () => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  };

  const checkLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          
          setCurrentLocation({ lat: userLat, lng: userLng });
          
          // Calculate distance to base
          const distance = calculateDistance(
            userLat,
            userLng,
            baseLocation.lat,
            baseLocation.lng
          );
          
          setIsAtBase(distance <= geofenceRadius);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleComplete = async () => {
    if (!finalOdometer) {
      toast({
        title: "Campo Obrigatório",
        description: "Informe o odômetro final",
        variant: "destructive"
      });
      return;
    }

    if (!isAtBase) {
      toast({
        title: "Fora da Base",
        description: "Você precisa estar na base para finalizar a ronda",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const odometerValue = parseInt(finalOdometer);
      
      // Validate odometer
      const { data: round } = await supabase
        .from('rounds')
        .select('initial_odometer')
        .eq('id', roundId)
        .single();

      if (round && odometerValue < (round.initial_odometer || 0)) {
        toast({
          title: "Odômetro Inválido",
          description: `O odômetro final não pode ser menor que o inicial (${round.initial_odometer} km)`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      onComplete(odometerValue, observations);
    } catch (error) {
      console.error('Error completing return to base:', error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar retorno à base",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-tactical-green" />
            Retorno à Base
          </DialogTitle>
          <DialogDescription>
            Finalize o registro de retorno à base e complete a ronda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Tempo Decorrido</span>
              </div>
              <Badge variant="secondary" className="font-mono">
                {formatTime(elapsedTime)}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Status da Localização</span>
              </div>
              <Badge variant={isAtBase ? "default" : "secondary"} className={isAtBase ? "bg-tactical-green" : ""}>
                {isAtBase ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Na Base
                  </>
                ) : (
                  'Fora da Base'
                )}
              </Badge>
            </div>
          </div>

          {/* Odometer Input */}
          <div className="space-y-2">
            <Label htmlFor="final_odometer" className="flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Odômetro Final (km) *
            </Label>
            <Input
              id="final_odometer"
              type="number"
              value={finalOdometer}
              onChange={(e) => setFinalOdometer(e.target.value)}
              placeholder="Digite o odômetro atual"
              required
            />
            <p className="text-xs text-muted-foreground">
              Informe a quilometragem atual do veículo
            </p>
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="observations">
              Observações Finais (Opcional)
            </Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Registre observações sobre a ronda, ocorrências ou condições do veículo..."
              rows={3}
            />
          </div>

          {/* Warning if not at base */}
          {!isAtBase && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Atenção:</strong> Você precisa estar dentro do perímetro da base para finalizar a ronda.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!isAtBase || loading || !finalOdometer}
              className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
            >
              {loading ? "Finalizando..." : "Cheguei na Base"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnToBaseDialog;
