export interface GoogleMapsData {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const extractDataFromGoogleMapsUrl = (url: string): GoogleMapsData | null => {
  try {
    // Padrão para URLs do Google Maps com coordenadas
    const coordsRegex = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const match = url.match(coordsRegex);
    
    if (match) {
      return {
        name: "",
        address: "",
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }

    // Padrão para URLs com place_id
    const placeRegex = /place\/([^\/]+)/;
    const placeMatch = url.match(placeRegex);
    
    if (placeMatch) {
      // Decode URL encoded place name
      const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      
      // Try to extract coordinates from the URL
      const coordsMatch = url.match(coordsRegex);
      if (coordsMatch) {
        return {
          name: placeName,
          address: placeName,
          lat: parseFloat(coordsMatch[1]),
          lng: parseFloat(coordsMatch[2])
        };
      }
      
      return {
        name: placeName,
        address: placeName,
        lat: 0,
        lng: 0
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing Google Maps URL:', error);
    return null;
  }
};