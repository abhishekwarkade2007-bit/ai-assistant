const state = { messages: [], pageContext: '', searchContext: '' };
const $ = (selector) => document.querySelector(selector);
const welcome = $('#welcome');
const messagesEl = $('#messages');
const input = $('#messageInput');
const results = $('#results');
const providerSelect = $('#providerSelect');
const functionUrl = (name) => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `/api/${name}`
  : `/.netlify/functions/${name}`;

function setContext(label, value) {
  state.pageContext = value || state.pageContext;
  $('#contextStrip').hidden = false;
  $('#contextStrip').textContent = `${label} is ready as context`;
}

function addMessage(role, content) {
  state.messages.push({ role, content });
  welcome.style.display = 'none';
  messagesEl.classList.add('visible');
  const row = document.createElement('div');
  row.className = `message ${role}`;
  row.innerHTML = `<div class="avatar">${role === 'user' ? 'You' : '✦'}</div><div class="message-body"></div>`;
  row.querySelector('.message-body').textContent = content;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row.querySelector('.message-body');
}

async function sendMessage(content) {
  const text = String(content || '').trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  addMessage('user', text);
  const answerEl = addMessage('assistant', 'Thinking...');
  try {
    const response = await fetch(functionUrl('chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: state.messages, pageContext: state.pageContext, searchContext: state.searchContext, provider: providerSelect.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    answerEl.textContent = data.answer;
    state.messages[state.messages.length - 1].content = data.answer;
  } catch (error) {
    answerEl.textContent = error.message;
    answerEl.parentElement.parentElement.classList.add('error');
    state.messages.pop();
  }
}

$('#chatForm').addEventListener('submit', (event) => { event.preventDefault(); sendMessage(input.value); });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 110)}px`; });
document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => { input.value = button.dataset.prompt; input.focus(); }));
$('#newChat').addEventListener('click', () => { state.messages = []; state.pageContext = ''; state.searchContext = ''; messagesEl.innerHTML = ''; messagesEl.classList.remove('visible'); welcome.style.display = ''; $('#contextStrip').hidden = true; });
$('#clearChat').addEventListener('click', () => $('#newChat').click());

function showLoading(text) { results.innerHTML = `<div class="loading">${text}</div>`; }
$('#searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = $('#searchInput').value.trim();
  if (!query) return;
  showLoading('Searching the web...');
  try {
    const response = await fetch(functionUrl('search'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    state.searchContext = data.results.map((item) => `${item.title} - ${item.url}`).join('\n');
    results.innerHTML = data.results.length ? data.results.map((item) => `<div class="result-card"><a href="${item.url}" target="_blank" rel="noreferrer">${item.title}</a><small>${item.url}</small></div>`).join('') : '<div class="loading">No results found.</div>';
    setContext('Search results', state.searchContext);
  } catch (error) { results.innerHTML = `<div class="loading">${error.message}</div>`; }
});

$('#browseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = $('#urlInput').value.trim();
  showLoading('Opening page...');
  try {
    const response = await fetch(functionUrl('browse'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setContext('Page content', data.text);
    results.innerHTML = `<div class="result-card"><a href="${data.url}" target="_blank" rel="noreferrer">Page loaded</a><small>${data.text.slice(0, 180)}...</small></div>`;
  } catch (error) { results.innerHTML = `<div class="loading">${error.message}</div>`; }
});

document.querySelectorAll('.tool-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tool-tab').forEach((item) => item.classList.remove('active'));
  tab.classList.add('active');
  const isSearch = tab.dataset.tool === 'search';
  $('#searchForm').hidden = !isSearch;
  $('#browseForm').hidden = isSearch;
}));
