import client from './client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  session_id: string
}

export interface SessionInfo {
  session_id: string
  last_active: number
}

export const agentApi = {
  chat: (message: string, session_id?: string) =>
    client.post<ChatResponse>('/agent/chat', { message, session_id }),

  getSessions: () =>
    client.get<{ sessions: SessionInfo[] }>('/agent/sessions'),

  getHistory: (session_id: string) =>
    client.get<{ session_id: string; history: ChatMessage[]; turns: number }>(
      `/agent/sessions/${session_id}/history`
    ),

  clearSession: (session_id: string) =>
    client.delete(`/agent/sessions/${session_id}`),
}
