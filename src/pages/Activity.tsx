import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { getPublicErrorMessage } from "@/lib/publicErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type ClientRow = { id: string; name: string };
type LocationRow = { id: string; name: string; client_id: string };
type ServiceRow = { id: string; name: string };

type MachineRow = {
  id: string;
  name: string;
  model: string | null;
  brand: string | null;
  plate: string | null;
  internal_id: string | null;
  status: string | null;
};

const ratingOptions = [1, 2, 3, 4, 5] as const;

const Activity = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"start" | "end">("start");
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [formData, setFormData] = useState({
    clientId: "",
    locationId: "",
    serviceId: "",

    machineId: "",
    odometer: "",
    notes: "",

    areaValue: "",
    areaUnit: "ha",
    areaNotes: "",

    performanceRating: "",
  });

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as MachineRow[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", formData.clientId],
    enabled: !!formData.clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, client_id")
        .eq("client_id", formData.clientId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as LocationRow[];
    },
  });

  const machineOptions = useMemo(() => {
    return (machines ?? []).filter((m) => m.status === "ACTIVE" || !m.status);
  }, [machines]);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          toast({
            title: t("success"),
            description: "Location captured",
          });
        },
        (error) => {
          toast({
            title: t("error"),
            description: "Could not get location: " + error.message,
            variant: "destructive",
          });
        },
      );
    }
  };

  const validateEndStep = () => {
    if (!formData.performanceRating) {
      toast({
        title: t("error"),
        description: "Selecione a classificação de desempenho (1–5).",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!location) {
      toast({
        title: t("error"),
        description: "Please capture location first",
        variant: "destructive",
      });
      return;
    }

    if (step === "end" && !validateEndStep()) return;

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const areaValue = formData.areaValue.trim() ? Number(formData.areaValue) : null;
      const performanceRating = Number(formData.performanceRating);

      if (step === "start") {
        const { data, error } = await supabase
          .from("activities")
          .insert({
            client_id: formData.clientId || null,
            location_id: formData.locationId || null,
            service_id: formData.serviceId || null,

            machine_id: formData.machineId,
            operator_id: user.id,
            start_odometer: parseFloat(formData.odometer),
            start_gps: location,
            notes: formData.notes,

            // we only require rating at the end step
            performance_rating: null,
            area_value: null,
            area_unit: null,
            area_notes: null,
          } as any)
          .select()
          .single();

        if (error) throw error;

        setCurrentActivity(data.id);
        setStep("end");
        setFormData((prev) => ({
          ...prev,
          odometer: "",
          notes: "",
        }));

        toast({
          title: t("success"),
          description: "Activity started successfully!",
        });
      } else {
        if (!currentActivity) throw new Error("No active activity");

        const { error } = await supabase
          .from("activities")
          .update({
            end_time: new Date().toISOString(),
            end_odometer: parseFloat(formData.odometer),
            end_gps: location,
            notes: formData.notes,

            performance_rating: performanceRating,
            area_value: Number.isFinite(areaValue as any) ? areaValue : null,
            area_unit: formData.areaUnit?.trim() || null,
            area_notes: formData.areaNotes?.trim() || null,
          } as any)
          .eq("id", currentActivity);

        if (error) throw error;

        toast({
          title: t("success"),
          description: "Activity completed! Awaiting admin validation.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: t("error"),
        description: getPublicErrorMessage(error, t),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}> 
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">{step === "start" ? t("startActivity") : t("endActivity")}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === "start" && (
              <>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select
                    value={formData.clientId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        clientId: value,
                        locationId: "",
                      }))
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Herdade / Local</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, locationId: value }))}
                    required
                    disabled={!formData.clientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.clientId ? "Selecione o local" : "Selecione o cliente primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select
                    value={formData.serviceId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceId: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {(services ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("selectMachine")}</Label>
                  <Select
                    value={formData.machineId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, machineId: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectMachine")} />
                    </SelectTrigger>
                    <SelectContent>
                      {machineOptions.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id}>
                          {machine.internal_id ? `${machine.internal_id} - ` : ""}
                          {machine.brand ? `${machine.brand} ` : ""}
                          {machine.name}
                          {machine.model ? ` ${machine.model}` : ""}
                          {machine.plate ? ` (${machine.plate})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="odometer">{step === "start" ? "Odómetro INÍCIO" : "Odómetro FIM"}</Label>
              <Input
                id="odometer"
                type="number"
                step="0.01"
                value={formData.odometer}
                onChange={(e) => setFormData((prev) => ({ ...prev, odometer: e.target.value }))}
                required
              />
              {step === "end" && (
                <p className="text-xs text-muted-foreground">
                  Atenção: o valor final deve ser superior ao inicial; durações acima de 18h serão rejeitadas.
                </p>
              )}
            </div>

            {step === "end" && (
              <>
                <div className="space-y-2">
                  <Label>Área realizada</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.areaValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, areaValue: e.target.value }))}
                      placeholder="Ex: 12.5"
                    />
                    <Input
                      value={formData.areaUnit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, areaUnit: e.target.value }))}
                      placeholder="Unidade (ha, m²...)"
                    />
                  </div>
                  <Textarea
                    value={formData.areaNotes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, areaNotes: e.target.value }))}
                    rows={2}
                    placeholder="Observações (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Como classifica o seu desempenho?</Label>
                  <Select
                    value={formData.performanceRating}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, performanceRating: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (1–5)" />
                    </SelectTrigger>
                    <SelectContent>
                      {ratingOptions.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{t("location")}</Label>
              <Button type="button" variant="outline" className="w-full" onClick={getLocation}>
                <MapPin className="mr-2 h-4 w-4" />
                {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Get Location"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === "start" ? t("register") : t("finish")}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default Activity;

