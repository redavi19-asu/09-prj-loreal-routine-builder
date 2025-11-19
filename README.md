# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Cloudflare Worker setup

1. Install Wrangler if you have not already:
   ```bash
   npm install -g wrangler
   ```
2. Log in to Cloudflare and create a new Worker project ("Custom" option).
3. Copy the code in `cloudflare-worker.js` into your Worker entry file (usually `src/index.js`).
4. Add your OpenAI API key as an encrypted secret:
   ```bash
   wrangler secret put OPENAI_API_KEY
   ```
5. Deploy the Worker:
   ```bash
   wrangler deploy
   ```
6. Update `secrets.js` in this project with the deployed Worker URL so the frontend can call it.
