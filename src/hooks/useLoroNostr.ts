/**
 * React Hook for Loro-Nostr Integration
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { LoroDoc, LoroText } from 'loro-crdt';
import { LoroNostrProvider } from '@/lib/loro-nostr-provider';
import { useNostrStore, useEditorStore } from '@/lib/store';
import type { Participant } from '@/types';

interface UseLoroNostrOptions {
  docId: string;
  autoConnect?: boolean;
}

interface UseLoroNostrReturn {
  doc: LoroDoc | null;
  text: LoroText | null;
  provider: LoroNostrProvider | null;
  isConnected: boolean;
  isSyncing: boolean;
  participants: Participant[];
  connect: () => Promise<void>;
  disconnect: () => void;
  getText: () => string;
  setText: (content: string) => void;
  insertText: (pos: number, content: string) => void;
  deleteText: (pos: number, len: number) => void;
  updateCursor: (anchor: number, head: number) => void;
}

export function useLoroNostr(options: UseLoroNostrOptions): UseLoroNostrReturn {
  const { docId, autoConnect = true } = options;

  const docRef = useRef<LoroDoc | null>(null);
  const textRef = useRef<LoroText | null>(null);
  const providerRef = useRef<LoroNostrProvider | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const { keys, relays, userName } = useNostrStore();
  const { setSyncState, setParticipants: storeSetParticipants } = useEditorStore();

  // Initialize Loro document - create new doc for each docId
  useEffect(() => {
    // Always create a new document for the current docId
    docRef.current = new LoroDoc();
    textRef.current = docRef.current.getText('content');

    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [docId]);

  // Initialize provider when keys are available
  useEffect(() => {
    if (!keys || !docRef.current) return;

    const relayUrls = relays.map((r) => r.url);

    providerRef.current = new LoroNostrProvider(docRef.current, {
      docId,
      relays: relayUrls,
      privateKey: keys.privateKey,
      batchInterval: 100,
      syncOnConnect: true,
    });

    // Set up event listeners
    providerRef.current.on('connected', () => {
      setIsConnected(true);
      setSyncState({ status: 'synced' });
    });

    providerRef.current.on('disconnected', () => {
      setIsConnected(false);
      setSyncState({ status: 'offline' });
    });

    providerRef.current.on('sync', (data: unknown) => {
      const { status } = data as { status: string };
      setIsSyncing(status === 'syncing');
      setSyncState({ status: status as 'synced' | 'syncing', lastSync: Date.now() });
    });

    providerRef.current.on('awareness', (data: unknown) => {
      const { participants: newParticipants } = data as { participants: Participant[] };
      setParticipants(newParticipants);
      storeSetParticipants(newParticipants);
    });

    providerRef.current.on('error', (data: unknown) => {
      const { message } = data as { message: string };
      console.error('Provider error:', message);
      setSyncState({ status: 'error', error: message });
    });

    providerRef.current.on('update', () => {
      // Remote update received - trigger re-render by updating sync state
      setSyncState({ status: 'synced', lastSync: Date.now() });
    });

    // Auto-connect if enabled
    if (autoConnect) {
      providerRef.current.connect().catch(console.error);
    }

    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [keys, docId, relays, autoConnect, setSyncState, storeSetParticipants]);

  const connect = useCallback(async () => {
    if (providerRef.current) {
      await providerRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.disconnect();
    }
  }, []);

  const getText = useCallback((): string => {
    if (textRef.current) {
      return textRef.current.toString();
    }
    return '';
  }, []);

  const setText = useCallback((content: string) => {
    if (textRef.current && docRef.current) {
      const currentLength = textRef.current.length;
      if (currentLength > 0) {
        textRef.current.delete(0, currentLength);
      }
      textRef.current.insert(0, content);
      // Commit the change to trigger subscription
      docRef.current.commit();
    }
  }, []);

  const insertText = useCallback((pos: number, content: string) => {
    if (textRef.current && docRef.current) {
      textRef.current.insert(pos, content);
      // Commit the change to trigger subscription
      docRef.current.commit();
    }
  }, []);

  const deleteText = useCallback((pos: number, len: number) => {
    if (textRef.current && docRef.current) {
      textRef.current.delete(pos, len);
      // Commit the change to trigger subscription
      docRef.current.commit();
    }
  }, []);

  const updateCursor = useCallback((anchor: number, head: number) => {
    if (providerRef.current) {
      providerRef.current.updatePresence({
        name: userName || undefined,
        cursor: { anchor, head },
      });
    }
  }, [userName]);

  return {
    doc: docRef.current,
    text: textRef.current,
    provider: providerRef.current,
    isConnected,
    isSyncing,
    participants,
    connect,
    disconnect,
    getText,
    setText,
    insertText,
    deleteText,
    updateCursor,
  };
}

/**
 * Hook for managing document list
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; lastOpened: number }>>([]);

  useEffect(() => {
    // Load documents from localStorage
    const stored = localStorage.getItem('nostr-loro-documents');
    if (stored) {
      try {
        setDocuments(JSON.parse(stored));
      } catch {
        setDocuments([]);
      }
    }
  }, []);

  const addDocument = useCallback((id: string, title: string) => {
    setDocuments((prev) => {
      const updated = [
        { id, title, lastOpened: Date.now() },
        ...prev.filter((d) => d.id !== id),
      ].slice(0, 20); // Keep only last 20 documents
      localStorage.setItem('nostr-loro-documents', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      localStorage.setItem('nostr-loro-documents', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { documents, addDocument, removeDocument };
}
