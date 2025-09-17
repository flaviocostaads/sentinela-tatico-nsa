import { useState } from "react";
import { MapPin, Edit, Trash2, Plus, ChevronDown, ChevronRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ChecklistManager from "./ChecklistManager";

interface Client {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  active: boolean;
  created_at: string;
}

interface Checkpoint {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  qr_code?: string;
  order_index: number;
  active: boolean;
}

interface CompactClientListProps {
  clients: Client[];
  checkpoints: Checkpoint[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onAddCheckpoint: (client: Client) => void;
  onViewCheckpoints: (client: Client) => void;
  onGenerateQR: (checkpoint: Checkpoint) => void;
  onDeleteCheckpoint: (checkpoint: Checkpoint) => void;
}

const CompactClientList = ({ 
  clients, 
  checkpoints, 
  onEdit, 
  onDelete, 
  onAddCheckpoint, 
  onViewCheckpoints,
  onGenerateQR,
  onDeleteCheckpoint 
}: CompactClientListProps) => {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [checklistDialog, setChecklistDialog] = useState<{
    open: boolean;
    checkpointId: string;
    checkpointName: string;
  }>({ open: false, checkpointId: "", checkpointName: "" });

  const toggleExpanded = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
      onViewCheckpoints(clients.find(c => c.id === clientId)!);
    }
    setExpandedClients(newExpanded);
  };

  const getClientCheckpoints = (clientId: string) => {
    return checkpoints.filter(cp => cp.client_id === clientId);
  };

  const openChecklistManager = (checkpoint: Checkpoint) => {
    setChecklistDialog({
      open: true,
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name
    });
  };

  return (
    <>
      <div className="space-y-2">
        {clients.map((client) => {
          const isExpanded = expandedClients.has(client.id);
          const clientCheckpoints = getClientCheckpoints(client.id);

          return (
            <Card key={client.id} className="tactical-card">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(client.id)}>
                <CollapsibleTrigger asChild>
                  <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <h3 className="font-medium text-foreground">{client.name}</h3>
                          <p className="text-sm text-muted-foreground">{client.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={client.active ? "default" : "secondary"}>
                          {client.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="outline">
                          {clientCheckpoints.length} pontos
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="border-t">
                  <CardContent className="p-4 space-y-4">
                    {/* Client Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-tactical-blue hover:bg-tactical-blue/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddCheckpoint(client);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Novo Ponto
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(client);
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar Cliente
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(client);
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir
                      </Button>
                    </div>

                    {/* Checkpoints */}
                    {clientCheckpoints.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Pontos de Verificação</h4>
                        <div className="grid gap-2">
                          {clientCheckpoints.map((checkpoint) => (
                            <div key={checkpoint.id} className="border rounded-lg p-3 bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <MapPin className="w-3 h-3 text-tactical-blue" />
                                    <span className="text-sm font-medium">{checkpoint.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      #{checkpoint.order_index}
                                    </Badge>
                                  </div>
                                  {checkpoint.description && (
                                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                                      {checkpoint.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex space-x-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openChecklistManager(checkpoint)}
                                    title="Gerenciar Checklist"
                                  >
                                    <List className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onGenerateQR(checkpoint)}
                                    title="Gerar QR Code"
                                  >
                                    QR
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onDeleteCheckpoint(checkpoint)}
                                    title="Excluir Ponto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      <ChecklistManager
        open={checklistDialog.open}
        onClose={() => setChecklistDialog({ ...checklistDialog, open: false })}
        checkpointId={checklistDialog.checkpointId}
        checkpointName={checklistDialog.checkpointName}
      />
    </>
  );
};

export default CompactClientList;