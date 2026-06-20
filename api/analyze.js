export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS headers so browser can reach this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Check API key is present
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set in Vercel.' });
  }

  const { imageBase64, mimeType, weatherData } = req.body;

  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64 in request body.' });
  if (!weatherData) return res.status(400).json({ error: 'Missing weatherData in request body.' });

  const prompt = `You are a marine weather assistant. The user has uploaded a photo taken from their boat. Analyze the sky, clouds, horizon visibility, and light conditions visible in the photo. Also consider this current weather data for their location:

${weatherData}

Return a concise boater weather briefing with:
(1) What the sky currently indicates â€” be specific about cloud types, color, coverage, and what they mean for a mariner
(2) Conditions for the next 2â€“4 hours based on the forecast data
(3) A simple GO / PROCEED WITH CAUTION / STAY IN flag â€” respond with exactly one of these three options on its own line starting with "STATUS:"

Always end with: "This is an AI situational awareness tool. Always verify with NOAA marine forecasts and VHF weather radio before departing."`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/jpeg',
                data: imageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errMsg = `Anthropic API returned status ${response.status}`;
      try {
        const errJson = JSON.parse(responseText);
        errMsg = errJson.error?.message || errMsg;
      } catch {}
      return res.status(response.status).json({ error: errMsg });
    }

    const data = JSON.parse(responseText);
    const text = data.content?.map(c => c.text || '').join('\n').trim();

    if (!text) return res.status(500).json({ error: 'Claude returned an empty response.' });

    return res.status(200).json({ result: text });

  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
