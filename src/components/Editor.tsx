/**
 * Collaborative Editor Component
 *
 * A rich-text editor that syncs via Loro CRDT over Nostr.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLoroNostr } from '@/hooks/useLoroNostr';
import { useNostrStore } from '@/lib/store';
import { generateColor } from '@/lib/loro-nostr-provider';
import { DebugPanel } from './DebugPanel';
import clsx from 'clsx';

interface EditorProps {
  docId: string;
  className?: string;
  showDebug?: boolean;
}

export function Editor({ docId, className, showDebug = true }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [localContent, setLocalContent] = useState('');
  const isComposing = useRef(false);
  const lastSyncedContent = useRef('');

  const {
    doc,
    text,
    provider,
    isConnected,
    isSyncing,
    participants,
    insertText,
    deleteText,
    updateCursor,
  } = useLoroNostr({ docId });

  const { keys } = useNostrStore();

  // Subscribe to Loro document changes
  useEffect(() => {
    if (!doc || !text) return;

    // Loro's subscribe method - returns subscription for cleanup
    doc.subscribe(() => {
      const newContent = text.toString();
      if (newContent !== lastSyncedContent.current) {
        lastSyncedContent.current = newContent;
        setLocalContent(newContent);
      }
    });

    // Initial content load
    const initialContent = text.toString();
    setLocalContent(initialContent);
    lastSyncedContent.current = initialContent;

    // Cleanup will be handled when component unmounts and doc changes
  }, [doc, text]);

  // Handle text input
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      if (isComposing.current || !text) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const newContent = e.currentTarget.textContent || '';
      const oldContent = lastSyncedContent.current;

      // Find the difference and apply it
      if (newContent !== oldContent) {
        // Simple diff: find first difference and length change
        let start = 0;
        while (start < oldContent.length && start < newContent.length && oldContent[start] === newContent[start]) {
          start++;
        }

        let oldEnd = oldContent.length;
        let newEnd = newContent.length;
        while (
          oldEnd > start &&
          newEnd > start &&
          oldContent[oldEnd - 1] === newContent[newEnd - 1]
        ) {
          oldEnd--;
          newEnd--;
        }

        const deleteLen = oldEnd - start;
        const insertStr = newContent.slice(start, newEnd);

        if (deleteLen > 0) {
          deleteText(start, deleteLen);
        }
        if (insertStr.length > 0) {
          insertText(start, insertStr);
        }

        lastSyncedContent.current = newContent;
      }
    },
    [text, insertText, deleteText]
  );

  // Handle composition (for IME input)
  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    isComposing.current = false;
    handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
  };

  // Handle selection change for cursor sync
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;

    // Calculate cursor position relative to text content
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const anchor = preCaretRange.toString().length;

    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const head = preCaretRange.toString().length;

    updateCursor(anchor, head);
  }, [updateCursor]);

  // Set up selection change listener
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  };

  return (
    <div className={clsx('relative', className)}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span
              className={clsx('w-2 h-2 rounded-full', {
                'bg-green-500': isConnected,
                'bg-yellow-500': isSyncing,
                'bg-red-500': !isConnected,
              })}
            />
            {isConnected ? (isSyncing ? 'Syncing...' : 'Connected') : 'Offline'}
          </span>
          <span className="text-gray-400">
            Document: {docId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Participant avatars */}
          <div className="flex -space-x-2">
            {participants.slice(0, 5).map((p) => (
              <div
                key={p.pubkey}
                className="w-6 h-6 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: p.color }}
                title={p.name || p.pubkey.slice(0, 8)}
              >
                {(p.name || p.pubkey)[0].toUpperCase()}
              </div>
            ))}
            {participants.length > 5 && (
              <div className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-600 flex items-center justify-center text-xs">
                +{participants.length - 5}
              </div>
            )}
          </div>
          {keys && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: generateColor(keys.publicKey) }}
              title="You"
            >
              Y
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={clsx(
          'min-h-[400px] p-4 bg-gray-900 text-gray-100',
          'focus:outline-none',
          'font-mono text-sm leading-relaxed',
          'whitespace-pre-wrap break-words'
        )}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      >
        {localContent || (
          <span className="text-gray-500 pointer-events-none">
            Start typing to collaborate...
          </span>
        )}
      </div>

      {/* Cursor overlays for other participants */}
      <ParticipantCursors
        participants={participants}
        editorRef={editorRef}
        content={localContent}
      />

      {/* Debug Panel */}
      {showDebug && (
        <DebugPanel
          docId={docId}
          provider={provider}
          isConnected={isConnected}
        />
      )}
    </div>
  );
}

// Component to render other participants' cursors
function ParticipantCursors({
  participants,
  editorRef,
  content,
}: {
  participants: Array<{ pubkey: string; name?: string; color: string; cursor?: { anchor: number; head: number } }>;
  editorRef: React.RefObject<HTMLDivElement>;
  content: string;
}) {
  const [cursorPositions, setCursorPositions] = useState<
    Array<{ pubkey: string; name?: string; color: string; x: number; y: number }>
  >([]);

  useEffect(() => {
    if (!editorRef.current) return;

    const positions = participants
      .filter((p) => p.cursor)
      .map((p) => {
        const pos = p.cursor!.head;
        const rect = getCaretCoordinates(editorRef.current!, pos, content);
        return {
          pubkey: p.pubkey,
          name: p.name,
          color: p.color,
          x: rect.x,
          y: rect.y,
        };
      });

    setCursorPositions(positions);
  }, [participants, editorRef, content]);

  return (
    <>
      {cursorPositions.map((cursor) => (
        <div
          key={cursor.pubkey}
          className="absolute pointer-events-none"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div
            className="w-0.5 h-5"
            style={{ backgroundColor: cursor.color }}
          />
          <div
            className="text-xs px-1 py-0.5 rounded text-white whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name || cursor.pubkey.slice(0, 6)}
          </div>
        </div>
      ))}
    </>
  );
}

// Helper to get caret coordinates from character position
function getCaretCoordinates(
  element: HTMLElement,
  position: number,
  content: string
): { x: number; y: number } {
  // Create a temporary range to measure position
  const range = document.createRange();
  const textNode = element.firstChild;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  const clampedPos = Math.min(position, content.length);

  try {
    range.setStart(textNode, clampedPos);
    range.setEnd(textNode, clampedPos);
    const rect = range.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  } catch {
    const rect = element.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }
}

export default Editor;
