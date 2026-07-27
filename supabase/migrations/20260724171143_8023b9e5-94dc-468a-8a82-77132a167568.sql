CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.pyqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'UPSC_Prelims',
  year INTEGER,
  subject TEXT NOT NULL DEFAULT 'Polity',
  topic TEXT,
  difficulty TEXT,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INTEGER,
  explanation TEXT,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  embedding vector(3072),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pyqs TO anon, authenticated;
GRANT ALL ON public.pyqs TO service_role;

ALTER TABLE public.pyqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read pyqs" ON public.pyqs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service manages pyqs" ON public.pyqs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS pyqs_chapter_idx ON public.pyqs(chapter_id);
CREATE INDEX IF NOT EXISTS pyqs_topic_idx ON public.pyqs(topic);

CREATE INDEX IF NOT EXISTS pyqs_embedding_idx
  ON public.pyqs USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_pyqs(
  query_embedding vector(3072),
  match_count int DEFAULT 5,
  filter_subject text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question text,
  options jsonb,
  correct_index int,
  explanation text,
  year int,
  topic text,
  difficulty text,
  source text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT p.id, p.question, p.options, p.correct_index, p.explanation,
         p.year, p.topic, p.difficulty, p.source,
         1 - (p.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.pyqs p
  WHERE p.embedding IS NOT NULL
    AND (filter_subject IS NULL OR p.subject = filter_subject)
  ORDER BY p.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;