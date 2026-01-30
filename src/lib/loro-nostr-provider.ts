/**
 * Loro-Nostr Provider
 *
 * Bridges Loro CRDT with the Nostr protocol for decentralized collaboration.
 * This provider handles:
 * - Document synchronization over Nostr relays
 * - Event publishing and subscription
 * - Offline-first operation with reconnection sync
 */

import { LoroDoc } from 'loro-crdt';
import {
  SimplePool,
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type Event as NostrEvent,
  type Filter,
} from 'nostr-tools';
import { NOSTR_KINDS, type SyncMessage, type Participant } from '@/types';

// Event emitter for provider events
type ProviderEventType =
  | 'sync'
  | 'update'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'awareness';

type ProviderEventCallback = (data: unknown) => void;

export interface LoroNostrProviderOptions {
  /** Document ID (used as room identifier) */
  docId: string;
  /** Nostr relay URLs */
  relays: string[];
  /** Private key (hex) - generates new if not provided */
  privateKey?: string;
  /** Enable compression for updates */
  compress?: boolean;
  /** Batch updates interval in ms */
  batchInterval?: number;
  /** Whether to sync on connect */
  syncOnConnect?: boolean;
}

export class LoroNostrProvider {
  private doc: LoroDoc;
  private pool: SimplePool;
  private relays: string[];
  private docId: string;
  private privateKey: Uint8Array;
  private publicKey: string;
  private subscriptionId: string | null = null;
  private pendingUpdates: Uint8Array[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private eventListeners: Map<ProviderEventType, Set<ProviderEventCallback>> = new Map();
  public isConnected = false;
  private lastSyncTimestamp = 0;
  private options: Required<LoroNostrProviderOptions>;
  private awareness: Map<string, Participant> = new Map();
  private lastExportedVersion: ReturnType<LoroDoc['version']> | null = null;

  constructor(doc: LoroDoc, options: LoroNostrProviderOptions) {
    this.doc = doc;
    this.docId = options.docId;
    this.relays = options.relays;

    // Set default options
    this.options = {
      docId: options.docId,
      relays: options.relays,
      privateKey: options.privateKey || '',
      compress: options.compress ?? true,
      batchInterval: options.batchInterval ?? 100,
      syncOnConnect: options.syncOnConnect ?? true,
    };

    // Initialize keys
    if (options.privateKey) {
      this.privateKey = hexToBytes(options.privateKey);
    } else {
      this.privateKey = generateSecretKey();
    }
    this.publicKey = getPublicKey(this.privateKey);

    // Initialize relay pool
    this.pool = new SimplePool();

    // Subscribe to local document changes
    this.setupDocumentListener();
  }

  /**
   * Get the public key (npub format)
   */
  get npub(): string {
    return nip19.npubEncode(this.publicKey);
  }

  /**
   * Get the public key (hex format)
   */
  get pubkey(): string {
    return this.publicKey;
  }

  /**
   * Connect to relays and start syncing
   */
  async connect(): Promise<void> {
    try {
      // Subscribe to document events
      await this.subscribe();

      this.isConnected = true;
      this.emit('connected', { relays: this.relays });

      // Fetch historical events if syncOnConnect is enabled
      if (this.options.syncOnConnect) {
        await this.fetchHistory();
      }
    } catch (error) {
      this.emit('error', { message: 'Connection failed', error });
      throw error;
    }
  }

  /**
   * Disconnect from relays
   */
  disconnect(): void {
    if (this.subscriptionId) {
      this.pool.close(this.relays);
      this.subscriptionId = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush pending updates before disconnecting
    if (this.pendingUpdates.length > 0) {
      this.flushUpdates();
    }

    this.isConnected = false;
    this.emit('disconnected', {});
  }

  /**
   * Subscribe to document events from relays
   */
  private async subscribe(): Promise<void> {
    // Subscribe to CRDT updates and snapshots
    const docFilter: Filter = {
      kinds: [NOSTR_KINDS.CRDT_UPDATE, NOSTR_KINDS.DOCUMENT_SNAPSHOT],
      '#d': [this.docId],
      since: this.lastSyncTimestamp || undefined,
    };

    this.pool.subscribeMany(this.relays, docFilter, {
      onevent: (event: NostrEvent) => {
        this.handleEvent(event);
      },
      oneose: () => {
        this.emit('sync', { status: 'synced' });
      },
    });

    // Subscribe to presence updates separately
    const presenceFilter: Filter = {
      kinds: [NOSTR_KINDS.PRESENCE],
      '#d': [this.docId],
      since: Math.floor(Date.now() / 1000) - 60, // Last minute only
    };

    this.pool.subscribeMany(this.relays, presenceFilter, {
      onevent: (event: NostrEvent) => {
        this.handleEvent(event);
      },
    });

    this.subscriptionId = 'active';
  }

  /**
   * Fetch historical events for initial sync
   */
  private async fetchHistory(): Promise<void> {
    this.emit('sync', { status: 'syncing' });

    try {
      // Query for snapshots and updates separately
      const snapshotEvents = await this.pool.querySync(this.relays, {
        kinds: [NOSTR_KINDS.DOCUMENT_SNAPSHOT],
        '#d': [this.docId],
        limit: 1,
      });
      const updateEvents = await this.pool.querySync(this.relays, {
        kinds: [NOSTR_KINDS.CRDT_UPDATE],
        '#d': [this.docId],
        limit: 100,
      });
      const events = [...snapshotEvents, ...updateEvents];

      // Sort events by timestamp
      events.sort((a, b) => a.created_at - b.created_at);

      // Apply snapshot first if available
      const snapshot = events.find((e) => e.kind === NOSTR_KINDS.DOCUMENT_SNAPSHOT);
      if (snapshot) {
        await this.applySnapshot(snapshot);
      }

      // Apply incremental updates
      for (const event of events) {
        if (event.kind === NOSTR_KINDS.CRDT_UPDATE) {
          await this.applyUpdate(event);
        }
      }

      this.emit('sync', { status: 'synced' });
    } catch (error) {
      this.emit('error', { message: 'Failed to fetch history', error });
    }
  }

  /**
   * Handle incoming Nostr event
   */
  private handleEvent(event: NostrEvent): void {
    // Skip our own events
    if (event.pubkey === this.publicKey) {
      return;
    }

    switch (event.kind) {
      case NOSTR_KINDS.CRDT_UPDATE:
        this.applyUpdate(event);
        break;
      case NOSTR_KINDS.DOCUMENT_SNAPSHOT:
        this.applySnapshot(event);
        break;
      case NOSTR_KINDS.PRESENCE:
        this.handlePresence(event);
        break;
    }
  }

  /**
   * Apply a CRDT update from a Nostr event
   */
  private async applyUpdate(event: NostrEvent): Promise<void> {
    try {
      const message: SyncMessage = JSON.parse(event.content);
      const data = base64ToBytes(message.data);

      // Import the update into Loro
      this.doc.import(data);

      this.lastSyncTimestamp = Math.max(this.lastSyncTimestamp, event.created_at);
      this.emit('update', { from: event.pubkey, timestamp: event.created_at });
    } catch (error) {
      console.error('Failed to apply update:', error);
    }
  }

  /**
   * Apply a document snapshot from a Nostr event
   */
  private async applySnapshot(event: NostrEvent): Promise<void> {
    try {
      const message: SyncMessage = JSON.parse(event.content);
      const data = base64ToBytes(message.data);

      // Import the snapshot
      this.doc.import(data);

      this.lastSyncTimestamp = Math.max(this.lastSyncTimestamp, event.created_at);
      this.emit('sync', { status: 'synced', snapshot: true });
    } catch (error) {
      console.error('Failed to apply snapshot:', error);
    }
  }

  /**
   * Handle presence update from another participant
   */
  private handlePresence(event: NostrEvent): void {
    try {
      const data = JSON.parse(event.content);
      const participant: Participant = {
        pubkey: event.pubkey,
        name: data.name,
        color: data.color || generateColor(event.pubkey),
        cursor: data.cursor,
        lastSeen: event.created_at,
      };

      this.awareness.set(event.pubkey, participant);
      this.emit('awareness', { participants: Array.from(this.awareness.values()) });
    } catch (error) {
      console.error('Failed to handle presence:', error);
    }
  }

  /**
   * Setup listener for local document changes
   */
  private setupDocumentListener(): void {
    this.doc.subscribe((event) => {
      // Check if this is a local change (not from import)
      // In Loro, 'local' means changes made directly, 'import' means from remote
      if (event.by !== 'import') {
        // Export the update
        const update = this.doc.export({ mode: 'update' });
        if (update.length > 0) {
          this.queueUpdate(update);
        }
      }
    });
  }

  /**
   * Queue an update for batched publishing
   */
  private queueUpdate(update: Uint8Array): void {
    this.pendingUpdates.push(update);

    // Set up batch timer if not already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushUpdates();
      }, this.options.batchInterval);
    }
  }

  /**
   * Flush pending updates to relays
   */
  private async flushUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;

    this.batchTimer = null;

    // Export updates from last known version
    let update: Uint8Array;
    if (this.lastExportedVersion) {
      // Export only changes since last export
      update = this.doc.export({ mode: 'update', from: this.lastExportedVersion });
    } else {
      // First export - get all updates
      update = this.doc.export({ mode: 'update' });
    }

    // Update version tracker
    this.lastExportedVersion = this.doc.version();

    // Clear pending updates
    this.pendingUpdates = [];

    // Only publish if there are actual changes
    if (update.length > 0) {
      await this.publishUpdate(update);
    }
  }

  /**
   * Publish a CRDT update to relays
   */
  private async publishUpdate(update: Uint8Array): Promise<void> {
    const message: SyncMessage = {
      type: 'update',
      docId: this.docId,
      data: bytesToBase64(update),
      timestamp: Date.now(),
    };

    const event = finalizeEvent(
      {
        kind: NOSTR_KINDS.CRDT_UPDATE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', this.docId]],
        content: JSON.stringify(message),
      },
      this.privateKey
    );

    try {
      const results = await Promise.allSettled(
        this.pool.publish(this.relays, event)
      );
      // Check if at least one succeeded
      if (!results.some(r => r.status === 'fulfilled')) {
        throw new Error('All relay publishes failed');
      }
    } catch (error) {
      this.emit('error', { message: 'Failed to publish update', error });
    }
  }

  /**
   * Publish a full document snapshot
   */
  async publishSnapshot(): Promise<void> {
    const snapshot = this.doc.export({ mode: 'snapshot' });

    const message: SyncMessage = {
      type: 'snapshot',
      docId: this.docId,
      data: bytesToBase64(snapshot),
      timestamp: Date.now(),
    };

    const event = finalizeEvent(
      {
        kind: NOSTR_KINDS.DOCUMENT_SNAPSHOT,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', this.docId]],
        content: JSON.stringify(message),
      },
      this.privateKey
    );

    try {
      const results = await Promise.allSettled(
        this.pool.publish(this.relays, event)
      );
      if (!results.some(r => r.status === 'fulfilled')) {
        throw new Error('All relay publishes failed');
      }
      this.emit('sync', { status: 'synced', snapshot: true });
    } catch (error) {
      this.emit('error', { message: 'Failed to publish snapshot', error });
    }
  }

  /**
   * Update and broadcast presence information
   */
  async updatePresence(data: { name?: string; cursor?: { anchor: number; head: number } }): Promise<void> {
    const presence = {
      name: data.name,
      cursor: data.cursor,
      color: generateColor(this.publicKey),
    };

    const event = finalizeEvent(
      {
        kind: NOSTR_KINDS.PRESENCE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', this.docId]],
        content: JSON.stringify(presence),
      },
      this.privateKey
    );

    try {
      await Promise.allSettled(
        this.pool.publish(this.relays, event)
      );
    } catch (error) {
      // Presence errors are non-critical
      console.warn('Failed to publish presence:', error);
    }
  }

  /**
   * Get current awareness state
   */
  getAwareness(): Participant[] {
    return Array.from(this.awareness.values());
  }

  /**
   * Add event listener
   */
  on(event: ProviderEventType, callback: ProviderEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: ProviderEventType, callback: ProviderEventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event
   */
  private emit(event: ProviderEventType, data: unknown): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(data));
  }

  /**
   * Destroy the provider
   */
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
  }
}

// Utility functions

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generateColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export { generateColor };
