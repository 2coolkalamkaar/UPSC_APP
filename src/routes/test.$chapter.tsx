import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { recordAttempt } from "@/lib/upsc.functions";
import { chapterQuizMixed, relatedPyqs } from "@/lib/pyq.functions";
import type { Quiz } from "@/lib/upsc.server";

export const Route = createFileRoute("/test/$chapter")({
  component: TestChapter,
  head: ({ params }) => ({
    meta: [
      { title: `Test: ${params.chapter} — Neeti` },
      { name: "description", content: `Chapter quiz for ${params.chapter}.` },
      { property: "og:title", content: `Test: ${params.chapter} — Neeti` },
      { property: "og:description", content: `AI-generated MCQs for ${params.chapter}.` },
    ],
  }),
});

function TestChapter() {
  const { chapter } = Route.useParams();
  const router = useRouter();
  const genQuiz = useServerFn(chapterQuizMixed);
  const record = useServerFn(recordAttempt);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const q = await genQuiz({ data: { slug: chapter, count: 10, pyqRatio: 0.5 } });
        if (!alive) return;
        if (q.questions.length === 0) {
          setErr("Could not generate questions. Please try again.");
        } else {
          setQuiz({ questions: q.questions });
          setAnswers(new Array(q.questions.length).fill(null));
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Failed to load quiz.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chapter, genQuiz]);

  async function finish() {
    if (!quiz) return;
    setSaving(true);
    try {
      const results = quiz.questions.map((q, i) => ({
        question: q.question,
        correct: answers[i] === q.correct_index,
        user_answer: answers[i],
        correct_answer: q.correct_index,
        explanation: q.explanation,
      }));
      await record({ data: { chapterSlug: chapter, mode: "chapter", results } });
      setSubmitted(true);
      router.invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <div className="text-xs text-muted-foreground">{chapter}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating your quiz…
          </div>
        )}
        {err && <div className="text-sm text-destructive">{err}</div>}
        {quiz && !submitted && (
          <QuizRunner
            quiz={quiz}
            idx={idx}
            setIdx={setIdx}
            answers={answers}
            setAnswers={setAnswers}
            onFinish={finish}
            saving={saving}
          />
        )}
        {quiz && submitted && <QuizReview quiz={quiz} answers={answers} chapter={chapter} />}
      </main>
    </div>
  );
}

function QuizRunner({
  quiz,
  idx,
  setIdx,
  answers,
  setAnswers,
  onFinish,
  saving,
}: {
  quiz: Quiz;
  idx: number;
  setIdx: (n: number) => void;
  answers: (number | null)[];
  setAnswers: (a: (number | null)[]) => void;
  onFinish: () => void;
  saving: boolean;
}) {
  const q = quiz.questions[idx];
  const selected = answers[idx];
  const last = idx === quiz.questions.length - 1;
  const answered = answers.filter((a) => a !== null).length;

  function pick(i: number) {
    const next = [...answers];
    next[idx] = i;
    setAnswers(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Question {idx + 1} of {quiz.questions.length}
        </div>
        <div>{answered} answered</div>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((idx + 1) / quiz.questions.length) * 100}%` }}
        />
      </div>
      <h2 className="mt-6 text-lg font-medium leading-snug">{q.question}</h2>
      <div className="mt-4 space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
              selected === i
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-foreground/30"
            }`}
          >
            <span className="mr-2 font-medium text-muted-foreground">{"ABCD"[i]}.</span>
            {opt}
          </button>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        {last ? (
          <button
            onClick={onFinish}
            disabled={selected === null || saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </button>
        ) : (
          <button
            onClick={() => setIdx(idx + 1)}
            disabled={selected === null}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function QuizReview({
  quiz,
  answers,
  chapter,
}: {
  quiz: Quiz;
  answers: (number | null)[];
  chapter: string;
}) {
  return <QuizReviewInner quiz={quiz} answers={answers} chapter={chapter} />;
}

function QuizReviewInner({
  quiz,
  answers,
  chapter,
}: {
  quiz: Quiz;
  answers: (number | null)[];
  chapter: string;
}) {
  const fetchPyqs = useServerFn(relatedPyqs);
  const [pyqs, setPyqs] = useState<
    Array<{ id: string; question: string; options: string[]; correct_index: number | null; explanation: string | null; year: number | null; topic: string | null }>
  >([]);
  useEffect(() => {
    let alive = true;
    fetchPyqs({ data: { slug: chapter, limit: 5 } })
      .then((r) => {
        if (alive) setPyqs(r.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [chapter, fetchPyqs]);
  const score = quiz.questions.filter((q, i) => answers[i] === q.correct_index).length;
  const total = quiz.questions.length;
  const pct = Math.round((100 * score) / total);
  const weak = pct < 70;
  return (
    <div>
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">You scored</div>
        <div className="mt-1 text-5xl font-semibold">{pct}%</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {score} of {total} correct
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          We&apos;ve scheduled revision quizzes at +3, +7, and +14 days.
        </div>
        {weak && (
          <div className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            Weak area detected — re-read this chapter before your next attempt.
          </div>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <Link
            to="/read/$chapter"
            params={{ chapter }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            Re-read chapter
          </Link>
          <Link
            to="/"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Home
          </Link>
        </div>
      </div>

      {pyqs.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-medium">Related previous-year questions</h3>
          <p className="text-xs text-muted-foreground">Matched to this chapter by semantic similarity.</p>
          <ul className="mt-3 space-y-3">
            {pyqs.map((p) => (
              <li key={p.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {p.year && <span>UPSC {p.year}</span>}
                  {p.topic && <span>· {p.topic}</span>}
                </div>
                <div className="mt-1 text-sm font-medium">{p.question}</div>
                {p.options.length > 0 && (
                  <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {p.options.map((o, i) => (
                      <li key={i} className={p.correct_index === i ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}>
                        {"ABCD"[i] ?? String.fromCharCode(65 + i)}. {o}
                      </li>
                    ))}
                  </ol>
                )}
                {p.explanation && <div className="mt-2 text-xs text-foreground/80">{p.explanation}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-6 space-y-4">
        {quiz.questions.map((q, i) => {
          const ok = answers[i] === q.correct_index;
          return (
            <li key={i} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">{q.question}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Correct: <span className="font-medium text-foreground">{q.options[q.correct_index]}</span>
                    {!ok && answers[i] !== null && (
                      <>
                        {" "}
                        · You picked:{" "}
                        <span className="font-medium">{q.options[answers[i] as number]}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-foreground/80">{q.explanation}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}