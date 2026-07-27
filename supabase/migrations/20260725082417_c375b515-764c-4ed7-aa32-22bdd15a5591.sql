CREATE POLICY "books read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'books');
CREATE POLICY "books insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'books');
CREATE POLICY "books update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'books') WITH CHECK (bucket_id = 'books');
CREATE POLICY "books delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'books');