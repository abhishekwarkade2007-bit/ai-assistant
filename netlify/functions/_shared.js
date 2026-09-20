const openAiUrl = 'https://api.openai.com/v1/chat/completions';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(body)
  };
}

function bodyOf(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
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

function requireApiKey(provider) {
  const keyName = provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  return process.env[keyName] ? null : `Add ${keyName} in Netlify environment variables.`;
}

async function askOpenAi(messages) {
  const response = await fetch(openAiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4 })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'The AI provider returned an error.');
  return data.choices?.[0]?.message?.content || 'No response was returned.';
}

async function askGemini(messages) {
  const systemInstruction = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const input = messages.filter((message) => message.role !== 'system').map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`).join('\n\n');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ model: geminiModel, input, system_instruction: systemInstruction, generation_config: { temperature: 0.4 }, store: false })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Gemini returned an error.');
  if (data.output_text) return data.output_text;
  return (data.steps || [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((content) => content.type === 'text')
    .map((content) => content.text || '')
    .join('') || 'No response was returned.';
}

module.exports = { askGemini, askOpenAi, bodyOf, cleanText, getProvider, json, requireApiKey };
