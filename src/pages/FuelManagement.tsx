import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Fuel, 
  Car, 
  Bike, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  DollarSign,
  Gauge
} from "lucide-react";
import FuelDeleteButton from "@/components/ui/fuel-delete-button";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface FuelLog {
  id: string;
  vehicle_id: string;
  fuel_amount: number;
  fuel_cost: number;
  odometer_reading: number;
  fuel_station?: string;
  created_at: string;
  created_by: string;
  vehicles: {
    license_plate: string;
    brand: string;
    model: string;
    type: 'car' | 'motorcycle' | 'on_foot';
  };
  profiles?: {
    name: string;
  };
}

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  type: 'car' | 'motorcycle' | 'on_foot';
  current_odometer: number;
  fuel_capacity?: number;
}

interface FuelStats {
  totalCost: number;
  totalLiters: number;
  averageConsumption: number;
  monthlyTrend: number;
}

const FuelManagement = () => {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<FuelStats>({
    totalCost: 0,
    totalLiters: 0,
    averageConsumption: 0,
    monthlyTrend: 0
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: "",
    fuel_amount: 0,
    fuel_cost: 0,
    odometer_reading: 0,
    fuel_station: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchFuelLogs(),
        fetchVehicles(),
        fetchStats()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFuelLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_fuel_logs")
        .select(`
          *,
          vehicles (license_plate, brand, model, type)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Buscar perfis separadamente
      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", log.created_by)
            .maybeSingle();
          
          return {
            ...log,
            profiles: profile ? { name: profile.name } : null
          };
        })
      );

      setFuelLogs(logsWithProfiles);
    } catch (error) {
      console.error("Error fetching fuel logs:", error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("active", true)
        .order("license_plate");

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_fuel_logs")
        .select("fuel_amount, fuel_cost, created_at");

      if (error) throw error;

      const logs = data || [];
      const totalCost = logs.reduce((sum, log) => sum + (log.fuel_cost || 0), 0);
      const totalLiters = logs.reduce((sum, log) => sum + log.fuel_amount, 0);

      // Calcular tendência mensal (simulado)
      const thisMonth = new Date().getMonth();
      const thisMonthLogs = logs.filter(log => 
        new Date(log.created_at).getMonth() === thisMonth
      );
      const lastMonthLogs = logs.filter(log => 
        new Date(log.created_at).getMonth() === thisMonth - 1
      );
      
      const thisMonthCost = thisMonthLogs.reduce((sum, log) => sum + (log.fuel_cost || 0), 0);
      const lastMonthCost = lastMonthLogs.reduce((sum, log) => sum + (log.fuel_cost || 0), 0);
      
      const monthlyTrend = lastMonthCost > 0 ? 
        ((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 : 0;

      setStats({
        totalCost,
        totalLiters,
        averageConsumption: totalLiters > 0 ? totalCost / totalLiters : 0,
        monthlyTrend
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("vehicle_fuel_logs")
        .insert([{
          ...formData,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Abastecimento registrado com sucesso!",
      });

      setDialogOpen(false);
      setFormData({
        vehicle_id: "",
        fuel_amount: 0,
        fuel_cost: 0,
        odometer_reading: 0,
        fuel_station: ""
      });
      fetchData();
    } catch (error) {
      console.error("Error creating fuel log:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar abastecimento",
        variant: "destructive",
      });
    }
  };

  const getVehicleIcon = (type: string) => {
    return type === 'car' ? Car : Bike;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestão de Abastecimento</h1>
              <p className="text-muted-foreground">
                Controle completo dos abastecimentos da frota
              </p>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-tactical-green hover:bg-tactical-green/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Abastecimento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Abastecimento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_id">Veículo</Label>
                    <Select 
                      value={formData.vehicle_id} 
                      onValueChange={(value) => {
                        const vehicle = vehicles.find(v => v.id === value);
                        setFormData({ 
                          ...formData, 
                          vehicle_id: value,
                          odometer_reading: vehicle?.current_odometer || 0
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o veículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((vehicle) => {
                          const Icon = getVehicleIcon(vehicle.type);
                          return (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              <div className="flex items-center space-x-2">
                                <Icon className="w-4 h-4" />
                                <span>{vehicle.license_plate} - {vehicle.brand} {vehicle.model}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fuel_amount">Litros</Label>
                      <Input
                        id="fuel_amount"
                        type="number"
                        step="0.01"
                        value={formData.fuel_amount}
                        onChange={(e) => setFormData({ ...formData, fuel_amount: parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel_cost">Valor (R$)</Label>
                      <Input
                        id="fuel_cost"
                        type="number"
                        step="0.01"
                        value={formData.fuel_cost}
                        onChange={(e) => setFormData({ ...formData, fuel_cost: parseFloat(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="odometer_reading">Odômetro (km)</Label>
                    <Input
                      id="odometer_reading"
                      type="number"
                      value={formData.odometer_reading}
                      onChange={(e) => setFormData({ ...formData, odometer_reading: parseInt(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuel_station">Posto (opcional)</Label>
                    <Input
                      id="fuel_station"
                      value={formData.fuel_station}
                      onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
                      placeholder="Nome do posto de combustível"
                    />
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
                      disabled={!formData.vehicle_id || !formData.fuel_amount || !formData.fuel_cost}
                    >
                      Registrar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  {stats.monthlyTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-tactical-red" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-tactical-green" />
                  )}
                  <span>{Math.abs(stats.monthlyTrend).toFixed(1)}% vs mês anterior</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Litros</CardTitle>
                <Fuel className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}L
                </div>
                <p className="text-xs text-muted-foreground">
                  Combustível consumido
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {stats.averageConsumption.toFixed(2)}/L
                </div>
                <p className="text-xs text-muted-foreground">
                  Por litro
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abastecimentos</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fuelLogs.length}</div>
                <p className="text-xs text-muted-foreground">
                  Registros totais
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de abastecimentos */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Abastecimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fuelLogs.map((log) => {
                  const Icon = getVehicleIcon(log.vehicles.type);
                  return (
                    <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Icon className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {log.vehicles.license_plate} - {log.vehicles.brand} {log.vehicles.model}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.profiles?.name || 'Usuário não encontrado'} • {' '}
                            {new Date(log.created_at).toLocaleDateString('pt-BR')}
                          </div>
                          {log.fuel_station && (
                            <div className="text-xs text-muted-foreground">
                              {log.fuel_station}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">
                            {log.fuel_amount.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}L
                          </div>
                          <div className="text-sm text-muted-foreground">
                            R$ {(log.fuel_cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.odometer_reading.toLocaleString()} km
                          </div>
                        </div>
                        <FuelDeleteButton 
                          logId={log.id} 
                          onDelete={() => fetchData()} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {fuelLogs.length === 0 && (
                <div className="text-center py-12">
                  <Fuel className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum abastecimento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default FuelManagement;