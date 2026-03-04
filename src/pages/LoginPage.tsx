import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [bEmail, setBEmail] = useState('');
  const [bPassword, setBPassword] = useState('');
  const [bLoading, setBLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async () => {
    if (!bEmail || !bPassword || bPassword.length < 6) {
      toast.error('Preencha e-mail e senha (mín. 6 caracteres)');
      return;
    }
    setBLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bootstrap-admin', {
        body: { email: bEmail, password: bPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || 'Admin criado! Faça login.');
      setShowBootstrap(false);
      setEmail(bEmail);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar admin');
    } finally {
      setBLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Gestor de Materiais</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Trade Management</p>
        </CardHeader>
        <CardContent>
          {!showBootstrap ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowBootstrap(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Configuração inicial (criar admin)
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Crie o primeiro usuário administrador do sistema.</p>
              <div>
                <Label>E-mail do Admin</Label>
                <Input type="email" value={bEmail} onChange={e => setBEmail(e.target.value)} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={bPassword} onChange={e => setBPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <Button onClick={handleBootstrap} className="w-full" disabled={bLoading}>
                <UserPlus className="h-4 w-4 mr-2" />
                {bLoading ? 'Criando...' : 'Criar Admin'}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowBootstrap(false)}>Voltar ao Login</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
