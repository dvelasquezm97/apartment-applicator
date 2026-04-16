import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '../lib/api.js';

// ---- Types ----

interface StatsResponse {
  applications: { total: number; byStatus: Record<string, number> };
  listings: { total: number };
  documents: { total: number };
  daily: { applicationsToday: number; automationPaused: boolean; resetAt: string | null };
  messages: { unprocessed: number };
}

interface ApplicationListing {
  id: string;
  title: string;
  address: string | null;
  rent: number | null;
  rooms: number | null;
  size: number | null;
  url: string;
}

interface Application {
  id: string;
  status: string;
  retryCount: number;
  timeline: { status: string; timestamp: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
  listing: ApplicationListing | null;
}

interface Document {
  id: string;
  type: string;
  filename: string;
  uploadedAt: string;
}

interface Settings {
  id: string;
  immoscoutEmail: string;
  hasPassword: boolean;
  profile: Record<string, any>;
  automationPaused: boolean;
  dailyApplicationCount: number;
  telegramChatId: number | null;
  searchUrl: string | null;
  onboardingComplete: boolean;
  createdAt: string;
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  receivedAt: string;
  processedAt: string | null;
}

interface ApplyStatus {
  status: 'idle' | 'scraping' | 'applying' | 'paused' | 'done';
  applied: number;
  failed: number;
  skipped: number;
  total: number;
  currentListing: string | null;
  extensionConnected: boolean;
}

// ---- Hooks ----

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: () => apiFetch('/stats'),
    refetchInterval: 30_000,
  });
}

export function useApplications() {
  return useQuery<{ applications: Application[] }>({
    queryKey: ['applications'],
    queryFn: () => apiFetch('/applications'),
    refetchInterval: 15_000,
  });
}

export function useApplication(id: string) {
  return useQuery<Application>({
    queryKey: ['application', id],
    queryFn: () => apiFetch(`/applications/${id}`),
    enabled: !!id,
  });
}

export function useApplicationMessages(id: string) {
  return useQuery<{ messages: Message[] }>({
    queryKey: ['application-messages', id],
    queryFn: () => apiFetch(`/applications/${id}/messages`),
    enabled: !!id,
  });
}

export function useDocuments() {
  return useQuery<{ documents: Document[] }>({
    queryKey: ['documents'],
    queryFn: () => apiFetch('/documents'),
  });
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/settings'),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { immoscoutEmail?: string; immoscoutPassword?: string; automationPaused?: boolean; searchUrl?: string; onboardingComplete?: boolean }) =>
      apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch('/settings/profile', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) =>
      apiUpload('/documents', file, { type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ---- Apply Loop ----

export function useApplyStatus() {
  return useQuery<ApplyStatus>({
    queryKey: ['apply-status'],
    queryFn: () => apiFetch('/apply/status'),
    refetchInterval: 5_000,
  });
}

export function useStartApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message: string }>('/apply/start', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apply-status'] }),
  });
}

export function useStopApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message: string }>('/apply/stop', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apply-status'] }),
  });
}
