import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Car, Bike, MapPin, Fuel, Calendar, Wrench, Edit, Trash2, ArrowLeft, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  type: 'car' | 'motorcycle';
  initial_odometer: number;
  current_odometer: number;
  fuel_capacity?: number;
  active: boolean;
  created_at: string;
}

interface FuelLog {
  id: string;
  fuel_amount: number;
  fuel_cost?: number;
  odometer_reading: number;
  fuel_station?: string;
  created_at: string;
}

interface MaintenanceLog {
  id: string;
  maintenance_type: string;
  service_type: string;
  description: string;
  cost?: number;
  odometer_reading: number;
  created_at: string;
}

const VehicleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    license_plate: "",
    brand: "",
    model: "",
    year: 0,
    fuel_capacity: 0,
    current_odometer: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchVehicleDetails();
    }
  }, [id]);

  const fetchVehicleDetails = async () => {
    try {
      // Buscar dados do veículo
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();

      if (vehicleError) throw vehicleError;
      setVehicle(vehicleData);
      setEditData({
        license_plate: vehicleData.license_plate,
        brand: vehicleData.brand,
        model: vehicleData.model,
        year: vehicleData.year,
        fuel_capacity: vehicleData.fuel_capacity || 0,
        current_odometer: vehicleData.current_odometer
      });

      // Buscar logs de combustível
      const { data: fuelData, error: fuelError } = await supabase
        .from("vehicle_fuel_logs")
        .select("*")
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false });

      if (fuelError) throw fuelError;
      setFuelLogs(fuelData || []);

      // Buscar logs de manutenção
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from("vehicle_maintenance_logs")
        .select("*")
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false });

      if (maintenanceError) throw maintenanceError;
      setMaintenanceLogs(maintenanceData || []);

      // Buscar rondas do veículo
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients(name),
          profiles(name)
        `)
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

    } catch (error) {
      console.error("Error fetching vehicle details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes do veículo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update vehicle
      const { error } = await supabase
        .from("vehicles")
        .update({
          license_plate: editData.license_plate.toUpperCase(),
          brand: editData.brand,
          model: editData.model,
          year: editData.year,
          fuel_capacity: editData.fuel_capacity > 0 ? editData.fuel_capacity : null,
          current_odometer: editData.current_odometer
        })
        .eq("id", id);

      if (error) throw error;

      // Log odometer change if it was updated
      if (vehicle && vehicle.current_odometer !== editData.current_odometer) {
        const { error: logError } = await supabase
          .from("audit_logs")
          .insert({
            user_id: user.id,
            user_name: user.email || "",
            action: "UPDATE",
            table_name: "vehicles",
            record_id: id,
            old_values: { current_odometer: vehicle.current_odometer },
            new_values: { current_odometer: editData.current_odometer }
          });

        if (logError) console.error("Error logging odometer change:", logError);
      }

      toast({
        title: "Sucesso",
        description: "Veículo atualizado com sucesso!",
      });

      setEditDialogOpen(false);
      fetchVehicleDetails();
    } catch (error) {
      console.error("Error updating vehicle:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar veículo",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Veículo desativado com sucesso!",
      });

      navigate('/vehicles');
    } catch (error) {
      console.error("Error deactivating vehicle:", error);
      toast({
        title: "Erro",
        description: "Erro ao desativar veículo",
        variant: "destructive",
      });
    }
  };

  const getVehicleIcon = (type: string) => {
    return type === 'car' ? Car : Bike;
  };

  const calculateStats = () => {
    // Calcular distância real baseada nos logs de combustível
    const sortedFuelLogs = [...fuelLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const realTotalDistance = sortedFuelLogs.length > 0 
      ? Math.max(...sortedFuelLogs.map(log => log.odometer_reading)) - (vehicle?.initial_odometer || 0)
      : 0;

    const totalFuel = fuelLogs.reduce((sum, log) => sum + log.fuel_amount, 0);
    const totalMaintenanceCost = maintenanceLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const fuelCost = fuelLogs.reduce((sum, log) => sum + (log.fuel_cost || 0), 0);
    const fuelEfficiency = realTotalDistance > 0 && totalFuel > 0 ? realTotalDistance / totalFuel : 0;

    // Estatísticas por tático
    const roundsByTactic = rounds.reduce((acc, round) => {
      const tacticName = round.profiles?.name || 'Não definido';
      if (!acc[tacticName]) {
        acc[tacticName] = { count: 0, distance: 0 };
      }
      acc[tacticName].count++;
      return acc;
    }, {} as Record<string, { count: number; distance: number }>);

    return {
      totalDistance: realTotalDistance,
      totalFuel,
      totalMaintenanceCost,
      fuelCost,
      fuelEfficiency,
      totalRounds: rounds.length,
      roundsByTactic
    };
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Carregando detalhes do veículo...</p>
      </div>
    </div>;
  }

  if (!vehicle) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Veículo não encontrado</h2>
        <Button onClick={() => navigate('/vehicles')} className="mt-4">
          Voltar para Veículos
        </Button>
      </div>
    </div>;
  }

  const Icon = getVehicleIcon(vehicle.type);
  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/vehicles')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{vehicle.license_plate}</h1>
                <p className="text-muted-foreground">
                  {vehicle.brand} {vehicle.model} {vehicle.year}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Desativar
              </Button>
            </div>
          </div>

          {/* Cabeçalho do veículo */}
          <Card className="tactical-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{vehicle.license_plate}</h2>
                    <p className="text-muted-foreground">
                      {vehicle.brand} {vehicle.model} {vehicle.year}
                    </p>
                    <Badge className="mt-2 bg-tactical-green text-white">
                      Ativo
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Odômetro Atual</p>
                  <p className="text-2xl font-bold">{vehicle.current_odometer.toLocaleString()} km</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-tactical-green" />
                  <span className="text-sm text-muted-foreground">Distância Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalDistance.toLocaleString()} km</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total de Rondas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalRounds}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Fuel className="w-5 h-5 text-tactical-amber" />
                  <span className="text-sm text-muted-foreground">Combustível</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalFuel.toFixed(1)}L</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-tactical-green" />
                  <span className="text-sm text-muted-foreground">Eficiência</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.fuelEfficiency > 0 ? `${stats.fuelEfficiency.toFixed(1)} km/L` : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs com detalhes */}
          <Tabs defaultValue="analytics" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="analytics">Análise</TabsTrigger>
              <TabsTrigger value="fuel">Abastecimentos</TabsTrigger>
              <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
              <TabsTrigger value="rounds">Rondas Recentes</TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="space-y-4">
              {/* Dashboard com análises e gráficos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Ranking Mensal - Rondas por Tático</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.entries(stats.roundsByTactic).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum dado de rondas disponível
                      </p>
                    ) : (
                       <div className="space-y-3">
                        {Object.entries(stats.roundsByTactic)
                          .sort(([,a], [,b]) => (b as { count: number; distance: number }).count - (a as { count: number; distance: number }).count)
                          .map(([tacticName, data], index) => {
                            const tacticData = data as { count: number; distance: number };
                            return (
                          <div key={tacticName} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                index === 0 ? 'bg-tactical-green' : 
                                index === 1 ? 'bg-tactical-amber' : 
                                index === 2 ? 'bg-tactical-red' : 'bg-muted'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{tacticName}</p>
                                <p className="text-sm text-muted-foreground">Tático</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{tacticData.count}</p>
                              <p className="text-sm text-muted-foreground">rondas</p>
                            </div>
                          </div>
                         )})}
                       </div>
                     )}
                   </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Consumo e Eficiência</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Consumo Total</p>
                        <p className="text-2xl font-bold text-tactical-amber">{stats.totalFuel.toFixed(1)}L</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Custo Total</p>
                        <p className="text-2xl font-bold text-tactical-red">R$ {stats.fuelCost.toFixed(2)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Eficiência</p>
                        <p className="text-2xl font-bold text-tactical-green">
                          {stats.fuelEfficiency > 0 ? `${stats.fuelEfficiency.toFixed(1)} km/L` : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Manutenção</p>
                        <p className="text-2xl font-bold text-primary">R$ {stats.totalMaintenanceCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de KM por Data</CardTitle>
                </CardHeader>
                <CardContent>
                  {fuelLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado de quilometragem disponível
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {fuelLogs
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 10)
                        .map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{new Date(log.created_at).toLocaleDateString('pt-BR')}</p>
                            <p className="text-sm text-muted-foreground">
                              {log.fuel_station || 'Abastecimento'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{log.odometer_reading.toLocaleString()} km</p>
                            <p className="text-sm text-muted-foreground">
                              {log.fuel_amount}L - R$ {(log.fuel_cost || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fuel" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Abastecimentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {fuelLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum abastecimento registrado
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {fuelLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{log.fuel_amount}L</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(log.created_at).toLocaleDateString()}
                            </p>
                            {log.fuel_station && (
                              <p className="text-sm text-muted-foreground">{log.fuel_station}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{log.odometer_reading.toLocaleString()} km</p>
                            {log.fuel_cost && (
                              <p className="text-sm text-muted-foreground">
                                R$ {log.fuel_cost.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Manutenção</CardTitle>
                </CardHeader>
                <CardContent>
                  {maintenanceLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma manutenção registrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {maintenanceLogs.map((log) => (
                        <div key={log.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{log.service_type}</h4>
                            <Badge variant="outline">{log.maintenance_type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{log.description}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span>{new Date(log.created_at).toLocaleDateString()}</span>
                            <div className="text-right">
                              <span className="text-muted-foreground">
                                {log.odometer_reading.toLocaleString()} km
                              </span>
                              {log.cost && (
                                <span className="ml-4 font-medium">R$ {log.cost.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rounds" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Rondas Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {rounds.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma ronda registrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {rounds.map((round) => (
                        <div key={round.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{round.clients?.name}</p>
                            <p className="text-sm text-muted-foreground">{round.profiles?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(round.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline" className={
                            round.status === 'completed' ? 'border-tactical-green text-tactical-green' :
                            round.status === 'active' ? 'border-tactical-amber text-tactical-amber' :
                            'border-muted-foreground text-muted-foreground'
                          }>
                            {round.status === 'completed' ? 'Concluída' :
                             round.status === 'active' ? 'Ativa' :
                             round.status === 'pending' ? 'Pendente' : round.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Dialog de Edição */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Veículo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="license_plate">Placa</Label>
                    <Input
                      id="license_plate"
                      value={editData.license_plate}
                      onChange={(e) => setEditData({ ...editData, license_plate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Ano</Label>
                    <Input
                      id="year"
                      type="number"
                      value={editData.year}
                      onChange={(e) => setEditData({ ...editData, year: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={editData.brand}
                      onChange={(e) => setEditData({ ...editData, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      value={editData.model}
                      onChange={(e) => setEditData({ ...editData, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuel_capacity">Capacidade do Tanque (L)</Label>
                  <Input
                    id="fuel_capacity"
                    type="number"
                    step="0.1"
                    value={editData.fuel_capacity}
                    onChange={(e) => setEditData({ ...editData, fuel_capacity: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current_odometer">Odômetro Atual (km)</Label>
                  <Input
                    id="current_odometer"
                    type="number"
                    value={editData.current_odometer}
                    onChange={(e) => setEditData({ ...editData, current_odometer: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleEdit} className="flex-1 bg-tactical-green hover:bg-tactical-green/90">
                    Salvar Alterações
                  </Button>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default VehicleDetails;