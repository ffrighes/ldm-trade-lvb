import { useMaterials, useProjects } from '@/hooks/useSupabaseData';
import { FolderKanban, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { data: projects = [] } = useProjects();
  const { data: materials = [] } = useMaterials();

  const stats = [
    { label: 'Projetos', value: projects.length, icon: FolderKanban, to: '/projetos', color: 'text-primary' },
    { label: 'Materiais', value: materials.length, icon: Database, to: '/base-dados', color: 'text-accent' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, to, color }) => (
          <Link key={label} to={to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
