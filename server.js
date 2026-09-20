const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const openAiUrl = 'https://api.openai.com/v1/chat/completions';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const requestWindows = new Map();
const limits = { chat: 20, search: 60, browse: 30 };

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requestLimit(route) {
  return (req, res, next) => {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const key = `${route}:${req.ip}`;
    const entry = requestWindows.get(key) || { count: 0, startedAt: now };
    if (now - entry.startedAt >= windowMs) {
      entry.count = 0;
      entry.startedAt = now;
    }
    entry.count += 1;
    requestWindows.set(key, entry);
    if (entry.count > limits[route]) {
      return res.status(429).json({ error: `Too many ${route} requests. Please try again later.` });
    }
    next();
  };
}

function cleanText(value, maxLength = 12000) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function getProvider(requestedProvider) {
  return requestedProvider === 'gemini' ? 'gemini' : 'openai';
}

function requireApiKey(res, provider) {
  const keyName = provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  if (!process.env[keyName]) {
    res.status(503).json({ error: `Add ${keyName} to ai-assistant/.env before using ${provider} mode.` });
    return false;
  }
  return true;
}

async function askOpenAi(messages) {
  const response = await fetch(openAiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4 })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'The AI provider returned an error.');
  return data.choices?.[0]?.message?.content || 'No response was returned.';
}

async function askGemini(messages) {
  const systemInstruction = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const input = messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n\n');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      model: geminiModel,
      input,
      system_instruction: systemInstruction,
      generation_config: { temperature: 0.4 },
      store: false
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Gemini returned an error.');
  if (data.output_text) return data.output_text;
  const textParts = (data.steps || [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((content) => content.type === 'text')
    .map((content) => content.text || '');
  return textParts.join('') || 'No response was returned.';
}

app.post('/api/search', requestLimit('search'), async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Enter a search query.' });

  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'MultiUseAssistant/1.0' }
    });
    const html = await response.text();
    const results = [...html.matchAll(/<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .slice(0, 6)
      .map((match) => ({ url: match[1], title: cleanText(match[2], 180) }));
    res.json({ results });
  } catch (error) {
    res.status(502).json({ error: `Search failed: ${error.message}` });
  }
});

app.post('/api/browse', requestLimit('browse'), async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Use a full http or https URL.' });

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'MultiUseAssistant/1.0' } });
    if (!response.ok) throw new Error(`Page returned ${response.status}.`);
    const html = await response.text();
    res.json({ url, text: cleanText(html) });
  } catch (error) {
    res.status(502).json({ error: `Could not open page: ${error.message}` });
  }
});

app.post('/api/chat', requestLimit('chat'), async (req, res) => {
  const { messages, pageContext, searchContext, provider: requestedProvider } = req.body || {};
  const provider = getProvider(requestedProvider);
  if (!requireApiKey(res, provider)) return;
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'A message is required.' });

  const context = [
    pageContext ? `PAGE CONTENT:\n${String(pageContext).slice(0, 10000)}` : '',
    searchContext ? `SEARCH RESULTS:\n${String(searchContext).slice(0, 6000)}` : ''
  ].filter(Boolean).join('\n\n');

  try {
    const modelMessages = [
      { role: 'system', content: 'You are a practical multi-purpose assistant. Be concise, accurate, and say when information is uncertain. When web context is provided, use it and mention relevant source URLs from the context.' },
      ...(context ? [{ role: 'system', content: context }] : []),
      ...messages.slice(-12).map((message) => ({ role: message.role, content: String(message.content).slice(0, 12000) }))
    ];
    const answer = provider === 'gemini' ? await askGemini(modelMessages) : await askOpenAi(modelMessages);
    res.json({ answer });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Assistant running at http://localhost:${port}`));
