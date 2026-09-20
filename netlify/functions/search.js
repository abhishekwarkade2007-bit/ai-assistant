const { bodyOf, cleanText, json } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST is required.' });
  const request = bodyOf(event);
  const query = String(request?.query || '').trim();
  if (!query) return json(400, { error: 'Enter a search query.' });
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'MultiUseAssistant/1.0' } });
    const html = await response.text();
    const results = [...html.matchAll(/<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .slice(0, 6)
      .map((match) => ({ url: match[1], title: cleanText(match[2], 180) }));
    return json(200, { results });
  } catch (error) {
    return json(502, { error: `Search failed: ${error.message}` });
  }
};
