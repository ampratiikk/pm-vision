# PM Vision - Market Analysis Platform

A modular market analysis platform built with React, Vite, Node.js, Express, and WebSockets.

---

## 🏛️ Architecture Overview

The repository is organized as a monorepo leveraging npm workspaces:

```
PM Vision - Market Analysis Platform/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── components/     # UI components (e.g. StatusCard)
│   │   ├── services/       # API & WebSocket client services
│   │   ├── App.tsx         # Main application component
│   │   ├── index.css       # Platform theme and layout styles
│   │   └── main.tsx        # React DOM entry point
│   ├── index.html          # HTML entry point
│   ├── package.json        # Client dependencies & scripts
│   ├── tsconfig.json       # Frontend TypeScript configuration
│   └── vite.config.ts      # Vite bundler & reverse proxy setup
│
├── server/                 # Backend Node.js / Express Application
│   ├── src/
│   │   ├── config/         # Environment & runtime configuration
│   │   ├── routes/         # Modular route definitions (e.g. /api/health)
│   │   ├── ws/             # WebSocket server handler
│   │   ├── app.ts          # Express application setup
│   │   └── index.ts        # Server bootstrap entry point
│   ├── package.json        # Server dependencies & scripts
│   └── tsconfig.json       # Backend TypeScript configuration
│
├── shared/                 # Shared domain types and contracts
│   ├── src/
│   │   └── index.ts        # Shared interfaces (HealthCheckResponse, WebSocketMessage)
│   ├── package.json        # Shared module definition
│   └── tsconfig.json       # Shared TypeScript configuration
│
├── .gitignore              # Git ignore rules
├── package.json            # Monorepo root workspace configuration
└── README.md               # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher (v26.x supported)
- **npm**: v9.0.0 or higher
- **Git**

> **Note for Windows PowerShell Users:** If PowerShell prevents script execution, use `npm.cmd` instead of `npm`, or set execution policy via `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

---

### Installation

Install all workspace dependencies from the repository root:

```bash
npm install
```
*(or `npm.cmd install` on Windows PowerShell)*

---

### Running the Application

#### 1. Run Frontend & Backend Simultaneously (Recommended)

```bash
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend HTTP API:** [http://localhost:5000](http://localhost:5000)
- **Backend WebSocket:** `ws://localhost:5000/ws`
- **Health-Check Endpoint:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

#### 2. Run Individually

**Backend only:**
```bash
npm run dev:server
```

**Frontend only:**
```bash
npm run dev:client
```

---

### Building for Production

Compile all packages (`shared`, `server`, and `client`):

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

---

## 📡 API & WebSocket Contracts

### Health-Check REST Endpoint
- **URL:** `GET /api/health`
- **Response Format:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-08T00:00:00.000Z",
    "uptimeSeconds": 42,
    "environment": "development",
    "version": "0.1.0"
  }
  ```

### WebSocket Endpoint
- **URL:** `ws://localhost:5000/ws` (proxied in dev via `/ws`)
- **Protocol:**
  - Upon connection, the server sends a `CONNECT_ACK` event with client ID.
  - Client sends `{ "type": "PING", "timestamp": "..." }` and receives `{ "type": "PONG", "timestamp": "..." }`.
