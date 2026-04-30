-- Remove any permissive write policies on the desenhos bucket and restrict to authenticated users
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%desenhos%' OR with_check LIKE '%desenhos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Public read remains (bucket is public)
CREATE POLICY "Desenhos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'desenhos');

-- Only authenticated users can upload
CREATE POLICY "Desenhos authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'desenhos');

-- Only authenticated users can update
CREATE POLICY "Desenhos authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'desenhos')
WITH CHECK (bucket_id = 'desenhos');

-- Only authenticated users can delete
CREATE POLICY "Desenhos authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'desenhos');