
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_affairs_id uuid NOT NULL REFERENCES public.current_affairs(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  reason text NOT NULL,
  similarity double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (current_affairs_id, chapter_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all notifications"
ON public.notifications
FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE INDEX notifications_unread_idx ON public.notifications (read_at, created_at DESC);

CREATE OR REPLACE FUNCTION public.match_chapters_for_news(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.5,
  max_chapters integer DEFAULT 5
)
RETURNS TABLE(chapter_id uuid, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT chapter_id,
         MAX(1 - (embedding::halfvec(3072) <=> query_embedding::halfvec(3072))) AS similarity
  FROM public.chunks
  WHERE embedding IS NOT NULL
  GROUP BY chapter_id
  HAVING MAX(1 - (embedding::halfvec(3072) <=> query_embedding::halfvec(3072))) >= match_threshold
  ORDER BY similarity DESC
  LIMIT max_chapters;
$$;
