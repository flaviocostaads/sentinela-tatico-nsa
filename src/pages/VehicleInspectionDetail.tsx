import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, FileText, Wrench } from 'lucide-react';
import { useVehicleInspections } from '@/hooks/useVehicleInspections';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function VehicleInspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getInspectionById } = useVehicleInspections();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadInspection();
    }
  }, [id]);

  const loadInspection = async () => {
    if (!id) return;
    const data = await getInspectionById(id);
    setInspection(data);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      approved: { label: 'Aprovado', icon: CheckCircle, className: 'bg-green-500/10 text-green-500' },
      approved_with_issues: { label: 'Aprovado c/ Ressalvas', icon: AlertTriangle, className: 'bg-yellow-500/10 text-yellow-500' },
      rejected: { label: 'Reprovado', icon: XCircle, className: 'bg-red-500/10 text-red-500' }
    };
    const statusConfig = config[status as keyof typeof config];
    if (!statusConfig) return null;
    const Icon = statusConfig.icon;
    return (
      <Badge className={statusConfig.className}>
        <Icon className="w-3 h-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      low: { label: 'Baixa', className: 'bg-blue-500/10 text-blue-500' },
      medium: { label: 'Média', className: 'bg-yellow-500/10 text-yellow-500' },
      high: { label: 'Alta', className: 'bg-orange-500/10 text-orange-500' },
      critical: { label: 'Crítica', className: 'bg-red-500/10 text-red-500' }
    };
    const sev = config[severity as keyof typeof config];
    if (!sev) return null;
    return <Badge className={sev.className}>{sev.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <p className="text-center text-muted-foreground">Carregando inspeção...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <p className="text-center text-muted-foreground">Inspeção não encontrada</p>
          </main>
        </div>
      </div>
    );
  }

  const checklistData = inspection.checklist_data || [];
  const photos = inspection.vehicle_inspection_photos || [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">Detalhes da Inspeção</h1>
              <p className="text-muted-foreground">ID: {inspection.id}</p>
            </div>
            {getStatusBadge(inspection.overall_status)}
          </div>

          {/* Informações do Veículo e Inspetor */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Veículo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Placa</p>
                  <p className="font-semibold">{inspection.vehicles?.license_plate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modelo</p>
                  <p>{inspection.vehicles?.brand} {inspection.vehicles?.model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Odômetro</p>
                  <p>{inspection.odometer_reading.toLocaleString()} km</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nível de Combustível</p>
                  <p>{inspection.fuel_level?.toFixed(0)}%</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inspetor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-semibold">{inspection.inspector?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p>{inspection.inspector?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data da Inspeção</p>
                  <p>{format(new Date(inspection.inspection_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="capitalize">{inspection.inspection_type.replace('_', ' ')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Checklist Completo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Checklist Completo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.isArray(checklistData) && checklistData.map((category: any, idx: number) => (
                <div key={idx} className="space-y-3">
                  <h3 className="font-semibold text-lg">{category.categoryLabel}</h3>
                  <div className="space-y-2 pl-4">
                    {category.items?.map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="flex items-start gap-3 p-2 rounded-lg bg-card/50">
                        {item.checked ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          {item.issue && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-muted-foreground">{item.issue}</p>
                              {item.severity && getSeverityBadge(item.severity)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {idx < checklistData.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fotos de Avarias */}
          {photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fotos de Avarias ({photos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo: any) => (
                    <Card key={photo.id} className="overflow-hidden">
                      <img
                        src={photo.photo_url}
                        alt="Avaria"
                        className="w-full h-48 object-cover"
                      />
                      <CardContent className="pt-4 space-y-2">
                        {photo.severity && getSeverityBadge(photo.severity)}
                        {photo.issue_description && (
                          <p className="text-sm text-muted-foreground">{photo.issue_description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {inspection.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{inspection.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Assinatura */}
          {inspection.signature_data && (
            <Card>
              <CardHeader>
                <CardTitle>Assinatura Digital</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-white">
                  <img
                    src={inspection.signature_data}
                    alt="Assinatura"
                    className="max-w-md mx-auto"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            {inspection.overall_status === 'approved_with_issues' && (
              <Button variant="outline">
                <Wrench className="w-4 h-4 mr-2" />
                Agendar Manutenção
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
