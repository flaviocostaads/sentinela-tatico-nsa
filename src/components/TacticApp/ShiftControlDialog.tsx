import { useState } from "react";
import { Clock, Navigation, MapPin, Camera, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ShiftControlDialogProps {
  open: boolean;
  onClose: () => void;
  shiftType: 'entrada' | 'saida';
  userName?: string;
}

const ShiftControlDialog = ({ open, onClose, shiftType, userName }: ShiftControlDialogProps) => {
  const [odometerReading, setOdometerReading] = useState("");
  const [observations, setObservations] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEntrada = shiftType === 'entrada';
  const title = isEntrada ? 'Entrada na Base' : 'Saída da Base';
  const buttonText = isEntrada ? 'Registrar Entrada' : 'Registrar Saída';
  const successMessage = isEntrada ? 'Entrada registrada com sucesso!' : 'Saída registrada com sucesso!';

  const handleSubmit = async () => {
    if (!odometerReading.trim()) {
      toast({
        title: "Odômetro obrigatório",
        description: "Digite a leitura atual do odômetro",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Registrar no banco de dados
      const { error } = await supabase
        .from('odometer_records')
        .insert({
          user_id: user.id,
          record_type: isEntrada ? 'shift_start' : 'shift_end',
          odometer_reading: parseInt(odometerReading),
          photo_url: photo || 'simulated_photo_url',
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: successMessage,
        variant: "default",
      });

      // Reset form
      setOdometerReading("");
      setObservations("");
      setPhoto(null);
      onClose();

    } catch (error) {
      console.error("Error recording shift:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = () => {
    // Simular captura de foto do odômetro
    const simulatedPhoto = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=`;
    setPhoto(simulatedPhoto);
    
    toast({
      title: "Foto capturada",
      description: "Foto do odômetro registrada com sucesso",
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isEntrada ? (
              <Navigation className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-rose-600" />
            )}
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do usuário */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{userName || 'Operador'}</p>
                <p className="text-sm text-muted-foreground">
                  {getCurrentTime()}
                </p>
              </div>
            </div>
          </div>

          {/* Leitura do Odômetro */}
          <div className="space-y-2">
            <Label htmlFor="odometer">
              Leitura do Odômetro (km) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="odometer"
              type="number"
              placeholder="Ex: 125450"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              className="text-lg"
            />
          </div>

          {/* Foto do Odômetro */}
          <div className="space-y-3">
            <Label>Foto do Odômetro <span className="text-red-500">*</span></Label>
            
            {photo ? (
              <div className="bg-muted p-4 rounded-lg text-center">
                <Camera className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                <p className="text-sm text-muted-foreground mb-2">Foto capturada com sucesso</p>
                <img 
                  src={photo} 
                  alt="Odômetro" 
                  className="w-full h-32 object-cover rounded border bg-white"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={takePhoto}
                >
                  Tirar nova foto
                </Button>
              </div>
            ) : (
              <Button
                onClick={takePhoto}
                variant="outline"
                className="w-full h-16 border-dashed"
              >
                <Camera className="w-5 h-5 mr-2" />
                Fotografar Odômetro
              </Button>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações (opcional)</Label>
            <Textarea
              id="observations"
              placeholder="Observações sobre o veículo ou turno..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={!odometerReading.trim() || !photo || loading}
              className={`flex-1 ${
                isEntrada 
                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              ) : isEntrada ? (
                <Navigation className="w-4 h-4 mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Registrando...' : buttonText}
            </Button>
          </div>

          {(!odometerReading.trim() || !photo) && (
            <p className="text-xs text-center text-muted-foreground">
              Preencha a leitura do odômetro e tire uma foto para continuar
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftControlDialog;