import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Activity, 
  TrendingUp, 
  Fuel, 
  Wrench, 
  Calendar,
  MapPin,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OdometerRecord {
  vehicle_id: string;
  km: number;
  source: string;
  recorded_at: string;
  notes: string | null;
  previous_km: number | null;
  km_diff: number | null;
}

interface OdometerAnalysisProps {
  vehicleId: string;
}

export const VehicleOdometerAnalysis = ({ vehicleId }: OdometerAnalysisProps) => {
  const [records, setRecords] = useState<OdometerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);

  const fetchOdometerHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_odometer_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching odometer history:', error);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchOdometerHistory();
  }, [fetchOdometerHistory]);

  const getSourceIcon = (source: string) => {
    if (source.includes('abastecimento')) return Fuel;
    if (source.includes('manutencao')) return Wrench;
    if (source.includes('ronda')) return MapPin;
    return Activity;
  };

  const getSourceLabel = (source: string) => {
    const labels: { [key: string]: string } = {
      'abastecimento': 'Abastecimento',
      'manutencao_preventive': 'Manutenção Preventiva',
      'manutencao_corrective': 'Manutenção Corretiva',
      'manutencao_emergency': 'Manutenção Emergencial',
      'ronda_inicial': 'Início de Ronda',
      'ronda_final': 'Fim de Ronda',
      'start': 'Início',
      'end': 'Fim'
    };
    return labels[source] || source;
  };

  const getSourceColor = (source: string) => {
    if (source.includes('abastecimento')) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    if (source.includes('manutencao')) return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
    if (source.includes('ronda')) return 'bg-green-500/10 text-green-700 dark:text-green-400';
    return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
  };

  const calculateStats = () => {
    if (records.length === 0) return null;

    const totalKm = records[0].km - (records[records.length - 1]?.previous_km || records[records.length - 1]?.km || 0);
    const daysWithData = Math.floor(
      (new Date(records[0].recorded_at).getTime() - 
       new Date(records[records.length - 1].recorded_at).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    const avgDaily = daysWithData > 0 ? Math.round(totalKm / daysWithData) : 0;

    return {
      totalKm,
      avgDaily,
      totalRecords: records.length,
      lastUpdate: records[0].recorded_at
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Atual</p>
                  <p className="text-2xl font-bold">{records[0]?.km.toLocaleString()} km</p>
                </div>
                <Activity className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Percorrido</p>
                  <p className="text-2xl font-bold">{stats.totalKm.toLocaleString()} km</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Média Diária</p>
                  <p className="text-2xl font-bold">{stats.avgDaily} km/dia</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Registros</p>
                  <p className="text-2xl font-bold">{stats.totalRecords}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Histórico Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Histórico de Quilometragem
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro de odômetro encontrado
            </p>
          ) : (
            <div className="space-y-2">
              {records.map((record, index) => {
                const Icon = getSourceIcon(record.source);
                const isExpanded = expandedRecord === index;
                
                return (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <div 
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedRecord(isExpanded ? null : index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-lg ${getSourceColor(record.source)}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={getSourceColor(record.source)}>
                                {getSourceLabel(record.source)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(record.recorded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-bold text-lg">
                                {record.km.toLocaleString()} km
                              </span>
                              
                              {record.km_diff && record.km_diff > 0 && (
                                <>
                                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm text-green-600 font-medium">
                                    +{record.km_diff.toLocaleString()} km
                                  </span>
                                </>
                              )}
                            </div>

                            {record.notes && !isExpanded && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                {record.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {isExpanded && record.notes && (
                        <div className="mt-3 ml-11 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm">{record.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
