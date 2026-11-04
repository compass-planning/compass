/**
 * server/openai/client.ts
 *
 * Deprecated — all AI functionality has moved to Anthropic.
 * Audio utilities re-exported from server/audio/utils.ts.
 * This file kept to avoid import errors during transition.
 */
export { detectAudioFormat, convertToWav, ensureCompatibleFormat, speechToText } from "../audio/utils";
export type { AudioFormat } from "../audio/utils";

// Stub export — openai package is no longer a hard dependency
export const openai = null;
