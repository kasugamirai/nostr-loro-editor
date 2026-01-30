/**
 * Type definitions for Nostr-Loro Editor
 */

// Nostr Types
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrRelay {
  url: string;
  status: RelayStatus;
  lastConnected?: number;
}

export type RelayStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface NostrKeys {
  publicKey: string;
  privateKey: string;
}

// Document Types
export interface Document {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  owner: string;
  participants: string[];
}

export interface DocumentState {
  content: string;
  version: Uint8Array;
  lastSync: number;
}

// Collaboration Types
export interface Participant {
  pubkey: string;
  name?: string;
  color: string;
  cursor?: CursorPosition;
  lastSeen: number;
}

export interface CursorPosition {
  anchor: number;
  head: number;
}

export interface PresenceState {
  participants: Map<string, Participant>;
}

// Sync Types
export interface SyncMessage {
  type: 'update' | 'snapshot' | 'awareness' | 'sync-request';
  docId: string;
  data: string; // base64 encoded
  timestamp: number;
}

export interface SyncState {
  status: 'synced' | 'syncing' | 'offline' | 'error';
  pendingUpdates: number;
  lastSync: number;
  error?: string;
}

// Event Kinds for Nostr
export const NOSTR_KINDS = {
  DOCUMENT_META: 30078,      // Replaceable: document metadata
  DOCUMENT_SNAPSHOT: 30079,  // Replaceable: full document snapshot
  CRDT_UPDATE: 21000,        // Regular: incremental CRDT update
  PRESENCE: 21001,           // Ephemeral: presence/cursor info
  PING: 21002,               // Latency test ping
  PONG: 21003,               // Latency test pong
} as const;

// Latency Measurement Types
export interface LatencyMeasurement {
  id: string;
  sentAt: number;
  receivedAt?: number;
  latency?: number;
  relay?: string;
}

export interface SyncMetrics {
  // Latency stats
  lastLatency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  measurements: LatencyMeasurement[];

  // Sync stats
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  lastSyncAt: number;

  // Connection stats
  connectedRelays: number;
  totalRelays: number;
}

// Store Types
export interface EditorStore {
  // Document state
  document: Document | null;
  documentState: DocumentState | null;

  // Sync state
  syncState: SyncState;

  // Participants
  participants: Participant[];

  // Actions
  setDocument: (doc: Document) => void;
  updateContent: (content: string) => void;
  setSyncState: (state: Partial<SyncState>) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (pubkey: string) => void;
  updateParticipant: (pubkey: string, data: Partial<Participant>) => void;
}

export interface NostrStore {
  // Keys
  keys: NostrKeys | null;

  // Relays
  relays: NostrRelay[];

  // Connection state
  isConnected: boolean;

  // Actions
  generateKeys: () => void;
  importKeys: (privateKey: string) => void;
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}
