const RECALL_API_BASE = "https://us-east-1.recall.ai/api/v1";

interface RecallBotCreateParams {
  meetingUrl: string;
  botName?: string;
}

interface RecallBotResponse {
  id: string;
  meeting_url: string;
  bot_name: string;
  status: {
    code: string;
    message: string | null;
    created_at: string;
  };
  video_url: string | null;
  recording: string | null;
  created_at: string;
}

interface RecallTranscriptSegment {
  speaker: string;
  speaker_id: number;
  words: Array<{
    text: string;
    start_time: number;
    end_time: number;
  }>;
}

interface _RecallRecordingMedia {
  url: string;
  expires_at: string;
}

function getApiKey(): string {
  const key = process.env.RECALL_API_KEY;
  if (!key) {
    throw new Error("RECALL_API_KEY environment variable is not set");
  }
  return key;
}

async function recallFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = getApiKey();
  const url = `${RECALL_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return response;
}

export async function createRecallBot(params: RecallBotCreateParams): Promise<RecallBotResponse> {
  const response = await recallFetch("/bot/", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: params.meetingUrl,
      bot_name: params.botName || "FinAdvisor Notetaker",
      transcription_options: { provider: "default" },
      recording_mode: "speaker_view",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recall.ai createBot failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getRecallBotStatus(botId: string): Promise<RecallBotResponse> {
  const response = await recallFetch(`/bot/${botId}/`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recall.ai getBotStatus failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getRecallBotTranscript(botId: string): Promise<RecallTranscriptSegment[]> {
  const response = await recallFetch(`/bot/${botId}/transcript/`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recall.ai getTranscript failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getRecallRecordingUrl(botId: string): Promise<string | null> {
  const bot = await getRecallBotStatus(botId);
  return bot.video_url || null;
}

export function mapRecallStatusToRecordingStatus(recallStatusCode: string): string {
  const statusMap: Record<string, string> = {
    ready: "pending",
    joining_call: "joining",
    in_waiting_room: "joining",
    in_call_not_recording: "joining",
    in_call_recording: "recording",
    call_ended: "processing",
    done: "done",
    fatal: "error",
    analysis_done: "done",
  };
  return statusMap[recallStatusCode] || "pending";
}

export function formatRecallTranscript(segments: RecallTranscriptSegment[]): {
  structured: Array<{ speaker: string; start: number; end: number; text: string }>;
  fullText: string;
} {
  const structured = segments.map((seg) => {
    const words = seg.words || [];
    const text = words.map((w) => w.text).join(" ");
    const start = words.length > 0 ? words[0].start_time : 0;
    const end = words.length > 0 ? words[words.length - 1].end_time : 0;
    return {
      speaker: seg.speaker || `Speaker ${seg.speaker_id}`,
      start,
      end,
      text,
    };
  });

  const fullText = structured
    .map((s) => `${s.speaker}: ${s.text}`)
    .join("\n");

  return { structured, fullText };
}
