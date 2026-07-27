
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_count integer DEFAULT 6,
  official_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  chapter_id uuid,
  book_id uuid,
  heading text,
  content text,
  page_start integer,
  page_end integer,
  chapter_slug text,
  chapter_title text,
  book_title text,
  is_official boolean,
  similarity double precision
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    ch.id,
    ch.chapter_id,
    ch.book_id,
    ch.heading,
    ch.content,
    ch.page_start,
    ch.page_end,
    c.slug AS chapter_slug,
    c.title AS chapter_title,
    b.title AS book_title,
    COALESCE(b.is_official, false) AS is_official,
    1 - (ch.embedding <=> query_embedding) AS similarity
  FROM public.chunks ch
  LEFT JOIN public.chapters c ON c.id = ch.chapter_id
  LEFT JOIN public.books b ON b.id = ch.book_id
  WHERE ch.embedding IS NOT NULL
    AND (NOT official_only OR COALESCE(b.is_official, false) = true)
  ORDER BY ch.embedding <=> query_embedding
  LIMIT match_count;
$$;
