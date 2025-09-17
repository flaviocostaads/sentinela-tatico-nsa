import { useState } from "react";
import { AlertTriangle, Camera, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface IncidentDialogProps {
  open: boolean;
  onClose: () => void;
  roundId: string;
  currentLocation?: { lat: number; lng: number };
  onSuccess?: () => void;
}

const IncidentDialog = ({ open, onClose, roundId, currentLocation, onSuccess }: IncidentDialogProps) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    priority: "medium"
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const incidentTypes = [
    { value: "security", label: "Incidente de Segurança" },
    { value: "maintenance", label: "Problema de Manutenção" },
    { value: "access", label: "Problema de Acesso" },
    { value: "suspicious", label: "Atividade Suspeita" },
    { value: "emergency", label: "Emergência" },
    { value: "other", label: "Outro" }
  ];

  const priorities = [
    { value: "low", label: "Baixa", color: "text-green-600" },
    { value: "medium", label: "Média", color: "text-yellow-600" },
    { value: "high", label: "Alta", color: "text-red-600" },
    { value: "critical", label: "Crítica", color: "text-red-800" }
  ];

  const handlePhotoCapture = async () => {
    try {
      // Criar um input file para capturar fotos
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.multiple = true;
      
      input.onchange = (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files) {
          const newFiles = Array.from(files).slice(0, 3 - photos.length); // Máximo 3 fotos
          
          if (newFiles.length > 0) {
            setPhotos(prev => [...prev, ...newFiles]);
            
            // Criar previews
            newFiles.forEach(file => {
              const reader = new FileReader();
              reader.onload = (e) => {
                if (e.target?.result) {
                  setPhotoPreviews(prev => [...prev, e.target.result as string]);
                }
              };
              reader.readAsDataURL(file);
            });
            
            toast({
              title: "Foto(s) capturada(s)",
              description: `${newFiles.length} foto(s) adicionada(s)`,
            });
          }
        }
      };
      
      input.click();
    } catch (error) {
      console.error("Error capturing photo:", error);
      toast({
        title: "Erro",
        description: "Erro ao capturar foto",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "",
      priority: "medium"
    });
    setPhotos([]);
    setPhotoPreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.title.trim() || !formData.description.trim() || !formData.type) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha todos os campos obrigatórios",
          variant: "destructive",
        });
        return;
      }

      const incidentData = {
        round_id: roundId,
        title: formData.title,
        description: formData.description,
        type: formData.type as any,
        priority: formData.priority as any,
        status: "open",
        lat: currentLocation?.lat || null,
        lng: currentLocation?.lng || null,
        reported_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("incidents")
        .insert([incidentData])
        .select();

      if (error) throw error;

      // Upload photos if any
      if (photos.length > 0) {
        for (const photo of photos) {
          try {
            const fileName = `incident-${incidentData.round_id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('incident-photos')
              .upload(fileName, photo, {
                contentType: photo.type,
                upsert: false
              });

            if (uploadError) {
              console.error("Error uploading photo:", uploadError);
              continue; // Continue with other photos if one fails
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('incident-photos')
              .getPublicUrl(fileName);

            // Save photo record in database
            await supabase
              .from("photos")
              .insert([{
                incident_id: data[0].id, // We need the incident ID from the insert
                round_id: roundId,
                url: publicUrl,
                lat: currentLocation?.lat || null,
                lng: currentLocation?.lng || null,
                metadata: {
                  original_name: photo.name,
                  size: photo.size,
                  type: photo.type
                }
              }]);
          } catch (photoError) {
            console.error("Error processing photo:", photoError);
          }
        }
      }

      toast({
        title: "Ocorrência registrada",
        description: "A ocorrência foi registrada com sucesso",
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error("Error creating incident:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar ocorrência",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
      resetForm();
      onSuccess?.();
      onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-tactical-red" />
            Registrar Ocorrência
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Incident Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Ocorrência <span className="text-tactical-red">*</span></Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {incidentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade <span className="text-tactical-red">*</span></Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <span className={priority.color}>{priority.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título <span className="text-tactical-red">*</span></Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Porta principal destravada"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição <span className="text-tactical-red">*</span></Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva detalhadamente a ocorrência..."
              rows={4}
            />
          </div>

          {/* Location Info */}
          {currentLocation && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Localização: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</span>
              </div>
            </div>
          )}

          {/* Photo Section */}
          <div className="space-y-3">
            <Label>Fotos da Ocorrência (máximo 3)</Label>
            
            {/* Photo Previews */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={preview} 
                      alt={`Foto ${index + 1}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={() => removePhoto(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Photo Button */}
            {photos.length < 3 && (
              <Button
                type="button"
                onClick={handlePhotoCapture}
                variant="outline"
                className="w-full h-16 border-dashed"
              >
                <Camera className="w-5 h-5 mr-2" />
                {photos.length === 0 ? 'Tirar foto' : `Adicionar foto (${photos.length}/3)`}
              </Button>
            )}
          </div>

          {/* Time */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Registrado em: {new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            
            <Button
              type="submit"
              className="flex-1 bg-tactical-red hover:bg-tactical-red/90"
              disabled={loading}
            >
              {loading ? "Registrando..." : "Registrar Ocorrência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentDialog;