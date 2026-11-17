-- Migration: Convert from 3072-dim to 384-dim local embeddings

-- 1. Drop existing HNSW indexes
DROP INDEX IF EXISTS pyqs_embedding_idx;
DROP INDEX IF EXISTS current_affairs_embedding_idx;

-- 2. Alter column types (this will clear existing data as dimensions change)
ALTER TABLE public.chunks ALTER COLUMN embedding TYPE vector(384);
ALTER TABLE public.pyqs ALTER COLUMN embedding TYPE vector(384);
ALTER TABLE public.current_affairs ALTER COLUMN embedding TYPE vector(384);

-- 3. Recreate HNSW indexes for 384 dims
CREATE INDEX pyqs_embedding_idx ON public.pyqs USING hnsw ((embedding::halfvec(384)) halfvec_cosine_ops);
CREATE INDEX current_affairs_embedding_idx ON public.current_affairs USING hnsw ((embedding::halfvec(384)) halfvec_cosine_ops);

-- 4. Recreate match functions

-- match_pyqs
DROP FUNCTION IF EXISTS public.match_pyqs;
CREATE OR REPLACE FUNCTION public.match_pyqs(
  query_embedding vector(384),
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
         1 - (p.embedding::halfvec(384) <=> query_embedding::halfvec(384)) AS similarity
  FROM public.pyqs p
  WHERE p.embedding IS NOT NULL
    AND (filter_subject IS NULL OR p.subject = filter_subject)
  ORDER BY p.embedding::halfvec(384) <=> query_embedding::halfvec(384)
  LIMIT match_count;
$$;


-- match_current_affairs
DROP FUNCTION IF EXISTS public.match_current_affairs;
CREATE OR REPLACE FUNCTION public.match_current_affairs(
  query_embedding vector(384),
  match_count int DEFAULT 3,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  title text,
  summary text,
  source text,
  topic text,
  published_on date,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT c.id, c.title, c.summary, c.source, c.topic, c.published_on,
         1 - (c.embedding::halfvec(384) <=> query_embedding::halfvec(384)) AS similarity
  FROM public.current_affairs c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding::halfvec(384) <=> query_embedding::halfvec(384)
  LIMIT match_count;
$$;


-- match_chunks
DROP FUNCTION IF EXISTS public.match_chunks;
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(384),
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


-- match_chapters_for_news
DROP FUNCTION IF EXISTS public.match_chapters_for_news;
CREATE OR REPLACE FUNCTION public.match_chapters_for_news(
  query_embedding vector(384),
  match_threshold double precision DEFAULT 0.5,
  max_chapters integer DEFAULT 5
)
RETURNS TABLE(chapter_id uuid, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT chapter_id,
         MAX(1 - (embedding::halfvec(384) <=> query_embedding::halfvec(384))) AS similarity
  FROM public.chunks
  WHERE embedding IS NOT NULL
  GROUP BY chapter_id
  HAVING MAX(1 - (embedding::halfvec(384) <=> query_embedding::halfvec(384))) >= match_threshold
  ORDER BY similarity DESC
  LIMIT max_chapters;
$$;
