import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useSecureMapbox } from "@/hooks/useSecureMapbox";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface MapSelectorProps {
  baseLocation?: { lat: number; lng: number; name: string };
  clientLocation?: { lat: number; lng: number; name: string };
  onLocationSelect?: (location: { lat: number; lng: number; name: string }) => void;
  onDistanceCalculated?: (distance: number) => void;
}

export const MapSelector = ({
  baseLocation,
  clientLocation,
  onLocationSelect,
  onDistanceCalculated,
}: MapSelectorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { token, loading: tokenLoading } = useSecureMapbox();
  const [searchAddress, setSearchAddress] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !token || map.current) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: baseLocation ? [baseLocation.lng, baseLocation.lat] : [-46.6333, -23.5505],
      zoom: baseLocation ? 12 : 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

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
      onLocationSelect?.({ lat, lng, name: "Local selecionado" });
    });

    return () => {
      map.current?.remove();
    };
  }, [token, baseLocation]);

  // Update client marker
  useEffect(() => {
    if (!map.current || !clientLocation) return;

    // Remove existing client marker
    const markers = document.querySelectorAll(".mapboxgl-marker");
    markers.forEach((marker) => {
      const markerElement = marker as HTMLElement;
      if (markerElement.style.backgroundColor !== "rgb(34, 197, 94)") {
        marker.remove();
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

    // Draw route line if both locations exist
    if (baseLocation && clientLocation) {
      map.current.flyTo({
        center: [
          (baseLocation.lng + clientLocation.lng) / 2,
          (baseLocation.lat + clientLocation.lat) / 2,
        ],
        zoom: 11,
      });

      // Calculate distance
      const distance = calculateDistance(
        baseLocation.lat,
        baseLocation.lng,
        clientLocation.lat,
        clientLocation.lng
      );
      onDistanceCalculated?.(distance);
    }
  }, [clientLocation, baseLocation, onDistanceCalculated]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSearch = async () => {
    if (!searchAddress || !token) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchAddress
        )}.json?access_token=${token}&limit=1`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const placeName = data.features[0].place_name;
        onLocationSelect?.({ lat, lng, name: placeName });
        
        map.current?.flyTo({ center: [lng, lat], zoom: 14 });
      }
    } catch (error) {
      console.error("Error searching address:", error);
    } finally {
      setSearching(false);
    }
  };

  if (tokenLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Carregando mapa...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar endereço..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div
          ref={mapContainer}
          className="w-full h-[400px] rounded-lg"
        />
        <p className="text-xs text-muted-foreground">
          Clique no mapa para selecionar uma localização ou use a busca por endereço
        </p>
      </CardContent>
    </Card>
  );
};
