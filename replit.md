# VoiceType - replit.md

## Overview

VoiceType is a mobile-first voice transcription app built with Expo (React Native). Users record audio, which gets transcribed using AI services (OpenAI Whisper or Groq), then optionally polished/cleaned up using an LLM. The app stores transcription history locally and supports copying results to the clipboard. It runs as an Expo app with an Express backend server.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: Three main screens — recording (index), settings, and history — using Stack navigation
- **State Management**: React Query (`@tanstack/react-query`) for server state, React `useState` for local component state
- **UI**: Custom components with React Native's built-in StyleSheet, animated with `react-native-reanimated`. No third-party UI library — everything is hand-rolled.
- **Fonts**: Inter font family loaded via `@expo-google-fonts/inter`
- **Routing structure**:
  - `app/index.tsx` — Main recording screen with record button, waveform visualizer, and transcript display
  - `app/settings.tsx` — Modal screen for managing API keys and provider selection
  - `app/history/index.tsx` — List of past transcriptions
  - `app/_layout.tsx` — Root layout with providers (QueryClient, GestureHandler, KeyboardProvider)

### Backend (Express)

- **Framework**: Express 5 running on Node.js
- **Location**: `server/` directory with `index.ts` (entry point), `routes.ts` (API route registration), and `storage.ts` (in-memory storage)
- **Current state**: The backend is minimal — it has a users table schema and in-memory storage but no real API routes implemented yet. Routes should be prefixed with `/api`.
- **CORS**: Configured to allow Replit domains and localhost origins for development
- **Build**: Uses `esbuild` to bundle server code for production, `tsx` for development

### Data Storage

- **Local storage**: `AsyncStorage` for transcription history (up to 100 entries) and web API key fallback
- **Secure storage**: `expo-secure-store` for API keys on native platforms, falls back to AsyncStorage on web
- **Database schema**: PostgreSQL schema defined with Drizzle ORM in `shared/schema.ts`. Currently only has a `users` table. Drizzle Kit configured for push migrations.
- **Server storage**: Currently uses `MemStorage` (in-memory Map) — not connected to Postgres yet. The `IStorage` interface in `server/storage.ts` is ready to be swapped to a database-backed implementation.

### API Key Management

- Users provide their own API keys (OpenAI or Groq) — stored securely on device
- Provider selection (OpenAI vs Groq) is persisted locally

### Audio & Transcription Pipeline

**Native (iOS/Android):**
1. Record audio using `expo-av`
2. Upload audio file directly to OpenAI Whisper API or Groq's Whisper endpoint using `expo-file-system` `File` class and `expo/fetch`
3. Polish/clean the transcript by calling the LLM chat completions API directly from the device
4. Auto-copy result to clipboard and save to local history

**Web:**
1. Record audio using `expo-av`
2. Send audio as base64 to the Express backend (`/api/transcribe`) which proxies to OpenAI/Groq (needed for CORS)
3. Polish via backend (`/api/polish`) which proxies to the LLM API
4. Auto-copy result to clipboard and save to local history

### Key Patterns

- **Platform-split networking**: Native calls APIs directly (no CORS on native); web uses backend proxy routes (CORS restriction)
- **expo/fetch**: Used for all API calls on native to avoid Hermes URL parsing issues with the global `fetch`
- **expo-file-system File class**: Used on native for uploading audio files via FormData
- **Platform-aware utilities**: Functions in `lib/api-keys.ts` branch between SecureStore (native) and AsyncStorage (web)
- **Error handling**: Custom ErrorBoundary component wrapping the app
- **Haptic feedback**: Used throughout for native interactions (recording, copying, deleting)
- **Development proxy**: Expo packager proxy configured for Replit's dev domain
- **Port mapping**: Port 8081 (Expo/Metro) is externally accessible on default HTTPS domain; port 5000 (Express) is only accessible internally — native apps must NOT route through port 5000

## External Dependencies

### Third-Party APIs (Client-Side)
- **OpenAI API** (`api.openai.com/v1`) — Whisper model for audio transcription, plus chat completions for transcript polishing
- **Groq API** (`api.groq.com/openai/v1`) — Alternative provider using `whisper-large-v3-turbo` model

### Database
- **PostgreSQL** — Configured via `DATABASE_URL` environment variable, schema managed by Drizzle ORM and Drizzle Kit. Currently has a `users` table but is not actively connected in the storage layer.

### Key NPM Packages
- `expo` ~54.0.27 — Core framework
- `expo-router` ~6.0.17 — File-based routing
- `expo-av` — Audio recording
- `expo-secure-store` — Secure credential storage (native)
- `expo-clipboard` — Clipboard access
- `expo-haptics` — Haptic feedback
- `react-native-reanimated` — Animations
- `react-native-gesture-handler` — Gesture handling
- `react-native-keyboard-controller` — Keyboard-aware views
- `@tanstack/react-query` — Data fetching/caching
- `drizzle-orm` + `drizzle-zod` — ORM and schema validation
- `express` ^5.0.1 — Backend server
- `pg` — PostgreSQL client
- `http-proxy-middleware` — Dev proxy for Expo bundler