// supabase/functions/tts/edge_tts.ts
// Síntese de voz neural da Microsoft (Edge TTS) via WebSocket.
// Sem chave de API ou custo, gerando MP3 a 24kHz com vozes neurais de alta fidelidade.

import WebSocket from "npm:ws@8.18.0";

export const VOICE_MAP: Record<string, string> = {
  "en-US": "en-US-JennyNeural",
  "en-GB": "en-GB-SoniaNeural",
  "en": "en-US-JennyNeural",
  "pt-BR": "pt-BR-FranciscaNeural",
  "pt-PT": "pt-PT-RaquelNeural",
  "pt": "pt-BR-FranciscaNeural",
  "es-ES": "es-ES-ElviraNeural",
  "es-MX": "es-MX-DaliaNeural",
  "es": "es-ES-ElviraNeural",
  "fr-FR": "fr-FR-DeniseNeural",
  "fr": "fr-FR-DeniseNeural",
  "de-DE": "de-DE-KatjaNeural",
  "de": "de-DE-KatjaNeural",
  "it-IT": "it-IT-ElsaNeural",
  "it": "it-IT-ElsaNeural",
  "ja-JP": "ja-JP-NanamiNeural",
  "ja": "ja-JP-NanamiNeural",
  "ko-KR": "ko-KR-SunHiNeural",
  "ko": "ko-KR-SunHiNeural",
  "zh-CN": "zh-CN-XiaoxiaoNeural",
  "zh": "zh-CN-XiaoxiaoNeural",
  "ru-RU": "ru-RU-SvetlanaNeural",
  "ru": "ru-RU-SvetlanaNeural",
};

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = "143";
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

export async function generateSecMsGec(): Promise<string> {
  let ticks = Math.floor(Date.now() / 1000);
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  const ticksBig = BigInt(ticks) * 10000000n;
  const strToHash = ticksBig.toString() + TRUSTED_CLIENT_TOKEN;
  const msgUint8 = new TextEncoder().encode(strToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function generateMuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function getVoiceForLang(lang: string): string {
  if (!lang) return "en-US-JennyNeural";
  return VOICE_MAP[lang] || VOICE_MAP[lang.split("-")[0]] || "en-US-JennyNeural";
}

export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function synthesizeEdgeTTS(
  text: string,
  lang: string,
  timeoutMs = 12000,
): Promise<Uint8Array> {
  const voice = getVoiceForLang(lang);
  const secMsGec = await generateSecMsGec();
  const muid = generateMuid();
  const connectionId = crypto.randomUUID().replaceAll("-", "");
  const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;

  const headers = {
    "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "Cookie": `muid=${muid};`,
  };

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error("Edge TTS timeout excedido"));
    }, timeoutMs);

    const ws = new WebSocket(wssUrl, { headers });
    const audioChunks: Uint8Array[] = [];

    ws.on("open", () => {
      const configMsg =
        `X-Timestamp:${new Date().toUTCString()}\r\n` +
        "Content-Type:application/json; charset=utf-8\r\n" +
        "Path:speech.config\r\n\r\n" +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        });
      ws.send(configMsg);

      const reqId = crypto.randomUUID().replaceAll("-", "");
      const cleanText = escapeSsml(text);
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${cleanText}</prosody></voice></speak>`;
      const ssmlMsg =
        `X-RequestId:${reqId}\r\n` +
        "Content-Type:application/ssml+xml\r\n" +
        `X-Timestamp:${new Date().toUTCString()}Z\r\n` +
        "Path:ssml\r\n\r\n" +
        ssml;
      ws.send(ssmlMsg);
    });

    ws.on("message", (data: any, isBinary: boolean) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length >= 2) {
          const headerLen = buf.readUInt16BE(0);
          const headerStr = buf.subarray(2, 2 + headerLen).toString("utf-8");
          if (headerStr.includes("Path:audio")) {
            const audioData = buf.subarray(2 + headerLen);
            if (audioData.length > 0) {
              audioChunks.push(new Uint8Array(audioData));
            }
          }
        }
      } else {
        const textStr = data.toString();
        if (textStr.includes("Path:turn.end")) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          try { ws.close(); } catch { /* ignore */ }
          if (audioChunks.length === 0) {
            reject(new Error("Nenhum segmento de áudio retornado pelo Edge TTS"));
            return;
          }
          const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of audioChunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(merged);
        }
      }
    });

    ws.on("error", (err: any) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}
