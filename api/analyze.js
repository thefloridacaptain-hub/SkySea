export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType, weatherData } = req.body;

  if (!imageBase64 || !weatherData) {
    return res.status(400).json({ error: 'Missing imageBase64 or weatherData' });
  }

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
        'x-api-key': process.env.ANTHROPIC_API_KEY,
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

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('\n').trim();
    return res.status(200).json({ result: text });

  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
