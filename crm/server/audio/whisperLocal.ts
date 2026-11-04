/**
 * server/audio/whisperLocal.ts
 *
 * PIPEDA-compliant local transcription using whisper.cpp.
 *
 * Audio is written to /tmp, processed entirely on the Fly.io server,
 * and the temp file is deleted immediately after transcription.
 * No audio is transmitted to any external service.
 *
 * Requires whisper-cpp binary and a model file in the Docker image:
 *   WHISPER_BIN   = whisper-cpp          (default)
 *   WHISPER_MODEL = /app/models/ggml-base.en.bin  (default)
 *
 * See Dockerfile for how to install whisper-cpp and download the model.
 */

import { spawn }                        from "child_process";
import { writeFile, unlink, readFile }  from "fs/promises";
import { randomUUID }                   from "crypto";
import { tmpdir }                       from "os";
import { join }                         from "path";
import { logger }                       from "../logger";

const WHISPER_BIN   = process.env.WHISPER_BIN   ?? "whisper-cpp";
const WHISPER_MODEL = process.env.WHISPER_MODEL  ?? "/app/models/ggml-base.en.bin";

// Timeout: 10 minutes max for a very long meeting
const TIMEOUT_MS = 10 * 60 * 1000;

export async function transcribeLocal(wavBuffer: Buffer): Promise<string> {
  const id      = randomUUID();
  const inPath  = join(tmpdir(), `compass-crm-meet-${id}.wav`);
  const outBase = join(tmpdir(), `compass-crm-meet-${id}`);
  const outTxt  = `${outBase}.txt`;

  logger.info({ bytes: wavBuffer.length }, "[whisper] Starting local transcription");
  const start = Date.now();

  try {
    await writeFile(inPath, wavBuffer);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => { proc.kill(); reject(new Error("Transcription timed out after 10 minutes")); },
        TIMEOUT_MS
      );

      const proc = spawn(WHISPER_BIN, [
        "--model",        WHISPER_MODEL,
        "--language",     "en",
        "--output-txt",
        "--output-file",  outBase,
        "--no-timestamps",
        "--threads",      "2",         // conservative — shared CPU
        "--file",         inPath,
      ]);

      // whisper.cpp writes progress to stderr — log at debug level only
      proc.stderr.on("data", (chunk: Buffer) => {
        logger.debug({ source: "whisper" }, chunk.toString().trim());
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`whisper-cpp exited with code ${code}`));
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(
          err.message.includes("ENOENT")
            ? `whisper-cpp binary not found at '${WHISPER_BIN}'. ` +
              "Ensure whisper-cpp is installed in the Docker image."
            : err.message
        ));
      });
    });

    const transcript = await readFile(outTxt, "utf-8");
    const ms = Date.now() - start;
    const words = transcript.split(/\s+/).filter(Boolean).length;
    logger.info({ ms, words }, "[whisper] Transcription complete");

    return transcript.trim();

  } finally {
    // Always clean up temp files — audio must not persist on disk
    await Promise.all([
      unlink(inPath).catch(() => {}),
      unlink(outTxt).catch(() => {}),
    ]);
  }
}

/**
 * Passthrough shim — WAV conversion is handled by utils.ts before calling transcribeLocal.
 * Exported here so utils.ts can import both functions from the same module.
 */
export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  // WAV conversion happens in utils.ts via ffmpeg before this function is called.
  // If audio is already WAV format, this is a no-op.
  return audioBuffer;
}
