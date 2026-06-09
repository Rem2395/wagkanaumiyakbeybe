# CVS Content Answer Generator

This project now includes a local backend that reads your OpenAI API key from `.env`.

## Setup

1. Install Node.js 18+.
2. In the project directory, run:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000` in your browser.

## Local API key storage

Put your OpenAI key in `.env`:

```env
OPENAI_API_KEY=sk-...your-key...
```

The `.env` file is ignored by Git via `.gitignore`.

## Notes

- The browser never stores or sends the API key directly.
- The backend proxy uses the server-side `.env` value.
