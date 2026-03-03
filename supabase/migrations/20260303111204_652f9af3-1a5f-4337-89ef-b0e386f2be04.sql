
-- Create storage bucket for drawing PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('desenhos', 'desenhos', true);

-- Allow public read access
CREATE POLICY "Public read access for desenhos"
ON storage.objects FOR SELECT
USING (bucket_id = 'desenhos');

-- Allow anyone to upload to desenhos bucket
CREATE POLICY "Allow upload to desenhos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'desenhos');

-- Allow anyone to update in desenhos bucket
CREATE POLICY "Allow update in desenhos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'desenhos');

-- Allow anyone to delete from desenhos bucket
CREATE POLICY "Allow delete from desenhos"
ON storage.objects FOR DELETE
USING (bucket_id = 'desenhos');
