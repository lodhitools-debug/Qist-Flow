export type WhatsAppConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "QR_READY"
  | "CONNECTED"
  | "FAILED";

export interface WhatsAppConnectedInfo {
  phone?: string;
  name?: string;
  connectedAt?: Date;
  lastActiveAt?: Date;
  status: WhatsAppConnectionState;
  qrCode?: string | null;
  errorMessage?: string | null;
}

export interface WhatsAppMessagePayload {
  recipientPhone: string; // e.g. "923122621292"
  messageText: string;
  customerId?: string;
  installmentId?: string;
  queueId?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface IWhatsAppProvider {
  name: string;
  init(): Promise<void>;
  getConnectionState(): Promise<WhatsAppConnectionState>;
  getQRCode(): Promise<string | null>;
  getConnectedInfo(): Promise<WhatsAppConnectedInfo>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult>;
}
