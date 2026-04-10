import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Activity, Play, Square, Save, AlertCircle, QrCode, Smartphone, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

export const TremorDetection: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [data, setData] = useState<{ time: number, x: number, y: number, z: number }[]>([]);
  const [severity, setSeverity] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<'waiting' | 'recording' | 'completed' | null>(null);
  const recordingRef = useRef(false);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      setPermissionGranted(false);
    } else {
      setPermissionGranted(true);
    }
  }, []);

  // Listen for remote session updates
  useEffect(() => {
    if (!sessionId) return;

    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.data();
        setRemoteStatus(sessionData.status);
        if (sessionData.status === 'completed' && sessionData.result) {
          setSeverity(sessionData.result.severity);
          toast.success("Remote test completed!");
          // Cleanup session
          setTimeout(() => deleteDoc(doc(db, 'sessions', sessionId)), 5000);
        }
      }
    });

    return () => unsub();
  }, [sessionId]);

  const startRemoteSession = async () => {
    const id = Math.random().toString(36).substring(7);
    setSessionId(id);
    setShowQR(true);
    setRemoteStatus('waiting');
    
    await setDoc(doc(db, 'sessions', id), {
      status: 'waiting',
      createdAt: serverTimestamp(),
      userId: auth.currentUser?.uid
    });
  };

  const requestPermission = async () => {
    try {
      const response = await (DeviceMotionEvent as any).requestPermission();
      if (response === 'granted') {
        setPermissionGranted(true);
      }
    } catch (e) {
      console.error("Permission request failed", e);
      toast.error("Could not access motion sensors");
    }
  };

  const startRecording = () => {
    setData([]);
    setSeverity(null);
    setIsRecording(true);
    recordingRef.current = true;
    
    window.addEventListener('devicemotion', handleMotion);
    
    setTimeout(() => {
      if (recordingRef.current) stopRecording();
    }, 30000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    recordingRef.current = false;
    window.removeEventListener('devicemotion', handleMotion);
    analyzeTremor();
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    if (!recordingRef.current) return;
    
    const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    setData(prev => {
      const newData = [...prev, { 
        time: prev.length, 
        x: x || 0, 
        y: y || 0, 
        z: z || 0 
      }];
      return newData.slice(-50);
    });
  };

  const analyzeTremor = () => {
    if (data.length < 10) return;
    const variances = data.map(d => Math.sqrt(d.x**2 + d.y**2 + d.z**2));
    const mean = variances.reduce((a, b) => a + b, 0) / variances.length;
    const variance = variances.reduce((a, b) => a + (b - mean)**2, 0) / variances.length;
    const calculatedSeverity = Math.min(10, Math.max(0, variance * 2));
    setSeverity(calculatedSeverity);
  };

  const saveResult = async () => {
    if (!auth.currentUser || severity === null) return;
    try {
      // Fetch current user's doctorUid
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const doctorUid = userSnap.exists() ? userSnap.data().doctorUid : null;

      await addDoc(collection(db, 'tremors'), {
        userId: auth.currentUser.uid,
        doctorUid: doctorUid,
        timestamp: serverTimestamp(),
        severity: Number(severity.toFixed(2)),
        notes: "Recorded via mobile app"
      });
      toast.success("Result saved successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tremors');
    }
  };

  const remoteUrl = `${window.location.origin}/?remoteSession=${sessionId}`;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <div className="h-2 bg-[#5A5A40]" />
        <CardHeader>
          <CardTitle className="font-serif text-2xl flex items-center justify-between">
            Tremor Analysis
            {!isMobile && !showQR && (
              <Button variant="outline" size="sm" onClick={startRemoteSession} className="border-[#5A5A40] text-[#5A5A40]">
                <Smartphone className="mr-2 h-4 w-4" /> Use Phone
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            {isMobile 
              ? "Hold your phone steadily in your hand for 30 seconds." 
              : "Laptops lack motion sensors. Use your smartphone for an accurate test."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showQR && remoteStatus !== 'completed' && (
            <div className="flex flex-col items-center gap-6 p-8 bg-[#F5F5F0] rounded-3xl border-2 border-dashed border-[#5A5A40]/20">
              <div className="bg-white p-4 rounded-2xl shadow-inner">
                <QRCodeSVG value={remoteUrl} size={200} />
              </div>
              <div className="text-center space-y-2">
                <p className="font-bold text-[#5A5A40]">Scan with your smartphone</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  {remoteStatus === 'waiting' ? (
                    <>
                      <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                      Waiting for connection...
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      Phone connected. Recording...
                    </>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowQR(false)}>Cancel</Button>
            </div>
          )}

          {(!showQR || remoteStatus === 'completed') && (
            <>
              {!permissionGranted && isMobile && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm text-amber-800 font-medium">Sensor Access Required</p>
                    <Button size="sm" onClick={requestPermission} className="bg-amber-600 hover:bg-amber-700">
                      Grant Permission
                    </Button>
                  </div>
                </div>
              )}

              <div className="h-[300px] w-full bg-[#151619] rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="time" hide />
                    <YAxis stroke="#8E9299" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', border: '1px solid #333' }}
                      itemStyle={{ fontSize: '10px' }}
                    />
                    <Line type="monotone" dataKey="x" stroke="#FF4444" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="y" stroke="#00FF00" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="z" stroke="#0088FF" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                {isMobile && (
                  !isRecording ? (
                    <Button 
                      onClick={startRecording} 
                      disabled={!permissionGranted}
                      className="bg-[#5A5A40] hover:bg-[#4A4A30] h-12 px-8 rounded-full"
                    >
                      <Play className="mr-2 h-5 w-5" /> Start Recording
                    </Button>
                  ) : (
                    <Button 
                      onClick={stopRecording} 
                      variant="destructive"
                      className="h-12 px-8 rounded-full animate-pulse"
                    >
                      <Square className="mr-2 h-5 w-5" /> Stop Recording
                    </Button>
                  )
                )}

                {severity !== null && (
                  <Button 
                    onClick={saveResult} 
                    variant="outline"
                    className="h-12 px-8 rounded-full border-[#5A5A40] text-[#5A5A40]"
                  >
                    <Save className="mr-2 h-5 w-5" /> Save Result
                  </Button>
                )}
              </div>

              {severity !== null && (
                <div className="p-6 bg-[#F5F5F0] rounded-2xl text-center space-y-2">
                  <p className="text-sm uppercase tracking-widest text-[#5A5A40] font-bold">Calculated Severity</p>
                  <p className="text-6xl font-serif font-black text-[#141414]">{severity.toFixed(1)}</p>
                  <p className="text-sm text-[#141414]/60">
                    {severity < 2 ? "Normal / Minimal Tremor" : 
                     severity < 5 ? "Mild Tremor Detected" : 
                     "Significant Tremor Detected"}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
