// supabase/functions/tts/edge_tts.ts
// Síntese de voz neural da Microsoft (Edge TTS) via WebSocket.
// Handshake feito à mão sobre TLS: a Microsoft recusa (403) conexões sem o
// User-Agent do Edge, e o npm:ws no Edge Runtime hospedado não o repassa.
// Sem chave de API ou custo, gerando MP3 a 24kHz com vozes neurais de alta fidelidade.

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

const WS_HOST = "speech.platform.bing.com";
const WS_PATH = "/consumer/speech/synthesize/readaloud/edge/v1";

function buildMessages(text: string, lang: string, voice: string): string[] {
  const config =
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
  const reqId = crypto.randomUUID().replaceAll("-", "");
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${escapeSsml(lang)}'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeSsml(text)}</prosody></voice></speak>`;
  const ssmlMsg =
    `X-RequestId:${reqId}\r\n` +
    "Content-Type:application/ssml+xml\r\n" +
    `X-Timestamp:${new Date().toUTCString()}Z\r\n` +
    "Path:ssml\r\n\r\n" +
    ssml;
  return [config, ssmlMsg];
}

// Frame cliente (RFC 6455 §5.2): FIN + opcode, payload mascarado.
export function encodeClientFrame(opcode: number, payload: Uint8Array): Uint8Array {
  const len = payload.length;
  const headerLen = len < 126 ? 2 : len < 65536 ? 4 : 10;
  const frame = new Uint8Array(headerLen + 4 + len);
  frame[0] = 0x80 | opcode;
  if (len < 126) {
    frame[1] = 0x80 | len;
  } else if (len < 65536) {
    frame[1] = 0x80 | 126;
    new DataView(frame.buffer).setUint16(2, len);
  } else {
    frame[1] = 0x80 | 127;
    new DataView(frame.buffer).setBigUint64(2, BigInt(len));
  }
  const mask = crypto.getRandomValues(new Uint8Array(4));
  frame.set(mask, headerLen);
  for (let i = 0; i < len; i++) frame[headerLen + 4 + i] = payload[i] ^ mask[i % 4];
  return frame;
}

type ServerFrame = { fin: boolean; opcode: number; payload: Uint8Array };

// Lê frames completos do servidor a partir do buffer acumulado; o resto
// (frame ainda incompleto) volta para a próxima leitura.
export function decodeServerFrames(buf: Uint8Array): { frames: ServerFrame[]; rest: Uint8Array } {
  const frames: ServerFrame[] = [];
  let off = 0;
  while (buf.length - off >= 2) {
    const b0 = buf[off];
    const b1 = buf[off + 1];
    let len = b1 & 0x7f;
    let hdr = 2;
    if (len === 126) {
      if (buf.length - off < 4) break;
      len = (buf[off + 2] << 8) | buf[off + 3];
      hdr = 4;
    } else if (len === 127) {
      if (buf.length - off < 10) break;
      len = Number(new DataView(buf.buffer, buf.byteOffset + off + 2, 8).getBigUint64(0));
      hdr = 10;
    }
    const maskLen = (b1 & 0x80) !== 0 ? 4 : 0;
    if (buf.length - off < hdr + maskLen + len) break;
    let payload = buf.slice(off + hdr + maskLen, off + hdr + maskLen + len);
    if (maskLen) {
      const mask = buf.slice(off + hdr, off + hdr + 4);
      payload = payload.map((v, i) => v ^ mask[i % 4]);
    }
    frames.push({ fin: (b0 & 0x80) !== 0, opcode: b0 & 0x0f, payload });
    off += hdr + maskLen + len;
  }
  return { frames, rest: buf.slice(off) };
}

