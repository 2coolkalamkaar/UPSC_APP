# 🏛️ UPSC Navigator ("Neeti") — AI-Tutored UPSC Polity Study Platform

**Neeti** is a full-stack, AI-powered study companion designed specifically for civil services aspirants preparing for Indian Polity (UPSC CSE Prelims & Mains).

It combines **Retrieval-Augmented Generation (RAG)**, **Spaced Repetition**, **MCQ Generation**, **Mains Rubric Answer Evaluation**, and **Newspaper-to-Syllabus Auto-Mapping**.

---

## ✨ Features

- 📖 **AI-Tutored Chapter Reader**: Read indexed chapters with original PDF viewing side-by-side. Ask questions and get concise, article-cited answers strictly from the textbook.
- ⚡ **Strict Mode**: Toggle Strict Mode to restrict AI responses exclusively to official textbooks (e.g. Laxmikanth).
- 🎯 **Prelims Chapter Tests**: Generate 10-question prelims quizzes per chapter (50% AI-generated, 50% matched from authentic UPSC Previous Year Questions).
- 🔁 **Spaced Repetition Review Queue**: Automated review schedules (+3, +7, and +14 days) after every chapter test. Daily 5-question micro-reviews drawn across all due chapters.
- 🔍 **Topic Explorer**: Search any concept (e.g. *Anti-Defection Law*, *Ordinance Power*). Switch between a **Crisp AI Summary** or **Strict Textbook Passages**, with pinned relevant PYQs and news precedent.
- 📚 **Textbook Ingestion Library**: Upload standard textbooks (PDFs/Images/Text). AI automatically detects chapters, sections, sub-headings, and page ranges.
- 📝 **UPSC Mains Answer Evaluator**: Paste any Mains question and your answer. Get structured, examiner-style feedback scored across 5 rubric criteria (*Introduction*, *Structure*, *Keywords*, *Constitutional Articles*, *Conclusion*).
- 📰 **Newspaper & Current Affairs Ingestion**: Upload daily newspaper clippings. AI extracts UPSC-relevant news, tags topics, and automatically alerts you when news matches chapters you are actively studying or struggling with (< 70% accuracy).
- 📊 **Polity Analytics Dashboard**: Track per-chapter accuracy %, weekly weak areas, and total attempts.

---

## 🛠️ Technology Stack

- **Frontend / Framework**: [TanStack Start](https://tanstack.com/router/latest/docs/framework/react/overview) (React 19, TypeScript, SSR, File-based Routing)
- **Styling**: Tailwind CSS v4 + Radix UI primitives + Lucide Icons + Recharts
- **Database & Search**: Self-hosted [Supabase](https://supabase.com) (PostgreSQL + `pgvector` extension for cosine similarity search)
- **AI & Embeddings**: Direct [Google AI Studio SDK](https://github.com/vercel/ai/tree/main/packages/google) (`@ai-sdk/google`)
  - **Text & Vision Generation**: `gemini-2.5-flash`
  - **Vector Embeddings**: `text-embedding-004`
- **Runtime**: [Bun](https://bun.sh)

---

## 🚀 Quick Start (Local Setup)

### Prerequisites

1. **Bun** installed (`curl -fsSL https://bun.sh/install | bash`)
2. **Docker** installed & running (for local Supabase database stack)
3. **Supabase CLI** (`curl -sSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz`)
4. **Google AI Studio API Key** (Free from [Google AI Studio](https://aistudio.google.com/apikey))

### Setup Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/2coolkalamkaar/UPSC_APP.git
   cd UPSC_APP
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your `GOOGLE_API_KEY` to `.env`.

4. **Start Local Supabase Stack & Apply Database Migrations**:
   ```bash
   supabase start
   ```
   *This starts Postgres, Auth, Storage, and pgvector locally on port `54321` and applies all database migrations automatically.*

   Update `.env` with the `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` printed by `supabase status`.

5. **Run the Development Server**:
   ```bash
   bun run dev
   ```

6. Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 📂 Project Structure

```
├── src/
│   ├── routes/                # TanStack Start file-based routes
│   │   ├── __root.tsx         # Root layout & SEO head meta
│   │   ├── index.tsx          # Home dashboard
│   │   ├── read.$chapter.tsx  # Chapter reader + AI Q&A + news context
│   │   ├── test.$chapter.tsx  # Prelims chapter quiz runner & review
│   │   ├── revision.tsx       # Daily spaced-repetition review queue
│   │   ├── explore.tsx        # Concept search (Crisp vs Strict Textbook)
│   │   ├── books.tsx          # Textbook upload & library management
│   │   ├── pyq.tsx            # Previous Year Question ingestion
│   │   ├── newspaper.tsx      # Newspaper clipping ingestion
│   │   ├── mains.tsx          # Mains answer rubric evaluator
│   │   ├── analyze.tsx        # Accuracy & weak area analytics
│   │   └── notifications.tsx  # Current-affairs chapter match notifications
│   ├── lib/                   # Server functions & business logic
│   │   ├── upsc.server.ts     # Core RAG, quiz gen, mains evaluation
│   │   ├── books.server.ts    # Textbook chunking & ingestion pipeline
│   │   ├── explore.server.ts  # Semantic search & match rationale logic
│   │   ├── pyq.server.ts      # PYQ extraction & vector indexing
│   │   ├── currentaffairs.server.ts # News parsing & smart notification matching
│   │   └── ai-gateway.server.ts     # Google AI Studio provider & embedding helper
│   └── integrations/supabase/ # Supabase server client (RLS bypass) & types
├── supabase/
│   └── migrations/            # PostgreSQL schemas, vector tables, and RPC functions
├── .env.example               # Template environment configuration
├── package.json               # Dependencies & build scripts
└── vite.config.ts             # Vite + TanStack Start configuration
```

---

## 🛡️ License

Private repository. Built for UPSC Civil Services Preparation.
