import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Check, X, AlertTriangle, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import IncidentDialog from "./IncidentDialog";
import SignaturePad from "./SignaturePad";

interface ChecklistItem {
  id: string;
  description: string;
  required: boolean;
  checked: boolean;
}

interface ChecklistDialogProps {
  open: boolean;
  onClose: () => void;
  checkpointName: string;
  checkpointId: string;
  roundId: string;
  onComplete: (photo: string | null, observations: string, checklist: ChecklistItem[]) => void;
}

const ChecklistDialog = ({ open, onClose, checkpointName, checkpointId, roundId, onComplete }: ChecklistDialogProps) => {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [observations, setObservations] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch checklist items from database or use default
  useEffect(() => {
    fetchChecklistItems();
    checkSignatureRequirement();
  }, [checkpointId]);

  const checkSignatureRequirement = async () => {
    try {
      console.log("Checking signature requirement for checkpoint:", checkpointId);
      
      // Check if this checkpoint requires signature based on template and shift_type
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select(`
          template_id,
          round_templates (
            shift_type,
            requires_signature
          )
        `)
        .eq("id", roundId)
        .single();

      if (roundError || !roundData?.template_id) {
        console.log("No template found for signature check");
        return;
      }

      console.log("Round data:", roundData);
      
      // Check if template is 'diurno' - only 'diurno' requires signature
      const isShiftTypeDiurno = roundData.round_templates?.shift_type === 'diurno';
      console.log("Shift type:", roundData.round_templates?.shift_type, "Is diurno:", isShiftTypeDiurno);

      if (!isShiftTypeDiurno) {
        console.log("Noturno shift - no signature required");
        setRequiresSignature(false);
        return;
      }

      const { data: templateCheckpoints, error: templateError } = await supabase
        .from("round_template_checkpoints")
        .select("required_signature, client_id, id")
        .eq("template_id", roundData.template_id);

      if (templateError) {
        console.error("Error checking signature requirement:", templateError);
        return;
      }

      console.log("Template checkpoints:", templateCheckpoints);
      console.log("Looking for checkpoint ID:", checkpointId);

      // Try different matching strategies - check all possible ID formats
      const templateCheckpoint = templateCheckpoints?.find(tc => {
        const possibleIds = [
          `template_${tc.id}`,
          `template_${tc.client_id}`,
          tc.id.toString(),
          tc.client_id.toString(),
          `client_${tc.client_id}`
        ];
        
        console.log("Comparing checkpoint:", checkpointId, "with possible IDs:", possibleIds);
        return possibleIds.includes(checkpointId);
      });

      console.log("Found template checkpoint:", templateCheckpoint);

      // For diurno shift, signature is always required
      const requiresSignature = templateCheckpoint?.required_signature || roundData.round_templates?.requires_signature || isShiftTypeDiurno;
      
      console.log("Final signature requirement:", {
        templateCheckpointSignature: templateCheckpoint?.required_signature,
        templateOverallSignature: roundData.round_templates?.requires_signature,
        isDiurno: isShiftTypeDiurno,
        finalRequires: requiresSignature
      });
      
      if (requiresSignature) {
        console.log("Signature required - setting requiresSignature to true");
        setRequiresSignature(true);
      } else {
        console.log("No signature required for this checkpoint");
        setRequiresSignature(false);
      }
    } catch (error) {
      console.error("Error checking signature requirement:", error);
    }
  };

  const fetchChecklistItems = async () => {
    try {
      // Try to get custom checklist from checkpoint by ID
      const { data: checkpointData, error } = await supabase
        .from("checkpoints")
        .select("checklist_items")
        .eq("id", checkpointId)
        .single();

      // Se NÃO encontrar checklist ou houver erro, usar lista vazia (sem itens padrão)
      if (error || !checkpointData?.checklist_items || !Array.isArray(checkpointData.checklist_items) || checkpointData.checklist_items.length === 0) {
        console.log(`Nenhum checklist encontrado para o ponto ${checkpointId}`);
        setChecklist([]); // Lista vazia em vez de itens padrão
        return;
      }

      // Use custom checklist from database
      const customItems = (checkpointData.checklist_items as any[]).map((item: any, index: number) => ({
        id: (index + 1).toString(),
        description: item.description || item,
        required: item.required !== undefined ? item.required : true,
        checked: false
      }));
      
      console.log(`Checklist carregado para ponto ${checkpointId}:`, customItems);
      setChecklist(customItems);
    } catch (error) {
      console.error("Error fetching checklist:", error);
      // Em caso de erro, usar lista vazia
      setChecklist([]);
    }
  };


  const handleChecklistChange = (itemId: string, checked: boolean) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, checked } : item
    ));
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const photoData = canvas.toDataURL('image/jpeg');
        setPhoto(photoData);
        setShowCamera(false);
        
        // Stop camera
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    } else {
      // Fallback to simulated photo
      const simulatedPhoto = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=`;
      setPhoto(simulatedPhoto);
      setShowCamera(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      // Fallback to simulated photo
      takePhoto();
    }
  };

  const canComplete = () => {
    const requiredItems = checklist.filter(item => item.required);
    const completedRequired = requiredItems.filter(item => item.checked);
    const hasRequiredPhoto = photo !== null;
    const hasRequiredSignature = !requiresSignature || (requiresSignature && signature !== null);
    
    return completedRequired.length === requiredItems.length && hasRequiredPhoto && hasRequiredSignature;
  };

  const handleComplete = () => {
    if (canComplete()) {
      onComplete(photo, observations, checklist);
      onClose();
      // Reset state
      setObservations("");
      setPhoto(null);
      setSignature(null);
      setChecklist(prev => prev.map(item => ({ ...item, checked: false })));
    }
  };

  const handleSignature = (signatureData: string) => {
    setSignature(signatureData);
    setShowSignaturePad(false);
  };

  const requiredCount = checklist.filter(item => item.required).length;
  const completedRequiredCount = checklist.filter(item => item.required && item.checked).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checklist - {checkpointName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span>Itens obrigatórios</span>
              <span>{completedRequiredCount}/{requiredCount}</span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className="bg-tactical-green h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedRequiredCount / requiredCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3">
            <h3 className="font-medium">Itens de verificação</h3>
            {checklist.map((item) => (
              <div key={item.id} className="flex items-start space-x-3 p-2 border rounded">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={(checked) => handleChecklistChange(item.id, !!checked)}
                />
                <Label htmlFor={item.id} className="flex-1 text-sm leading-relaxed">
                  {item.description}
                  {item.required && <span className="text-tactical-red ml-1">*</span>}
                </Label>
              </div>
            ))}
          </div>

          {/* Photo Section */}
          <div className="space-y-3">
            <h3 className="font-medium">Foto do local <span className="text-tactical-red">*</span></h3>
            
            {showCamera ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-48 object-cover rounded-lg bg-black"
                />
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  <Button
                    onClick={takePhoto}
                    className="bg-tactical-green hover:bg-tactical-green/90"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capturar
                  </Button>
                  <Button
                    onClick={() => setShowCamera(false)}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : photo ? (
              <div className="bg-muted p-4 rounded-lg text-center">
                <Camera className="w-8 h-8 mx-auto mb-2 text-tactical-green" />
                <p className="text-sm text-muted-foreground">Foto capturada com sucesso</p>
                <img 
                  src={photo} 
                  alt="Checkpoint" 
                  className="mt-2 w-full h-32 object-cover rounded border"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={startCamera}
                >
                  Tirar nova foto
                </Button>
              </div>
            ) : (
              <Button
                onClick={startCamera}
                variant="outline"
                className="w-full h-20 border-dashed"
              >
                <Camera className="w-6 h-6 mr-2" />
                Tirar foto
              </Button>
            )}
          </div>

          {/* Signature Section */}
          {requiresSignature && (
            <div className="space-y-3">
              <h3 className="font-medium">Assinatura do Cliente <span className="text-tactical-red">*</span></h3>
              
              {signature ? (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <PenTool className="w-8 h-8 mx-auto mb-2 text-tactical-green" />
                  <p className="text-sm text-muted-foreground">Assinatura coletada com sucesso</p>
                  <img 
                    src={signature} 
                    alt="Assinatura" 
                    className="mt-2 w-full h-24 object-contain bg-white rounded border"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setShowSignaturePad(true)}
                  >
                    Coletar nova assinatura
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowSignaturePad(true)}
                  variant="outline"
                  className="w-full h-16 border-dashed"
                >
                  <PenTool className="w-6 h-6 mr-2" />
                  Coletar Assinatura
                </Button>
              )}
            </div>
          )}

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações (opcional)</Label>
            <Textarea
              id="observations"
              placeholder="Observações sobre este checkpoint..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              className="flex-1 bg-tactical-red text-white hover:bg-tactical-red/90"
              onClick={() => setShowIncidentDialog(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Criar Ocorrência
            </Button>
            
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            
            <Button
              className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
              onClick={handleComplete}
              disabled={!canComplete()}
            >
              <Check className="w-4 h-4 mr-2" />
              Finalizar
            </Button>
          </div>

          {!canComplete() && (
            <p className="text-xs text-center text-muted-foreground">
              Complete todos os itens obrigatórios, tire uma foto{requiresSignature ? ' e colete a assinatura' : ''} para finalizar
            </p>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>

      {/* Signature Pad Dialog */}
      {showSignaturePad && (
        <Dialog open={showSignaturePad} onOpenChange={() => setShowSignaturePad(false)}>
          <DialogContent className="max-w-md">
            <SignaturePad
              onSignature={handleSignature}
              onCancel={() => setShowSignaturePad(false)}
              clientName={checkpointName}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Incident Dialog */}
      <IncidentDialog
        open={showIncidentDialog}
        onClose={() => setShowIncidentDialog(false)}
        roundId={roundId}
      />
    </Dialog>
  );
};

export default ChecklistDialog;