import API from "../lib/api";

export interface CreateStreamResponse {
  id: string;
  slug: string;
  created_at: string;
  shareUrl: string;
}

export interface StreamStatusResponse {
  id: string;
  slug: string;
  title: string;
  is_live: boolean;
  viewers_count: number;
  created_at: string;
  ended_at: string | null;
}

const getWsBaseUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const apiBase = API.defaults.baseURL || "http://localhost:3333";
  return apiBase.replace(/^http(s?):\/\//i, "ws$1://");
};

export const streamService = {
  createStream: async (): Promise<CreateStreamResponse> => {
    const { data } = await API.post<CreateStreamResponse>("/api/streams");
    return data;
  },

  getStreamBySlug: async (slug: string): Promise<StreamStatusResponse> => {
    const { data } = await API.get<StreamStatusResponse>(`/api/streams/${slug}`);
    return data;
  },

  getSignalingWsUrl: (slug: string, role: "broadcaster" | "viewer"): string => {
    return `${getWsBaseUrl()}/ws/${slug}?role=${role}`;
  },

  getIceServers: (): RTCConfiguration => {
    const stunUrl = import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302";
    return {
      iceServers: [{ urls: stunUrl }],
    };
  },
};