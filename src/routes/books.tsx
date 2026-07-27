import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, Loader2, Star, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import {
  deleteBook,
  getBookPdfUrl,
  listBooks,
  setBookOfficial,
  uploadBook,
} from "@/lib/books.functions";

const booksQuery = queryOptions({
  queryKey: ["books"],
  queryFn: () => listBooks(),
});

export const Route = createFileRoute("/books")({
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQuery),
  component: BooksPage,
  head: () => ({
    meta: [
      { title: "Books library — Neeti" },
      { name: "description", content: "Upload UPSC textbooks; Neeti auto-splits chapters and indexes them for RAG." },
      { property: "og:title", content: "Books library — Neeti" },
      { property: "og:description", content: "Your single source of truth for UPSC preparation." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">Failed: {error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const s = reader.result as string;
      resolve(s.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function BooksPage() {
  const { data: books } = useSuspenseQuery(booksQuery);
  const qc = useQueryClient();
  const upload = useServerFn(uploadBook);
  const setOfficial = useServerFn(setBookOfficial);
  const del = useServerFn(deleteBook);
  const getUrl = useServerFn(getBookPdfUrl);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isOfficial, setIsOfficial] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setErr("Give the book a title.");
      return;
    }
    if (!file && !text.trim()) {
      setErr("Attach a PDF or paste text.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      let base64: string | undefined;
      let mimeType: string | undefined;
      let filename: string | undefined;
      if (file) {
        base64 = await readFileAsBase64(file);
        mimeType = file.type || "application/pdf";
        filename = file.name;
      }
      const res = await upload({
        data: {
          title: title.trim(),
          author: author.trim() || null,
          isOfficial,
          base64,
          mimeType,
          filename,
          text: text.trim() || undefined,
        },
      });
      setMsg(`Ingested ${res.sections} sections · ${res.chunks} chunks.`);
      setTitle("");
      setAuthor("");
      setFile(null);
      setText("");
      await qc.invalidateQueries({ queryKey: ["books"] });
      await qc.invalidateQueries({ queryKey: ["chapters"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOfficial(id: string, next: boolean) {
    await setOfficial({ data: { id, isOfficial: next } });
    await qc.invalidateQueries({ queryKey: ["books"] });
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this book, its chapters, and all its chunks?")) return;
    await del({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["books"] });
    await qc.invalidateQueries({ queryKey: ["chapters"] });
  }

  async function openPdf(id: string) {
    const { url } = await getUrl({ data: { id } });
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <div className="text-sm font-medium">Books library</div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your single source of truth</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Upload the standard textbook (e.g. Laxmikanth). Neeti detects chapters, chunks the content,
          and adds them to your reader. Mark books as <span className="font-medium">Official</span> so
          Strict Mode can restrict RAG answers to them.
        </p>

        <form onSubmit={onUpload} className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title (e.g. Indian Polity)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (optional)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="file"
              accept="application/pdf,image/*,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOfficial}
                onChange={(e) => setIsOfficial(e.target.checked)}
              />
              Mark as official
            </label>
          </div>
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="…or paste raw text if you don't have a PDF."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {err && <div className="mt-3 text-xs text-destructive">{err}</div>}
          {msg && <div className="mt-3 text-xs text-primary">{msg}</div>}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              PDFs are stored privately. You'll get a "Read original" button on each chapter.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {busy ? "Ingesting…" : "Upload & index"}
            </button>
          </div>
        </form>

        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Uploaded books
          </h2>
          {books.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
              No books yet. Upload one above.
            </div>
          )}
          <ul className="space-y-3">
            {books.map((b) => (
              <li key={b.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="font-medium">{b.title}</span>
                      {b.isOfficial && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <Star className="h-2.5 w-2.5" /> Official
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {b.author ? `${b.author} · ` : ""}
                      {b.chapterCount} chapter{b.chapterCount === 1 ? "" : "s"}
                      {b.hasPdf ? " · PDF stored" : " · text only"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.hasPdf && (
                      <button
                        onClick={() => openPdf(b.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Open PDF
                      </button>
                    )}
                    <button
                      onClick={() => toggleOfficial(b.id, !b.isOfficial)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      {b.isOfficial ? "Unmark official" : "Mark official"}
                    </button>
                    <button
                      onClick={() => onDelete(b.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}