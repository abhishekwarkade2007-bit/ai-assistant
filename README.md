# Multi-use AI Assistant

A local browser app for chat, web search, and opening pages for context.

## Run

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Add your provider key to `.env`:

	```env
	GEMINI_API_KEY=your_gemini_key_here
	```

	The app opens in Gemini mode by default. You can also add `OPENAI_API_KEY` and switch providers from the header.
4. Run `npm start`.
5. Open http://localhost:3000.

API keys stay on the server and are never sent to the browser. Search uses DuckDuckGo HTML results; direct page fetching may be limited by sites that block automated requests.

## Publish for everyone with Render

1. Put this project in a GitHub repository.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render will use `render.yaml` to create the web service.
4. In the service environment settings, add `GEMINI_API_KEY` with your real key.
5. Deploy and share the generated `https://...onrender.com` URL.

The service includes a `/health` endpoint and limits each IP to 20 chat, 60 search, and 30 page requests per hour. Never commit `.env` or put an API key in frontend files.

## Publish with Netlify

1. Push the project to GitHub, including `netlify.toml` and the `netlify/functions` folder.
2. In Netlify, choose **Add new project > Import an existing project**.
3. Select the GitHub repository and deploy. The build settings are already in `netlify.toml`.
4. In **Site configuration > Environment variables**, add `GEMINI_API_KEY`.
5. Redeploy, then share the generated HTTPS site URL.

Netlify serves the frontend from `public` and runs the API through Netlify Functions. Never upload `.env` or an API key to GitHub.
