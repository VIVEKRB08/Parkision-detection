import React from 'react';
import { auth, loginWithGoogle } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Button } from './ui/button';
import { LogIn, LogOut, Activity, MessageSquare, Pill, Calendar, LayoutDashboard, BrainCircuit, UserCog, Stethoscope } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: 'patient' | 'doctor';
  onToggleRole?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, userRole = 'patient', onToggleRole }) => {
  const [user] = useAuthState(auth);

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-sans text-[#141414]">
      <header className="sticky top-0 z-50 w-full border-b border-[#141414]/10 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-serif text-xl font-bold italic">
            <Activity className="h-6 w-6 text-[#5A5A40]" />
            <span>TremorTrack</span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#141414]/60">
                  <span>{user.displayName}</span>
                </div>
                <Avatar className="h-8 w-8 border border-[#141414]/10">
                  <AvatarImage src={user.photoURL || ''} />
                  <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" onClick={onToggleRole} title="Toggle Doctor/Patient Mode (Testing)">
                  <UserCog className="h-5 w-5 text-[#5A5A40]" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => auth.signOut()}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button onClick={loginWithGoogle} className="bg-[#5A5A40] hover:bg-[#4A4A30]">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-8">
        {user && (
          <aside className="w-full md:w-64 flex-shrink-0">
              <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {userRole === 'doctor' ? (
                  <>
                    <NavButton 
                      active={activeTab === 'doctor-portal'} 
                      onClick={() => setActiveTab('doctor-portal')}
                      icon={<Stethoscope className="h-5 w-5" />}
                      label="Doctor Portal"
                    />
                    <NavButton 
                      active={activeTab === 'chat'} 
                      onClick={() => setActiveTab('chat')}
                      icon={<MessageSquare className="h-5 w-5" />}
                      label="Patient Chat"
                    />
                  </>
                ) : (
                  <>
                    <NavButton 
                      active={activeTab === 'dashboard'} 
                      onClick={() => setActiveTab('dashboard')}
                      icon={<LayoutDashboard className="h-5 w-5" />}
                      label="Dashboard"
                    />
                    <NavButton 
                      active={activeTab === 'tremor'} 
                      onClick={() => setActiveTab('tremor')}
                      icon={<Activity className="h-5 w-5" />}
                      label="Tremor Detection"
                    />
                    <NavButton 
                      active={activeTab === 'meds'} 
                      onClick={() => setActiveTab('meds')}
                      icon={<Pill className="h-5 w-5" />}
                      label="Medications"
                    />
                    <NavButton 
                      active={activeTab === 'assistant'} 
                      onClick={() => setActiveTab('assistant')}
                      icon={<BrainCircuit className="h-5 w-5" />}
                      label="AI Assistant"
                    />
                    <NavButton 
                      active={activeTab === 'chat'} 
                      onClick={() => setActiveTab('chat')}
                      icon={<MessageSquare className="h-5 w-5" />}
                      label="Doctor Chat"
                    />
                    <NavButton 
                      active={activeTab === 'appointments'} 
                      onClick={() => setActiveTab('appointments')}
                      icon={<Calendar className="h-5 w-5" />}
                      label="Appointments"
                    />
                  </>
                )}
              </nav>
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
      active 
        ? 'bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20' 
        : 'hover:bg-white text-[#141414]/60 hover:text-[#141414]'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);
