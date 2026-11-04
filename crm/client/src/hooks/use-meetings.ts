import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertMeeting, type MeetingOutput, type MeetingTranscript, type MeetingTask, type MeetingRecordingConsent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export interface TeamsMeeting {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinWebUrl: string;
  participantCount: number;
}

export function useClientMeetings(clientId: number) {
  return useQuery({
    queryKey: [api.meetings.list.path],
    queryFn: async () => {
      const url = buildUrl(api.meetings.list.path, { clientId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch meetings");
      return api.meetings.list.responses[200].parse(await res.json());
    },
    enabled: !!clientId});
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { clientId: number; data: Omit<InsertMeeting, "clientId"> }) => {
      const url = buildUrl(api.meetings.create.path, { clientId });
      const res = await fetch(url, {
        method: api.meetings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create meeting");
      return api.meetings.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path, variables.clientId] });
    },
  });
}

export function useSummarizeMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; clientId: number }) => {
      const url = buildUrl(api.meetings.summarize.path, { id });
      const res = await fetch(url, {
        method: api.meetings.summarize.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to summarize meeting");
      return api.meetings.summarize.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path, variables.clientId] });
    },
  });
}

export function useUploadMeetingAudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, audioBase64 }: { id: number; clientId: number; audioBase64: string }) => {
      const url = buildUrl(api.audio.upload.path, { id });
      const res = await fetch(url, {
        method: api.audio.upload.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioBase64 }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload audio");
      return api.audio.upload.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path, variables.clientId] });
    },
  });
}

export function useTeamsMeetings(enabled: boolean) {
  return useQuery<TeamsMeeting[]>({
    queryKey: ['/api/crm/outlook/teams-meetings'],
    queryFn: async () => {
      const res = await fetch('/api/crm/outlook/teams-meetings', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed to fetch Teams meetings' }));
        throw new Error(body.message || 'Failed to fetch Teams meetings');
      }
      return res.json();
    },
    enabled,
    retry: false,
  });
}

export function useImportTeamsMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamsMeetingId,
      subject,
      startDateTime,
    }: {
      clientId: number;
      teamsMeetingId: string;
      subject: string;
      startDateTime: string;
    }) => {
      const res = await apiRequest('POST', `/api/crm/clients/${clientId}/meetings/import-teams`, {
        teamsMeetingId,
        subject,
        startDateTime,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path, variables.clientId] });
    },
  });
}

export function useSendNotetaker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, meetingUrl, botName }: { meetingId: number; clientId: number; meetingUrl?: string; botName?: string }) => {
      const res = await apiRequest('POST', `/api/crm/meetings/${meetingId}/send-notetaker`, {
        meetingUrl,
        botName,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path, variables.clientId] });
    },
  });
}

export function useMeetingOutputs(meetingId: number, enabled = true) {
  return useQuery<MeetingOutput>({
    queryKey: ['/api/crm/meetings', meetingId, 'outputs'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/meetings/${meetingId}/outputs`, { credentials: 'include' });
      if (!res.ok) throw new Error('No outputs');
      return res.json();
    },
    enabled: enabled && !!meetingId,
    retry: false,
  });
}

export function useMeetingTranscript(meetingId: number, enabled = true) {
  return useQuery<MeetingTranscript>({
    queryKey: ['/api/crm/meetings', meetingId, 'transcript'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/meetings/${meetingId}/transcript`, { credentials: 'include' });
      if (!res.ok) throw new Error('No transcript');
      return res.json();
    },
    enabled: enabled && !!meetingId,
    retry: false,
  });
}

export function useMeetingTasks(meetingId: number, enabled = true) {
  return useQuery<MeetingTask[]>({
    queryKey: ['/api/crm/meetings', meetingId, 'tasks'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/meetings/${meetingId}/tasks`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    enabled: enabled && !!meetingId,
    retry: false,
  });
}

export function useUpdateMeetingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, taskId, status }: { meetingId: number; taskId: number; status: string }) => {
      const res = await apiRequest('PATCH', `/api/crm/meetings/${meetingId}/tasks/${taskId}`, { status });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/meetings', variables.meetingId, 'tasks'] });
    },
  });
}

export function useReviewCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId }: { meetingId: number }) => {
      const res = await apiRequest('POST', `/api/crm/meetings/${meetingId}/outputs/review-compliance`, {});
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/meetings', variables.meetingId, 'outputs'] });
    },
  });
}

export function useMeetingConsent(meetingId: number, enabled = true) {
  return useQuery<MeetingRecordingConsent | null>({
    queryKey: ['/api/crm/meetings', meetingId, 'consent'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/meetings/${meetingId}/consent`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch consent');
      return res.json();
    },
    enabled: enabled && !!meetingId,
    retry: false,
  });
}

export function useRecordConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, consentMethod, notes }: { meetingId: number; consentMethod: string; notes?: string }) => {
      const res = await apiRequest('POST', `/api/crm/meetings/${meetingId}/consent`, { consentMethod, notes });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/meetings', variables.meetingId, 'consent'] });
    },
  });
}
