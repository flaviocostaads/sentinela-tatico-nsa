import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, CheckCircle } from "lucide-react";

interface SignaturePadProps {
  onSignature: (signature: string) => void;
  onCancel: () => void;
  clientName: string;
}

const SignaturePad = ({ onSignature, onCancel, clientName }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size - responsive for mobile
    const updateCanvasSize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = Math.min(300, window.innerHeight * 0.4);
      }

      // Set drawing styles
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Fill background with white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const signatureData = canvas.toDataURL('image/png');
    onSignature(signatureData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-xl">
          ✍️ Assinatura do Cliente
        </CardTitle>
        <p className="text-sm text-center font-medium text-foreground">
          {clientName}
        </p>
        <p className="text-xs text-center text-muted-foreground">
          👆 Assine com o dedo na área abaixo
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-primary rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair touch-none"
            style={{ height: 'min(300px, 40vh)' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearSignature}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={saveSignature}
            disabled={!hasSignature}
            className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirmar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignaturePad;