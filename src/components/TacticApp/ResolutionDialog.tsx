import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ResolutionDialogProps {
  open: boolean;
  onClose: () => void;
  incident: {
    id: string;
    title: string;
    status: string;
  };
  onComplete: () => void;
}

const ResolutionDialog = ({ open, onClose, incident, onComplete }: ResolutionDialogProps) => {
  const [resolutionComment, setResolutionComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Update incident as resolved
      const { error: updateError } = await supabase
        .from("incidents")
        .update({
          status: 'resolved',
          resolution_comment: resolutionComment || null,
          resolved_at: new Date().toISOString(),
          resolved_by: profile?.user_id
        })
        .eq("id", incident.id);

      if (updateError) throw updateError;

      toast({
        title: "Ocorrência Resolvida",
        description: "A ocorrência foi marcada como resolvida com sucesso",
      });

      onComplete();
      onClose();
      setResolutionComment("");
    } catch (error) {
      console.error("Error resolving incident:", error);
      toast({
        title: "Erro",
        description: "Erro ao resolver ocorrência",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResolutionComment("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-tactical-green" />
            Resolver Ocorrência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p><strong>Ocorrência:</strong> {incident.title}</p>
            <p><strong>Status Atual:</strong> Investigando</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolution-comment">
                Comentário de Resolução (opcional)
              </Label>
              <Textarea
                id="resolution-comment"
                placeholder="Adicione detalhes sobre como a ocorrência foi resolvida..."
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
                rows={4}
              />
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
                disabled={loading}
                className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
              >
                {loading ? "Resolvendo..." : "Resolver Ocorrência"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResolutionDialog;