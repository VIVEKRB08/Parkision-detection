import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Activity, Play, Square, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export const RemoteTest: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [data, setData] = useState<{ x: number, y: number, z: number }[]>([]);
  const [status, setStatus] = useState<'waiting' | 'recording' | 'completed'>('waiting');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const recordingRef = useRef(false);

  useEffect(() => {
    let timer: any;
    if (isRecording && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRecording) {
      stopRecording();
    }
    return () => clearInterval(timer);
  }, [isRecording, timeLeft]);

  useEffect(() => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      setPermissionGranted(false);
    } else {
      setPermissionGranted(true);
    }

    // Listen for session cancellation or updates
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (snapshot) => {
      if (!snapshot.exists()) {
        window.location.href = '/'; // Redirect if session deleted
      }
    });

    return () => unsub();
  }, [sessionId]);

  const requestPermission = async () => {
    try {
      const response = await (DeviceMotionEvent as any).requestPermission();
      if (response === 'granted') {
        setPermissionGranted(true);
      }
    } catch (e) {
      toast.error("Sensor access denied");
    }
  };

  const startRecording = async () => {
    setData([]);
    setIsRecording(true);
    setStatus('recording');
    setTimeLeft(30);
    recordingRef.current = true;
    
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'recording' });
    window.addEventListener('devicemotion', handleMotion);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    recordingRef.current = false;
    window.removeEventListener('devicemotion', handleMotion);
    
    const severity = analyzeTremor();
    setStatus('completed');
    
    await updateDoc(doc(db, 'sessions', sessionId), { 
      status: 'completed',
      result: { severity: Number(severity.toFixed(2)) }
    });

    toast.success("Test completed! You can close this tab.");
    
    // Auto-back after 3 seconds
    setTimeout(() => {
      window.location.href = '/';
    }, 3000);
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    if (!recordingRef.current) return;
    const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    setData(prev => [...prev, { x: x || 0, y: y || 0, z: z || 0 }]);
  };

  const analyzeTremor = () => {
    if (data.length < 10) return 0;
    const variances = data.map(d => Math.sqrt(d.x**2 + d.y**2 + d.z**2));
    const mean = variances.reduce((a, b) => a + b, 0) / variances.length;
    const variance = variances.reduce((a, b) => a + (b - mean)**2, 0) / variances.length;
    return Math.min(10, Math.max(0, variance * 2));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-[0_32px_64px_-12px_rgba(90,90,64,0.2)] bg-white rounded-[3rem] overflow-hidden">
          <div className="h-4 bg-[#5A5A40]" />
          <CardHeader className="text-center pt-10 pb-2">
            <div className="mx-auto p-5 bg-[#5A5A40]/10 rounded-[2rem] w-fit mb-6 shadow-inner">
              <Activity className="h-12 w-12 text-[#5A5A40]" />
            </div>
            <CardTitle className="font-serif text-4xl font-black text-[#141414]">Remote Test</CardTitle>
            <CardDescription className="text-base mt-2">Your phone is linked and ready.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-10">
            {status === 'waiting' && (
              <div className="space-y-8 text-center">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-gray-600 leading-relaxed">
                    Hold your phone firmly in your dominant hand. Press the button below to start the 30-second recording.
                  </p>
                </div>
                {!permissionGranted ? (
                  <Button 
                    onClick={requestPermission} 
                    className="w-full h-16 bg-amber-600 hover:bg-amber-700 rounded-2xl text-lg font-bold shadow-lg shadow-amber-600/20"
                  >
                    Enable Motion Sensors
                  </Button>
                ) : (
                  <Button 
                    onClick={startRecording} 
                    className="w-full h-16 bg-[#5A5A40] hover:bg-[#4A4A30] rounded-2xl text-xl font-bold shadow-xl shadow-[#5A5A40]/20"
                  >
                    <Play className="mr-3 h-6 w-6 fill-current" /> Start Test
                  </Button>
                )}
              </div>
            )}

            {status === 'recording' && (
              <div className="flex flex-col items-center gap-8 py-10">
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 bg-red-500 rounded-full"
                  />
                  <div className="relative h-28 w-28 bg-white border-4 border-red-500 rounded-full flex items-center justify-center shadow-2xl">
                    <Square className="h-12 w-12 text-red-600 fill-current" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-2xl font-black text-red-600 tracking-tight">RECORDING: {timeLeft}s</p>
                  <p className="text-gray-400 font-medium">Keep your hand as steady as possible</p>
                </div>
                <Button 
                  onClick={stopRecording} 
                  variant="ghost" 
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full px-8"
                >
                  Stop Early
                </Button>
              </div>
            )}

            {status === 'completed' && (
              <div className="flex flex-col items-center gap-8 py-10 text-center">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center shadow-inner"
                >
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </motion.div>
                <div className="space-y-3">
                  <p className="text-3xl font-serif font-black text-green-600">Test Successful!</p>
                  <p className="text-gray-500 leading-relaxed">
                    Data has been securely transmitted. You can now return to your laptop.
                  </p>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3 }}
                    className="h-full bg-green-500"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
