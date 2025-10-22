import { useState, useRef, useEffect, useCallback } from "react";
import { X, Camera, Type, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsQR from "jsqr";

interface QrScannerV2Props {
  open: boolean;
  onClose: () => void;
  onScan: (qrCode: string) => void;
  expectedCompany?: string;
}

type ScannerState = 'initializing' | 'camera-ready' | 'error' | 'manual';

const QrScannerV2 = ({ 
  open, 
  onClose, 
  onScan, 
  expectedCompany = "Cliente" 
}: QrScannerV2Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  
  const [state, setState] = useState<ScannerState>('initializing');
  const [error, setError] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [validating, setValidating] = useState(false);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  // Handle dialog open/close
  useEffect(() => {
    if (open) {
      console.log("🎬 QR Scanner V2 - Dialog opened");
      resetAndStart();
    } else {
      console.log("🛑 QR Scanner V2 - Dialog closed");
      cleanup();
    }
  }, [open]);

  const resetAndStart = () => {
    setState('initializing');
    setError("");
    setManualCode("");
    setValidating(false);
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      if (mountedRef.current) {
        initializeCamera();
      }
    }, 200);
  };

  const cleanup = () => {
    console.log("🧹 Cleaning up resources");
    
    // Stop scanning
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("📹 Stopped track:", track.label);
      });
      streamRef.current = null;
    }
    
    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const initializeCamera = async () => {
    console.log("📱 Initializing camera...");
    
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }

      // Wait for DOM to be ready and check video element with retry
      let retries = 3;
      while (!videoRef.current && retries > 0) {
        console.log(`⏳ Waiting for video element... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
      }

      if (!videoRef.current) {
        console.error("❌ Video element not found after retries");
        throw new Error("VIDEO_ELEMENT_NOT_FOUND");
      }

      console.log("✅ Video element found, requesting camera access...");

      // Request camera with progressive constraints
      let stream: MediaStream;
      
      try {
        // Try with environment camera first
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { exact: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        console.log("✅ Environment camera obtained");
      } catch (envError) {
        console.log("⚠️ Environment camera not available, trying any camera...");
        // Fallback to any camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        console.log("✅ Front/any camera obtained");
      }

      console.log("✅ Camera stream obtained:", {
        active: stream.active,
        tracks: stream.getTracks().length
      });

      if (!mountedRef.current) {
        console.log("⚠️ Component unmounted, stopping stream");
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      
      // Attach stream to video with retry mechanism
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("VIDEO_ELEMENT_LOST");
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      console.log("🎥 Waiting for video to load...");

      // Wait for video to be ready with better error handling
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("⏰ Video load timeout");
          reject(new Error("VIDEO_LOAD_TIMEOUT"));
        }, 8000); // Increased timeout

        const cleanup = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
        };

        const onLoadedMetadata = () => {
          console.log("📺 Video metadata loaded, dimensions:", video.videoWidth, "x", video.videoHeight);
          
          video.play()
            .then(() => {
              console.log("▶️ Video playing successfully");
              cleanup();
              resolve();
            })
            .catch((err) => {
              console.error("❌ Play failed:", err);
              cleanup();
              reject(new Error("VIDEO_PLAY_FAILED"));
            });
        };

        const onError = (err: Event) => {
          console.error("❌ Video error:", err);
          cleanup();
          reject(new Error("VIDEO_LOAD_ERROR"));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        video.addEventListener('error', onError, { once: true });

        // Trigger load if needed
        if (video.readyState >= 2) {
          console.log("📺 Video already loaded, playing immediately");
          onLoadedMetadata();
        }
      });

      if (!mountedRef.current) return;

      console.log("✅ Camera ready, starting QR scan");
      setState('camera-ready');
      startScanning();

    } catch (err: any) {
      console.error("💥 Camera initialization error:", err);
      
      if (!mountedRef.current) return;

      let errorMessage = "Erro ao acessar câmera";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Permissão de câmera negada. Permita o acesso nas configurações do navegador.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "Nenhuma câmera encontrada neste dispositivo.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Câmera está sendo usada por outro aplicativo.";
      } else if (err.message === 'BROWSER_NOT_SUPPORTED') {
        errorMessage = "Navegador não suporta acesso à câmera.";
      } else if (err.message === 'VIDEO_ELEMENT_NOT_FOUND' || err.message === 'VIDEO_ELEMENT_LOST') {
        errorMessage = "Erro ao carregar componente de vídeo. Tente fechar e abrir novamente.";
      } else if (err.message === 'VIDEO_LOAD_TIMEOUT') {
        errorMessage = "Tempo esgotado ao carregar câmera. Verifique as permissões.";
      } else if (err.message === 'VIDEO_PLAY_FAILED') {
        errorMessage = "Erro ao iniciar reprodução do vídeo. Tente novamente.";
      } else if (err.message === 'VIDEO_LOAD_ERROR') {
        errorMessage = "Erro ao carregar stream de vídeo. Reinicie o navegador.";
      }
      
      setError(errorMessage);
      setState('error');
      
      toast({
        title: "Erro na câmera",
        description: errorMessage,
        variant: "destructive",
      });
      
      cleanup();
    }
  };

  const startScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    console.log("🔍 Starting QR code scanning");
    
    scanIntervalRef.current = window.setInterval(() => {
      scanFrame();
    }, 150); // Scan every 150ms for good balance
  };

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Match canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Scan for QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code?.data) {
      console.log("🎯 QR Code detected:", code.data);
      handleQrDetected(code.data);
    }
  }, []);

  const handleQrDetected = (qrData: string) => {
    // Stop scanning immediately
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    console.log("✅ Processing QR code:", qrData);
    cleanup();
    onScan(qrData);
    onClose();
  };

  const validateManualCode = async (code: string): Promise<boolean> => {
    const cleanCode = code.trim();
    console.log("🔍 Validating manual code:", cleanCode);

    try {
      const { data, error } = await supabase
        .from("checkpoints")
        .select("id, name, manual_code")
        .eq("manual_code", cleanCode)
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Database error:", error);
        return false;
      }

      if (data) {
        console.log("✅ Valid code found:", data);
        return true;
      }

      console.log("❌ Code not found in database");
      return false;
    } catch (error) {
      console.error("Validation error:", error);
      return false;
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode || manualCode.length !== 9) {
      toast({
        title: "Código inválido",
        description: "O código deve ter exatamente 9 dígitos",
        variant: "destructive",
      });
      return;
    }

    setValidating(true);

    try {
      const isValid = await validateManualCode(manualCode);
      
      if (isValid) {
        toast({
          title: "Código válido",
          description: "Processando checkpoint...",
        });
        cleanup();
        onScan(manualCode);
        onClose();
      } else {
        toast({
          title: "Código não encontrado",
          description: "Verifique o código e tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de validação",
        description: "Não foi possível validar o código",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Escanear QR Code - {expectedCompany}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative bg-black">
          {/* INITIALIZING STATE */}
          {state === 'initializing' && (
            <div className="flex flex-col items-center justify-center p-12 min-h-[320px]">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Inicializando câmera...</p>
              <Button 
                onClick={() => setState('manual')} 
                variant="ghost" 
                size="sm"
                className="mt-4"
              >
                Usar código manual
              </Button>
            </div>
          )}

          {/* ERROR STATE */}
          {state === 'error' && (
            <div className="flex flex-col items-center justify-center p-8 min-h-[320px]">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-sm text-center text-muted-foreground mb-6 max-w-xs">
                {error}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={initializeCamera} variant="outline" className="w-full">
                  <Camera className="w-4 h-4 mr-2" />
                  Tentar novamente
                </Button>
                <Button onClick={() => setState('manual')} variant="default" className="w-full">
                  <Type className="w-4 h-4 mr-2" />
                  Usar código manual
                </Button>
              </div>
            </div>
          )}

          {/* MANUAL INPUT STATE */}
          {state === 'manual' && (
            <div className="p-6 space-y-4 min-h-[320px]">
              <div className="space-y-2">
                <Label htmlFor="manual-code" className="text-foreground">
                  Código Manual (9 dígitos)
                </Label>
                <Input
                  id="manual-code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="000000000"
                  maxLength={9}
                  disabled={validating}
                  className="text-lg text-center tracking-wider"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setState('initializing');
                    initializeCamera();
                  }} 
                  variant="outline" 
                  className="flex-1"
                  disabled={validating}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Câmera
                </Button>
                <Button 
                  onClick={handleManualSubmit} 
                  className="flex-1"
                  disabled={validating || manualCode.length !== 9}
                >
                  {validating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* CAMERA READY STATE */}
          {state === 'camera-ready' && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-80 object-cover"
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  {/* Center box */}
                  <div className="w-56 h-56 border-2 border-white/30 rounded-xl" />
                  {/* Corner markers */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>

              {/* Status indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Procurando QR Code</span>
              </div>

              {/* Manual input button */}
              <div className="absolute bottom-3 right-3">
                <Button
                  onClick={() => {
                    if (scanIntervalRef.current) {
                      clearInterval(scanIntervalRef.current);
                    }
                    setState('manual');
                  }}
                  size="sm"
                  variant="secondary"
                  className="bg-black/60 backdrop-blur-sm hover:bg-black/70"
                >
                  <Type className="w-4 h-4 mr-2" />
                  Manual
                </Button>
              </div>

              {/* Hidden canvas for scanning */}
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </div>

        {state === 'camera-ready' && (
          <div className="p-4 bg-muted/50 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Posicione o QR code dentro da área marcada para escanear automaticamente
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerV2;
