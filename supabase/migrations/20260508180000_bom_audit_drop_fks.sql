-- Drop foreign keys on bom_audit so the audit trail behaves as a
-- standalone historical log. The previous schema set FKs with
-- ON DELETE SET NULL which works for rows already in bom_audit when
-- the parent is removed, but it does not help for the AFTER DELETE
-- audit triggers that fire DURING a cascading bom_root delete:
-- by the time those triggers INSERT into bom_audit, the referenced
-- bom_root / bom_version / bom_node rows have already been removed,
-- so the immediate FK check rejects the new audit row with
-- "violates foreign key constraint bom_audit_root_id_fkey".
--
-- This was the real cause of the 409/"No API key found" surface seen
-- when calling bom_drop_root: the gateway was rewriting the database
-- error.

ALTER TABLE public.bom_audit
  DROP CONSTRAINT IF EXISTS bom_audit_root_id_fkey,
  DROP CONSTRAINT IF EXISTS bom_audit_version_id_fkey;
-- node_id had no FK declared in the original schema, but defensively
-- drop any FK named like the auto-generated one if present.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.bom_audit'::regclass
       AND contype  = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.bom_audit DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
