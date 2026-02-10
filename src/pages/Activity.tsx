import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { uploadActivityPhoto } from "@/lib/activityPhotos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Loader2, MapPin, Upload } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<"selfie" | "odometer">("selfie");

  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [odometerData, setOdometerData] = useState<string | null>(null);
  const [odometerBlob, setOdometerBlob] = useState<Blob | null>(null);

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

  const startCamera = async (target: "selfie" | "odometer") => {
    try {
      setCaptureTarget(target);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: target === "selfie" ? "user" : "environment",
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari: improves reliability
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => undefined);
        setCameraActive(true);
      }
    } catch (err: any) {
      const msg = `${err?.name ?? "CameraError"}: ${err?.message ?? "Camera access denied"}`;
      toast({
        title: t("error"),
        description: msg,
        variant: "destructive",
      });
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL("image/jpeg");

        try {
          const blob = await (await fetch(imageData)).blob();

          if (captureTarget === "selfie") {
            setSelfieData(imageData);
            setSelfieBlob(blob);
          } else {
            setOdometerData(imageData);
            setOdometerBlob(blob);
          }
        } catch {
          if (captureTarget === "selfie") setSelfieBlob(null);
          else setOdometerBlob(null);
        }

        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraActive(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

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

    if (!selfieData || !selfieBlob) {
      toast({
        title: t("error"),
        description: "Tire a selfie primeiro",
        variant: "destructive",
      });
      return;
    }

    if (!odometerData || !odometerBlob) {
      toast({
        title: t("error"),
        description: "Tire a foto do hodômetro primeiro",
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
        const [startSelfiePath, startOdometerPath] = await Promise.all([
          uploadActivityPhoto({
            userId: user.id,
            blob: selfieBlob,
            prefix: "start",
          }),
          uploadActivityPhoto({
            userId: user.id,
            blob: odometerBlob,
            prefix: "start-odometer",
          }),
        ]);

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
            start_photo_url: startSelfiePath,
            start_odometer_photo_url: startOdometerPath,
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
        setSelfieData(null);
        setSelfieBlob(null);
        setOdometerData(null);
        setOdometerBlob(null);
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

        const [endSelfiePath, endOdometerPath] = await Promise.all([
          uploadActivityPhoto({
            userId: user.id,
            blob: selfieBlob,
            prefix: "end",
          }),
          uploadActivityPhoto({
            userId: user.id,
            blob: odometerBlob,
            prefix: "end-odometer",
          }),
        ]);

        const { error } = await supabase
          .from("activities")
          .update({
            end_time: new Date().toISOString(),
            end_odometer: parseFloat(formData.odometer),
            end_gps: location,
            end_photo_url: endSelfiePath,
            end_odometer_photo_url: endOdometerPath,
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
      toast({
        title: t("error"),
        description: error.message,
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

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selfie (obrigatório)</Label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => startCamera("selfie")}
                    disabled={cameraActive}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Abrir câmara
                  </Button>

                  <label className="w-full">
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (!f) return;
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result));
                          r.onerror = () => reject(new Error("file_read_failed"));
                          r.readAsDataURL(f);
                        });
                        setSelfieData(dataUrl);
                        setSelfieBlob(f);
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full" disabled={cameraActive}>
                      <Upload className="mr-2 h-4 w-4" />
                      Enviar foto
                    </Button>
                  </label>
                </div>

                {selfieData && (
                  <div className="space-y-2">
                    <img src={selfieData} alt="Selfie" className="w-full rounded-lg border" />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelfieData(null);
                        setSelfieBlob(null);
                      }}
                      disabled={cameraActive}
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Foto do hodômetro (obrigatório)</Label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => startCamera("odometer")}
                    disabled={cameraActive}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Abrir câmara
                  </Button>

                  <label className="w-full">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (!f) return;
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result));
                          r.onerror = () => reject(new Error("file_read_failed"));
                          r.readAsDataURL(f);
                        });
                        setOdometerData(dataUrl);
                        setOdometerBlob(f);
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full" disabled={cameraActive}>
                      <Upload className="mr-2 h-4 w-4" />
                      Enviar foto
                    </Button>
                  </label>
                </div>

                {odometerData && (
                  <div className="space-y-2">
                    <img src={odometerData} alt="Foto do hodômetro" className="w-full rounded-lg border" />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setOdometerData(null);
                        setOdometerBlob(null);
                      }}
                      disabled={cameraActive}
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>

              {cameraActive && (
                <div className="space-y-2">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border" />
                  <Button type="button" className="w-full" onClick={capturePhoto}>
                    Capture
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A capturar: {captureTarget === "selfie" ? "Selfie" : "Hodômetro"}
                  </p>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>

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

