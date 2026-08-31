<p align="center">
  <h1 align="center">MasterAnki</h1>
</p>

MasterAnki is an Android app that converts shared text, URLs, PDFs, images, and voice input into AnkiDroid flashcards, powered by **multi-LLM backends** (Gemini, OpenAI, Claude, Ollama, and Chinese providers).

MasterAnki uses a **four-type plugin architecture** (LLM Provider / Input Source / Card Template / Anki Backend) so that new providers, input sources, card templates, and Anki backends can be added without touching the core pipeline.

---

## How It Works

1. **Input** — Share text, URLs, PDFs from any app, or add content manually / via voice.
2. **Inbox** — Content is silently saved to an inbox (Room-backed SQLite).
3. **Extraction** — URLs/PDFs/EPUBs are extracted into readable text on demand.
4. **Generation** — A three-step pipeline (fact extraction → fact scoring → card generation) turns text into flashcards via the active LLM Provider.
5. **Review & Commit** — Cards are reviewed, edited, and committed to AnkiDroid.

## Core Architecture

```
src/
├── lib/
│   ├── plugins/        # Plugin base types, registry, context
│   ├── llm/            # LLM Provider abstraction + 3-step pipeline
│   ├── inputs/         # InputSource plugins (text/url/pdf/...)
│   ├── cards/          # CardTemplate plugins (basic/cloze/io)
│   ├── anki/           # AnkiBackend abstraction + AnkiDroid impl
│   ├── config/         # Unified config source (secure/env/default)
│   ├── queue/          # Offline queue (persisted state machine)
│   ├── stats/          # Learning statistics
│   ├── settings/       # Provider keys, prompts
│   └── validation/     # Strict JSON validation
├── pages/              # Inbox, EntryDetail, Settings, ManualCreate, CardEditor, ...
└── plugins/            # Capacitor plugin interfaces
```

## Development

```bash
npm install
npm run dev          # Web dev server
npm run test         # Unit tests
npm run build        # Build web assets
npx cap sync android # Sync Capacitor
```

### BYOK (Bring Your Own Key)

Production builds: users configure their own API key per Provider in Settings.
Keys are encrypted on-device (Android KeyStore). Development only: create a `.env` file:

```env
VITE_MASTERANKI_PROVIDER_GEMINI_API_KEY=your_key_here
```

## License

MIT — see [LICENSE](./LICENSE).
