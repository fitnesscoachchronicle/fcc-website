// Live Google reviews for The Fitness Coach Chronicle.
//
// Reads the business's Google reviews through the Places API (New) and returns a
// trimmed, display-safe JSON payload for the carousel in js/google-reviews.js.
//
// Required Vercel env var:
//   GOOGLE_PLACES_API_KEY   key with "Places API (New)" enabled
// Optional:
//   GOOGLE_PLACE_ID         overrides DEFAULT_PLACE_ID below
//
// Without a key this returns { source: 'unconfigured' } and the page simply keeps
// the real reviews that are already in the HTML, so nothing breaks.
//
// Notes:
//  - Places API returns at most 5 reviews (Google's "most relevant" selection).
//  - No star-rating filter is applied: whatever Google returns is shown.
//  - Responses are cached at the edge so Google is called a few times a day,
//    not once per page view.

const DEFAULT_PLACE_ID = 'ChIJqTMH_Ze5h0gRKfjJfPbycuo';
const GOOGLE_URL = /^https:\/\/(www\.|maps\.)?google\.com\//;

const safeUrl = (u) => (typeof u === 'string' && GOOGLE_URL.test(u) ? u : null);

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = (process.env.GOOGLE_PLACE_ID || DEFAULT_PLACE_ID).trim();

    if (!apiKey) {
        res.setHeader('Cache-Control', 'public, s-maxage=300');
        return res.status(200).json({ source: 'unconfigured', reviews: [] });
    }

    try {
        const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en-GB&regionCode=GB`;
        const response = await fetch(url, {
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,googleMapsUri,reviews'
            }
        });

        if (!response.ok) {
            console.error('Google Places reviews request failed:', response.status, await response.text());
            res.setHeader('Cache-Control', 'public, s-maxage=300');
            return res.status(200).json({ source: 'error', reviews: [] });
        }

        const place = await response.json();

        const reviews = (place.reviews || [])
            .map((r) => ({
                author: String(r.authorAttribution?.displayName || 'Google user').slice(0, 80),
                authorUrl: safeUrl(r.authorAttribution?.uri),
                rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))),
                // Prefer the reviewer's original wording over any translation.
                text: String(r.originalText?.text || r.text?.text || '').trim().slice(0, 2000),
                publishedAt: r.publishTime || null
            }))
            .filter((r) => r.text && r.rating >= 1);

        res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
        return res.status(200).json({
            source: 'google',
            name: place.displayName?.text || 'The Fitness Coach Chronicle',
            rating: typeof place.rating === 'number' ? place.rating : null,
            count: typeof place.userRatingCount === 'number' ? place.userRatingCount : reviews.length,
            url: safeUrl(place.googleMapsUri) || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            reviews
        });
    } catch (err) {
        console.error('Google Places reviews error:', err.message);
        res.setHeader('Cache-Control', 'public, s-maxage=300');
        return res.status(200).json({ source: 'error', reviews: [] });
    }
}
