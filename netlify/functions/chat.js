const { askGemini, askOpenAi, bodyOf, getProvider, json, requireApiKey } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST is required.' });
  const request = bodyOf(event);
  if (!request) return json(400, { error: 'Invalid JSON request.' });
  const { messages, pageContext, searchContext, provider: requestedProvider } = request;
  if (!Array.isArray(messages) || !messages.length) return json(400, { error: 'A message is required.' });

  const provider = getProvider(requestedProvider);
  const keyError = requireApiKey(provider);
  if (keyError) return json(503, { error: keyError });
  const context = [
    pageContext ? `PAGE CONTENT:\n${String(pageContext).slice(0, 10000)}` : '',
    searchContext ? `SEARCH RESULTS:\n${String(searchContext).slice(0, 6000)}` : ''
  ].filter(Boolean).join('\n\n');
  const modelMessages = [
    { role: 'system', content: 'You are a practical multi-purpose assistant. Be concise, accurate, and say when information is uncertain. When web context is provided, mention relevant source URLs.' },
    ...(context ? [{ role: 'system', content: context }] : []),
    ...messages.slice(-12).map((message) => ({ role: message.role, content: String(message.content).slice(0, 12000) }))
  ];

  try {
    const answer = provider === 'gemini' ? await askGemini(modelMessages) : await askOpenAi(modelMessages);
    return json(200, { answer });
  } catch (error) {
    return json(502, { error: error.message });
  }
};
