BEGIN;

-- Public content tables should be read-only for end users.
-- Writes happen through the service-role ingestion pipeline (supabaseAdmin).
DROP POLICY IF EXISTS "Authenticated manage chapters" ON public.chapters;
DROP POLICY IF EXISTS "Authenticated manage chunks" ON public.chunks;
DROP POLICY IF EXISTS "Authenticated manage books" ON public.books;
DROP POLICY IF EXISTS "Authenticated manage pyqs" ON public.pyqs;
DROP POLICY IF EXISTS "Authenticated manage current_affairs" ON public.current_affairs;

-- Ensure only SELECT grants remain for public content.
REVOKE ALL ON public.chapters, public.chunks, public.books, public.pyqs, public.current_affairs FROM authenticated;
GRANT SELECT ON public.chapters, public.chunks, public.books, public.pyqs, public.current_affairs TO authenticated;
GRANT SELECT ON public.chapters, public.chunks, public.books, public.pyqs, public.current_affairs TO anon;

COMMIT;