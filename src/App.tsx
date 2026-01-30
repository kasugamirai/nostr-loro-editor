/**
 * Main Application Component
 *
 * Combines the Editor and Sidebar for a complete collaborative editing experience.
 */

import { useState, useEffect } from 'react';
import { Editor } from '@/components/Editor';
import { Sidebar } from '@/components/Sidebar';
import { useNostrStore } from '@/lib/store';

export function App() {
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const { keys, generateKeys } = useNostrStore();

  // Auto-generate keys if not present
  useEffect(() => {
    if (!keys) {
      generateKeys();
    }
  }, [keys, generateKeys]);

  const handleSelectDocument = (docId: string) => {
    setCurrentDocId(docId);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <Sidebar
        onSelectDocument={handleSelectDocument}
        currentDocId={currentDocId}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentDocId ? (
          <Editor docId={currentDocId} showDebug={true} />
        ) : (
          <WelcomeScreen />
        )}
      </main>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="mb-6">
          <svg
            className="w-20 h-20 mx-auto text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4">Nostr Loro Editor</h1>
        <p className="text-gray-400 mb-6">
          A decentralized collaborative text editor powered by Nostr and Loro CRDT.
          Create or open a document from the sidebar to get started.
        </p>
        <div className="space-y-3 text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <CheckIcon />
            <span>Real-time collaboration</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckIcon />
            <span>Decentralized via Nostr relays</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckIcon />
            <span>Conflict-free with CRDT</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckIcon />
            <span>Works offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default App;
