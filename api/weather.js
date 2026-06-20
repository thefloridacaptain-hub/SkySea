export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENWEATHER_API_KEY environment variable is not set in Vercel.' });
  }

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat or lon query parameters.' });

  try {
    const [curRes, foreRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&cnt=4&units=metric&appid=${apiKey}`)
    ]);

    if (!curRes.ok) {
      const err = await curRes.json().catch(() => ({}));
      return res.status(curRes.status).json({ error: `OpenWeatherMap error: ${err.message || curRes.status}` });
    }

    const cur  = await curRes.json();
    const fore = await foreRes.json();

    const windKts  = ((cur.wind?.speed || 0) * 1.944).toFixed(1);
    const windDir  = cur.wind?.deg || 0;
    const visKm    = ((cur.visibility || 0) / 1000).toFixed(1);
    const cond     = cur.weather?.[0]?.description || 'unknown';
    const temp     = cur.main?.temp?.toFixed(1) || 'â€”';
    const pressure = cur.main?.pressure || 'â€”';
    const humid    = cur.main?.humidity || 'â€”';
    const rainNow  = cur.rain?.['1h'] || 0;

    let foreStr = 'unavailable';
    if (fore.list && fore.list.length > 0) {
      foreStr = fore.list.map(f => {
        const t   = new Date(f.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const wKt = ((f.wind?.speed || 0) * 1.944).toFixed(0);
        return `${t}: ${f.weather?.[0]?.description || 'unknown'}, wind ${wKt} kts, ${f.main?.temp?.toFixed(0) || 'â€”'}Â°C`;
      }).join(' | ');
    }

    const summary = `CURRENT CONDITIONS (${parseFloat(lat).toFixed(3)}, ${parseFloat(lon).toFixed(3)}):
- Wind: ${windKts} knots from ${windDir}Â°
- Visibility: ${visKm} km
- Conditions: ${cond}
- Temperature: ${temp}Â°C
- Pressure: ${pressure} hPa
- Humidity: ${humid}%
- Rainfall last hour: ${rainNow} mm

4-HOUR FORECAST: ${foreStr}`;

    return res.status(200).json({
      summary,
      raw: {
        windKts,
        visKm,
        condition: cur.weather?.[0]?.main || '',
        description: cond
      }
    });

  } catch (err) {
    console.error('weather error:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
