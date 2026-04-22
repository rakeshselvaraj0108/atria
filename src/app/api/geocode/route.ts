import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.toLowerCase() || '';
    
    if (!q) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    // Hardcoded highly reliable fallbacks for the Hackathon Demo!
    const hardcodedLocations = [
      { place_id: 10001, display_name: "KJU (Kristu Jayanti College), Bangalore", lat: "13.0584", lon: "77.6433" },
      { place_id: 10002, display_name: "Atria Institute of Technology, Bangalore", lat: "13.0334", lon: "77.5901" },
      { place_id: 10003, display_name: "Silk Board Junction, Bangalore", lat: "12.9176", lon: "77.6238" },
      { place_id: 10004, display_name: "Koramangala, Bangalore", lat: "12.9352", lon: "77.6245" },
      { place_id: 10005, display_name: "Kempegowda International Airport, Bangalore", lat: "13.1989", lon: "77.7068" },
      { place_id: 10006, display_name: "Electronic City Phase 1, Bangalore", lat: "12.8452", lon: "77.6602" },
      { place_id: 10007, display_name: "Shanti Nagar, Bangalore", lat: "12.9569", lon: "77.5959" },
      { place_id: 10008, display_name: "Indiranagar, Bangalore", lat: "12.9784", lon: "77.6408" }
    ];

    const matchedHardcoded = hardcodedLocations.filter(loc => loc.display_name.toLowerCase().includes(q) || (q === 'kju' && loc.place_id === 10001) || (q === 'atria' && loc.place_id === 10002));
    
    let nominatimResults: any[] = [];
    
    try {
      // Remove bounded=1 so it's less strict, but still prioritize the viewbox
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ' bangalore')}&viewbox=77.3,13.3,77.9,12.7&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Trafficmaxxers/1.0 (hackathon-submission@example.com)',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        }
      );

      if (res.ok) {
        nominatimResults = await res.json();
      }
    } catch (e) {
      console.warn("Nominatim failed, falling back to hardcoded only", e);
    }

    // Combine hardcoded and nominatim results, giving priority to hardcoded
    const finalResults = [...matchedHardcoded, ...nominatimResults].slice(0, 5);
    return NextResponse.json(finalResults);
  } catch (error: any) {
    console.error('Geocode API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
