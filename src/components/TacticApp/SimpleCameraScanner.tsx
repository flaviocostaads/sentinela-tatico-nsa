import { useState, useRef, useEffect, useCallback } from "react";
import { X, Camera, Flashlight, Type, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsQR from "jsqr";

interface SimpleCameraScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (qrCode: string) => void;
  expectedCompany?: string;
}

const SimpleCameraScanner = ({ open, onClose, onScan, expectedCompany = "Cliente" }: SimpleCameraScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [cameraState, setCameraState] = useState<'loading' | 'ready' | 'error' | 'manual'>('loading');
  const [error, setError] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      resetState();
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const resetState = () => {
    setCameraState('loading');
    setError("");
    setManualCode("");
    setValidatingCode(false);
    setIsScanning(false);
  };

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for QR scanning
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      // Scan for QR code
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (qrCode && qrCode.data) {
        console.log("QR Code detected:", qrCode.data);
        stopScanning();
        onScan(qrCode.data);
        onClose();
      }
    } catch (error) {
      console.error("Error scanning QR code:", error);
    }
  }, [isScanning, onScan, onClose]);

  const startScanning = () => {
    console.log("Starting QR code scanning...");
    setIsScanning(true);
    
    // Scan every 100ms for responsive detection
    scanIntervalRef.current = setInterval(scanQRCode, 100);
  };

  const startCamera = async () => {
    console.log("🎥 === Camera Initialization START ===");
    setCameraState('loading');
    
    try {
      // Wait a tiny bit for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if video element exists
      if (!videoRef.current) {
        console.error("❌ videoRef.current is null - element not mounted yet");
        throw new Error("Elemento de vídeo não encontrado. Aguarde e tente novamente.");
      }
      
      // Check if camera is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error("❌ getUserMedia not supported");
        throw new Error("Câmera não suportada neste dispositivo");
      }

      console.log("📱 Requesting camera access...");
      
      // Simplified camera constraints
      const constraints = [
        { video: { facingMode: 'environment' } },
        { video: true }
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (const constraint of constraints) {
        try {
          console.log("🔍 Trying:", JSON.stringify(constraint));
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (stream) {
            console.log("✅ Stream obtained:", stream.active, stream.getTracks().length, "tracks");
            break;
          }
        } catch (err: any) {
          console.log("❌ Failed:", err.name, err.message);
          lastError = err;
          continue;
        }
      }
      
      if (!stream) {
        throw lastError || new Error("Não foi possível acessar a câmera");
      }
      
      streamRef.current = stream;
      
      const video = videoRef.current;
      console.log("🎬 Connecting stream to video element...");
      video.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onMetadata);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
        };
        
        const onMetadata = () => {
          console.log("📽️ Metadata loaded, attempting play...");
          video.play()
            .then(() => {
              if (!resolved) {
                resolved = true;
                console.log("▶️ Video playing");
                cleanup();
                resolve();
              }
            })
            .catch((err) => {
              if (!resolved) {
                resolved = true;
                console.error("❌ Play failed:", err);
                cleanup();
                reject(err);
              }
            });
        };
        
        const onCanPlay = () => {
          if (!resolved) {
            resolved = true;
            console.log("✅ Video can play");
            cleanup();
            resolve();
          }
        };
        
        const onError = (e: Event) => {
          if (!resolved) {
            resolved = true;
            console.error("❌ Video error:", e);
            cleanup();
            reject(new Error("Erro no elemento de vídeo"));
          }
        };
        
        video.addEventListener('loadedmetadata', onMetadata);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onError);
        
        // Timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error("Timeout: câmera não respondeu"));
          }
        }, 8000);
      });
      
      console.log("✅ Camera ready!");
      setCameraState('ready');
      
      // Start scanning after short delay
      setTimeout(() => {
        if (videoRef.current?.readyState === 4) { // HAVE_ENOUGH_DATA
          console.log("🎯 Starting QR scan...");
          startScanning();
        } else {
          console.log("⚠️ Video not ready yet, waiting...");
          setTimeout(() => startScanning(), 500);
        }
      }, 500);
      
    } catch (error: any) {
      console.error("💥 Camera error:", error);
      
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      let errorMessage = "Erro ao acessar câmera";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Permissão negada. Permita acesso à câmera nas configurações.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Nenhuma câmera encontrada.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Câmera em uso por outro app.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setCameraState('error');
      
      toast({
        title: "Erro na câmera",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    console.log("Stopping camera...");
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const validateManualCode = async (code: string): Promise<boolean> => {
    try {
      console.log("🔍 === Manual Code Validation START ===");
      console.log("🔢 Input code:", code);
      console.log("📏 Code length:", code.length);
      console.log("🔤 Code type:", typeof code);
      
      // Ensure code is a string and trim it
      const cleanCode = String(code).trim();
      console.log("🧹 Cleaned code:", cleanCode);
      
      // Check if it's a 9-digit code
      if (!/^\d{9}$/.test(cleanCode)) {
        console.log("❌ Invalid format: not 9 digits");
        return false;
      }

      // Search for this manual code in checkpoints table
      console.log("🗃️ Searching in checkpoints table...");
      const { data: checkpoints, error } = await supabase
        .from("checkpoints")
        .select("id, name, manual_code, client_id, active")
        .eq("manual_code", cleanCode)
        .eq("active", true);

      console.log("📊 Query response - data:", checkpoints);
      console.log("📊 Query response - error:", error);

      if (error) {
        console.error("💥 Database error:", error);
        // Even with error, log more details
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        return false;
      }

      if (checkpoints && checkpoints.length > 0) {
        const checkpoint = checkpoints[0];
        console.log("✅ SUCCESS! Manual code found:", checkpoint);
        console.log("✅ Checkpoint ID:", checkpoint.id);
        console.log("✅ Checkpoint name:", checkpoint.name);
        return true;
      }

      console.log("❌ No checkpoints found for code:", cleanCode);
      
      // Additional debugging: try to list some codes to verify
      const { data: allCodes } = await supabase
        .from("checkpoints")
        .select("manual_code")
        .eq("active", true)
        .limit(5);
      console.log("📝 Sample of manual codes in database:", allCodes);
      
      return false;
    } catch (error) {
      console.error("💥 EXCEPTION in validateManualCode:", error);
      return false;
    }
  };

  const handleManualInput = async () => {
    if (!manualCode.trim()) {
      toast({
        title: "Código necessário",
        description: "Digite o código QR manualmente",
        variant: "destructive",
      });
      return;
    }

    // Basic format validation
    if (!/^\d{9}$/.test(manualCode)) {
      toast({
        title: "Código inválido",
        description: "O código deve conter exatamente 9 dígitos",
        variant: "destructive",
      });
      return;
    }

    setValidatingCode(true);

    try {
      // Validate against database
      const isValid = await validateManualCode(manualCode);
      
      if (isValid) {
        console.log("✅ Manual code validated successfully:", manualCode);
        toast({
          title: "Código válido",
          description: `Código ${manualCode} validado com sucesso!`,
        });
        onScan(manualCode);
        onClose();
      } else {
        console.log("❌ Manual code validation failed:", manualCode);
        toast({
          title: "Código inválido",
          description: `Código ${manualCode} não encontrado no sistema. Verifique e tente novamente.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in manual input validation:", error);
      toast({
        title: "Erro de validação",
        description: "Erro ao validar código. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setValidatingCode(false);
    }
  };

  const simulateQrScan = () => {
    // For development/testing: simulate a valid QR scan
    const testCode = "828194563"; // Known valid code from database
    console.log("🧪 Simulating QR scan with test code:", testCode);
    onScan(testCode);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Escanear QR Code - {expectedCompany}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative">
          {cameraState === 'loading' && (
            <div className="p-8 text-center">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground mb-4">Inicializando câmera...</p>
              <Button 
                onClick={() => setCameraState('manual')} 
                variant="outline" 
                className="w-full"
              >
                <Type className="w-4 h-4 mr-2" />
                Usar código manual
              </Button>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="p-8 text-center">
              <Camera className="w-16 h-16 text-destructive mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={() => setCameraState('manual')} className="w-full">
                  Usar código manual
                </Button>
              </div>
            </div>
          )}

          {cameraState === 'manual' && (
            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="manual-code">Código Manual (9 dígitos)</Label>
                <Input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="Digite o código de 9 dígitos"
                  maxLength={9}
                  disabled={validatingCode}
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => {
                    setCameraState('loading');
                    startCamera();
                  }} 
                  variant="outline" 
                  className="flex-1"
                  disabled={validatingCode}
                >
                  Voltar à Câmera
                </Button>
                <Button 
                  onClick={handleManualInput} 
                  className="flex-1" 
                  disabled={validatingCode || manualCode.length !== 9}
                >
                  {validatingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <Button 
                  onClick={simulateQrScan} 
                  variant="outline" 
                  className="w-full text-xs"
                >
                  🧪 Testar com código válido
                </Button>
              )}
            </div>
          )}

          {cameraState === 'ready' && (
            <>
              <video
                ref={videoRef}
                className="w-full h-80 object-cover bg-black rounded-lg"
                autoPlay
                playsInline
                muted
                style={{ 
                  backgroundColor: '#000',
                  minHeight: '320px'
                }}
              />
              
              {/* QR Scanner Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-lg"></div>
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                </div>
              </div>

              {/* Hidden canvas for QR code scanning */}
              <canvas 
                ref={canvasRef} 
                style={{ display: 'none' }}
              />

              {/* Camera indicators */}
              <div className="absolute top-4 left-4 bg-red-500 w-3 h-3 rounded-full animate-pulse"></div>
              <div className="absolute top-4 left-8 text-white text-xs bg-black/50 px-2 py-1 rounded">
                {isScanning ? 'Escaneando...' : 'Câmera ativa'}
              </div>
              
              {isScanning && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/70 px-3 py-1 rounded">
                  Procurando QR Code...
                </div>
              )}

              {/* Manual code button */}
              <div className="absolute bottom-4 right-4">
                <Button
                  onClick={() => setCameraState('manual')}
                  size="sm"
                  variant="secondary"
                  className="bg-black/70 hover:bg-black/80 text-white border-white/20"
                >
                  <Type className="w-4 h-4 mr-2" />
                  Manual
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleCameraScanner;