export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-id, x-github-token, x-openai-key, x-anthropic-key, x-google-key, x-xai-key, x-deepseek-key, x-groq-key, x-agentrouter-key, x-openrouter-key, x-openai-base-url, x-lovable-token, x-session-token",
  "Content-Type": "application/json; charset=utf-8",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}
