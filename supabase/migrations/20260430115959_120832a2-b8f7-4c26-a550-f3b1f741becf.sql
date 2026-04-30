
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.transfer_items_to_inventario() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_solicitacao_numero() FROM anon, authenticated, public;

-- Allow get_user_role to be called by the app (used by useUserRole hook via RPC)
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
