
ALTER TABLE public.mains_evaluations
  ADD COLUMN IF NOT EXISTS model_answer text,
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS challenge_date date,
  ADD COLUMN IF NOT EXISTS prompt_source text NOT NULL DEFAULT 'custom';

CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  seconds integer NOT NULL CHECK (seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own study sessions"
  ON public.study_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS study_sessions_user_chapter_idx
  ON public.study_sessions (user_id, chapter_id);
CREATE INDEX IF NOT EXISTS study_sessions_user_created_idx
  ON public.study_sessions (user_id, created_at DESC);
