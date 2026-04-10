import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TremorDetection } from './components/TremorDetection';
import { AIAssistant } from './components/AIAssistant';
import { DoctorChat } from './components/DoctorChat';
import { MedicationTracker } from './components/MedicationTracker';
import { AppointmentManager } from './components/AppointmentManager';
import { DoctorPortal } from './components/DoctorPortal';
import { RemoteTest } from './components/RemoteTest';
import { Toaster } from './components/ui/sonner';
import { auth, db, loginWithGoogle, handleFirestoreError, OperationType } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Button } from './components/ui/button';
import { Activity, ShieldCheck, HeartPulse, Smartphone, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<'patient' | 'doctor'>('patient');

  // Ensure user document exists in Firestore
  useEffect(() => {
    const ensureUserDoc = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: 'patient', // Default role
            createdAt: serverTimestamp()
          });
          setUserRole('patient');
        } else {
          setUserRole(userSnap.data().role || 'patient');
        }
      }
    };
    ensureUserDoc();
  }, [user]);

  const toggleRole = async () => {
    if (!user) return;
    const newRole = userRole === 'patient' ? 'doctor' : 'patient';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      setUserRole(newRole);
      setActiveTab(newRole === 'doctor' ? 'doctor-portal' : 'dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Update last seen status
  useEffect(() => {
    if (!user) return;
    
    const updateLastSeen = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to update last seen", error);
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user]);

  // Check for remote session in URL
  const urlParams = new URLSearchParams(window.location.search);
  const remoteSessionId = urlParams.get('remoteSession');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <Activity className="h-12 w-12 text-[#5A5A40]" />
          <p className="font-serif italic text-[#5A5A40]">Initializing TremorTrack...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-[2rem] shadow-2xl text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-[#5A5A40]/10 rounded-3xl">
              <Activity className="h-12 w-12 text-[#5A5A40]" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-serif font-black text-[#141414]">TremorTrack</h1>
            {remoteSessionId ? (
              <div className="p-5 bg-[#5A5A40]/5 rounded-3xl border border-[#5A5A40]/10 space-y-3">
                <div className="flex items-center gap-2 text-[#5A5A40] justify-center">
                  <Smartphone className="h-5 w-5" />
                  <p className="font-bold text-sm uppercase tracking-wider">Remote Test Mode</p>
                </div>
                <p className="text-[#141414]/70 text-sm leading-relaxed">
                  Please sign in to link your phone's sensors. You can use <strong>any Google account</strong> on this phone—it doesn't have to be the same one as your computer.
                </p>
              </div>
            ) : (
              <p className="text-[#141414]/60">Your companion in Parkinson's care and management.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 text-left">
            <FeatureItem icon={<ShieldCheck className="h-4 w-4" />} text="Secure Data Encryption" />
            <FeatureItem icon={<HeartPulse className="h-4 w-4" />} text="Real-time Health Insights" />
            {remoteSessionId && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-blue-700 leading-tight">
                  <strong>Note:</strong> Your mobile browser is separate from your computer. Logging in here is safe and required for the test.
                </p>
              </div>
            )}
          </div>

          <Button 
            onClick={loginWithGoogle} 
            className="w-full h-14 bg-[#5A5A40] hover:bg-[#4A4A30] text-lg rounded-2xl shadow-lg shadow-[#5A5A40]/20"
          >
            Get Started with Google
          </Button>

          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            Trusted by patients and doctors worldwide
          </p>

          {remoteSessionId && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">
                QR scan issue? Ensure your camera app opens the full link including the code.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (remoteSessionId) {
    return <RemoteTest sessionId={remoteSessionId} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'tremor': return <TremorDetection />;
      case 'assistant': return <AIAssistant />;
      case 'chat': return <DoctorChat />;
      case 'meds': return <MedicationTracker />;
      case 'appointments': return <AppointmentManager />;
      case 'doctor-portal': return <DoctorPortal />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} onToggleRole={toggleRole}>
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderContent()}
      </motion.div>
      <Toaster position="bottom-right" />
    </Layout>
  );
}

const FeatureItem = ({ icon, text }: { icon: React.ReactNode, text: string }) => (
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
    <div className="text-[#5A5A40]">{icon}</div>
    <span className="text-xs font-bold text-[#141414]/70">{text}</span>
  </div>
);
