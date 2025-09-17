import { useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface InvestigationDialogProps {
  open: boolean;
  onClose: () => void;
  incident: {
    id: string;
    title: string;
    status: string;
  };
  onComplete: () => void;
}

const InvestigationDialog = ({ open, onClose, incident, onComplete }: InvestigationDialogProps) => {
  const [investigationReport, setInvestigationReport] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      toast({
        title: "Limite de arquivos",
        description: "Máximo de 5 arquivos permitidos",
        variant: "destructive",
      });
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!investigationReport.trim()) {
      toast({
        title: "Erro",
        description: "O relatório de investigação é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Upload files if any
      const uploadedPhotos = [];
      for (const file of selectedFiles) {
        const fileName = `investigation-${incident.id}-${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("incident-photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("incident-photos")
          .getPublicUrl(fileName);

        // Save photo metadata
        const { error: photoError } = await supabase
          .from("photos")
          .insert({
            url: publicUrl,
            incident_id: incident.id,
            metadata: {
              type: 'investigation',
              original_name: file.name,
              size: file.size
            }
          });

        if (photoError) throw photoError;
        uploadedPhotos.push(publicUrl);
      }

      // Update incident with investigation data
      const { error: updateError } = await supabase
        .from("incidents")
        .update({
          status: 'investigating',
          investigation_report: investigationReport,
          investigation_completed_at: new Date().toISOString(),
          investigated_by: profile?.user_id
        })
        .eq("id", incident.id);

      if (updateError) throw updateError;

      toast({
        title: "Investigação Concluída",
        description: "Relatório de investigação salvo com sucesso",
      });

      onComplete();
      onClose();
      setInvestigationReport("");
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error completing investigation:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar investigação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInvestigationReport("");
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-tactical-amber" />
            Investigação da Ocorrência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="bg-muted p-3 rounded-lg">
            <p><strong>Ocorrência:</strong> {incident.title}</p>
            <p><strong>Status Atual:</strong> {incident.status === 'open' ? 'Aberta' : 'Em Investigação'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="investigation-report">
                Relatório de Investigação *
              </Label>
              <Textarea
                id="investigation-report"
                placeholder="Descreva detalhadamente a investigação realizada, achados, evidências coletadas e conclusões..."
                value={investigationReport}
                onChange={(e) => setInvestigationReport(e.target.value)}
                rows={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Anexos Adicionais (opcional)</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                <input
                  type="file"
                  id="investigation-files"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="investigation-files"
                  className="flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm">Clique para adicionar arquivos</p>
                  <p className="text-xs">Imagens, PDF, DOC (máx. 5 arquivos)</p>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Arquivos Selecionados:</Label>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-muted p-2 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !investigationReport.trim()}
                className="flex-1 bg-tactical-amber hover:bg-tactical-amber/90"
              >
                {loading ? "Salvando..." : "Concluir Investigação"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvestigationDialog;