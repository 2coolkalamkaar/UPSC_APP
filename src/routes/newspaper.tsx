import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText, Loader2, Newspaper, Upload } from "lucide-react";
import { useRef, useState } from "react";

import {
  listCurrentAffairs,
  uploadNewspaperFile,
  uploadNewspaperText,
} from "@/lib/currentaffairs.functions";

const libQuery = queryOptions({
  queryKey: ["current-affairs"],
  queryFn: () => listCurrentAffairs(),
});

export const Route = createFileRoute("/newspaper")({
  loader: ({ context }) => context.queryClient.ensureQueryData(libQuery),
  component: NewspaperPage,
  head: () => ({
    meta: [
      { title: "Newspaper — Neeti" },
      { name: "description", content: "Upload today's newspaper and link current affairs to chapters." },
      { property: "og:title", content: "Newspaper — Neeti" },
      { property: "og:description", content: "AI extracts UPSC-relevant news and maps it to chapters." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function NewspaperPage() {
  const { data } = useSuspenseQuery(libQuery);
  const qc = useQueryClient();
  const upFile = useServerFn(uploadNewspaperFile);
  const upText = useServerFn(uploadNewspaperText);

  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submitFile(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    setErr(null);
    setStatus(`Reading ${f.name}…`);
    try {
      const base64 = await fileToBase64(f);
      const res = await upFile({
        data: {
          filename: f.name,
          mimeType: f.type || (f.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
          base64,
          source: source || undefined,
          published_on: date || undefined,
        },
      });
      setStatus(`Extracted ${res.extracted}, saved ${res.inserted} news items.`);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["current-affairs"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    setStatus("Structuring text…");
    try {
      const res = await upText({
        data: {
          text,
          source: source || undefined,
          published_on: date || undefined,
        },
      });
      setStatus(`Extracted ${res.extracted}, saved ${res.inserted} news items.`);
      setText("");
      await qc.invalidateQueries({ queryKey: ["current-affairs"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Newspaper className="h-3 w-3" /> {data.total} news items indexed
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Today's newspaper</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a page (PDF or photo) or paste article text — the AI extracts UPSC-relevant items,
          tags them by topic, and links them to your chapter reader.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (e.g. The Hindu)"
            className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-xs"
          />
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-xs"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
          <form onSubmit={submitFile} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" /> Upload page (PDF or image)
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="mt-3 block w-full text-xs"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />} Extract & index
            </button>
          </form>

          <form onSubmit={submitText} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" /> Paste article text
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste one or more news items."
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />} Parse & save
            </button>
          </form>
        </div>

        {status && <div className="mt-4 text-xs text-muted-foreground">{status}</div>}
        {err && <div className="mt-2 text-xs text-destructive">{err}</div>}

        <section className="mt-10">
          <h2 className="text-sm font-medium">Recent items</h2>
          {data.items.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No current-affairs items yet. Upload a page to get started.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.items.map((n) => (
                <li key={n.id} className="rounded-md border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>{n.source}</span>
                    {n.published_on && <span>· {n.published_on}</span>}
                    {n.topic && <span>· {n.topic}</span>}
                  </div>
                  <div className="mt-1 text-sm font-medium">{n.title}</div>
                  <div className="mt-1 text-xs text-foreground/80">{n.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}