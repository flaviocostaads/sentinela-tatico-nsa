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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      cleanup();
      resetState();
    }

    return () => {
      stopCamera();
      cleanup();
    };
  }, [open]);

  const resetState = () => {
    setError("");
    setIsLoading(false);
    setHasPermission(null);
    setShowManualInput(false);
    setManualCode("");
    setValidatingCode(false);
    setIsScanning(false);
    setCameraInitialized(false);
  };

  const cleanup = () => {
    stopScanning();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
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
    console.log("=== Starting Camera Initialization ===");
    setIsLoading(true);
    setError("");
    setCameraInitialized(false);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set timeout for camera initialization (10 seconds)
    timeoutRef.current = setTimeout(() => {
      console.log("❌ Camera initialization timeout");
      setError("Tempo limite esgotado. Use o código manual.");
      setShowManualInput(true);
      setIsLoading(false);
    }, 10000);
    
    try {
      console.log("Requesting camera access...");
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }

      // Request camera access with fallback options
      let stream: MediaStream | null = null;
      
      try {
        // Try with back camera first
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          }
        });
      } catch (backCameraError) {
        console.log("Back camera failed, trying front camera...");
        // Fallback to any available camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          }
        });
      }
      
      if (!stream) {
        throw new Error("NO_STREAM");
      }
      
      streamRef.current = stream;
      setHasPermission(true);
      console.log("✅ Camera stream obtained");
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Use multiple events to ensure camera starts properly
        const handleCameraReady = () => {
          console.log("✅ Camera ready, clearing timeout");
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setCameraInitialized(true);
          setIsLoading(false);
          
          // Start scanning after a brief delay
          setTimeout(() => {
            startScanning();
          }, 500);
        };
        
        const handleCameraError = (errorType: string) => {
          console.error(`❌ Camera error: ${errorType}`);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setError("Erro ao inicializar câmera. Use o código manual.");
          setShowManualInput(true);
          setIsLoading(false);
        };
        
        // Multiple event listeners for better reliability
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("Video playing started");
                handleCameraReady();
              })
              .catch((playError) => {
                console.error("Video play error:", playError);
                handleCameraError("PLAY_FAILED");
              });
          }
        };
        
        videoRef.current.oncanplay = () => {
          console.log("Video can play");
          if (!cameraInitialized) {
            handleCameraReady();
          }
        };
        
        videoRef.current.onplaying = () => {
          console.log("Video is playing");
          if (!cameraInitialized) {
            handleCameraReady();
          }
        };
        
        videoRef.current.onerror = () => handleCameraError("VIDEO_ERROR");
        videoRef.current.onabort = () => handleCameraError("VIDEO_ABORT");
      }
      
    } catch (error: any) {
      console.error("❌ Camera access error:", error);
      
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setHasPermission(false);
      
      if (error.name === 'NotAllowedError' || error.message === 'PERMISSION_DENIED') {
        setError("Permissão de câmera negada. Permita o acesso ou use o código manual.");
      } else if (error.name === 'NotFoundError') {
        setError("Nenhuma câmera encontrada. Use o código manual.");
      } else if (error.name === 'NotReadableError') {
        setError("Câmera em uso por outro aplicativo. Use o código manual.");
      } else if (error.message === 'BROWSER_NOT_SUPPORTED') {
        setError("Navegador não suporta câmera. Use o código manual.");
      } else {
        setError("Erro ao acessar câmera. Use o código manual.");
      }
      
      setShowManualInput(true);
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    console.log("Stopping camera...");
    cleanup();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraInitialized(false);
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
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground mb-2">Inicializando câmera...</p>
              <p className="text-xs text-muted-foreground mb-4">Aguarde enquanto configuramos a câmera</p>
              
              {/* Emergency manual code button during loading */}
              <Button 
                onClick={() => {
                  setShowManualInput(true);
                  setIsLoading(false);
                }} 
                variant="outline" 
                className="w-full"
              >
                <Type className="w-4 h-4 mr-2" />
                Usar código manual agora
              </Button>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <Camera className="w-16 h-16 text-destructive mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={startCamera} variant="outline" className="w-full">
                  Tentar câmera novamente
                </Button>
                <Button onClick={() => setShowManualInput(true)} className="w-full">
                  Usar código manual
                </Button>
              </div>
            </div>
          ) : showManualInput ? (
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
                  onClick={() => setShowManualInput(false)} 
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
          ) : (
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

              {/* Camera and scanning indicators */}
              <div className="absolute top-4 left-4 bg-red-500 w-3 h-3 rounded-full animate-pulse"></div>
              <div className="absolute top-4 left-8 text-white text-xs bg-black/50 px-2 py-1 rounded">
                {isScanning ? 'Escaneando...' : 'Câmera ativa'}
              </div>
              
              {isScanning && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/70 px-3 py-1 rounded">
                  Procurando QR Code...
                </div>
              )}
            </>
          )}
        </div>

        {!showManualInput && hasPermission && (
          <div className="p-4 space-y-2">
            <div className="flex space-x-2">
              <Button
                onClick={() => setShowManualInput(true)}
                variant="outline"
                className="flex-1"
              >
                <Type className="w-4 h-4 mr-2" />
                Código Manual
              </Button>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Posicione o QR code dentro do quadrado. Se não funcionar, use o código manual.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SimpleCameraScanner;