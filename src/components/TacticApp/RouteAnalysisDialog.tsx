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
  AlertCircle,
  Home
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBaseLocation } from '@/hooks/useBaseLocation';

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
  templateId?: string;
  checkpoints?: Checkpoint[];
  vehicleType: 'car' | 'motorcycle' | 'on_foot';
  roundName?: string;
}

const RouteAnalysisDialog = ({
  open,
  onOpenChange,
  roundId,
  templateId,
  checkpoints: providedCheckpoints,
  vehicleType,
  roundName
}: RouteAnalysisDialogProps) => {
  const { 
    calculateRoundDistance, 
    calculateRoundCost,
    loading: apiLoading
  } = useMapboxDirections();
  
  const { base, loading: baseLoading } = useBaseLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(providedCheckpoints || []);
  const [routeData, setRouteData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [operationalCost, setOperationalCost] = useState<any>(null);

  useEffect(() => {
    if (open && (templateId || roundId) && !providedCheckpoints) {
      fetchCheckpoints();
    } else if (open && checkpoints.length >= 2) {
      analyzeRoute();
    }
  }, [open, roundId, templateId]);

  const fetchCheckpoints = async () => {
    if (!templateId && !roundId) return;
    
    setLoading(true);
    try {
      let checkpointsData: Checkpoint[] = [];

      if (templateId) {
        // Buscar checkpoints diretamente do template
        console.log("Fetching checkpoints for template:", templateId);
        
        const { data: templateCheckpoints, error: templateError } = await supabase
          .from('round_template_checkpoints')
          .select('client_id, order_index')
          .eq('template_id', templateId)
          .order('order_index');

        if (templateError) throw templateError;

        if (!templateCheckpoints || templateCheckpoints.length === 0) {
          toast({
            title: "Erro",
            description: "Template não possui checkpoints configurados",
            variant: "destructive",
          });
          setCheckpoints([]);
          return;
        }

        console.log("Template checkpoints:", templateCheckpoints);

        // Buscar clientes com coordenadas
        const clientIds = templateCheckpoints.map(tc => tc.client_id);
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, lat, lng')
          .in('id', clientIds);

        if (clientsError) throw clientsError;

        console.log("Clients data:", clients);

        // Buscar checkpoints físicos
        const { data: physicalCheckpoints, error: checkpointsError } = await supabase
          .from('checkpoints')
          .select('id, name, client_id, lat, lng')
          .in('client_id', clientIds)
          .eq('active', true);

        if (checkpointsError) throw checkpointsError;

        console.log("Physical checkpoints:", physicalCheckpoints);

        // Construir lista de checkpoints com fallback para coordenadas do cliente
        templateCheckpoints.forEach(tc => {
          const client = clients?.find(c => c.id === tc.client_id);
          const clientPhysicalCheckpoints = physicalCheckpoints?.filter(cp => cp.client_id === tc.client_id) || [];
          
          if (clientPhysicalCheckpoints.length > 0) {
            // Usar checkpoints físicos COM FALLBACK para coordenadas do cliente
            clientPhysicalCheckpoints.forEach(cp => {
              const lat = cp.lat || client?.lat;
              const lng = cp.lng || client?.lng;
              
              if (lat && lng) {
                checkpointsData.push({
                  id: cp.id,
                  name: cp.name,
                  latitude: Number(lat),
                  longitude: Number(lng)
                });
              }
            });
          } else if (client?.lat && client?.lng) {
            // Criar checkpoint virtual usando coordenadas do cliente
            checkpointsData.push({
              id: `virtual_${tc.client_id}`,
              name: client.name,
              latitude: Number(client.lat),
              longitude: Number(client.lng)
            });
          }
        });

        console.log("Checkpoints before validation:", checkpointsData);

        // VALIDAÇÃO CRÍTICA: Remover checkpoints sem coordenadas
        checkpointsData = checkpointsData.filter(cp => 
          cp.latitude && cp.longitude && 
          !isNaN(cp.latitude) && !isNaN(cp.longitude)
        );

        console.log("Checkpoints after validation:", checkpointsData);

        if (checkpointsData.length === 0) {
          toast({
            title: "Erro ao Carregar Pontos",
            description: "Nenhum checkpoint com coordenadas válidas foi encontrado. Verifique se os clientes possuem lat/lng configurados.",
            variant: "destructive"
          });
          setCheckpoints([]);
          return;
        }

        if (checkpointsData.length === 1) {
          toast({
            title: "Pontos Insuficientes",
            description: "Encontrado apenas 1 ponto. São necessários pelo menos 2 pontos para calcular uma rota.",
            variant: "destructive"
          });
          setCheckpoints(checkpointsData);
          return;
        }

      } else if (roundId) {
        // Lógica existente para roundId
        const { data: round, error: roundError } = await supabase
          .from('rounds')
          .select('template_id, client_id')
          .eq('id', roundId)
          .single();

        if (roundError) throw roundError;

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
          templateCheckpoints.forEach((tc: any) => {
            const clientPhysicalCheckpoints = clientCheckpoints?.filter((cp: any) => cp.client_id === tc.client_id) || [];
            const client = clients?.find((c: any) => c.id === tc.client_id);
            
            if (clientPhysicalCheckpoints.length > 0) {
              // Use physical checkpoints with fallback
              clientPhysicalCheckpoints.forEach((cp: any) => {
                const lat = cp.lat || client?.lat;
                const lng = cp.lng || client?.lng;
                
                if (lat && lng) {
                  checkpointsData.push({
                    id: cp.id,
                    name: cp.name,
                    latitude: Number(lat),
                    longitude: Number(lng)
                  });
                }
              });
            } else if (client?.lat && client?.lng) {
              // Use client location as fallback
              checkpointsData.push({
                id: tc.id,
                name: client.name || "Cliente",
                latitude: Number(client.lat),
                longitude: Number(client.lng)
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

          if (client?.lat && client?.lng) {
            checkpointsData = [{
              id: client.id,
              name: client.name,
              latitude: Number(client.lat),
              longitude: Number(client.lng)
            }];
          }
        }
      }

      setCheckpoints(checkpointsData);
      
      if (checkpointsData.length >= 2) {
        await analyzeRoute();
      } else if (checkpointsData.length === 1) {
        toast({
          title: "Aviso",
          description: "Ronda possui apenas 1 ponto. São necessários pelo menos 2 pontos para calcular a rota.",
          variant: "default",
        });
      } else {
        toast({
          title: "Aviso",
          description: "Ronda não possui pontos válidos. Análise não disponível.",
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
    if (!base) {
      toast({
        title: "BASE não configurada",
        description: "Configure uma BASE no sistema para calcular rotas precisas",
        variant: "destructive",
      });
      return;
    }

    const profile = getMapboxProfile(vehicleType);
    
    // Incluir BASE no início e no fim da rota (BASE → Checkpoints → BASE)
    const baseCoordinate = {
      latitude: Number(base.lat),
      longitude: Number(base.lng)
    };
    
    const checkpointCoordinates = checkpoints.map(cp => ({
      latitude: cp.latitude,
      longitude: cp.longitude
    }));
    
    // Rota completa: BASE → Checkpoints → BASE
    const coordinates = [baseCoordinate, ...checkpointCoordinates, baseCoordinate];

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
          {(loading || apiLoading || baseLoading) ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">
                {baseLoading ? 'Carregando BASE...' : 'Calculando rota...'}
              </span>
            </div>
          ) : !base ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Home className="h-12 w-12 mb-4" />
              <p className="font-semibold">BASE não configurada</p>
              <p className="text-sm">Configure uma BASE no sistema para análise de rotas</p>
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
                  {base && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                      <Home className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{base.name}</p>
                        <p className="text-xs text-muted-foreground">{base.address}</p>
                      </div>
                      <Badge variant="outline">BASE</Badge>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Distância Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {routeData.distanceKm.toFixed(2)} km
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistance(routeData.totalDistance)} (ida e volta)
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
                      <p className="text-muted-foreground">Pontos de Parada</p>
                      <p className="font-semibold">{checkpoints.length}</p>
                      <p className="text-xs text-muted-foreground">+ BASE</p>
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
