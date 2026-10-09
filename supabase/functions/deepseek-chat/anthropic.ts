// Adaptador Anthropic (Claude) para a Edge Function de IA do LinguaFlow.
// Recebe o pedido no formato OpenAI (o que os clientes já enviam) e devolve
// a resposta no mesmo formato, para a extensão e o PWA não mudarem.
// Funções puras e sem dependências de Deno, para serem testadas com Node.

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";

export type ChatMessage = { role: string; content: string };

// Claude exige: "system" separado, primeira mensagem do usuário e papéis
// alternados. Junta mensagens consecutivas do mesmo papel.
export function toAnthropicRequest(
  messages: ChatMessage[],
  opts: { model: string; maxTokens: number; temperature: number; stream: boolean },
) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else turns.push({ role: m.role, content: m.content });
  }
  if (turns.length === 0 || turns[0].role !== "user") {
    turns.unshift({ role: "user", content: "Continue." });
  }
  return {
    model: opts.model,
    max_tokens: opts.maxTokens,
    // A API da Anthropic aceita temperatura de 0 a 1.
    temperature: Math.min(Math.max(opts.temperature, 0), 1),
    stream: opts.stream,
    ...(system ? { system } : {}),
    messages: turns,
  };
}

// Resposta sem streaming -> formato OpenAI (choices[0].message.content).
export function fromAnthropicResponse(data: any, model: string) {
  const text = Array.isArray(data?.content)
    ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
    : "";
  return {
    id: data?.id || "",
    object: "chat.completion",
    model: data?.model || model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: text },
      finish_reason: data?.stop_reason === "max_tokens" ? "length" : "stop",
    }],
    usage: {
      prompt_tokens: data?.usage?.input_tokens ?? 0,
      completion_tokens: data?.usage?.output_tokens ?? 0,
    },
  };
}

// SSE da Anthropic -> SSE no formato OpenAI (choices[0].delta.content),
// que utils/ai-stream.js já sabe ler.
export function anthropicSseToOpenAi(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  const emit = (controller: TransformStreamDefaultController<Uint8Array>, line: string) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    try {
      const event = JSON.parse(t.slice(5).trim());
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        const chunk = { choices: [{ index: 0, delta: { content: event.delta.text } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      } else if (event.type === "message_stop") {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }
    } catch { /* linha parcial ou ping */ }
  };
  return upstream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) emit(controller, line);
    },
    flush(controller) {
      if (buf) emit(controller, buf);
    },
  }));
}
