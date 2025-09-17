import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSecureMapbox } from '@/hooks/useSecureMapbox';

interface MapViewProps {
  className?: string;
  showControls?: boolean;
  center?: [number, number];
  zoom?: number;
}

const MapView: React.FC<MapViewProps> = ({ 
  className = "", 
  showControls = false,
  center = [-48.3336, -10.1849], // Palmas - TO coordinates
  zoom = 12
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const { toast } = useToast();
  const [clientMarkers, setClientMarkers] = useState<mapboxgl.Marker[]>([]);
  const { token: secureToken, loading: tokenLoading, error: tokenError } = useSecureMapbox();

  useEffect(() => {
    // Cleanup previous map instance if exists
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    // Use secure token if available
    if (secureToken && !tokenLoading) {
      setMapboxToken(secureToken);
      setTokenSaved(true);
      
      // Initialize map after a small delay to ensure container is ready
      setTimeout(() => {
        initializeMap(secureToken);
      }, 100);
    } else if (tokenError) {
      // Fallback to manual token input if secure token fails
      const savedToken = localStorage.getItem('mapbox_token');
      if (savedToken) {
        setMapboxToken(savedToken);
        setTokenSaved(true);
        setTimeout(() => {
          initializeMap(savedToken);
        }, 100);
      }
    }

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [secureToken, tokenLoading, tokenError]);

  const initializeMap = (token: string) => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11', // Changed from satellite to streets as requested
        center: center,
        zoom: zoom,
        attributionControl: false
      });

      // Log when map is loaded for debugging
      map.current.on('load', () => {
        console.log("Mapa carregado com sucesso!");
      });

      map.current.on('error', (e) => {
        console.error('Erro no mapa:', e);
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add geolocate control
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );

      // Add scale control
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

      // Load real client locations from database
      loadClientMarkers();

      toast({
        title: "Mapa carregado",
        description: "Mapa em tempo real carregado com sucesso!",
      });

    } catch (error) {
      console.error('Erro ao inicializar mapa:', error);
      toast({
        title: "Erro no mapa",
        description: "Token do Mapbox inválido ou erro de conexão",
        variant: "destructive",
      });
    }
  };

  const loadClientMarkers = async () => {
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("*")
        .eq("active", true)
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (error) throw error;

      // Clear existing markers
      clientMarkers.forEach(marker => marker.remove());
      setClientMarkers([]);

      const newMarkers: mapboxgl.Marker[] = [];

      clients?.forEach(client => {
        if (client.lat && client.lng && map.current) {
          const el = document.createElement('div');
          el.className = 'client-marker';
          el.style.backgroundColor = 'hsl(var(--tactical-blue))';
          el.style.width = '16px';
          el.style.height = '16px';
          el.style.borderRadius = '50%';
          el.style.border = '3px solid white';
          el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
          el.style.cursor = 'pointer';

          // Create permanent label
          const labelEl = document.createElement('div');
          labelEl.className = 'client-label';
          labelEl.style.cssText = `
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            pointer-events: none;
            transform: translate(-50%, -100%);
            margin-bottom: 5px;
          `;
          labelEl.textContent = client.name;

          const labelMarker = new mapboxgl.Marker(labelEl, { anchor: 'bottom' })
            .setLngLat([client.lng, client.lat])
            .addTo(map.current);

          const marker = new mapboxgl.Marker(el)
            .setLngLat([client.lng, client.lat])
            .setPopup(
              new mapboxgl.Popup({ 
                offset: 25,
                className: 'tactical-popup'
              })
                .setHTML(`
                  <div style="background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); padding: 12px; border-radius: 8px; border: 1px solid hsl(var(--border));">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: hsl(var(--primary-foreground));">${client.name}</h3>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: hsl(var(--primary-foreground)); opacity: 0.9;">${client.address}</p>
                    <div style="font-size: 11px; color: hsl(var(--primary-foreground)); opacity: 0.8;">
                      Lat: ${client.lat.toFixed(4)}, Lng: ${client.lng.toFixed(4)}
                    </div>
                  </div>
                `)
            )
            .addTo(map.current);

          newMarkers.push(marker, labelMarker);
        }
      });

      setClientMarkers(newMarkers);

    } catch (error) {
      console.error('Error loading client markers:', error);
    }
  };

  const handleSaveToken = () => {
    if (!mapboxToken.trim()) {
      toast({
        title: "Token necessário",
        description: "Por favor, insira seu token do Mapbox",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem('mapbox_token', mapboxToken);
    setTokenSaved(true);
    initializeMap(mapboxToken);
    
    toast({
      title: "Token salvo",
      description: "Token do Mapbox salvo com sucesso!",
    });
  };

  if (!tokenSaved) {
    return (
      <Card className={`tactical-card ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-tactical-blue" />
            Configuração do Mapa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Para visualizar o mapa em tempo real, você precisa configurar seu token do Mapbox.
          </p>
          <p className="text-muted-foreground text-sm">
            Obtenha seu token gratuito em:{' '}
            <a 
              href="https://mapbox.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-tactical-blue hover:underline"
            >
              mapbox.com
            </a>
          </p>
          <div className="space-y-2">
            <Label htmlFor="mapbox-token">Token do Mapbox</Label>
            <Input
              id="mapbox-token"
              type="password"
              placeholder="pk.eyJ1..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveToken} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            Salvar e Carregar Mapa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainer} 
        id="map"
        className="w-full h-full rounded-lg overflow-hidden tactical-card min-h-[70vh]" 
        style={{ minHeight: '70vh' }}
      />
      {showControls && (
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-2">
          <div className="text-sm font-medium text-card-foreground">
            Mapa em Tempo Real - Palmas/TO
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;