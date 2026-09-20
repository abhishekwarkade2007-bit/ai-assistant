const { bodyOf, cleanText, json } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST is required.' });
  const request = bodyOf(event);
  const url = String(request?.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return json(400, { error: 'Use a full http or https URL.' });
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'MultiUseAssistant/1.0' } });
    if (!response.ok) throw new Error(`Page returned ${response.status}.`);
    return json(200, { url, text: cleanText(await response.text()) });
  } catch (error) {
    return json(502, { error: `Could not open page: ${error.message}` });
  }
};
