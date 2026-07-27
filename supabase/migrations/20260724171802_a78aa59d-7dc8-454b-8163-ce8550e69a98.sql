CREATE TABLE public.current_affairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'Newspaper',
  published_on date,
  title text NOT NULL,
  summary text NOT NULL,
  topic text,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  embedding vector(3072)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.current_affairs TO anon, authenticated;
GRANT ALL ON public.current_affairs TO service_role;

ALTER TABLE public.current_affairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all current_affairs" ON public.current_affairs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX current_affairs_topic_idx ON public.current_affairs (topic);
CREATE INDEX current_affairs_published_idx ON public.current_affairs (published_on DESC);
CREATE INDEX current_affairs_embedding_idx
  ON public.current_affairs USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_current_affairs(
  query_embedding vector,
  match_count integer DEFAULT 5,
  filter_topic text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  summary text,
  source text,
  published_on date,
  topic text,
  similarity double precision
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.id, c.title, c.summary, c.source, c.published_on, c.topic,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.current_affairs c
  WHERE c.embedding IS NOT NULL
    AND (filter_topic IS NULL OR c.topic ILIKE '%' || filter_topic || '%')
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;