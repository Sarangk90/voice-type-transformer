# VoiceType

A mobile-first voice transcription app. Record audio, get it transcribed using AI (OpenAI Whisper or Groq), and optionally polish the result with an LLM. Works on iPhone, Android, and the web.

## Features

- Tap-to-record audio with a live waveform visualizer
- AI-powered transcription via OpenAI Whisper or Groq
- Optional transcript polishing/cleanup using an LLM
- Transcription history stored locally on your device
- One-tap copy to clipboard
- Haptic feedback on native devices
- Bring your own API key (stored securely on device)

## How It Works

1. Open the app and tap the record button
2. Speak — you'll see a live waveform as you record
3. Tap stop — your audio is sent to the AI transcription service
4. The transcript appears on screen, automatically copied to your clipboard
5. Optionally, the transcript is polished by an LLM for cleaner output

## Setup

### API Key

You need an API key from one of the supported providers:

- **OpenAI** — [Get an API key](https://platform.openai.com/api-keys)
- **Groq** — [Get an API key](https://console.groq.com/keys)

Open the settings screen (gear icon) and enter your key. It's stored securely on your device and never sent to our servers.

### Running Locally

```bash
npm install
```

Start both the backend and frontend:

```bash
npm run server:dev   # Express backend on port 5000
npm run expo:dev     # Expo dev server on port 8081
```

### Using on iPhone (Without an Apple Developer Account)

VoiceType is deployed as a web app. Open the published URL in Safari on your iPhone and add it to your home screen for an app-like experience.

## Tech Stack

- **Frontend**: Expo (React Native) with expo-router, React Query, Reanimated
- **Backend**: Express 5 (Node.js/TypeScript)
- **Transcription**: OpenAI Whisper API or Groq Whisper endpoint
- **Polishing**: OpenAI or Groq chat completions
- **Storage**: Local device storage (AsyncStorage + SecureStore)

## Project Structure

```
app/               # Expo Router screens
  index.tsx        # Main recording screen
  settings.tsx     # API key & provider settings
  history/         # Transcription history
components/        # Reusable UI components
lib/               # Utilities (API keys, transcription logic)
server/            # Express backend
  index.ts         # Server entry point
  routes.ts        # API route registration
scripts/           # Build scripts
```

## License

Private project.
