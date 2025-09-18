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
    console.log("Starting camera...");
    setCameraState('loading');
    
    try {
      // Check if camera is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported");
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            console.log("Camera ready!");
            setCameraState('ready');
            
            // Start QR scanning
            setTimeout(() => {
              startScanning();
            }, 500);
          });
        };
      }
      
    } catch (error: any) {
      console.error("Camera error:", error);
      let errorMessage = "Erro ao acessar câmera.";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permissão de câmera negada.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Nenhuma câmera encontrada.";
      }
      
      setError(errorMessage);
      setCameraState('error');
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
      console.log("=== Manual Code Validation ===");
      console.log("Validating code:", code);
      
      // First check if it's a 9-digit code
      if (!/^\d{9}$/.test(code)) {
        console.log("Invalid format: not 9 digits");
        return false;
      }

      // Search for this manual code in checkpoints table
      const { data: checkpoints, error } = await supabase
        .from("checkpoints")
        .select(`
          id, 
          name, 
          manual_code,
          client_id,
          clients (name)
        `)
        .eq("manual_code", code);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      console.log("Found checkpoints with this manual code:", checkpoints);

      if (checkpoints && checkpoints.length > 0) {
        // Valid manual code found in database
        console.log("✅ Manual code exists in database");
        return true;
      }

      // Also check in client-based systems (for flexibility)
      const { data: clients, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${code}%`);

      if (clientError) {
        console.error("Client search error:", clientError);
      }

      if (clients && clients.length > 0) {
        console.log("✅ Found matching clients for code");
        return true;
      }

      console.log("❌ Manual code not found in database");
      return false;
    } catch (error) {
      console.error("Error validating manual code:", error);
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