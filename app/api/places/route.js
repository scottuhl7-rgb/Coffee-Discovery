import { NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function POST(req) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { lat, lng, query } = await req.json();

    // Use Google Places Text Search to find specialty coffee shops
    const searchQuery = query || "specialty coffee roaster single origin";
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/textsearch/json"
    );
    url.searchParams.set("query", searchQuery);
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", "16000"); // ~10 miles
    url.searchParams.set("type", "cafe");
    url.searchParams.set("key", GOOGLE_API_KEY);

    const resp = await fetch(url.toString());
    const data = await resp.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places error:", data.status, data.error_message);
      return NextResponse.json(
        { error: "Places search failed" },
        { status: 502 }
      );
    }

    // Return top 10 results with relevant fields
    const places = (data.results || []).slice(0, 10).map((p) => ({
      name: p.name,
      address: p.formatted_address,
      rating: p.rating || null,
      totalRatings: p.user_ratings_total || 0,
      priceLevel: p.price_level || null,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      placeId: p.place_id,
      open: p.opening_hours?.open_now ?? null,
      types: p.types || [],
    }));

    return NextResponse.json({ places });
  } catch (e) {
    console.error("Places API error:", e);
    return NextResponse.json(
      { error: "Failed to search for places" },
      { status: 500 }
    );
  }
}
