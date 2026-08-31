export type WhatsAppConnectionState =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "INIT_QR"      // Fresh QR requested (before socket is created)
  | "QR_READY"
  | "PAIRING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "LOGGED_OUT"
  | "ERROR"
  | "FAILED"; // Legacy alias for ERROR

export interface WhatsAppConnectedInfo {
  userId?: string;
  phone?: string | null;
  name?: string | null;
  connectedAt?: Date | null;
  lastDisconnectedAt?: Date | null;
  lastActiveAt?: Date | null;
  status: WhatsAppConnectionState;
  qrCode?: string | null;
  qrExpiresAt?: Date | null;
  pairingCode?: string | null;
  errorMessage?: string | null;
  reconnectAttempts?: number;
}

export interface WhatsAppMessagePayload {
  recipientPhone: string; // e.g. "923122621292"
  messageText: string;
  customerId?: string;
  installmentId?: string;
  queueId?: string;
  senderUserId?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Legacy interface — kept for backward compatibility with web-provider, cloud-provider, remote-provider.
 * New code should use UserWhatsAppSession / WhatsAppSessionManager directly.
 */
export interface IWhatsAppProvider {
  name: string;
  init(): Promise<void>;
  isConnected?(): boolean;
  getConnectionState(): Promise<WhatsAppConnectionState>;
  getQRCode(): Promise<string | null>;
  getConnectedInfo(): Promise<WhatsAppConnectedInfo>;
  sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult>;
  sendDirectMessage?(phone: string, message: string): Promise<WhatsAppSendResult>;
  disconnect(): Promise<void>;
  requestPairingCode?(phone: string): Promise<string>;
}
