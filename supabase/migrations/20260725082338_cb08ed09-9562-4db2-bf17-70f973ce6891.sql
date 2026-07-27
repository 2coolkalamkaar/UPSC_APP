CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  is_official boolean NOT NULL DEFAULT false,
  storage_path text,
  mime_type text,
  pages integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO anon, authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all books" ON public.books FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id) ON DELETE SET NULL;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id) ON DELETE SET NULL;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS page_start integer;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS page_end integer;

CREATE INDEX IF NOT EXISTS idx_chunks_book ON public.chunks(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON public.chapters(book_id);