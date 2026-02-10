import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList,
  Wrench,
  AlertTriangle,
  Fuel,
  Package,
  Headset,
  ShieldCheck,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardGrid, { type DashboardBtn } from "@/components/dashboard/DashboardGrid";

const Dashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        toast({
          title: t("error"),
          description: `${t("sessionLoadFailed")}: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (user) {
        setUserEmail(user.email || "");

        const [{ data: profile }, { data: adminFlag }, { data: superAdminFlag }, { data: coordinatorFlag }] =
          await Promise.all([
            supabase.from("users").select("first_name, last_name").eq("id", user.id).maybeSingle(),
            supabase.rpc("is_admin_or_super_admin", { _user_id: user.id }),
            supabase.rpc("is_user_role", { _user_id: user.id, _role: "SUPER_ADMIN" }),
            supabase.rpc("is_coordenador_or_above", { _user_id: user.id }),
          ]);

        setIsAdmin(!!adminFlag);
        setIsSuperAdmin(!!superAdminFlag);
        setIsCoordinator(!!coordinatorFlag);

        if (profile) {
          setUserName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "");
        } else {
          setUserName(user.email || "");
        }
      }
    };

    loadUser();
  }, [t, toast]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: t("error"),
        description: `${t("logoutFailed")}: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    navigate("/login");
  };

  const dashboardButtons: DashboardBtn[] = useMemo(() => {
    const base: DashboardBtn[] = [
      {
        icon: ClipboardList,
        label: t("activityRecord"),
        path: "/activity",
        variant: "default",
      },
      {
        icon: Wrench,
        label: t("maintenance"),
        path: "/maintenance",
        variant: "secondary",
      },
      {
        icon: AlertTriangle,
        label: t("damages"),
        path: "/damages",
        variant: "destructive",
      },
      {
        icon: Fuel,
        label: t("fuel"),
        path: "/fuel",
        variant: "secondary",
      },
      {
        icon: Package,
        label: t("orders"),
        path: "/orders",
        variant: "secondary",
      },
      {
        icon: Headset,
        label: t("support"),
        path: "/support",
        variant: "secondary",
      },
      {
        icon: ClipboardList,
        label: t("myDocuments"),
        path: "/my-documents",
        variant: "outline",
      },
    ];

    if (isCoordinator) {
      base.unshift({
        icon: ShieldCheck,
        label: t("approvals"),
        path: "/admin/approvals",
        variant: "outline",
      });
    }

    if (isAdmin) {
      base.unshift({
        icon: ShieldCheck,
        label: t("adminValidation"),
        path: "/admin/activities",
        variant: "outline",
      });
    }

    return base;
  }, [isAdmin, isCoordinator, t]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        userName={userName}
        userEmail={userEmail}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onNavigate={(path) => navigate(path)}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <DashboardGrid items={dashboardButtons} onNavigate={(path) => navigate(path)} />
      </main>
    </div>
  );
};

export default Dashboard;

