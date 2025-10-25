import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMapboxDirections } from '@/hooks/useMapboxDirections';
import { 
  formatDistance, 
  formatDuration, 
  formatCost, 
  calculateOperationalCost,
  getMapboxProfile 
} from '@/utils/routeCalculations';
import { 
  Route, 
  Clock, 
  Fuel, 
  DollarSign, 
  MapPin, 
  TrendingUp,
  Navigation,
  Loader2,
  AlertCircle 
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Checkpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface RouteAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundId?: string;
  checkpoints?: Checkpoint[];
  vehicleType: 'car' | 'motorcycle' | 'on_foot';
  roundName?: string;
}

const RouteAnalysisDialog = ({
  open,
  onOpenChange,
  roundId,
  checkpoints: providedCheckpoints,
  vehicleType,
  roundName
}: RouteAnalysisDialogProps) => {
  const { 
    calculateRoundDistance, 
    calculateRoundCost,
    loading: apiLoading
  } = useMapboxDirections();
  
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(providedCheckpoints || []);
  const [routeData, setRouteData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [operationalCost, setOperationalCost] = useState<any>(null);

  useEffect(() => {
    if (open && roundId && !providedCheckpoints) {
      fetchCheckpoints();
    } else if (open && checkpoints.length >= 2) {
      analyzeRoute();
    }
  }, [open, roundId]);

  const fetchCheckpoints = async () => {
    if (!roundId) return;
    
    setLoading(true);
    try {
      // Get round details to determine if it's template-based
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select('template_id, client_id')
        .eq('id', roundId)
        .single();

      if (roundError) throw roundError;

      let checkpointsData: Checkpoint[] = [];

      if (round.template_id) {
        // Template-based round - get checkpoints from template
        const { data: templateCheckpoints, error: templateError } = await supabase
          .from('round_template_checkpoints')
          .select('template_id, client_id, order_index')
          .eq('template_id', round.template_id)
          .order('order_index');

        if (templateError) throw templateError;

        // Get client IDs from template
        const clientIds = templateCheckpoints.map((tc: any) => tc.client_id);

        // Get client details
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, lat, lng')
          .in('id', clientIds);

        if (clientsError) throw clientsError;

        // Get checkpoints for these clients
        const { data: clientCheckpoints, error: checkpointsError } = await supabase
          .from('checkpoints')
          .select('id, name, client_id, lat, lng')
          .in('client_id', clientIds)
          .eq('active', true)
          .order('client_id, order_index');

        if (checkpointsError) throw checkpointsError;

        // Map template order to checkpoints - use physical checkpoints if available, otherwise use client location
        checkpointsData = [];
        
        templateCheckpoints.forEach((tc: any) => {
          const clientPhysicalCheckpoints = clientCheckpoints?.filter((cp: any) => cp.client_id === tc.client_id) || [];
          const client = clients?.find((c: any) => c.id === tc.client_id);
          
          if (clientPhysicalCheckpoints.length > 0) {
            // Use physical checkpoints
            clientPhysicalCheckpoints.forEach((cp: any) => {
              checkpointsData.push({
                id: cp.id,
                name: cp.name,
                latitude: cp.lat || client?.lat,
                longitude: cp.lng || client?.lng
              });
            });
          } else if (client) {
            // Use client location as fallback
            checkpointsData.push({
              id: tc.id,
              name: client.name || "Cliente",
              latitude: client.lat,
              longitude: client.lng
            });
          }
        });
      } else {
        // Custom round - get client location
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('id, name, lat, lng')
          .eq('id', round.client_id)
          .single();

        if (clientError) throw clientError;

        checkpointsData = [{
          id: client.id,
          name: client.name,
          latitude: client.lat,
          longitude: client.lng
        }];
      }

      setCheckpoints(checkpointsData);
      
      if (checkpointsData.length >= 2) {
        await analyzeRoute();
      } else {
        toast({
          title: "Aviso",
          description: "Ronda possui menos de 2 pontos. Análise não disponível.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pontos da ronda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeRoute = async () => {
    const profile = getMapboxProfile(vehicleType);
    
    const coordinates = checkpoints.map(cp => ({
      latitude: cp.latitude,
      longitude: cp.longitude
    }));

    const result = await calculateRoundDistance(coordinates, profile);
    
    if (result) {
      setRouteData(result);
      
      // Calcular custo de combustível (apenas para veículos motorizados)
      if (vehicleType !== 'on_foot') {
        const fuelPrice = 5.50; // R$ por litro
        const consumption = vehicleType === 'motorcycle' ? 30 : 10; // km/l
        const cost = calculateRoundCost(result.distanceKm, vehicleType, fuelPrice, consumption);
        setCostData(cost);
      } else {
        setCostData(null);
      }
      
      // Calcular custo operacional total
      if (vehicleType !== 'on_foot') {
        const opCost = calculateOperationalCost({
          distanceKm: result.distanceKm,
          durationHours: result.durationHours,
          fuelCost: costData?.estimatedCost || 0,
          hourlyWage: 15,
          maintenanceCostPerKm: vehicleType === 'motorcycle' ? 0.20 : 0.30,
          vehicleDepreciationPerKm: vehicleType === 'motorcycle' ? 0.30 : 0.50
        });
        setOperationalCost(opCost);
      } else {
        // Para rondas a pé, apenas considerar mão de obra
        const opCost = calculateOperationalCost({
          distanceKm: result.distanceKm,
          durationHours: result.durationHours,
          fuelCost: 0,
          hourlyWage: 15,
          maintenanceCostPerKm: 0,
          vehicleDepreciationPerKm: 0
        });
        setOperationalCost(opCost);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Análise de Rota {roundName && `- ${roundName}`}
          </DialogTitle>
          <DialogDescription>
            Análise detalhada de distância, tempo e custos estimados
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          {(loading || apiLoading) ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Calculando rota...</span>
            </div>
          ) : !routeData ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p>Não foi possível calcular a rota</p>
              <p className="text-sm">Verifique se há pelo menos 2 checkpoints</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Informações da Rota */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Route className="h-5 w-5" />
                    Informações da Rota
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Distância Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {routeData.distanceKm.toFixed(2)} km
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistance(routeData.totalDistance)}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Tempo Estimado</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatDuration(routeData.totalDuration)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {routeData.durationHours.toFixed(2)} horas
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Checkpoints</p>
                      <p className="font-semibold">{checkpoints.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Veículo</p>
                      <Badge variant="outline">
                        {vehicleType === 'car' ? 'Carro' : 
                         vehicleType === 'motorcycle' ? 'Moto' : 'A pé'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Velocidade Média</p>
                      <p className="font-semibold">
                        {(routeData.distanceKm / routeData.durationHours).toFixed(1)} km/h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Análise de Custos de Combustível */}
              {costData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Fuel className="h-5 w-5" />
                      Análise de Combustível
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Consumo Estimado</p>
                        <p className="text-xl font-bold">{costData.fuelConsumption} L</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Custo de Combustível</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCost(costData.estimatedCost)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Custo por Km</p>
                      <p className="text-lg font-semibold">{formatCost(costData.costPerKm)}/km</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custo Operacional Total */}
              {operationalCost && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Custo Operacional Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Combustível</span>
                        <span className="font-semibold">{formatCost(operationalCost.fuelCost)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Mão de Obra</span>
                        <span className="font-semibold">{formatCost(operationalCost.laborCost)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Manutenção</span>
                        <span className="font-semibold">{formatCost(operationalCost.maintenanceCost)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Depreciação</span>
                        <span className="font-semibold">{formatCost(operationalCost.depreciationCost)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between">
                        <span className="font-bold">Total</span>
                        <span className="text-xl font-bold text-primary">
                          {formatCost(operationalCost.totalCost)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Checkpoints */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Pontos da Rota ({checkpoints.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {checkpoints.map((checkpoint, index) => (
                      <div key={checkpoint.id} className="flex items-center gap-3 text-sm">
                        <Badge variant={index === 0 ? "default" : index === checkpoints.length - 1 ? "destructive" : "secondary"}>
                          {index + 1}
                        </Badge>
                        <span className="flex-1">{checkpoint.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {checkpoint.latitude.toFixed(6)}, {checkpoint.longitude.toFixed(6)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {routeData && (
            <Button onClick={analyzeRoute} disabled={loading || apiLoading}>
              {(loading || apiLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Recalcular
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteAnalysisDialog;
