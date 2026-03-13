import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    // Create a client with the caller's token to verify identity
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerError } = await anonClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    // Use the service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if caller has admin role
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores podem gerenciar usuários." }, 403);
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case "list": {
        const { data, error } = await adminClient.auth.admin.listUsers();
        if (error) throw error;

        // Fetch roles for all users
        const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
        const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

        const users = data.users.map((u) => ({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          role: roleMap.get(u.id) ?? null,
        }));
        return jsonResponse({ users });
      }

      case "create": {
        const { email, password, role } = payload;
        if (!email || !password) {
          return jsonResponse({ error: "Email e senha são obrigatórios." }, 400);
        }
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw error;

        // Create profile
        await adminClient.from("profiles").insert({
          id: data.user.id,
          email,
          nome: "",
        });

        // Assign role if provided
        if (role) {
          await adminClient.from("user_roles").insert({
            user_id: data.user.id,
            role,
          });
        }

        return jsonResponse({ user: { id: data.user.id, email: data.user.email } });
      }

      case "update": {
        const { id, email, password, role } = payload;
        if (!id) {
          return jsonResponse({ error: "ID do usuário é obrigatório." }, 400);
        }
        const updates: Record<string, string> = {};
        if (email) updates.email = email;
        if (password) updates.password = password;

        if (Object.keys(updates).length > 0) {
          const { error } = await adminClient.auth.admin.updateUserById(id, updates);
          if (error) throw error;
        }

        // Update profile email if changed
        if (email) {
          await adminClient.from("profiles").update({ email }).eq("id", id);
        }

        // Update role if provided
        if (role !== undefined) {
          // Delete existing role
          await adminClient.from("user_roles").delete().eq("user_id", id);
          // Insert new role if not empty
          if (role) {
            await adminClient.from("user_roles").insert({ user_id: id, role });
          }
        }

        return jsonResponse({ success: true });
      }

      case "delete": {
        const { id } = payload;
        if (!id) {
          return jsonResponse({ error: "ID do usuário é obrigatório." }, 400);
        }
        if (id === caller.id) {
          return jsonResponse({ error: "Você não pode excluir sua própria conta." }, 400);
        }
        // Clean up role and profile
        await adminClient.from("user_roles").delete().eq("user_id", id);
        await adminClient.from("profiles").delete().eq("id", id);
        const { error } = await adminClient.auth.admin.deleteUser(id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
});
