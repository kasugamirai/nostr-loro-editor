/**
 * Sidebar Component
 *
 * Manages relays, documents, and user settings.
 */

import { useState } from 'react';
import { useNostrStore, useEditorStore, useUIStore } from '@/lib/store';
import { useDocuments } from '@/hooks/useLoroNostr';
import { nip19 } from 'nostr-tools';
import clsx from 'clsx';

interface SidebarProps {
  onSelectDocument: (docId: string) => void;
  currentDocId: string | null;
}

export function Sidebar({ onSelectDocument, currentDocId }: SidebarProps) {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { keys, relays, userName, generateKeys, importKeys, exportKeysAsNsec, exportKeysAsHex, setUserName, addRelay, removeRelay, clearKeys } = useNostrStore();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const { participants } = useEditorStore();
  const { documents, addDocument, removeDocument } = useDocuments();

  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [joinDocId, setJoinDocId] = useState('');
  const [showKeyImport, setShowKeyImport] = useState(false);
  const [importKeyValue, setImportKeyValue] = useState('');
  const [activeTab, setActiveTab] = useState<'documents' | 'relays' | 'settings'>('documents');

  const handleAddRelay = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRelayUrl.trim()) {
      let url = newRelayUrl.trim();
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        url = 'wss://' + url;
      }
      addRelay(url);
      setNewRelayUrl('');
    }
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newDocTitle.trim() || 'Untitled Document';
    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addDocument(docId, title);
    onSelectDocument(docId);
    setNewDocTitle('');
  };

  const handleJoinDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const docId = joinDocId.trim();
    if (docId) {
      // Check if document already exists locally
      const existingDoc = documents.find(d => d.id === docId);
      if (!existingDoc) {
        addDocument(docId, `Shared: ${docId.slice(0, 12)}...`);
      }
      onSelectDocument(docId);
      setJoinDocId('');
    }
  };

  const copyDocIdToClipboard = (docId: string) => {
    navigator.clipboard.writeText(docId);
    alert('Document ID copied! Share this with collaborators.');
  };

  const handleImportKey = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      importKeys(importKeyValue.trim());
      setShowKeyImport(false);
      setImportKeyValue('');
    } catch (error) {
      alert('Invalid private key format');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-50 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
      >
        <MenuIcon />
      </button>
    );
  }

  return (
    <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h1 className="text-lg font-bold text-purple-400">Nostr Loro</h1>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['documents', 'relays', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Create new document */}
            <form onSubmit={handleCreateDocument} className="space-y-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title..."
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-400 focus:outline-none text-sm"
              />
              <button
                type="submit"
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
              >
                + New Document
              </button>
            </form>

            {/* Join existing document */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Join Shared Document</h3>
              <form onSubmit={handleJoinDocument} className="flex gap-2">
                <input
                  type="text"
                  value={joinDocId}
                  onChange={(e) => setJoinDocId(e.target.value)}
                  placeholder="Enter Document ID..."
                  className="flex-1 px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-400 focus:outline-none text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                >
                  Join
                </button>
              </form>
            </div>

            {/* Document list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Recent Documents</h3>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500">No documents yet</p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={clsx(
                      'p-3 rounded cursor-pointer transition-colors group',
                      currentDocId === doc.id
                        ? 'bg-purple-600/20 border border-purple-500'
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    )}
                    onClick={() => onSelectDocument(doc.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{doc.title}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyDocIdToClipboard(doc.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all"
                          title="Share Document ID"
                        >
                          <ShareIcon />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDocument(doc.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      ID: {doc.id.slice(0, 16)}... · {new Date(doc.lastOpened).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'relays' && (
          <div className="space-y-4">
            {/* Add relay */}
            <form onSubmit={handleAddRelay} className="flex gap-2">
              <input
                type="text"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                placeholder="wss://relay.example.com"
                className="flex-1 px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-400 focus:outline-none text-sm"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
              >
                Add
              </button>
            </form>

            {/* Relay list */}
            <div className="space-y-2">
              {relays.map((relay) => (
                <div
                  key={relay.url}
                  className="p-3 bg-gray-700/50 rounded flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={clsx('w-2 h-2 rounded-full flex-shrink-0', {
                        'bg-green-500': relay.status === 'connected',
                        'bg-yellow-500': relay.status === 'connecting',
                        'bg-red-500': relay.status === 'error',
                        'bg-gray-500': relay.status === 'disconnected',
                      })}
                    />
                    <span className="text-sm truncate">{relay.url.replace('wss://', '')}</span>
                  </div>
                  <button
                    onClick={() => removeRelay(relay.url)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* User Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Display Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name..."
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-400 focus:outline-none text-sm"
              />
            </div>

            {/* Keys */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Nostr Keys</label>
              {keys ? (
                <div className="space-y-3">
                  {/* Public Key */}
                  <div className="p-3 bg-gray-700/50 rounded">
                    <div className="text-xs text-gray-400 mb-1">Public Key (npub)</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs flex-1 truncate">
                        {nip19.npubEncode(keys.publicKey)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(nip19.npubEncode(keys.publicKey))}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Copy public key"
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </div>

                  {/* Private Key */}
                  <div className="p-3 bg-gray-700/50 rounded border border-yellow-600/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-yellow-500">Private Key (nsec) ⚠️</div>
                      <button
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="text-xs text-gray-400 hover:text-gray-200"
                      >
                        {showPrivateKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {showPrivateKey ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-xs flex-1 truncate text-yellow-200">
                            {exportKeysAsNsec()}
                          </code>
                          <button
                            onClick={() => {
                              const nsec = exportKeysAsNsec();
                              if (nsec) copyToClipboard(nsec);
                            }}
                            className="p-1 hover:bg-gray-600 rounded"
                            title="Copy nsec"
                          >
                            <CopyIcon />
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Hex:
                          <button
                            onClick={() => {
                              const hex = exportKeysAsHex();
                              if (hex) copyToClipboard(hex);
                            }}
                            className="ml-1 text-gray-400 hover:text-gray-200 underline"
                          >
                            Copy hex format
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-yellow-600">
                          ⚠️ Never share your private key!
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Click "Show" to reveal your private key
                      </div>
                    )}
                  </div>

                  {/* Key Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowKeyImport(true)}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                    >
                      Import Key
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure? This will generate a new key pair and you will lose access to your current identity.')) {
                          generateKeys();
                        }
                      }}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
                    >
                      New Key
                    </button>
                  </div>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      if (confirm('This will remove your keys from this browser. Make sure you have backed up your private key!')) {
                        clearKeys();
                      }
                    }}
                    className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm transition-colors"
                  >
                    Remove Keys
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={generateKeys}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
                  >
                    Generate New Keys
                  </button>
                  <button
                    onClick={() => setShowKeyImport(true)}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    Import Existing Key
                  </button>
                </div>
              )}
            </div>

            {/* Participants */}
            {participants.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Active Participants ({participants.length})
                </label>
                <div className="space-y-1">
                  {participants.map((p) => (
                    <div
                      key={p.pubkey}
                      className="flex items-center gap-2 p-2 bg-gray-700/50 rounded"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ backgroundColor: p.color }}
                      >
                        {(p.name || p.pubkey)[0].toUpperCase()}
                      </div>
                      <span className="text-sm truncate">
                        {p.name || p.pubkey.slice(0, 12) + '...'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Key Import Modal */}
      {showKeyImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96 max-w-[90vw]">
            <h3 className="text-lg font-medium mb-4">Import Private Key</h3>
            <form onSubmit={handleImportKey} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">
                  Enter your private key (nsec or hex format)
                </label>
                <input
                  type="password"
                  value={importKeyValue}
                  onChange={(e) => setImportKeyValue(e.target.value)}
                  placeholder="nsec1... or hex..."
                  className="w-full mt-2 px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowKeyImport(false);
                    setImportKeyValue('');
                  }}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                >
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

export default Sidebar;
