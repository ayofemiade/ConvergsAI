/**
 * API Client for AI Sales Agent
 * Handles all communication with Node.js API Gateway
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface MessageRequest {
    text: string;
    session_id: string;
}

export interface MessageResponse {
    success: boolean;
    response: string;
    session_id: string;
    stage?: string;
    qualification?: {
        business_type?: string | null;
        goal?: string | null;
        urgency?: string | null;
        budget_readiness?: string | null;
    };
    qualification_complete?: boolean;
    message_count?: number;
    error?: string;
}

export interface SessionInfo {
    session_id: string;
    created_at: string;
    message_count: number;
    stage: string;
    qualification: {
        business_type?: string | null;
        goal?: string | null;
        urgency?: string | null;
        budget_readiness?: string | null;
    };
    qualification_complete: boolean;
}

class APIClient {
    private baseURL: string;

    constructor(baseURL: string = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    async fetchWithHeaders(endpoint: string, options: RequestInit = {}) {
        // Ensure robust URL joining regardless of trailing slashes
        const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = endpoint.startsWith('http') ? endpoint : `${base}${path}`;

        const headers = {
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true', // Bypasses localtunnel's splash screen
            ...(options.headers || {}),
        };

        const response = await fetch(url, { ...options, headers });
        return response;
    }

    /**
     * Create a new conversation session
     */
    async createSession(customPrompt?: string): Promise<{ session_id: string }> {
        const response = await this.fetchWithHeaders('/api/session/new', {
            method: 'POST',
            body: JSON.stringify(customPrompt ? { custom_prompt: customPrompt } : {}),
        });

        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }

        const data = await response.json();
        return { session_id: data.session_id };
    }

    /**
     * Send a message to the AI agent
     */
    async sendMessage(request: MessageRequest): Promise<MessageResponse> {
        const response = await this.fetchWithHeaders('/api/message', {
            method: 'POST',
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Request failed: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get session information
     */
    async getSession(sessionId: string): Promise<SessionInfo> {
        const response = await this.fetchWithHeaders(`/api/session/${sessionId}`);

        if (!response.ok) {
            throw new Error(`Failed to get session: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Delete a session
     */
    async deleteSession(sessionId: string): Promise<void> {
        const response = await this.fetchWithHeaders(`/api/session/${sessionId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Failed to delete session: ${response.statusText}`);
        }
    }

    /**
     * Get LiveKit token
     */
    async getLiveKitToken(roomName: string, identity?: string): Promise<{ token: string; serverUrl: string }> {
        const response = await this.fetchWithHeaders('/api/livekit/token', {
            method: 'POST',
            body: JSON.stringify({ roomName, identity }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get LiveKit token: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ status: string; services: any }> {
        const response = await this.fetchWithHeaders('/health');

        if (!response.ok) {
            throw new Error('Health check failed');
        }

        return response.json();
    }
}

export const apiClient = new APIClient();
