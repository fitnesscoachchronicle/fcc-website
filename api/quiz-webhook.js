import crypto from 'crypto';

const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/7SAACxzSKnpblPNlayky/webhook-trigger/96766bc8-e57a-4558-bb78-04026ba51742';
const META_PIXEL_ID = '1774984310117031';
const META_API_VERSION = 'v21.0';

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function getCookie(cookieHeader, name) {
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
}

function eventNameFor(payload) {
    const tags = payload.tags || [];
    return tags.includes('contact-form') ? 'Contact' : 'Lead';
}

// Fire a server-side Meta Conversions API event alongside the GHL lead webhook.
// Non-fatal by design — a CAPI failure must never block lead delivery to GHL.
async function sendMetaCapiEvent(req, payload) {
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    if (!accessToken) return;

    const userData = {};
    if (payload.email) userData.em = [sha256(payload.email.trim().toLowerCase())];
    if (payload.phone) {
        let digits = payload.phone.replace(/\D/g, '');
        if (digits.startsWith('0')) digits = '44' + digits.slice(1);
        userData.ph = [sha256(digits)];
    }
    if (payload.firstName) userData.fn = [sha256(payload.firstName.trim().toLowerCase())];
    if (payload.lastName) userData.ln = [sha256(payload.lastName.trim().toLowerCase())];

    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) userData.client_ip_address = forwardedFor.split(',')[0].trim();
    if (req.headers['user-agent']) userData.client_user_agent = req.headers['user-agent'];

    const fbp = getCookie(req.headers.cookie, '_fbp');
    const fbc = getCookie(req.headers.cookie, '_fbc');
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const event = {
        event_name: eventNameFor(payload),
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: req.headers.referer || 'https://fitnesscoachchronicle.com',
        user_data: userData
    };

    const body = { data: [event], access_token: accessToken };
    // Set META_CAPI_TEST_EVENT_CODE in Vercel temporarily to make events show up
    // under Events Manager > Test Events; remove it once verified.
    const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;
    if (testEventCode) body.test_event_code = testEventCode;

    try {
        const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            console.error('Meta CAPI event rejected:', res.status, await res.text());
        }
    } catch (err) {
        // Non-fatal by design — logged only, never blocks GHL delivery.
        console.error('Meta CAPI event failed:', err.message);
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const [ghlResponse] = await Promise.all([
            fetch(GHL_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            }),
            sendMetaCapiEvent(req, req.body || {})
        ]);
        return res.status(200).json({ ok: true, status: ghlResponse.status });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
