import { useState, useRef, useEffect } from "react";
import { Camera, Gauge, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OdometerDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: (odometer: number, photo: string) => void;
  vehiclePlate: string;
  roundId?: string;
  vehicleId?: string;
}

const OdometerDialog = ({ open, onClose, onComplete, vehiclePlate, roundId, vehicleId }: OdometerDialogProps) => {
  const [odometer, setOdometer] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [lastOdometer, setLastOdometer] = useState<number | null>(null);
  const [lastOdometerSource, setLastOdometerSource] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [isLoadingLastOdometer, setIsLoadingLastOdometer] = useState(false);
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch last odometer reading when dialog opens
  useEffect(() => {
    if (open && vehicleId) {
      fetchLastOdometer();
    }
  }, [open, vehicleId]);

  const fetchLastOdometer = async () => {
    if (!vehicleId) return;
    
    try {
      setIsLoadingLastOdometer(true);
      console.log("Fetching last odometer for vehicle:", vehicleId);

      // Usar a função RPC que busca o último odômetro de todas as fontes
      const { data, error } = await supabase.rpc('get_last_vehicle_odometer', {
        p_vehicle_id: vehicleId
      });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setLastOdometer(data[0].km);
        setLastOdometerSource(data[0].source);
        console.log("Last odometer:", data[0].km, "from", data[0].source);
      } else {
        setLastOdometer(null);
        setLastOdometerSource('');
        console.log("No odometer records found");
      }
    } catch (error) {
      console.error("Error fetching last odometer:", error);
    } finally {
      setIsLoadingLastOdometer(false);
    }
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
        
        toast({
          title: "Foto capturada",
          description: "Foto do odômetro registrada com sucesso",
        });
      }
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported");
      }

      // Request camera permission with multiple constraint options
      let stream;
      
      // First try with back camera (environment)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { exact: "environment" },
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          }
        });
      } catch {
        // Fallback to any available camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: "environment",
              width: { min: 640, ideal: 1280 },
              height: { min: 480, ideal: 720 }
            }
          });
        } catch {
          // Final fallback - basic video
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            console.log("Camera started successfully");
          }).catch((playError) => {
            console.error("Error playing video:", playError);
            toast({
              title: "Erro na câmera",
              description: "Erro ao iniciar o vídeo. Tente novamente.",
              variant: "destructive",
            });
          });
        };
      } else {
        throw new Error("Video element or stream not available");
      }
      
    } catch (error) {
      console.error("Error accessing camera:", error);
      setShowCamera(false);
      
      toast({
        title: "Erro na câmera",
        description: "Não foi possível acessar a câmera. Verifique as permissões e tente novamente.",
        variant: "destructive",
      });
      
      // For development/testing - create a simple placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 320, 240);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Foto de teste', 160, 120);
        ctx.fillText('do odômetro', 160, 140);
        
        const testPhoto = canvas.toDataURL('image/jpeg');
        setPhoto(testPhoto);
        
        toast({
          title: "Foto de teste gerada",
          description: "Usando foto simulada para desenvolvimento",
        });
      }
    }
  };

  const canComplete = () => {
    const odometerValue = parseInt(odometer);
    if (isNaN(odometerValue) || odometerValue <= 0 || photo === null) {
      return false;
    }
    
    // Validate that new odometer is greater than last odometer
    if (lastOdometer !== null && odometerValue <= lastOdometer) {
      return false;
    }
    
    return true;
  };

  const handleComplete = async () => {
    if (!canComplete() || !vehicleId) return;
    
    try {
      const odometerValue = parseInt(odometer);
      
      // Validar odômetro usando a função RPC (cross-source validation)
      const { data: validationData, error: validationError } = await supabase.rpc(
        'validate_odometer_reading',
        {
          p_vehicle_id: vehicleId,
          p_new_km: odometerValue
        }
      );

      if (validationError) throw validationError;
      
      const validation = validationData as any;
      
      if (!validation.valid) {
        toast({
          title: "Odômetro inválido",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
      
      // Upload photo to storage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Convert base64 to blob
      const response = await fetch(photo!);
      const blob = await response.blob();
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${user.id}/${timestamp}-odometer.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('odometer-photos')
        .upload(filename, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('odometer-photos')
        .getPublicUrl(filename);

      // Create odometer record
      const { error: recordError } = await supabase
        .from('odometer_records')
        .insert({
          user_id: user.id,
          round_id: roundId,
          vehicle_id: vehicleId,
          odometer_reading: odometerValue,
          photo_url: publicUrl,
          record_type: 'start'
        });

      if (recordError) throw recordError;

      // Update vehicle's current odometer if vehicleId is provided
      if (vehicleId) {
        const { error: vehicleUpdateError } = await supabase
          .from('vehicles')
          .update({ current_odometer: odometerValue })
          .eq('id', vehicleId);

        if (vehicleUpdateError) {
          console.error('Error updating vehicle odometer:', vehicleUpdateError);
          // Don't throw error here, just log it as the main operation succeeded
        }
      }

      onComplete(odometerValue, photo!);
      
      // Reset form
      setOdometer("");
      setPhoto(null);
      setShowCamera(false);
      
      toast({
        title: "Registro salvo",
        description: "Foto e dados do odômetro salvos com sucesso",
      });
    } catch (error) {
      console.error("Error saving odometer record:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro do odômetro",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    // Stop camera if running
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    setOdometer("");
    setPhoto(null);
    setShowCamera(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            Registrar Odômetro - {vehiclePlate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Odometer Input */}
          <div className="space-y-2">
            <Label htmlFor="odometer">Quilometragem Atual <span className="text-tactical-red">*</span></Label>
            {isLoadingLastOdometer ? (
              <div className="text-sm text-muted-foreground">Carregando último odômetro...</div>
            ) : lastOdometer !== null && (
              <div className="text-sm text-muted-foreground mb-1">
                Última leitura: <span className="font-semibold">{lastOdometer} km</span>
              </div>
            )}
            <Input
              id="odometer"
              type="number"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder={lastOdometer !== null ? `Maior que ${lastOdometer} km` : "Ex: 125430"}
              min={lastOdometer !== null ? lastOdometer + 1 : 1}
              className={
                odometer && lastOdometer !== null && parseInt(odometer) <= lastOdometer
                  ? "border-destructive"
                  : ""
              }
            />
            {odometer && lastOdometer !== null && parseInt(odometer) <= lastOdometer && (
              <p className="text-sm text-destructive">
                O valor deve ser maior que {lastOdometer} km
              </p>
            )}
          </div>

          {/* Photo Section */}
          <div className="space-y-3">
            <Label>Foto do Odômetro <span className="text-tactical-red">*</span></Label>
            
            {showCamera ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
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
                    onClick={() => {
                      setShowCamera(false);
                      // Stop camera
                      if (videoRef.current?.srcObject) {
                        const stream = videoRef.current.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                      }
                    }}
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
                  alt="Odometer" 
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
                Tirar foto do odômetro
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            
            <Button
              className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
              onClick={handleComplete}
              disabled={!canComplete()}
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </div>

          {!canComplete() && (
            <p className="text-xs text-center text-muted-foreground">
              {!odometer || !photo 
                ? "Insira o odômetro e tire uma foto para continuar"
                : lastOdometer !== null && parseInt(odometer) <= lastOdometer
                ? `O odômetro deve ser maior que ${lastOdometer} km`
                : "Complete todos os campos obrigatórios"}
            </p>
          )}
        </div>
        
        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
};

export default OdometerDialog;