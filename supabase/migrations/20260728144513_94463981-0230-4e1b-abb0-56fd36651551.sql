BEGIN;

-- Subject metadata for multi-subject scaling later.
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'Polity';
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS syllabus_tag text;
ALTER TABLE public.current_affairs ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'Polity';

-- User ownership columns for progress isolation.
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.question_results ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.revision_schedule ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.mains_evaluations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add user_id indexes for performance.
CREATE INDEX IF NOT EXISTS quiz_attempts_user_idx ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS question_results_user_idx ON public.question_results(user_id);
CREATE INDEX IF NOT EXISTS revision_schedule_user_idx ON public.revision_schedule(user_id);
CREATE INDEX IF NOT EXISTS mains_evaluations_user_idx ON public.mains_evaluations(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id);

-- Profiles table for app identity.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update RLS policies for user-owned tables.
DROP POLICY IF EXISTS "public all quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "Users own quiz attempts" ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public all question_results" ON public.question_results;
CREATE POLICY "Users own question results" ON public.question_results
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public all revision_schedule" ON public.revision_schedule;
CREATE POLICY "Users own revision schedule" ON public.revision_schedule
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public all mains_evaluations" ON public.mains_evaluations;
CREATE POLICY "Users own mains evaluations" ON public.mains_evaluations
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public all notifications" ON public.notifications;
CREATE POLICY "Users own notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

-- Public content tables remain publicly readable; writes happen via service role.
DROP POLICY IF EXISTS "public all chapters" ON public.chapters;
CREATE POLICY "Public read chapters" ON public.chapters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated manage chapters" ON public.chapters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all chunks" ON public.chunks;
CREATE POLICY "Public read chunks" ON public.chunks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated manage chunks" ON public.chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all books" ON public.books;
CREATE POLICY "Public read books" ON public.books FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated manage books" ON public.books FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public read pyqs" ON public.pyqs;
DROP POLICY IF EXISTS "service manages pyqs" ON public.pyqs;
CREATE POLICY "Public read pyqs" ON public.pyqs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated manage pyqs" ON public.pyqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all current_affairs" ON public.current_affairs;
CREATE POLICY "Public read current_affairs" ON public.current_affairs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated manage current_affairs" ON public.current_affairs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Make sure all public tables have GRANTs for the roles the policies allow.
GRANT SELECT ON public.chapters TO anon, authenticated;
GRANT SELECT ON public.chunks TO anon, authenticated;
GRANT SELECT ON public.books TO anon, authenticated;
GRANT SELECT ON public.pyqs TO anon, authenticated;
GRANT SELECT ON public.current_affairs TO anon, authenticated;

GRANT ALL ON public.chapters, public.chunks, public.books, public.pyqs, public.current_affairs TO service_role;

COMMIT;