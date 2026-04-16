import { NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function nearbySearch(lat, lng, keyword) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
  );
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "16000"); // ~10 miles
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("type", "cafe");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const resp = await fetch(url.toString());
  const data = await resp.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places error: ${data.status} ${data.error_message || ""}`
    );
  }

  return (data.results || []).slice(0, 10).map((p) => ({
    name: p.name,
    address: p.vicinity || p.formatted_address,
    rating: p.rating || null,
    totalRatings: p.user_ratings_total || 0,
    priceLevel: p.price_level || null,
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    placeId: p.place_id,
    open: p.opening_hours?.open_now ?? null,
    types: p.types || [],
  }));
}

// Fetch the canonical Google Maps URL for each place so the client can
// deep-link to the specific listing. We intentionally skip the shop-reported
// `website` field because it's user-submitted and sometimes points at an
// unrelated similarly-named business. The Google Maps URL is tied to the
// place_id, so it's always correct.
async function placeDetails(placeId) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json"
  );
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "url");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.status !== "OK") return { mapsUrl: null };
  return { mapsUrl: data.result?.url || null };
}

// Sort highest-rated first. Unrated shops sink to the bottom. Tiebreak on
// review count so a 5.0/2 doesn't outrank a 4.8/800.
function sortByRating(places) {
  return [...places].sort((a, b) => {
    const ra = a.rating ?? -Infinity;
    const rb = b.rating ?? -Infinity;
    if (rb !== ra) return rb - ra;
    return (b.totalRatings || 0) - (a.totalRatings || 0);
  });
}

export async function POST(req) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { lat, lng, keywords, keyword } = await req.json();

    // Accept either an array of keywords (tried in priority order) or a single
    // keyword. We fall through from the most specific to the most generic until
    // we find results, so users always see *some* nearby specialty shops even
    // when no local shop explicitly references the coffee's origin.
    const queue =
      Array.isArray(keywords) && keywords.length > 0
        ? keywords
        : [keyword || "specialty coffee single origin"];

    let places = [];
    let matchedKeyword = null;
    for (const kw of queue) {
      if (!kw) continue;
      places = await nearbySearch(lat, lng, kw);
      if (places.length > 0) {
        matchedKeyword = kw;
        break;
      }
    }

    // Enrich each hit with the shop's website + Google Maps URL in parallel
    // so users can tap through directly to check a menu.
    if (places.length > 0) {
      const details = await Promise.all(
        places.map((p) => placeDetails(p.placeId))
      );
      places = places.map((p, i) => ({ ...p, ...details[i] }));
    }

    places = sortByRating(places);

    return NextResponse.json({ places, matchedKeyword });
  } catch (e) {
    console.error("Places API error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to search for places" },
      { status: 500 }
    );
  }
}
