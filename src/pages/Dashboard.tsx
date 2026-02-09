import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ClipboardList, 
  Wrench, 
  AlertTriangle, 
  Fuel, 
  Package, 
  Headset,
  LogOut 
} from 'lucide-react';

const Dashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setUserName(`${data.first_name || ''} ${data.last_name || ''}`.trim() || user.email || '');
        }
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const dashboardButtons = [
    {
      icon: ClipboardList,
      label: t('activityRecord'),
      path: '/activity',
      variant: 'default' as const,
    },
    {
      icon: Wrench,
      label: t('maintenance'),
      path: '/maintenance',
      variant: 'secondary' as const,
    },
    {
      icon: AlertTriangle,
      label: t('damages'),
      path: '/damages',
      variant: 'destructive' as const,
    },
    {
      icon: Fuel,
      label: t('fuel'),
      path: '/fuel',
      variant: 'secondary' as const,
    },
    {
      icon: Package,
      label: t('orders'),
      path: '/orders',
      variant: 'secondary' as const,
    },
    {
      icon: Headset,
      label: t('support'),
      path: '/support',
      variant: 'secondary' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Fleet Control</h1>
            <p className="text-sm text-muted-foreground">{t('welcomeBack')}, {userName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {dashboardButtons.map((button) => {
            const Icon = button.icon;
            return (
              <Card
                key={button.path}
                className="p-0 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => navigate(button.path)}
              >
                <Button
                  variant={button.variant}
                  className="w-full h-32 flex flex-col items-center justify-center gap-3 rounded-none text-lg font-semibold"
                >
                  <Icon className="h-10 w-10" />
                  {button.label}
                </Button>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
