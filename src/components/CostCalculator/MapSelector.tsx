import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useSecureMapbox } from "@/hooks/useSecureMapbox";
import { useMapboxDirections } from "@/hooks/useMapboxDirections";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MapSelectorProps {
  baseLocation?: { lat: number; lng: number; name: string };
  clientLocation?: { lat: number; lng: number; name: string };
  onLocationSelect?: (location: { lat: number; lng: number; name: string }) => void;
  onDistanceCalculated?: (distance: number) => void;
}

interface SearchResult {
  type: 'client' | 'address' | 'manual';
  name: string;
  address?: string;
  lat: number;
  lng: number;
  id?: string;
}

interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
  geometry?: any;
}

export const MapSelector = ({
  baseLocation,
  clientLocation,
  onLocationSelect,
  onDistanceCalculated,
}: MapSelectorProps) => {
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const { token, loading: tokenLoading } = useSecureMapbox();
  const { calculateDistanceBetweenPoints, loading: routeLoading } = useMapboxDirections();
  
  const [searchAddress, setSearchAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [tempLocation, setTempLocation] = useState<SearchResult | null>(null);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [calculating, setCalculating] = useState(false);
  
  // Coordenadas manuais
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  useEffect(() => {
    if (!mapContainer.current || !token || map.current) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: baseLocation ? [baseLocation.lng, baseLocation.lat] : [-46.6333, -23.5505],
      zoom: baseLocation ? 12 : 10,
    });

    // Habilitar todos os controles de zoom
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.scrollZoom.enable();
    map.current.touchZoomRotate.enable();
    map.current.doubleClickZoom.enable();
    map.current.boxZoom.enable();

    // Add base marker if exists
    if (baseLocation) {
      new mapboxgl.Marker({ color: "#22c55e" })
        .setLngLat([baseLocation.lng, baseLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>Base</strong><br>${baseLocation.name}`))
        .addTo(map.current);
    }

    // Click to select location
    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      handleSelectResult({
        type: 'manual',
        name: `Localização (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [token, baseLocation]);

  // Update client marker when confirmed
  useEffect(() => {
    if (!map.current || !clientLocation) return;

    // Remove existing client marker (blue markers only)
    const markers = document.querySelectorAll(".mapboxgl-marker");
    markers.forEach((marker) => {
      const markerElement = marker as HTMLElement;
      // Check if it's not the green base marker
      const svg = markerElement.querySelector('svg');
      if (svg) {
        const path = svg.querySelector('path');
        if (path && path.getAttribute('fill') === '#3b82f6') {
          marker.remove();
        }
      }
    });

    // Add new client marker
    new mapboxgl.Marker({ color: "#3b82f6" })
      .setLngLat([clientLocation.lng, clientLocation.lat])
      .setPopup(
        new mapboxgl.Popup().setHTML(
          `<strong>Cliente</strong><br>${clientLocation.name}`
        )
      )
      .addTo(map.current);
  }, [clientLocation]);

  const handleSearch = async () => {
    if (!searchAddress || !token) return;

    setSearching(true);
    setShowResults(true);
    
    try {
      // 1. Buscar clientes cadastrados primeiro
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', `%${searchAddress}%`)
        .eq('active', true)
        .limit(5);

      const results: SearchResult[] = [];

      // Adicionar clientes encontrados
      if (clients && clients.length > 0) {
        results.push(...clients.map(c => ({
          type: 'client' as const,
          name: c.name,
          address: c.address,
          lat: c.lat,
          lng: c.lng,
          id: c.id
        })));
      }

      // 2. Se não encontrou clientes suficientes, buscar via Mapbox Geocoding
      if (results.length < 5) {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            searchAddress
          )}.json?access_token=${token}&limit=${5 - results.length}&country=BR`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          results.push(...data.features.map((f: any) => ({
            type: 'address' as const,
            name: f.text,
            address: f.place_name,
            lat: f.center[1],
            lng: f.center[0]
          })));
        }
      }

      setSearchResults(results);

      if (results.length === 0) {
        toast({
          title: "Nenhum resultado encontrado",
          description: "Tente buscar por outro termo ou use as coordenadas manuais",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível realizar a busca. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    // Remove previous temp marker
    tempMarkerRef.current?.remove();

    // Add temporary orange marker
    tempMarkerRef.current = new mapboxgl.Marker({ color: "#FFA500" })
      .setLngLat([result.lng, result.lat])
      .setPopup(
        new mapboxgl.Popup().setHTML(
          `<strong>📍 Confirmar localização?</strong><br>${result.name}`
        )
      )
      .addTo(map.current!);

    // Show temporary marker popup
    tempMarkerRef.current.togglePopup();

    // Store temp location and show confirm button
    setTempLocation(result);
    setShowConfirmButton(true);
    setShowResults(false);

    // Center map on location
    map.current?.flyTo({ 
      center: [result.lng, result.lat], 
      zoom: 15,
      duration: 1500
    });
  };

  const addRouteLineToMap = (geometry: any) => {
    if (!map.current) return;

    // Remove previous route if exists
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add new route
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: geometry
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.75
      }
    });
  };

  const handleConfirmLocation = async () => {
    if (!baseLocation || !tempLocation) return;

    setCalculating(true);

    try {
      // Calculate actual route using Mapbox Directions
      const route = await calculateDistanceBetweenPoints(
        { latitude: baseLocation.lat, longitude: baseLocation.lng },
        { latitude: tempLocation.lat, longitude: tempLocation.lng },
        'mapbox.driving'
      );

      if (route) {
        // Draw route line on map
        if (route.geometry) {
          addRouteLineToMap(route.geometry);
        }

        // Store route info
        setRouteInfo({
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
          geometry: route.geometry
        });

        // Send data to parent component
        onLocationSelect?.({
          lat: tempLocation.lat,
          lng: tempLocation.lng,
          name: tempLocation.name
        });

        onDistanceCalculated?.(route.distanceKm);

        // Show success message
        toast({
          title: "✓ Rota Calculada",
          description: `${route.distanceKm.toFixed(1)} km • ${route.durationMinutes.toFixed(0)} min`,
        });

        // Convert temp marker to permanent blue marker
        tempMarkerRef.current?.remove();
        new mapboxgl.Marker({ color: "#3b82f6" })
          .setLngLat([tempLocation.lng, tempLocation.lat])
          .setPopup(
            new mapboxgl.Popup().setHTML(
              `<strong>Cliente</strong><br>${tempLocation.name}`
            )
          )
          .addTo(map.current!);

        // Fit map to show both markers and route
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([baseLocation.lng, baseLocation.lat]);
        bounds.extend([tempLocation.lng, tempLocation.lat]);
        map.current?.fitBounds(bounds, { padding: 100, duration: 1500 });

      } else {
        toast({
          title: "Erro ao calcular rota",
          description: "Não foi possível calcular a rota. Usando distância em linha reta.",
          variant: "destructive"
        });
        
        // Fallback to straight line distance
        const R = 6371;
        const dLat = ((tempLocation.lat - baseLocation.lat) * Math.PI) / 180;
        const dLon = ((tempLocation.lng - baseLocation.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((baseLocation.lat * Math.PI) / 180) *
            Math.cos((tempLocation.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        onDistanceCalculated?.(distance);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      toast({
        title: "Erro",
        description: "Erro ao calcular a rota",
        variant: "destructive"
      });
    } finally {
      setCalculating(false);
      setShowConfirmButton(false);
      setTempLocation(null);
    }
  };

  const handleManualCoordinates = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    // Validação
    if (isNaN(lat) || isNaN(lng)) {
      toast({
        title: "Coordenadas inválidas",
        description: "Por favor, insira valores numéricos válidos",
        variant: "destructive"
      });
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast({
        title: "Coordenadas fora do intervalo",
        description: "Latitude: -90 a 90, Longitude: -180 a 180",
        variant: "destructive"
      });
      return;
    }

    // Tratar como resultado de busca
    handleSelectResult({
      type: 'manual',
      name: `Coordenadas (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat: lat,
      lng: lng
    });

    // Limpar inputs
    setManualLat("");
    setManualLng("");
  };

  if (tokenLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-center text-muted-foreground">Carregando mapa...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Busca por endereço */}
        <div className="relative">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar cliente ou endereço..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Dropdown de resultados */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((result, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectResult(result)}
                  className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {result.name}
                        {result.type === 'client' && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                            ✓ Cliente Cadastrado
                          </span>
                        )}
                      </div>
                      {result.address && (
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {result.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input manual de coordenadas */}
        <div className="flex gap-2">
          <Input
            placeholder="Latitude (ex: -23.5505)"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Longitude (ex: -46.6333)"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleManualCoordinates} variant="outline">
            <MapPin className="h-4 w-4" />
          </Button>
        </div>

        {/* Mapa */}
        <div
          ref={mapContainer}
          className="w-full h-[400px] rounded-lg border"
        />

        {/* Botão de confirmação */}
        {showConfirmButton && tempLocation && (
          <Button 
            onClick={handleConfirmLocation} 
            className="w-full"
            disabled={calculating || !baseLocation}
          >
            {calculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculando Rota...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar e Calcular Rota
              </>
            )}
          </Button>
        )}

        {/* Informações da rota */}
        {routeInfo && (
          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {routeInfo.distanceKm.toFixed(1)} km
                  </div>
                  <div className="text-xs text-muted-foreground">Distância (ida)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {routeInfo.durationMinutes.toFixed(0)} min
                  </div>
                  <div className="text-xs text-muted-foreground">Tempo estimado</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {(routeInfo.distanceKm * 2).toFixed(1)} km
                  </div>
                  <div className="text-xs text-muted-foreground">Ida + Volta</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          💡 <strong>Dica:</strong> Busque por cliente, digite um endereço, insira coordenadas ou clique no mapa
        </p>
      </CardContent>
    </Card>
  );
};
