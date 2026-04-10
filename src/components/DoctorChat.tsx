import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { MessageSquare, Send, ShieldCheck, User, Loader2, Info, ExternalLink } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Badge } from './ui/badge';

export const DoctorChat: React.FC = () => {
  const [messages, setMessages] = useState<{ text: string, senderId: string, timestamp: string }[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const roomId = "demo-room-123"; 

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch current user role and setup partner listener
    const setupChat = async () => {
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (userSnap.exists()) {
        const role = userSnap.data().role;
        setUserRole(role);
        
        // Fetch partner info with real-time listener for lastSeen
        const partnerId = role === 'patient' ? (userSnap.data().doctorUid) : null;
        if (partnerId) {
          const unsubPartner = onSnapshot(doc(db, 'users', partnerId), (doc) => {
            if (doc.exists()) {
              setPartnerInfo(doc.data());
            }
          });
          return unsubPartner;
        }
      }
    };
    
    let unsubPartner: (() => void) | undefined;
    setupChat().then(unsub => {
      unsubPartner = unsub;
    });

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-room', roomId);
    });

    newSocket.on('receive-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', auth.currentUser.uid),
      where('roomId', '==', roomId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs
        .map(doc => ({
          text: doc.data().encryptedContent,
          senderId: doc.data().senderId,
          senderRole: doc.data().senderRole,
          timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(history);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => {
      newSocket.close();
      unsubscribe();
      if (unsubPartner) unsubPartner();
    };
  }, [auth.currentUser]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatLastSeen = (timestamp: any) => {
    if (!timestamp) return 'Offline';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 120) return 'Online';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const handleSend = async () => {
    if (!input.trim() || !auth.currentUser) return;

    const messageData = {
      roomId,
      text: input.trim(),
      senderId: auth.currentUser.uid,
    };

    socket?.emit('send-message', messageData);

    try {
      const receiverId = userRole === 'patient' ? (partnerInfo?.uid || auth.currentUser.uid) : auth.currentUser.uid;
      await addDoc(collection(db, 'messages'), {
        roomId,
        senderId: auth.currentUser.uid,
        senderRole: userRole,
        receiverId: receiverId,
        participants: [auth.currentUser.uid, receiverId],
        encryptedContent: input.trim(),
        timestamp: serverTimestamp()
      });
      setInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
      <Card className="lg:col-span-3 border-none shadow-xl bg-white flex flex-col overflow-hidden">
        <CardHeader className="border-b border-[#141414]/5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="font-serif text-xl">
                {partnerInfo ? partnerInfo.displayName : (userRole === 'doctor' ? 'Patient Consultation' : 'Doctor Consultation')}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-green-600" />
                  <span className="text-[10px]">Encrypted</span>
                </div>
                {partnerInfo && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-[10px] font-medium text-gray-400">
                      Last seen: {formatLastSeen(partnerInfo.lastSeen)}
                    </span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-medium text-gray-500">{isConnected ? 'Server Connected' : 'Connecting...'}</span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col gap-1.5 max-w-[75%] ${msg.senderId === auth.currentUser?.uid ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 px-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                        msg.senderId === auth.currentUser?.uid ? 'bg-white/20 text-white' : 'bg-[#5A5A40]/10 text-[#5A5A40]'
                      }`}>
                        {msg.senderRole === 'doctor' ? 'D' : 'P'}
                      </div>
                      <span className="text-[10px] font-black text-[#141414]/40 uppercase tracking-wider">
                        {msg.senderRole === 'doctor' ? 'Doctor' : 'Patient'}
                        {msg.senderId === auth.currentUser?.uid && <span className="ml-1 opacity-60">(You)</span>}
                      </span>
                    </div>
                    <div className={`p-4 text-sm shadow-sm transition-all hover:shadow-md ${
                      msg.senderId === auth.currentUser?.uid 
                        ? 'bg-[#5A5A40] text-white rounded-[20px] rounded-tr-none' 
                        : 'bg-white border border-[#141414]/5 text-[#141414] rounded-[20px] rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-gray-400 px-2 font-medium">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-[#141414]/5 bg-gray-50/50">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input 
                placeholder="Type your message..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-white border-[#141414]/10 focus-visible:ring-blue-600"
              />
              <Button type="submit" disabled={!isConnected} className="bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="hidden lg:flex lg:col-span-1 border-none shadow-xl bg-white flex-col">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-[#5A5A40]" />
            {userRole === 'doctor' ? 'Patient Info' : 'Doctor Info'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {partnerInfo ? (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-[#5A5A40]/10 flex items-center justify-center mb-3">
                  <User className="h-10 w-10 text-[#5A5A40]" />
                </div>
                <h3 className="font-bold text-lg">{partnerInfo.displayName}</h3>
                <p className="text-xs text-gray-500">{partnerInfo.email}</p>
                <Badge className="mt-2 capitalize" variant="secondary">{partnerInfo.role}</Badge>
              </div>

              {userRole === 'doctor' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quick Actions</p>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      <ExternalLink className="h-3 w-3 mr-2" /> View Full Report
                    </Button>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">Doctor's Note</p>
                    <p className="text-[10px] text-amber-700">Patient reported increased tremors in the morning. Monitor adherence closely.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-xs">Loading info...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
