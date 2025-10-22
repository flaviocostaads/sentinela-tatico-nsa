import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { 
  Fuel, 
  Wrench, 
  AlertTriangle, 
  Calendar, 
  MapPin, 
  DollarSign,
  TrendingUp,
  Clock,
  Search,
  X
} from "lucide-react";

interface MaintenanceLog {
  id: string;
  maintenance_type: string;
  service_type: string;
  description: string;
  location?: string;
  odometer_reading: number;
  cost?: number;
  parts_replaced?: string[];
  service_provider?: string;
  start_time: string;
  end_time?: string;
  created_by: string;
  profiles?: {
    name: string;
  } | null;
}

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  type: 'car' | 'motorcycle' | 'on_foot';
  current_odometer: number;
}

const VehicleMaintenanceReports = () => {
  const { vehicleId } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    if (vehicleId) {
      fetchVehicle();
      fetchMaintenanceLogs();
    }
  }, [vehicleId]);

  useEffect(() => {
    filterLogs();
  }, [maintenanceLogs, searchTerm, serviceTypeFilter, maintenanceTypeFilter]);

  const fetchVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .maybeSingle();

      if (error) throw error;
      setVehicle(data);
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do veículo",
        variant: "destructive",
      });
    }
  };

  const fetchMaintenanceLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_maintenance_logs")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately to avoid relationship issues
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
      
      setMaintenanceLogs(logsWithProfiles);
    } catch (error) {
      console.error("Error fetching maintenance logs:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de manutenção",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = maintenanceLogs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.service_provider?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (serviceTypeFilter !== "all") {
      filtered = filtered.filter(log => log.service_type === serviceTypeFilter);
    }

    if (maintenanceTypeFilter !== "all") {
      filtered = filtered.filter(log => log.maintenance_type === maintenanceTypeFilter);
    }

    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setServiceTypeFilter("all");
    setMaintenanceTypeFilter("all");
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'fuel': return Fuel;
      case 'tire_change':
      case 'oil_change':
      case 'repair': return Wrench;
      default: return AlertTriangle;
    }
  };

  const getServiceTypeLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      fuel: "Abastecimento",
      tire_change: "Troca de Pneu",
      oil_change: "Troca de Óleo",
      repair: "Reparo",
      inspection: "Inspeção",
      other: "Outro"
    };
    return labels[serviceType] || serviceType;
  };

  const getMaintenanceTypeLabel = (maintenanceType: string) => {
    const labels: Record<string, string> = {
      preventive: "Preventiva",
      corrective: "Corretiva",
      emergency: "Emergencial"
    };
    return labels[maintenanceType] || maintenanceType;
  };

  const getMaintenanceTypeBadge = (maintenanceType: string) => {
    switch (maintenanceType) {
      case 'preventive': 
        return <Badge variant="outline" className="text-tactical-green border-tactical-green">Preventiva</Badge>;
      case 'corrective': 
        return <Badge variant="outline" className="text-tactical-amber border-tactical-amber">Corretiva</Badge>;
      case 'emergency': 
        return <Badge variant="outline" className="text-tactical-red border-tactical-red">Emergencial</Badge>;
      default: 
        return <Badge variant="outline">{maintenanceType}</Badge>;
    }
  };

  const totalCost = filteredLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const totalServices = filteredLogs.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Veículo não encontrado</h1>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Relatórios de Manutenção - {vehicle.license_plate}
              </h1>
              <p className="text-muted-foreground">
                {vehicle.brand} {vehicle.model} {vehicle.year}
              </p>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total de Serviços</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalServices}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-tactical-green" />
                  <span className="text-sm text-muted-foreground">Custo Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Odômetro Atual</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {vehicle.current_odometer.toLocaleString()} km
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-tactical-amber" />
                  <span className="text-sm text-muted-foreground">Custo Médio</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  R$ {totalServices > 0 ? (totalCost / totalServices).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por descrição, local..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de Serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Serviços</SelectItem>
                    <SelectItem value="fuel">Abastecimento</SelectItem>
                    <SelectItem value="tire_change">Troca de Pneu</SelectItem>
                    <SelectItem value="oil_change">Troca de Óleo</SelectItem>
                    <SelectItem value="repair">Reparo</SelectItem>
                    <SelectItem value="inspection">Inspeção</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={maintenanceTypeFilter} onValueChange={setMaintenanceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de Manutenção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Manutenções</SelectItem>
                    <SelectItem value="preventive">Preventiva</SelectItem>
                    <SelectItem value="corrective">Corretiva</SelectItem>
                    <SelectItem value="emergency">Emergencial</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Manutenções */}
          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Wrench className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma manutenção encontrada</h3>
                  <p className="text-muted-foreground">
                    {maintenanceLogs.length === 0 
                      ? "Este veículo ainda não possui registros de manutenção."
                      : "Nenhuma manutenção corresponde aos filtros aplicados."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredLogs.map((log) => {
                const ServiceIcon = getServiceIcon(log.service_type);
                
                return (
                  <Card key={log.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <ServiceIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{getServiceTypeLabel(log.service_type)}</h3>
                            <p className="text-sm text-muted-foreground">{log.description}</p>
                          </div>
                        </div>
                        {getMaintenanceTypeBadge(log.maintenance_type)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {new Date(log.start_time).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {log.odometer_reading.toLocaleString()} km
                          </span>
                        </div>
                        
                        {log.cost && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              R$ {log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        
                        {log.location && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{log.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {(log.parts_replaced && log.parts_replaced.length > 0) && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium mb-1">Peças Substituídas:</p>
                          <div className="flex flex-wrap gap-1">
                            {log.parts_replaced.map((part, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {part}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {log.service_provider && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Prestador:</span> {log.service_provider}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default VehicleMaintenanceReports;