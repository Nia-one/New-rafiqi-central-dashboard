import { NextRequest, NextResponse } from "next/server"
import { actorFromRequest } from "@/lib/access-control"
import { selfDrivePlatformEnabled } from "@/lib/operating-loop/feature-flags"

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      text?: { text?: string }
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
    }
  }>
}

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  name?: string
}

export async function GET(request: NextRequest) {
  const actor = await actorFromRequest(request)
  if (!actor) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (process.env.RAFIQI_SELF_DRIVE_PLATFORM?.trim().toLowerCase() !== "true" || !selfDrivePlatformEnabled()) return NextResponse.json({ error: "Self Drive platform is disabled." }, { status: 404 })

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim() ?? ""
  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() ?? ""
  const googleKey = process.env.GOOGLE_MAPS_API_KEY

  if (placeId && googleKey) {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`, {
      headers: {
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
      },
      cache: "no-store",
    })
    if (!response.ok) return NextResponse.json({ error: "Place details are unavailable." }, { status: response.status })
    const place = await response.json() as { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }
    return NextResponse.json({
      id: place.id ?? placeId,
      name: place.displayName?.text ?? place.formattedAddress ?? "Selected location",
      address: place.formattedAddress ?? "",
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      provider: "google",
    })
  }

  if (query.length < 3) return NextResponse.json({ suggestions: [] })

  if (googleKey) {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey },
      body: JSON.stringify({
        input: query,
        sessionToken,
        includedRegionCodes: ["in"],
        locationBias: { circle: { center: { latitude: 12.95, longitude: 79.34 }, radius: 100_000 } },
      }),
      cache: "no-store",
    })
    if (response.ok) {
      const payload = await response.json() as GoogleAutocompleteResponse
      const suggestions = (payload.suggestions ?? []).flatMap(item => {
        const prediction = item.placePrediction
        if (!prediction?.placeId) return []
        return [{
          id: prediction.placeId,
          name: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "Place",
          address: prediction.structuredFormat?.secondaryText?.text ?? prediction.text?.text ?? "",
          provider: "google",
        }]
      }).slice(0, 5)
      return NextResponse.json({ suggestions })
    }
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/search")
  endpoint.searchParams.set("format", "jsonv2")
  endpoint.searchParams.set("limit", "5")
  endpoint.searchParams.set("countrycodes", "in")
  endpoint.searchParams.set("q", query)
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "RafiQi-Operations-Control-Center/1.0 (ops@nia.one)", "Accept-Language": "en" },
    cache: "no-store",
  })
  if (!response.ok) return NextResponse.json({ suggestions: [], error: "Location search is unavailable." }, { status: 502 })
  const results = await response.json() as NominatimResult[]
  return NextResponse.json({
    suggestions: results.map(result => ({
      id: String(result.place_id),
      name: result.name ?? result.display_name.split(",")[0],
      address: result.display_name,
      lat: Number(result.lat),
      lng: Number(result.lon),
      provider: "openstreetmap",
    })),
  })
}
