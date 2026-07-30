ALTER TABLE public.notifications DROP CONSTRAINT notifications_current_affairs_id_chapter_id_key;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_current_affairs_id_chapter_id_user_id_key UNIQUE (current_affairs_id, chapter_id, user_id);

DROP POLICY IF EXISTS "Users own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users own quiz attempts" ON public.quiz_attempts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users own question results" ON public.question_results;
CREATE POLICY "Users own question results" ON public.question_results FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users own revision schedule" ON public.revision_schedule;
CREATE POLICY "Users own revision schedule" ON public.revision_schedule FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users own mains evaluations" ON public.mains_evaluations;
CREATE POLICY "Users own mains evaluations" ON public.mains_evaluations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users own notifications" ON public.notifications;
CREATE POLICY "Users own notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
