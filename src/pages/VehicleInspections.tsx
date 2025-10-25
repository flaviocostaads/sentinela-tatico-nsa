import { useState } from 'react';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClipboardCheck, Search, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useVehicleInspections } from '@/hooks/useVehicleInspections';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function VehicleInspections() {
  const navigate = useNavigate();
  const { inspections, loading, getInspectionStats } = useVehicleInspections();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const stats = getInspectionStats();

  const getStatusBadge = (status: string) => {
    const config = {
      approved: { label: 'Aprovado', variant: 'default' as const, icon: CheckCircle, className: 'bg-green-500/10 text-green-500' },
      approved_with_issues: { label: 'Aprovado c/ Ressalvas', variant: 'secondary' as const, icon: AlertTriangle, className: 'bg-yellow-500/10 text-yellow-500' },
      rejected: { label: 'Reprovado', variant: 'destructive' as const, icon: XCircle, className: 'bg-red-500/10 text-red-500' },
      pending_review: { label: 'Aguardando Revisão', variant: 'outline' as const, icon: Clock, className: 'bg-blue-500/10 text-blue-500' }
    };

    const statusConfig = config[status as keyof typeof config] || config.pending_review;
    const Icon = statusConfig.icon;

    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        <Icon className="w-3 h-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const filteredInspections = inspections.filter(inspection => {
    const matchesSearch = 
      inspection.vehicles?.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.inspector?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inspection.overall_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const criticalIssues = inspections.filter(i => 
    i.overall_status === 'rejected' || 
    (i.issues_reported && Array.isArray(i.issues_reported) && 
      i.issues_reported.some((issue: any) => issue.severity === 'critical'))
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Inspeções Veiculares</h1>
              <p className="text-muted-foreground">Gerencie e acompanhe todas as inspeções</p>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Inspeções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aprovadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Com Avarias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{stats.withIssues}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Reprovadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas Críticos */}
          {criticalIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{criticalIssues.length} veículo(s)</strong> com problemas críticos necessitam atenção imediata
              </AlertDescription>
            </Alert>
          )}

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por veículo ou inspetor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="approved_with_issues">Com Ressalvas</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                    <SelectItem value="pending_review">Aguardando Revisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Inspeções */}
          <Card>
            <CardHeader>
              <CardTitle>Inspeções Recentes</CardTitle>
              <CardDescription>Histórico completo de inspeções veiculares</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando inspeções...</p>
              ) : filteredInspections.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma inspeção encontrada</p>
              ) : (
                filteredInspections.map(inspection => (
                  <Card key={inspection.id} className="bg-card/50 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/vehicle-inspections/${inspection.id}`)}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">
                              {inspection.vehicles?.license_plate}
                            </h3>
                            {getStatusBadge(inspection.overall_status)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Veículo: {inspection.vehicles?.brand} {inspection.vehicles?.model}</p>
                            <p>Inspetor: {inspection.inspector?.name}</p>
                            <p>Data: {format(new Date(inspection.inspection_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            <p>Odômetro: {inspection.odometer_reading.toLocaleString()} km</p>
                          </div>
                          {inspection.notes && (
                            <p className="text-sm italic text-muted-foreground mt-2">
                              "{inspection.notes}"
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm">
                          Ver Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
