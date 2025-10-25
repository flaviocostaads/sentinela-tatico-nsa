import { useState, useRef } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVehicleOdometer } from "@/hooks/useVehicleOdometer";

interface OdometerStepProps {
  vehicleId: string;
  onComplete: (odometer: number, photoUrl: string) => void;
  onBack: () => void;
}

const OdometerStep = ({ vehicleId, onComplete, onBack }: OdometerStepProps) => {
  const [odometer, setOdometer] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { validateOdometer, lastOdometer } = useVehicleOdometer(vehicleId);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;

    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `odometer/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('odometer-photos')
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('odometer-photos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const handleComplete = async () => {
    if (!odometer) {
      toast({
        title: "Campo obrigatório",
        description: "Digite o odômetro atual do veículo",
        variant: "destructive",
      });
      return;
    }

    if (!photoFile) {
      toast({
        title: "Foto obrigatória",
        description: "Tire uma foto do odômetro",
        variant: "destructive",
      });
      return;
    }

    const odometerNumber = parseInt(odometer);

    // Validate odometer reading
    const validation = await validateOdometer(odometerNumber);
    if (!validation.valid) {
      toast({
        title: "Odômetro inválido",
        description: validation.message || "O valor do odômetro está incorreto",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload photo
      const photoUrl = await uploadPhoto();
      if (!photoUrl) {
        throw new Error("Falha ao fazer upload da foto");
      }

      onComplete(odometerNumber, photoUrl);
    } catch (error) {
      console.error("Error completing odometer step:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar odômetro",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold mb-2">Registro de Odômetro</h3>
        <p className="text-sm text-muted-foreground">
          Informe o odômetro atual e tire uma foto obrigatória
        </p>
      </div>

      {/* Last Odometer Info */}
      {lastOdometer && (
        <Alert>
          <AlertDescription className="text-sm">
            <strong>Último registro:</strong> {lastOdometer.km.toLocaleString()} km
            <br />
            <span className="text-muted-foreground">
              {new Date(lastOdometer.recorded_at).toLocaleDateString('pt-BR')} às{' '}
              {new Date(lastOdometer.recorded_at).toLocaleTimeString('pt-BR')}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Odometer Input */}
      <div className="space-y-2">
        <Label htmlFor="odometer">Odômetro Atual (km) *</Label>
        <Input
          id="odometer"
          type="number"
          placeholder="Digite o KM atual"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          className="text-lg"
        />
      </div>

      {/* Photo Capture */}
      <div className="space-y-2">
        <Label>Foto do Odômetro *</Label>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Odometer preview"
                  className="w-full h-64 object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Trocar Foto
                </Button>
              </div>
            ) : (
              <div
                className="h-64 flex flex-col items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Toque para tirar uma foto do odômetro
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          className="hidden"
        />
      </div>

      {/* Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          A foto do odômetro é obrigatória e será anexada ao registro de inspeção.
        </AlertDescription>
      </Alert>

      {/* Actions */}
      <div className="flex space-x-2 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1"
          disabled={uploading}
        >
          Voltar
        </Button>
        <Button
          onClick={handleComplete}
          className="flex-1"
          disabled={uploading}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processando...
            </>
          ) : (
            'Continuar'
          )}
        </Button>
      </div>
    </div>
  );
};

export default OdometerStep;
