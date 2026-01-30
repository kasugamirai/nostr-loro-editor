# Nostr Loro Editor

A decentralized collaborative text editor powered by [Nostr](https://nostr.com/) and [Loro CRDT](https://loro.dev/).

## Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Decentralized**: No central server - uses Nostr relays for communication
- **Conflict-free**: Powered by Loro CRDT for automatic conflict resolution
- **Offline-first**: Works offline and syncs when reconnected
- **Cryptographic Identity**: Uses Nostr keypairs for user identification

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Editor    │  │   Sidebar   │  │   State Management  │  │
│  │  Component  │  │  Component  │  │      (Zustand)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Middleware Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Loro-Nostr Provider                      │   │
│  │  - Document synchronization                          │   │
│  │  - Event batching                                    │   │
│  │  - Presence management                               │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │    Loro CRDT        │  │      nostr-tools            │   │
│  │  - Document model   │  │  - Relay connections        │   │
│  │  - Text operations  │  │  - Event signing            │   │
│  │  - Version vectors  │  │  - Subscriptions            │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Nostr Event Types

| Kind  | Purpose              | Description                           |
|-------|----------------------|---------------------------------------|
| 30078 | Document Metadata    | Replaceable event for doc info        |
| 30079 | Document Snapshot    | Full document state snapshot          |
| 21000 | CRDT Update          | Incremental CRDT operations           |
| 21001 | Presence             | User cursor and presence info         |

## Project Structure

```
src/
├── components/
│   ├── Editor.tsx      # Main collaborative editor
│   └── Sidebar.tsx     # Relay and document management
├── hooks/
│   └── useLoroNostr.ts # React hook for Loro-Nostr integration
├── lib/
│   ├── loro-nostr-provider.ts  # Core sync provider
│   └── store.ts        # Zustand state management
├── types/
│   └── index.ts        # TypeScript type definitions
└── styles/
    └── index.css       # Tailwind CSS styles
```

## Configuration

Default relays can be modified in the Sidebar. The application supports:

- Adding custom relay URLs
- Removing relays
- Viewing relay connection status

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Loro CRDT** - Conflict-free replicated data types
- **nostr-tools** - Nostr protocol implementation
- **Zustand** - State management
- **Tailwind CSS** - Styling

## References

- [Loro Documentation](https://loro.dev/docs)
- [Nostr Protocol](https://github.com/nostr-protocol/nips)
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools)

## License

MIT
