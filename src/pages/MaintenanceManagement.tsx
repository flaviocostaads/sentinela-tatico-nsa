import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Wrench, 
  Car, 
  Bike, 
  Plus, 
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import MaintenanceDeleteButton from "@/components/ui/maintenance-delete-button";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  service_type: string;
  maintenance_type: string;
  description: string;
  cost?: number;
  odometer_reading: number;
  start_time: string;
  end_time?: string;
  location?: string;
  service_provider?: string;
  parts_replaced?: string[];
  created_by: string;
  vehicles: {
    license_plate: string;
    brand: string;
    model: string;
    type: 'car' | 'motorcycle';
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
  type: 'car' | 'motorcycle';
  current_odometer: number;
}

interface MaintenanceStats {
  totalCost: number;
  totalServices: number;
  pendingServices: number;
  avgServiceTime: string;
}

const MaintenanceManagement = () => {
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<MaintenanceStats>({
    totalCost: 0,
    totalServices: 0,
    pendingServices: 0,
    avgServiceTime: "0h"
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: "",
    service_type: "",
    maintenance_type: "",
    description: "",
    cost: 0,
    odometer_reading: 0,
    location: "",
    service_provider: "",
    parts_replaced: ""
  });
  const { toast } = useToast();

  const maintenanceTypes = [
    "preventiva",
    "corretiva", 
    "preditiva",
    "emergencial"
  ];

  const serviceTypes = [
    "troca_oleo",
    "revisao_geral",
    "troca_pneus",
    "freios",
    "suspensao",
    "motor",
    "transmissao",
    "eletrica", 
    "ar_condicionado",
    "outros"
  ];

  const getServiceLabel = (serviceType: string) => {
    const labels: { [key: string]: string } = {
      "troca_oleo": "Troca de óleo",
      "revisao_geral": "Revisão geral",
      "troca_pneus": "Troca de pneus",
      "freios": "Freios",
      "suspensao": "Suspensão",
      "motor": "Motor",
      "transmissao": "Transmissão",
      "eletrica": "Elétrica",
      "ar_condicionado": "Ar condicionado",
      "outros": "Outros"
    };
    return labels[serviceType] || serviceType;
  };

  const getMaintenanceLabel = (maintenanceType: string) => {
    const labels: { [key: string]: string } = {
      "preventiva": "Preventiva",
      "corretiva": "Corretiva",
      "preditiva": "Preditiva", 
      "emergencial": "Emergencial"
    };
    return labels[maintenanceType] || maintenanceType;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchMaintenanceLogs(),
        fetchVehicles(),
        fetchStats()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_maintenance_logs")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Buscar dados relacionados separadamente
      const logsWithDetails = await Promise.all(
        (data || []).map(async (log) => {
          const [profileResult, vehicleResult] = await Promise.all([
            supabase.from("profiles").select("name").eq("user_id", log.created_by).maybeSingle(),
            supabase.from("vehicles").select("license_plate, brand, model, type").eq("id", log.vehicle_id).maybeSingle()
          ]);
          
          return {
            ...log,
            profiles: profileResult.data ? { name: profileResult.data.name } : null,
            vehicles: vehicleResult.data || { license_plate: 'N/A', brand: 'N/A', model: 'N/A', type: 'car' as const }
          };
        })
      );

      setMaintenanceLogs(logsWithDetails);
    } catch (error) {
      console.error("Error fetching maintenance logs:", error);
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
        .from("vehicle_maintenance_logs")
        .select("cost, start_time, end_time");

      if (error) throw error;

      const logs = data || [];
      const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
      const completedServices = logs.filter(log => log.end_time);
      const pendingServices = logs.filter(log => !log.end_time);

      // Calcular tempo médio de serviço
      let avgTime = 0;
      if (completedServices.length > 0) {
        const totalMinutes = completedServices.reduce((sum, log) => {
          if (log.start_time && log.end_time) {
            const start = new Date(log.start_time);
            const end = new Date(log.end_time);
            return sum + ((end.getTime() - start.getTime()) / (1000 * 60));
          }
          return sum;
        }, 0);
        avgTime = totalMinutes / completedServices.length;
      }

      const hours = Math.floor(avgTime / 60);
      const minutes = Math.floor(avgTime % 60);

      setStats({
        totalCost,
        totalServices: logs.length,
        pendingServices: pendingServices.length,
        avgServiceTime: `${hours}h ${minutes}m`
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

      const partsArray = formData.parts_replaced 
        ? formData.parts_replaced.split(',').map(part => part.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from("vehicle_maintenance_logs")
        .insert([{
          vehicle_id: formData.vehicle_id,
          service_type: formData.service_type,
          maintenance_type: formData.maintenance_type,
          description: formData.description,
          cost: formData.cost || null,
          odometer_reading: formData.odometer_reading,
          location: formData.location || null,
          service_provider: formData.service_provider || null,
          parts_replaced: partsArray.length > 0 ? partsArray : null,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Manutenção registrada com sucesso!",
      });

      setDialogOpen(false);
      setFormData({
        vehicle_id: "",
        service_type: "",
        maintenance_type: "",
        description: "",
        cost: 0,
        odometer_reading: 0,
        location: "",
        service_provider: "",
        parts_replaced: ""
      });
      fetchData();
    } catch (error) {
      console.error("Error creating maintenance log:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar manutenção",
        variant: "destructive",
      });
    }
  };

  const getServiceIcon = (maintenanceType: string) => {
    switch (maintenanceType.toLowerCase()) {
      case 'preventiva':
        return CheckCircle;
      case 'corretiva':
        return Wrench;
      case 'emergencial':
        return AlertTriangle;
      default:
        return Wrench;
    }
  };

  const getServiceColor = (maintenanceType: string) => {
    switch (maintenanceType.toLowerCase()) {
      case 'preventiva':
        return 'bg-tactical-green text-white';
      case 'corretiva':
        return 'bg-tactical-amber text-white';
      case 'emergencial':
        return 'bg-tactical-red text-white';
      default:
        return 'bg-muted text-muted-foreground';
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
              <h1 className="text-3xl font-bold text-foreground">Gestão de Manutenção</h1>
              <p className="text-muted-foreground">
                Controle completo da manutenção da frota
              </p>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-tactical-green hover:bg-tactical-green/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Manutenção
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Registrar Manutenção</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="service_type">Tipo de Serviço</Label>
                      <Select 
                        value={formData.service_type} 
                        onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map((type) => (
                            <SelectItem key={type} value={type}>{getServiceLabel(type)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maintenance_type">Tipo de Manutenção</Label>
                    <Select 
                      value={formData.maintenance_type} 
                      onValueChange={(value) => setFormData({ ...formData, maintenance_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a manutenção" />
                      </SelectTrigger>
                        <SelectContent>
                          {maintenanceTypes.map((type) => (
                            <SelectItem key={type} value={type}>{getMaintenanceLabel(type)}</SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva o serviço realizado..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cost">Custo (R$)</Label>
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                        placeholder="0.00"
                      />
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Local</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Oficina ou local do serviço"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="service_provider">Prestador</Label>
                      <Input
                        id="service_provider"
                        value={formData.service_provider}
                        onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })}
                        placeholder="Nome da oficina/mecânico"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parts_replaced">Peças Substituídas</Label>
                    <Input
                      id="parts_replaced"
                      value={formData.parts_replaced}
                      onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
                      placeholder="Peça 1, Peça 2, Peça 3... (separadas por vírgula)"
                    />
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
                      disabled={!formData.vehicle_id || !formData.service_type || !formData.maintenance_type || !formData.description}
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
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Em manutenções
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Serviços</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalServices}</div>
                <p className="text-xs text-muted-foreground">
                  Manutenções realizadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-tactical-amber">{stats.pendingServices}</div>
                <p className="text-xs text-muted-foreground">
                  Serviços em andamento
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgServiceTime}</div>
                <p className="text-xs text-muted-foreground">
                  Por serviço
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de manutenções */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {maintenanceLogs.map((log) => {
                  const VehicleIcon = getVehicleIcon(log.vehicles.type);
                  const ServiceIcon = getServiceIcon(log.maintenance_type);
                  return (
                    <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <VehicleIcon className="w-8 h-8 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">
                            {log.vehicles.license_plate} - {log.vehicles.brand} {log.vehicles.model}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.profiles?.name || 'Usuário não encontrado'} • {' '}
                            {new Date(log.start_time).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-sm">
                            <Badge className={getServiceColor(log.maintenance_type)} variant="secondary">
                              <ServiceIcon className="w-3 h-3 mr-1" />
                              {getMaintenanceLabel(log.maintenance_type)}
                            </Badge>
                            <span className="ml-2 text-muted-foreground">{getServiceLabel(log.service_type)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.description}
                          </div>
                          {log.location && (
                            <div className="text-xs text-muted-foreground">
                              📍 {log.location}
                            </div>
                          )}
                        </div>
                      </div>
                       <div className="flex items-center space-x-4">
                         <div className="text-right">
                           {log.cost && (
                             <div className="font-medium">
                               R$ {log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                             </div>
                           )}
                           <div className="text-sm text-muted-foreground">
                             {log.odometer_reading.toLocaleString()} km
                           </div>
                           <div className="text-xs">
                             {log.end_time ? (
                               <Badge className="bg-tactical-green text-white">Concluído</Badge>
                             ) : (
                               <Badge className="bg-tactical-amber text-white">Em andamento</Badge>
                             )}
                           </div>
                         </div>
                         <MaintenanceDeleteButton 
                           logId={log.id} 
                           onDelete={() => fetchData()} 
                         />
                       </div>
                    </div>
                  );
                })}
              </div>
              
              {maintenanceLogs.length === 0 && (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma manutenção registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default MaintenanceManagement;