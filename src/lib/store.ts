/**
 * Zustand Store for Application State
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import type { Document, Participant, SyncState, NostrKeys, NostrRelay } from '@/types';

// Editor Store
interface EditorState {
  document: Document | null;
  content: string;
  syncState: SyncState;
  participants: Participant[];

  // Actions
  setDocument: (doc: Document | null) => void;
  updateContent: (content: string) => void;
  setSyncState: (state: Partial<SyncState>) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (pubkey: string) => void;
  updateParticipant: (pubkey: string, data: Partial<Participant>) => void;
  setParticipants: (participants: Participant[]) => void;
  reset: () => void;
}

const initialEditorState = {
  document: null,
  content: '',
  syncState: {
    status: 'offline' as const,
    pendingUpdates: 0,
    lastSync: 0,
  },
  participants: [],
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialEditorState,

  setDocument: (doc) => set({ document: doc }),

  updateContent: (content) => set({ content }),

  setSyncState: (state) =>
    set((prev) => ({
      syncState: { ...prev.syncState, ...state },
    })),

  addParticipant: (participant) =>
    set((prev) => ({
      participants: [...prev.participants.filter((p) => p.pubkey !== participant.pubkey), participant],
    })),

  removeParticipant: (pubkey) =>
    set((prev) => ({
      participants: prev.participants.filter((p) => p.pubkey !== pubkey),
    })),

  updateParticipant: (pubkey, data) =>
    set((prev) => ({
      participants: prev.participants.map((p) =>
        p.pubkey === pubkey ? { ...p, ...data } : p
      ),
    })),

  setParticipants: (participants) => set({ participants }),

  reset: () => set(initialEditorState),
}));

// Nostr Store
interface NostrState {
  keys: NostrKeys | null;
  relays: NostrRelay[];
  isConnected: boolean;
  userName: string;

  // Actions
  generateKeys: () => void;
  importKeys: (privateKey: string) => void;
  setUserName: (name: string) => void;
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
  updateRelayStatus: (url: string, status: NostrRelay['status']) => void;
  setConnected: (connected: boolean) => void;
  clearKeys: () => void;
}

const DEFAULT_RELAYS: NostrRelay[] = [
  { url: 'wss://relay.damus.io', status: 'disconnected' },
  { url: 'wss://nos.lol', status: 'disconnected' },
  { url: 'wss://nostr-pub.wellorder.net/', status: 'disconnected' },
];

export const useNostrStore = create<NostrState>()(
  persist(
    (set, get) => ({
      keys: null,
      relays: DEFAULT_RELAYS,
      isConnected: false,
      userName: '',

      generateKeys: () => {
        const privateKeyBytes = generateSecretKey();
        const privateKey = Array.from(privateKeyBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const publicKey = getPublicKey(privateKeyBytes);

        set({
          keys: { privateKey, publicKey },
        });
      },

      importKeys: (privateKey: string) => {
        try {
          // Handle both hex and nsec formats
          let hexKey = privateKey;
          if (privateKey.startsWith('nsec')) {
            const decoded = nip19.decode(privateKey);
            if (decoded.type === 'nsec') {
              hexKey = Array.from(decoded.data as Uint8Array)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
            }
          }

          const privateKeyBytes = new Uint8Array(
            hexKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
          );
          const publicKey = getPublicKey(privateKeyBytes);

          set({
            keys: { privateKey: hexKey, publicKey },
          });
        } catch (error) {
          console.error('Failed to import keys:', error);
          throw new Error('Invalid private key format');
        }
      },

      setUserName: (name) => set({ userName: name }),

      addRelay: (url) => {
        const { relays } = get();
        if (!relays.find((r) => r.url === url)) {
          set({
            relays: [...relays, { url, status: 'disconnected' }],
          });
        }
      },

      removeRelay: (url) => {
        set((prev) => ({
          relays: prev.relays.filter((r) => r.url !== url),
        }));
      },

      updateRelayStatus: (url, status) => {
        set((prev) => ({
          relays: prev.relays.map((r) =>
            r.url === url ? { ...r, status } : r
          ),
        }));
      },

      setConnected: (connected) => set({ isConnected: connected }),

      clearKeys: () => set({ keys: null }),
    }),
    {
      name: 'nostr-loro-editor-storage',
      partialize: (state) => ({
        keys: state.keys,
        relays: state.relays,
        userName: state.userName,
      }),
    }
  )
);

// UI Store
interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  theme: 'light' | 'dark';

  // Actions
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      settingsOpen: false,
      theme: 'dark',

      toggleSidebar: () => set((prev) => ({ sidebarOpen: !prev.sidebarOpen })),
      toggleSettings: () => set((prev) => ({ settingsOpen: !prev.settingsOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'nostr-loro-editor-ui',
    }
  )
);
