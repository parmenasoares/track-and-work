import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  Wrench,
  AlertTriangle,
  Fuel,
  Package,
  Headset,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

type DashboardBtn = {
  icon: any;
  label: string;
  path: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
};

const Dashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      if (user) {
        setUserEmail(user.email || '');

        const [{ data: profile }, { data: adminFlag }] = await Promise.all([
          supabase.from('users').select('first_name, last_name').eq('id', user.id).maybeSingle(),
          supabase.rpc('is_admin_or_super_admin', { _user_id: user.id }),
        ]);

        setIsAdmin(!!adminFlag);

        if (profile) {
          setUserName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email || '');
        } else {
          setUserName(user.email || '');
        }
      }
    };
    loadUser();
  }, [t, toast]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    navigate('/login');
  };

  const dashboardButtons: DashboardBtn[] = useMemo(() => {
    const base: DashboardBtn[] = [
      {
        icon: ClipboardList,
        label: t('activityRecord'),
        path: '/activity',
        variant: 'default',
      },
      {
        icon: Wrench,
        label: t('maintenance'),
        path: '/maintenance',
        variant: 'secondary',
      },
      {
        icon: AlertTriangle,
        label: t('damages'),
        path: '/damages',
        variant: 'destructive',
      },
      {
        icon: Fuel,
        label: t('fuel'),
        path: '/fuel',
        variant: 'secondary',
      },
      {
        icon: Package,
        label: t('orders'),
        path: '/orders',
        variant: 'secondary',
      },
      {
        icon: Headset,
        label: t('support'),
        path: '/support',
        variant: 'secondary',
      },
    ];

    if (isAdmin) {
      base.unshift({
        icon: ShieldCheck,
        label: t('adminValidation'),
        path: '/admin/activities',
        variant: 'outline',
      });
    }

    return base;
  }, [isAdmin, t]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Fleet Control</h1>
            <p className="text-sm text-muted-foreground truncate">
              {t('welcomeBack')}{userName ? `, ${userName}` : ''}
            </p>
            {!!userEmail && (
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            )}
          </div>

          <Button variant="ghost" onClick={handleLogout} className="shrink-0">
            <LogOut className="h-5 w-5" />
            <span className="ml-2">Logout</span>
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
