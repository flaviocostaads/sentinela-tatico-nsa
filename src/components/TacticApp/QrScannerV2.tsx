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
  const initializingRef = useRef(false);
  
  const [state, setState] = useState<ScannerState>('initializing');
  const [error, setError] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [validating, setValidating] = useState(false);
  const { toast } = useToast();

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up camera resources");
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("📹 Stopped track:", track.label);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    initializingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Initialize camera when dialog opens
  const initializeCamera = useCallback(async () => {
    if (initializingRef.current) {
      console.log("⚠️ Already initializing, skipping...");
      return;
    }

    initializingRef.current = true;
    console.log("📱 Starting camera initialization...");
    
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("BROWSER_NOT_SUPPORTED");
      }

      // Wait a bit for video element to be mounted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if video element exists
      if (!videoRef.current) {
        console.error("❌ Video element not available");
        throw new Error("VIDEO_ELEMENT_NOT_FOUND");
      }

      console.log("✅ Video element ready, requesting camera access...");

      // Request camera access with multiple fallback strategies
      let stream: MediaStream | null = null;
      
      // Strategy 1: Try environment camera (back camera on mobile) without exact
      try {
        console.log("📱 Trying environment camera (back camera)...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 }
          },
          audio: false
        });
        console.log("✅ Environment camera obtained");
      } catch (envError) {
        console.log("⚠️ Environment camera failed:", envError);
        
        // Strategy 2: Try with minimal constraints
        try {
          console.log("📱 Trying any camera with basic constraints...");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
          console.log("✅ Camera with basic constraints obtained");
        } catch (basicError) {
          console.log("⚠️ Basic constraints failed:", basicError);
          
          // Strategy 3: Try with just video: true (most permissive)
          console.log("📱 Trying with minimal constraints...");
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          console.log("✅ Camera with minimal constraints obtained");
        }
      }

      if (!stream) {
        throw new Error("NO_STREAM_OBTAINED");
      }

      console.log("✅ Camera stream obtained:", {
        active: stream.active,
        tracks: stream.getTracks().length,
        trackSettings: stream.getVideoTracks()[0]?.getSettings()
      });

      streamRef.current = stream;
      
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("VIDEO_ELEMENT_LOST");
      }

      // Configure video element
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('muted', 'true');
      video.muted = true;
      video.playsInline = true;
      
      console.log("🎥 Waiting for video to be ready...");

      // Wait for video to be ready with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("⏰ Video load timeout after 15 seconds");
          reject(new Error("VIDEO_LOAD_TIMEOUT"));
        }, 15000);

        const onCanPlay = async () => {
          console.log("📺 Video can play, attempting to start playback...");
          
          try {
            await video.play();
            console.log("▶️ Video playing successfully");
            clearTimeout(timeout);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            resolve();
          } catch (playErr) {
            console.error("❌ Play failed:", playErr);
            clearTimeout(timeout);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            reject(new Error("VIDEO_PLAY_FAILED"));
          }
        };

        const onError = (err: Event) => {
          console.error("❌ Video error event:", err);
          clearTimeout(timeout);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          reject(new Error("VIDEO_LOAD_ERROR"));
        };

        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('error', onError, { once: true });

        // If video is already ready, trigger immediately
        if (video.readyState >= video.HAVE_FUTURE_DATA) {
          console.log("📺 Video already ready, triggering immediately");
          onCanPlay();
        }
      });

      console.log("✅ Camera ready, starting QR scan");
      console.log("📺 Video state:", {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        currentTime: video.currentTime
      });
      
      setState('camera-ready');
      
      // Wait a bit for video to stabilize before scanning
      setTimeout(() => {
        console.log("🎬 Starting scanner after video stabilization");
        startScanning();
      }, 500);

    } catch (err: any) {
      console.error("💥 Camera initialization error:", err);
      console.error("Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      
      let errorMessage = "Erro ao acessar câmera";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Permissão de câmera negada. Permita o acesso nas configurações do navegador.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "Nenhuma câmera encontrada neste dispositivo.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Câmera está sendo usada por outro aplicativo. Feche outros apps e tente novamente.";
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = "Configurações de câmera não suportadas. Tentando configuração alternativa...";
      } else if (err.message === 'BROWSER_NOT_SUPPORTED') {
        errorMessage = "Navegador não suporta acesso à câmera.";
      } else if (err.message === 'VIDEO_ELEMENT_NOT_FOUND' || err.message === 'VIDEO_ELEMENT_LOST') {
        errorMessage = "Erro ao carregar componente de vídeo. Feche e abra novamente.";
      } else if (err.message === 'VIDEO_LOAD_TIMEOUT') {
        errorMessage = "Tempo esgotado ao carregar câmera. Tente novamente.";
      } else if (err.message === 'VIDEO_PLAY_FAILED') {
        errorMessage = "Erro ao iniciar vídeo. Permita reprodução automática.";
      } else if (err.message === 'VIDEO_LOAD_ERROR') {
        errorMessage = "Erro ao carregar stream de vídeo.";
      } else if (err.message === 'NO_STREAM_OBTAINED') {
        errorMessage = "Não foi possível obter stream de câmera.";
      }
      
      setError(errorMessage);
      setState('error');
      
      toast({
        title: "Erro na câmera",
        description: errorMessage,
        variant: "destructive",
      });
      
      cleanup();
    } finally {
      initializingRef.current = false;
    }
  }, [cleanup, toast]);

  // Handle dialog open/close
  useEffect(() => {
    if (open) {
      console.log("🎬 QR Scanner opened");
      setState('initializing');
      setError("");
      setManualCode("");
      setValidating(false);
      
      // Delay to ensure dialog and video element are fully mounted
      const timer = setTimeout(() => {
        console.log("⏰ Starting camera initialization after mount delay");
        initializeCamera();
      }, 500);
      
      return () => {
        console.log("🧹 Clearing initialization timer");
        clearTimeout(timer);
      };
    } else {
      console.log("🛑 QR Scanner closed");
      cleanup();
    }
  }, [open, initializeCamera, cleanup]);

  const startScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    console.log("🔍 === STARTING QR CODE SCANNING ===");
    console.log("📹 Video element:", videoRef.current);
    console.log("📹 Video ready:", videoRef.current?.readyState);
    console.log("📹 Video dimensions:", {
      width: videoRef.current?.videoWidth,
      height: videoRef.current?.videoHeight
    });
    console.log("🎨 Canvas element:", canvasRef.current);
    
    // Verify video is actually playing
    const video = videoRef.current;
    if (video) {
      console.log("🎬 Video state:", {
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: video.duration
      });
    }
    
    // Start scanning immediately and frequently
    let scanCount = 0;
    
    const scan = () => {
      scanCount++;
      
      if (scanCount % 10 === 0) {
        console.log(`🔄 Scan attempt #${scanCount}`);
      }
      
      try {
        scanFrame();
      } catch (error) {
        console.error("❌ Scan error:", error);
      }
    };
    
    // Scan every 150ms for good balance between performance and detection
    scanIntervalRef.current = window.setInterval(scan, 150);
    console.log("⚡ Scanning started with 150ms interval");
    
    // Also do an immediate first scan
    scan();
  };

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      console.log("❌ Missing video or canvas element");
      return;
    }

    // Check video state
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log("⏳ Video not ready yet, readyState:", video.readyState);
      return;
    }

    // Ensure video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("⚠️ Video has no dimensions yet");
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.warn("⚠️ No canvas context available");
      return;
    }

    // Set canvas size to match video - use larger dimensions for better QR detection
    const targetWidth = Math.max(video.videoWidth, 640);
    const targetHeight = Math.max(video.videoHeight, 480);
    
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      console.log("📐 Canvas resized:", { 
        width: canvas.width, 
        height: canvas.height,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
    }

    try {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame to canvas with smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data from entire canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (!imageData || imageData.data.length === 0) {
        console.warn("⚠️ No image data captured");
        return;
      }

      console.log("🔍 Scanning frame:", {
        width: imageData.width,
        height: imageData.height,
        dataLength: imageData.data.length
      });

      // Try multiple detection strategies
      let code = null;
      
      // Strategy 1: Full image with both inversions
      code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code?.data) {
        console.log("✅ QR Code detected with full image scan!");
        console.log("🎯 QR Data:", code.data);
        console.log("📍 QR Location:", code.location);
        handleQrDetected(code.data);
        return;
      }

      // Strategy 2: Try center region only (in case QR is in center)
      const centerX = Math.floor(imageData.width * 0.25);
      const centerY = Math.floor(imageData.height * 0.25);
      const centerWidth = Math.floor(imageData.width * 0.5);
      const centerHeight = Math.floor(imageData.height * 0.5);
      
      const centerImageData = ctx.getImageData(centerX, centerY, centerWidth, centerHeight);
      
      code = jsQR(centerImageData.data, centerImageData.width, centerImageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code?.data) {
        console.log("✅ QR Code detected in center region!");
        console.log("🎯 QR Data:", code.data);
        handleQrDetected(code.data);
        return;
      }

    } catch (error) {
      console.error("❌ Error in scanFrame:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');
    }
  }, []);

  const handleQrDetected = (qrData: string) => {
    // Stop scanning immediately to prevent multiple detections
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
      console.log("⏹️ Stopped scanning");
    }

    console.log("✅ Processing QR code:", qrData);
    console.log("📊 QR data length:", qrData.length);
    console.log("📋 QR data type:", typeof qrData);
    
    // Show immediate feedback
    toast({
      title: "QR Code Detectado!",
      description: "Processando código...",
    });
    
    // Clean up camera
    cleanup();
    
    // Call the onScan callback with the detected data
    console.log("🎯 Calling onScan callback with:", qrData);
    onScan(qrData);
    
    // Close the scanner
    console.log("🚪 Closing scanner");
    onClose();
  };

  const validateManualCode = (code: string): boolean => {
    const cleanCode = code.trim();
    console.log("🔍 Checking manual code format:", cleanCode);

    // Only validate format - actual validation happens in parent component
    if (!/^\d{9}$/.test(cleanCode)) {
      console.log("❌ Invalid format: must be 9 digits");
      return false;
    }

    console.log("✅ Format valid: 9 digits");
    return true;
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
      const isValid = validateManualCode(manualCode);
      
      if (isValid) {
        toast({
          title: "Código detectado",
          description: "Processando checkpoint...",
        });
        cleanup();
        onScan(manualCode);
        onClose();
      } else {
        toast({
          title: "Formato inválido",
          description: "O código deve ter 9 dígitos",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de validação",
        description: "Não foi possível processar o código",
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
                onClick={() => {
                  console.log("🔘 Switching to manual mode from initializing");
                  cleanup();
                  setState('manual');
                }} 
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
                <Button onClick={() => {
                  console.log("🔘 Switching to manual mode from error");
                  cleanup();
                  setState('manual');
                }} variant="default" className="w-full">
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
                    setTimeout(() => initializeCamera(), 100);
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

              {/* Status indicator with scan count */}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Procurando QR Code...</span>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
                <p className="text-white text-xs text-center">
                  Mantenha o QR code centralizado e bem iluminado
                </p>
              </div>

              {/* Manual input button */}
              <div className="absolute bottom-3 right-3 pointer-events-auto">
              <Button
                  onClick={() => {
                    console.log("🔘 Manual button clicked - switching to manual mode");
                    cleanup();
                    setState('manual');
                  }}
                  size="sm"
                  variant="secondary"
                  className="bg-black/60 backdrop-blur-sm hover:bg-black/70 shadow-lg"
                >
                  <Type className="w-4 h-4 mr-2" />
                  Manual
                </Button>
              </div>
            </>
          )}

          {/* Always render video element and canvas to ensure refs are available */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={state === 'camera-ready' ? "w-full h-80 object-cover" : "hidden"}
          />
          <canvas ref={canvasRef} className="hidden" />
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
