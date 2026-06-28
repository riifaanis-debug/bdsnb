
CREATE POLICY "Public read generated-audio" ON storage.objects FOR SELECT USING (bucket_id = 'generated-audio');
CREATE POLICY "Public upload generated-audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-audio');
CREATE POLICY "Public update generated-audio" ON storage.objects FOR UPDATE USING (bucket_id = 'generated-audio') WITH CHECK (bucket_id = 'generated-audio');
CREATE POLICY "Public delete generated-audio" ON storage.objects FOR DELETE USING (bucket_id = 'generated-audio');
