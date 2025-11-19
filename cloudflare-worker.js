// Cloudflare Worker entry point for the L'Oréal Routine Builder
// This worker proxies requests to OpenAI's API using the Messages format.
// Store your OpenAI API key as a secret named OPENAI_API_KEY via `wrangler secret put OPENAI_API_KEY`.

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Request body must be valid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Include a messages array in the request body",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const enableWebSearch = Boolean(payload.webSearch);

    const apiBody = {
      model: enableWebSearch ? "gpt-4o-mini" : "gpt-4o",
      messages,
      temperature: 0.8,
      top_p: 1,
      // When web search is enabled, request the `web_search` tool.
      // Remove the tools block if you do not plan to use search.
      ...(enableWebSearch
        ? {
            tools: [
              {
                type: "web_search",
                web_search: {
                  max_results: 3,
                },
              },
            ],
          }
        : {}),
    };

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(apiBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            error: "OpenAI request failed",
            details: errorText,
          }),
          {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Unable to reach OpenAI",
          details: String(error),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
