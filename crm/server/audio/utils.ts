/**
 * server/audio/utils.ts
 *
 * Audio format detection, conversion, and Whisper transcription.
 * ffmpeg is used only as a fallback for containers Whisper can't read directly.
 */

import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

// Whisper API hard limit per request.
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

// Formats Whisper accepts directly — no transcode needed.
const WHISPER_DIRECT: Record<string, { name: string; type: string }> = {
  wav:  { name: "audio.wav",  type: "audio/wav" },
  mp3:  { name: "audio.mp3",  type: "audio/mpeg" },
  webm: { name: "audio.webm", type: "audio/webm" },
  mp4:  { name: "audio.m4a",  type: "audio/mp4" },
  ogg:  { name: "audio.ogg",  type: "audio/ogg" },
};

export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) return "mp3";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "mp4";
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  return "unknown";
}

export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath  = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath, "-vn", "-f", "wav",
        "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", "-y", outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => { if (code === 0) resolve(); else reject(new Error(`ffmpeg exited with code ${code}`)); });
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

/**
 * Transcribe audio via OpenAI Whisper.
 *
 * Sends compressed formats (m4a/mp4, webm, mp3, ogg, wav) straight to Whisper —
 * this keeps long meetings small. Only genuinely unknown containers are
 * transcoded to wav first (which bloats size, so it's a last resort).
 *
 * Throws if OPENAI_API_KEY is missing or the file exceeds Whisper's 25MB limit.
 */
export async function speechToText(
  audioBuffer: Buffer,
  format?: string
): Promise<string> {
  // ── PIPEDA-compliant path: whisper.cpp runs on-server ─────────────────────
  // Audio is converted to 16kHz mono WAV then passed to whisper.cpp.
  // Nothing leaves the Fly.io container. WHISPER_LOCAL defaults to true.
  if (process.env.WHISPER_LOCAL !== "false") {
    // PIPEDA-compliant: transcribeLocal uses whisper.cpp on-server.
    // Static import at top of file — whisperLocal functions are no-ops if binary absent.
    const wavBuffer = format === "wav" ? audioBuffer : await whisperConvertToWav(audioBuffer);
    return transcribeLocal(wavBuffer);
  }

  // ── Fallback: OpenAI Whisper API ───────────────────────────────────────────
  // Only for local development when whisper-cpp is not installed.
  // MUST NOT be used in production — audio would leave Canadian soil.
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "No transcription engine available. " +
      "Set WHISPER_LOCAL=true (default) or provide OPENAI_API_KEY for local dev."
    );
  }
  logger.warn(
    "Using OpenAI Whisper API — NOT PIPEDA compliant. " +
    "Set WHISPER_LOCAL=true for production."
  );

  let buffer = audioBuffer;
  let detected = (format as AudioFormat) || detectAudioFormat(audioBuffer);
  let meta = WHISPER_DIRECT[detected];

  // Unknown container → transcode to wav so Whisper can read it.
  if (!meta) {
    buffer = await convertToWav(audioBuffer);
    detected = "wav";
    meta = WHISPER_DIRECT.wav;
  }

  if (buffer.length > WHISPER_MAX_BYTES) {
    throw new Error(
      `Audio is ${(buffer.length / 1024 / 1024).toFixed(1)}MB, over Whisper's 25MB limit. ` +
      `Compress the recording (mono, ~64kbps) on the client before uploading.`
    );
  }

  const { default: OpenAI, toFile } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const file = await toFile(buffer, meta.name, { type: meta.type });

  const resp = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en",
    response_format: "text",
  });

  return (typeof resp === "string" ? resp : (resp as any).text || "").trim();
}
