import { useState, useRef } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ProblemReportDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  onSubmit: (problem: {
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    photos: File[];
  }) => void;
}

const ProblemReportDialog = ({ open, onClose, itemName, onSubmit }: ProblemReportDialogProps) => {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      return;
    }

    onSubmit({
      description: description.trim(),
      severity,
      photos
    });

    // Reset form
    setDescription('');
    setSeverity('medium');
    setPhotos([]);
    setPhotoPreviews([]);
    onClose();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-tactical-blue text-white';
      case 'medium': return 'bg-tactical-amber text-white';
      case 'high': return 'bg-tactical-red text-white';
      case 'critical': return 'bg-destructive text-white';
      default: return 'bg-muted';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      case 'critical': return 'Crítica';
      default: return severity;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-tactical-amber" />
            <span>Relatar Problema</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Item: <strong>{itemName}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Severity */}
          <div className="space-y-2">
            <Label>Gravidade do Problema</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center space-x-2">
                    <Badge className={getSeverityColor('low')}>{getSeverityLabel('low')}</Badge>
                    <span>- Problema leve, não afeta operação</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center space-x-2">
                    <Badge className={getSeverityColor('medium')}>{getSeverityLabel('medium')}</Badge>
                    <span>- Requer atenção em breve</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center space-x-2">
                    <Badge className={getSeverityColor('high')}>{getSeverityLabel('high')}</Badge>
                    <span>- Problema sério, atenção urgente</span>
                  </div>
                </SelectItem>
                <SelectItem value="critical">
                  <div className="flex items-center space-x-2">
                    <Badge className={getSeverityColor('critical')}>{getSeverityLabel('critical')}</Badge>
                    <span>- Crítico, não operar veículo</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Problema *</Label>
            <Textarea
              id="description"
              placeholder="Descreva o problema encontrado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Fotos (Opcional)</Label>
            <div className="grid grid-cols-3 gap-2">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`Problem photo ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute top-1 right-1 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photoPreviews.length < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Adicionar</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoAdd}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!description.trim()}>
            Salvar Problema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProblemReportDialog;
