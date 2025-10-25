import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, apiKey, location } = await req.json();

    console.log('Search request received:', { query, hasApiKey: !!apiKey, location });

    // Validations
    if (!query || !apiKey) {
      throw new Error('Query e API Key são obrigatórios');
    }

    // 1. Text Search - search for places/businesses
    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pt-BR`;
    
    // Add proximity to base location if provided
    if (location?.lat && location?.lng) {
      searchUrl += `&location=${location.lat},${location.lng}&radius=50000`;
    }

    console.log('Calling Google Places Text Search API');
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    console.log('Google Places API response status:', searchData.status);

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', searchData);
      throw new Error(`Google Places API error: ${searchData.status} - ${searchData.error_message || ''}`);
    }

    if (searchData.status === 'ZERO_RESULTS' || !searchData.results || searchData.results.length === 0) {
      console.log('No results found');
      return new Response(
        JSON.stringify({ 
          success: true,
          results: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Place Details - get additional details for each result
    console.log(`Fetching details for ${searchData.results.length} places`);
    const detailedResults = await Promise.all(
      (searchData.results || []).slice(0, 5).map(async (place: any) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours,website,rating,user_ratings_total&key=${apiKey}&language=pt-BR`;
          
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();

          if (detailsData.status !== 'OK') {
            console.warn(`Failed to get details for place ${place.place_id}:`, detailsData.status);
          }

          return {
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            geometry: place.geometry,
            rating: detailsData.result?.rating || place.rating,
            user_ratings_total: detailsData.result?.user_ratings_total,
            formatted_phone_number: detailsData.result?.formatted_phone_number,
            website: detailsData.result?.website,
            opening_hours: detailsData.result?.opening_hours,
            types: place.types
          };
        } catch (error) {
          console.error(`Error fetching details for place ${place.place_id}:`, error);
          // Return place without detailed info
          return {
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            geometry: place.geometry,
            rating: place.rating,
            types: place.types
          };
        }
      })
    );

    console.log(`Successfully processed ${detailedResults.length} results`);

    return new Response(
      JSON.stringify({ 
        success: true,
        results: detailedResults 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-places function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
