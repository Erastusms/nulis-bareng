import type {
  ClientMessage,
  ErrorMessage,
  RealtimeDomainEvent,
  RealtimeServerMessage,
} from "./events";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type EventListener = (event: RealtimeDomainEvent) => void;
export type StatusListener = (status: ConnectionStatus) => void;
export type ErrorListener = (error: ErrorMessage) => void;

export interface RealtimeClientOptions {
  url?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  heartbeatIntervalMs?: number;
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private url: string;
  private status: ConnectionStatus = "disconnected";
  private activeSubscriptions = new Set<string>();

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly initialReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly heartbeatIntervalMs: number;

  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private eventListeners = new Set<EventListener>();
  private statusListeners = new Set<StatusListener>();
  private errorListeners = new Set<ErrorListener>();

  private isExplicitlyClosed = false;

  constructor(options: RealtimeClientOptions = {}) {
    this.url =
      options.url ||
      (typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_WS_URL || `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname || "localhost"}:3001`)
        : "ws://localhost:3001");
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.initialReconnectDelayMs = options.initialReconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 10000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;

    if (options.autoConnect && typeof window !== "undefined") {
      this.connect();
    }
  }

  /**
   * Current connection lifecycle status.
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error("[RealtimeClient] Error in status listener:", err);
      }
    }
  }

  /**
   * Establishes WebSocket connection.
   */
  connect(): void {
    if (typeof window === "undefined") return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    try {
      let connectUrl = this.url;
      if (typeof document !== "undefined" && !connectUrl.includes("token=")) {
        const match = document.cookie.match(/(?:^|;\s*)nb_session=([^;]*)/);
        if (match && match[1]) {
          const sep = connectUrl.includes("?") ? "&" : "?";
          connectUrl = `${connectUrl}${sep}token=${encodeURIComponent(match[1])}`;
        }
      }

      this.socket = new WebSocket(connectUrl);

      this.socket.onopen = () => {
        this.setStatus("connected");
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.resubscribeActiveRooms();
      };

      this.socket.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.socket = null;
        if (!this.isExplicitlyClosed) {
          this.setStatus("disconnected");
          this.scheduleReconnect();
        } else {
          this.setStatus("disconnected");
        }
      };

      this.socket.onerror = () => {
        // Handled by onclose
      };
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  /**
   * Closes the connection and stops automatic reconnection.
   */
  disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  /**
   * Subscribes to a workspace room.
   */
  subscribe(workspaceId: string): void {
    this.activeSubscriptions.add(workspaceId);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: "subscribe", workspaceId });
    }
  }

  /**
   * Unsubscribes from a workspace room.
   */
  unsubscribe(workspaceId: string): void {
    this.activeSubscriptions.delete(workspaceId);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: "unsubscribe", workspaceId });
    }
  }

  /**
   * Re-sends subscribe requests for all active subscriptions on reconnection.
   */
  private resubscribeActiveRooms(): void {
    for (const workspaceId of this.activeSubscriptions) {
      this.sendMessage({ type: "subscribe", workspaceId });
    }
  }

  private sendMessage(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch (err) {
        console.error("[RealtimeClient] Failed to send message:", err);
      }
    }
  }

  private handleIncomingMessage(rawData: string | ArrayBuffer | Blob): void {
    try {
      const text = typeof rawData === "string" ? rawData : rawData.toString();
      const message = JSON.parse(text) as RealtimeServerMessage;

      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }

      if (message.type === "pong" || message.type === "subscribed" || message.type === "unsubscribed") {
        return;
      }

      if (message.type === "error") {
        for (const listener of this.errorListeners) {
          try {
            listener(message);
          } catch (err) {
            console.error("[RealtimeClient] Error in error listener:", err);
          }
        }
        return;
      }

      // Domain event
      for (const listener of this.eventListeners) {
        try {
          listener(message);
        } catch (err) {
          console.error("[RealtimeClient] Error in event listener:", err);
        }
      }
    } catch (err) {
      console.error("[RealtimeClient] Failed to parse incoming WebSocket message:", err);
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[RealtimeClient] Maximum reconnect attempts reached");
      return;
    }

    const backoff = Math.min(
      this.initialReconnectDelayMs * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );
    const jitter = Math.random() * 500;
    const delay = backoff + jitter;

    this.reconnectAttempts++;
    this.setStatus("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendMessage({ type: "ping" });
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Event Subscriptions
  // -------------------------------------------------------------------------

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }
}

let globalClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!globalClient) {
    globalClient = new RealtimeClient({ autoConnect: true });
  }
  return globalClient;
}
