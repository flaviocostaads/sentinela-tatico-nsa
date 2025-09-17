import { useState, useEffect } from "react";
import { AlertTriangle, MapPin, Clock, User, FileImage, X, FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import InvestigationDialog from "./InvestigationDialog";
import ResolutionDialog from "./ResolutionDialog";

interface IncidentDetailsProps {
  open: boolean;
  onClose: () => void;
  incident: {
    id: string;
    title: string;
    description?: string;
    type: string;
    priority: string;
    status: string;
    lat?: number;
    lng?: number;
    reported_at: string;
    round_id?: string;
    investigation_report?: string;
    investigation_completed_at?: string;
    investigated_by?: string;
    resolution_comment?: string;
    resolved_at?: string;
    resolved_by?: string;
  };
  onRefresh?: () => void;
}

interface Photo {
  id: string;
  url: string;
  metadata?: any;
}

interface RoundDetails {
  id: string;
  user: {
    name: string;
  };
  client: {
    name: string;
  };
}

const IncidentDetailsDialog = ({ open, onClose, incident, onRefresh }: IncidentDetailsProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [roundDetails, setRoundDetails] = useState<RoundDetails | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    if (open && incident) {
      fetchIncidentDetails();
    }
  }, [open, incident]);

  const fetchIncidentDetails = async () => {
    try {
      setLoading(true);

      // Buscar fotos da ocorrência
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .eq("incident_id", incident.id);

      if (photosError) {
        console.error("Error fetching photos:", photosError);
      } else {
        setPhotos(photosData || []);
      }

      // Buscar detalhes da ronda se houver round_id
      if (incident.round_id) {
        const { data: roundData, error: roundError } = await supabase
          .from("rounds")
          .select(`
            id,
            profiles:user_id (name),
            clients (name)
          `)
          .eq("id", incident.round_id)
          .single();

        if (roundError) {
          console.error("Error fetching round details:", roundError);
        } else {
          setRoundDetails({
            id: roundData.id,
            user: { name: roundData.profiles?.name || "Usuário não encontrado" },
            client: { name: roundData.clients?.name || "Cliente não encontrado" }
          });
        }
      }
    } catch (error) {
      console.error("Error fetching incident details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ocorrência",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateIncidentStatus = async (newStatus: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("incidents")
        .update({ status: newStatus })
        .eq("id", incident.id);

      if (error) throw error;

      toast({
        title: "Status Atualizado",
        description: `Ocorrência marcada como ${getStatusLabel(newStatus)}`,
      });

      onClose();
    } catch (error) {
      console.error("Error updating incident status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da ocorrência",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getIncidentTypeLabel = (type: string) => {
    switch (type) {
      case 'security': return 'Segurança';
      case 'maintenance': return 'Manutenção';
      case 'emergency': return 'Emergência';
      case 'other': return 'Outros';
      default: return type;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-tactical-red text-white';
      case 'high': return 'bg-tactical-amber text-white';
      case 'medium': return 'bg-tactical-blue text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-600 text-white';
      case 'investigating': return 'bg-yellow-600 text-white';
      case 'resolved': return 'bg-green-600 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'investigating': return 'Investigada';
      case 'resolved': return 'Resolvida';
      default: return status;
    }
  };

  const handleInvestigationComplete = () => {
    onRefresh?.();
    fetchIncidentDetails();
  };

  const handleResolutionComplete = () => {
    onRefresh?.();
    fetchIncidentDetails();
  };

  const isAdmin = profile?.role === 'admin';
  const isOperator = profile?.role === 'operador';
  const canManageIncident = isAdmin || isOperator;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openGoogleMaps = () => {
    if (incident.lat && incident.lng) {
      const url = `https://www.google.com/maps?q=${incident.lat},${incident.lng}`;
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-tactical-red" />
              Detalhes da Ocorrência
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tactical-red"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{incident.title}</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {getIncidentTypeLabel(incident.type)}
                        </Badge>
                        <Badge className={getPriorityColor(incident.priority)}>
                          {getPriorityLabel(incident.priority)}
                        </Badge>
                        <Badge className={getStatusColor(incident.status)}>
                          {getStatusLabel(incident.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Reportado: {formatDateTime(incident.reported_at)}</span>
                    </div>
                    {roundDetails && (
                      <>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>Reportado por: {roundDetails.user.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Cliente: {roundDetails.client.name}</span>
                        </div>
                      </>
                    )}
                    {incident.lat && incident.lng && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <Button
                          variant="link"
                          size="sm"
                          onClick={openGoogleMaps}
                          className="p-0 h-auto text-tactical-blue"
                        >
                          Ver no mapa
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {incident.description && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Descrição</h4>
                    <p className="text-sm text-muted-foreground">{incident.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Photos */}
              {photos.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileImage className="w-4 h-4" />
                      Fotos Anexadas ({photos.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="cursor-pointer rounded-lg overflow-hidden border hover:shadow-lg transition-shadow"
                          onClick={() => setSelectedPhoto(photo)}
                        >
                          <img
                            src={photo.url}
                            alt="Foto da ocorrência"
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Investigation Report */}
              {incident.investigation_report && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Relatório de Investigação
                    </h4>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{incident.investigation_report}</p>
                      {incident.investigation_completed_at && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Concluída em: {formatDateTime(incident.investigation_completed_at)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resolution Comment */}
              {incident.resolution_comment && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Comentário de Resolução
                    </h4>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{incident.resolution_comment}</p>
                      {incident.resolved_at && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Resolvida em: {formatDateTime(incident.resolved_at)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              {canManageIncident && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3">Ações Administrativas</h4>
                    <div className="flex gap-2">
                      {incident.status === 'open' && (
                        <Button
                          onClick={() => setInvestigationOpen(true)}
                          className="bg-yellow-600 hover:bg-yellow-700"
                          disabled={loading}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Investigar
                        </Button>
                      )}
                      
                      {incident.status === 'investigating' && (
                        <Button
                          onClick={() => setResolutionOpen(true)}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={loading}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Resolver
                        </Button>
                      )}

                      {incident.status === 'resolved' && (
                        <div className="text-sm text-muted-foreground">
                          Esta ocorrência foi resolvida
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Preview Dialog */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                Foto da Ocorrência
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPhoto(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img
                src={selectedPhoto.url}
                alt="Foto da ocorrência"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Investigation Dialog */}
      <InvestigationDialog
        open={investigationOpen}
        onClose={() => setInvestigationOpen(false)}
        incident={incident}
        onComplete={handleInvestigationComplete}
      />

      {/* Resolution Dialog */}
      <ResolutionDialog
        open={resolutionOpen}
        onClose={() => setResolutionOpen(false)}
        incident={incident}
        onComplete={handleResolutionComplete}
      />
    </>
  );
};

export default IncidentDetailsDialog;