// Mensagem binária do protocolo: 2 bytes com o tamanho do cabeçalho textual,
// o cabeçalho ("Path:audio"), depois o trecho de MP3.
export function extractAudio(message: Uint8Array): Uint8Array | null {
  if (message.length < 2) return null;
  const headerLen = (message[0] << 8) | message[1];
  const header = new TextDecoder().decode(message.subarray(2, 2 + headerLen));
  if (!header.includes("Path:audio")) return null;
  const audio = message.subarray(2 + headerLen);
  return audio.length > 0 ? audio : null;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function indexOfCrlfCrlf(buf: Uint8Array): number {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

async function writeAll(conn: Deno.TlsConn, data: Uint8Array): Promise<void> {
  let off = 0;
  while (off < data.length) off += await conn.write(data.subarray(off));
}

export async function synthesizeEdgeTTS(
  text: string,
  lang: string,
  timeoutMs = 12000,
): Promise<Uint8Array> {
  const voice = getVoiceForLang(lang);
  const secMsGec = await generateSecMsGec();
  const connectionId = crypto.randomUUID().replaceAll("-", "");
  const query = `TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));

  const request =
    `GET ${WS_PATH}?${query} HTTP/1.1\r\n` +
    `Host: ${WS_HOST}\r\n` +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Key: ${key}\r\n` +
    "Sec-WebSocket-Version: 13\r\n" +
    `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0\r\n` +
    "Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold\r\n" +
    "Pragma: no-cache\r\n" +
    "Cache-Control: no-cache\r\n" +
    "Accept-Language: en-US,en;q=0.9\r\n" +
    `Cookie: muid=${generateMuid()};\r\n` +
    "\r\n";

  let timedOut = false;
  const conn = await Deno.connectTls({ hostname: WS_HOST, port: 443 });
  const timer = setTimeout(() => {
    timedOut = true;
    try { conn.close(); } catch { /* já fechado */ }
  }, timeoutMs);
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const chunk = new Uint8Array(16384);
  const audioChunks: Uint8Array[] = [];

  try {
    await writeAll(conn, enc.encode(request));

    // 1. Resposta do handshake
    let buf = new Uint8Array(0);
    let headerEnd = -1;
    while (headerEnd < 0) {
      const n = await conn.read(chunk);
      if (n === null) throw new Error("Edge TTS fechou durante o handshake");
      buf = concat(buf, chunk.subarray(0, n));
      headerEnd = indexOfCrlfCrlf(buf);
    }
    const statusLine = dec.decode(buf.subarray(0, buf.indexOf(13)));
    const status = Number(statusLine.split(" ")[1]);
    if (status !== 101) throw new Error(`Edge TTS handshake ${status || "?"}`);
    buf = buf.slice(headerEnd + 4);

    // 2. Pedido de síntese
    for (const msg of buildMessages(text, lang, voice)) {
      await writeAll(conn, encodeClientFrame(0x1, enc.encode(msg)));
    }

    // 3. Frames até turn.end
    let partial = new Uint8Array(0);
    let partialOpcode = 0;
    for (;;) {
      const { frames, rest } = decodeServerFrames(buf);
      buf = rest;
      for (const f of frames) {
        if (f.opcode === 0x8) throw new Error("Edge TTS fechou antes do fim");
        if (f.opcode === 0x9) {
          await writeAll(conn, encodeClientFrame(0xA, f.payload));
          continue;
        }
        if (f.opcode === 0x1 || f.opcode === 0x2) {
          partial = f.payload;
          partialOpcode = f.opcode;
        } else if (f.opcode === 0x0) {
          partial = concat(partial, f.payload);
        } else {
          continue;
        }
        if (!f.fin) continue;
        if (partialOpcode === 0x2) {
          const audio = extractAudio(partial);
          if (audio) audioChunks.push(audio.slice());
        } else if (dec.decode(partial).includes("Path:turn.end")) {
          if (audioChunks.length === 0) throw new Error("Nenhum segmento de áudio retornado pelo Edge TTS");
          const total = audioChunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const c of audioChunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          return merged;
        }
      }
      const n = await conn.read(chunk);
      if (n === null) throw new Error("Edge TTS fechou antes do fim");
      buf = concat(buf, chunk.subarray(0, n));
    }
  } catch (err) {
    if (timedOut) throw new Error("Edge TTS timeout excedido");
    throw err;
  } finally {
    clearTimeout(timer);
    try { conn.close(); } catch { /* já fechado */ }
  }
}
