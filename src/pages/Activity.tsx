import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { uploadActivityPhoto } from '@/lib/activityPhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, MapPin, ArrowLeft, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const Activity = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'start' | 'end'>('start');
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const [formData, setFormData] = useState({
    machineId: '',
    odometer: '',
    notes: '',
  });

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          toast({
            title: t('success'),
            description: 'Location captured',
          });
        },
        (error) => {
          toast({
            title: t('error'),
            description: 'Could not get location: ' + error.message,
            variant: 'destructive',
          });
        }
      );
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: 'Camera access denied',
        variant: 'destructive',
      });
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL('image/jpeg');
        setPhotoData(imageData);

        // Also keep a Blob version for upload (never store the data URL in the database)
        try {
          const blob = await (await fetch(imageData)).blob();
          setPhotoBlob(blob);
        } catch {
          setPhotoBlob(null);
        }

        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setCameraActive(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location) {
      toast({
        title: t('error'),
        description: 'Please capture location first',
        variant: 'destructive',
      });
      return;
    }

    if (!photoData || !photoBlob) {
      toast({
        title: t('error'),
        description: 'Please take a selfie first',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (step === 'start') {
        // Upload selfie to file storage and store only the file path in the database
        const startPhotoPath = await uploadActivityPhoto({
          userId: user.id,
          blob: photoBlob,
          prefix: 'start',
        });

        const { data, error } = await supabase
          .from('activities')
          .insert({
            machine_id: formData.machineId,
            operator_id: user.id,
            start_odometer: parseFloat(formData.odometer),
            start_gps: location,
            start_photo_url: startPhotoPath,
            notes: formData.notes,
          })
          .select()
          .single();

        if (error) throw error;

        setCurrentActivity(data.id);
        setStep('end');
        setPhotoData(null);
        setPhotoBlob(null);
        setFormData({ ...formData, odometer: '', notes: '' });

        toast({
          title: t('success'),
          description: 'Activity started successfully!',
        });
      } else {
        if (!currentActivity) throw new Error('No active activity');

        const endPhotoPath = await uploadActivityPhoto({
          userId: user.id,
          blob: photoBlob,
          prefix: 'end',
        });

        const { error } = await supabase
          .from('activities')
          .update({
            end_time: new Date().toISOString(),
            end_odometer: parseFloat(formData.odometer),
            end_gps: location,
            end_photo_url: endPhotoPath,
            notes: formData.notes,
          })
          .eq('id', currentActivity);

        if (error) throw error;

        toast({
          title: t('success'),
          description: 'Activity completed! Awaiting admin validation.',
        });
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {step === 'start' ? t('startActivity') : t('endActivity')}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 'start' && (
              <div className="space-y-2">
                <Label>{t('selectMachine')}</Label>
                <Select
                  value={formData.machineId}
                  onValueChange={(value) => setFormData({ ...formData, machineId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectMachine')} />
                  </SelectTrigger>
                  <SelectContent>
                    {machines
                      ?.filter((m) => m.status === "ACTIVE" || !m.status)
                      .map((machine) => (
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
            )}

            <div className="space-y-2">
              <Label htmlFor="odometer">{t('odometer')}</Label>
              <Input
                id="odometer"
                type="number"
                step="0.01"
                value={formData.odometer}
                onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('takeSelfie')}</Label>
              {!cameraActive && !photoData && (
                <Button type="button" variant="outline" className="w-full" onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" />
                  {t('takeSelfie')}
                </Button>
              )}
              {cameraActive && (
                <div className="space-y-2">
                  <video ref={videoRef} autoPlay className="w-full rounded-lg border" />
                  <Button type="button" className="w-full" onClick={capturePhoto}>
                    Capture
                  </Button>
                </div>
              )}
              {photoData && (
                <div className="space-y-2">
                  <img src={photoData} alt="Selfie" className="w-full rounded-lg border" />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setPhotoData(null);
                      setPhotoBlob(null);
                      startCamera();
                    }}
                  >
                    Retake
                  </Button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="space-y-2">
              <Label>{t('location')}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={getLocation}
              >
                <MapPin className="mr-2 h-4 w-4" />
                {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Get Location'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === 'start' ? t('register') : t('finish')}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default Activity;
