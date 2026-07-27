import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { listPyqLibrary, uploadPyqFile, uploadPyqText } from "@/lib/pyq.functions";

const libQuery = queryOptions({
  queryKey: ["pyq-library"],
  queryFn: () => listPyqLibrary(),
});

export const Route = createFileRoute("/pyq")({
  loader: ({ context }) => context.queryClient.ensureQueryData(libQuery),
  component: PyqPage,
  head: () => ({
    meta: [
      { title: "PYQ library — Neeti" },
      { name: "description", content: "Upload UPSC previous-year questions and match them to chapters." },
      { property: "og:title", content: "PYQ library — Neeti" },
      { property: "og:description", content: "PDF/image PYQ ingestion with topic mapping." },
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

function PyqPage() {
  const { data } = useSuspenseQuery(libQuery);
  const qc = useQueryClient();
  const uploadFile = useServerFn(uploadPyqFile);
  const uploadText = useServerFn(uploadPyqText);

  const fileRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
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
      const res = await uploadFile({
        data: {
          filename: f.name,
          mimeType: f.type || (f.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
          base64,
          year: year ? Number(year) : undefined,
          topic: topic || undefined,
        },
      });
      setStatus(`Extracted ${res.extracted}, saved ${res.inserted} PYQs.`);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["pyq-library"] });
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
      const res = await uploadText({
        data: { text, year: year ? Number(year) : undefined, topic: topic || undefined },
      });
      setStatus(`Extracted ${res.extracted}, saved ${res.inserted} PYQs.`);
      setText("");
      await qc.invalidateQueries({ queryKey: ["pyq-library"] });
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
          <div className="text-xs text-muted-foreground">PYQ library · {data.total} saved</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Add previous-year questions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF or a photo of a paper — Gemini extracts questions, options, answers, and topic
          metadata, then indexes them so relevant PYQs appear alongside your chapter tests.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <form onSubmit={submitFile} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" /> Upload PDF or image
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="mt-3 block w-full text-xs"
              disabled={busy}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Year (e.g. 2022)"
                className="rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic hint (optional)"
                className="rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
            </div>
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
              <FileText className="h-4 w-4" /> Paste question text
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste one or more MCQs; the AI will parse them."
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
          <h2 className="text-sm font-medium">Recently added</h2>
          {data.items.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No PYQs yet. Upload a paper to get started.
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {data.items.map((p) => (
                <li key={p.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {p.year && <span>UPSC {p.year}</span>}
                    {p.topic && <span>· {p.topic}</span>}
                    {p.difficulty && <span>· {p.difficulty}</span>}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px]">{p.question}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}