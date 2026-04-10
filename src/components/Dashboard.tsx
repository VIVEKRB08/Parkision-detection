import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Activity, Calendar, TrendingUp, AlertCircle, CheckCircle2, MessageSquare, BrainCircuit } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export const Dashboard: React.FC<{ setActiveTab?: (tab: string) => void }> = ({ setActiveTab }) => {
  const [tremorHistory, setTremorHistory] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [checklistHistory, setChecklistHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const tremorQuery = query(
      collection(db, 'tremors'),
      where('userId', '==', auth.currentUser.uid),
      limit(10)
    );

    const medQuery = query(
      collection(db, 'medications'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubTremors = onSnapshot(tremorQuery, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({
          date: doc.data().timestamp?.toDate().toLocaleDateString() || '',
          severity: doc.data().severity,
          rawTimestamp: doc.data().timestamp?.toDate() || new Date()
        }))
        .sort((a, b) => a.rawTimestamp.getTime() - b.rawTimestamp.getTime());
      setTremorHistory(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tremors');
    });

    const unsubMeds = onSnapshot(medQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setMeds(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'medications');
    });

    const checklistQuery = query(
      collection(db, 'checklists'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubChecklist = onSnapshot(checklistQuery, (snapshot) => {
      if (snapshot.empty) {
        // Initialize default checklist
        const defaults = [
          { label: "Morning Medication", completed: false },
          { label: "15-min Hand Exercises", completed: false },
          { label: "Hydration Goal (2L)", completed: false },
          { label: "Tremor Recording", completed: false }
        ];
        setChecklist(defaults);
      } else {
        setChecklist(snapshot.docs[0].data().items);
      }
    });

    const historyQuery = query(
      collection(db, 'checklist_logs'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc'),
      limit(7)
    );

    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      if (snapshot.empty) {
        // Mock data for the past week if empty
        const mockData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            date: d.toLocaleDateString('en-US', { weekday: 'short' }),
            completed: Math.floor(Math.random() * 4) + 1,
            fullDate: d.toISOString().split('T')[0]
          };
        });
        setChecklistHistory(mockData);
      } else {
        const data = snapshot.docs.map(doc => ({
          date: new Date(doc.data().date).toLocaleDateString('en-US', { weekday: 'short' }),
          completed: doc.data().completedCount,
          fullDate: doc.data().date
        })).reverse();
        setChecklistHistory(data);
      }
    });

    return () => {
      unsubTremors();
      unsubMeds();
      unsubChecklist();
      unsubHistory();
    };
  }, []);

  const toggleCheck = async (index: number) => {
    if (!auth.currentUser) return;
    const newChecklist = [...checklist];
    newChecklist[index].completed = !newChecklist[index].completed;
    setChecklist(newChecklist);

    const completedCount = newChecklist.filter(i => i.completed).length;
    const today = new Date().toISOString().split('T')[0];

    try {
      // Update current checklist
      const q = query(collection(db, 'checklists'), where('userId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await addDoc(collection(db, 'checklists'), {
          userId: auth.currentUser.uid,
          items: newChecklist,
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'checklists', snapshot.docs[0].id), {
          items: newChecklist,
          updatedAt: serverTimestamp()
        });
      }

      // Update daily log
      const logQ = query(
        collection(db, 'checklist_logs'), 
        where('userId', '==', auth.currentUser.uid),
        where('date', '==', today)
      );
      const logSnap = await getDocs(logQ);
      if (logSnap.empty) {
        await addDoc(collection(db, 'checklist_logs'), {
          userId: auth.currentUser.uid,
          date: today,
          completedCount,
          totalCount: newChecklist.length
        });
      } else {
        await updateDoc(doc(db, 'checklist_logs', logSnap.docs[0].id), {
          completedCount,
          totalCount: newChecklist.length
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'checklists');
    }
  };

  const avgSeverity = tremorHistory.length > 0 
    ? (tremorHistory.reduce((acc, curr) => acc + curr.severity, 0) / tremorHistory.length).toFixed(1)
    : 'N/A';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Avg. Tremor Severity" 
          value={avgSeverity} 
          icon={<Activity className="h-6 w-6 text-blue-600" />}
          description="Last 10 recordings"
          color="bg-blue-50"
        />
        <StatCard 
          title="Medications Active" 
          value={meds.length.toString()} 
          icon={<TrendingUp className="h-6 w-6 text-green-600" />}
          description="Prescribed treatments"
          color="bg-green-50"
        />
        <StatCard 
          title="Next Appointment" 
          value="Oct 24" 
          icon={<Calendar className="h-6 w-6 text-purple-600" />}
          description="Virtual consultation"
          color="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-xl bg-white">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Tremor Progression</CardTitle>
            <CardDescription>Visualizing your tremor intensity over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tremorHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                  <XAxis dataKey="date" fontSize={10} tickMargin={10} />
                  <YAxis domain={[0, 10]} fontSize={10} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="severity" 
                    stroke="#5A5A40" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#5A5A40' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2 rounded-2xl border-gray-100 hover:bg-blue-50 hover:border-blue-100"
                onClick={() => setActiveTab?.('chat')}
              >
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-bold">Chat</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2 rounded-2xl border-gray-100 hover:bg-purple-50 hover:border-purple-100"
                onClick={() => setActiveTab?.('assistant')}
              >
                <BrainCircuit className="h-5 w-5 text-purple-600" />
                <span className="text-xs font-bold">AI Help</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Weekly Adherence</CardTitle>
              <CardDescription>Tasks completed over the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[150px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={checklistHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                    <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                      {checklistHistory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.completed >= 3 ? '#5A5A40' : '#A5A58D'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Daily Checklist</CardTitle>
              <CardDescription>Stay on track with your health goals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklist.map((item, idx) => (
                <CheckItem 
                  key={idx} 
                  label={item.label} 
                  completed={item.completed} 
                  onToggle={() => toggleCheck(idx)} 
                />
              ))}
              
              <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Health Tip</p>
                  <p className="text-xs text-amber-800">Regular exercise like Tai Chi can significantly improve balance and reduce tremor severity.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, description, color }: any) => (
  <Card className="border-none shadow-xl bg-white overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${color}`}>
          {icon}
        </div>
        <Badge variant="secondary" className="bg-gray-100 text-gray-600">+2% vs last week</Badge>
      </div>
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-3xl font-serif font-black mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-2">{description}</p>
    </CardContent>
  </Card>
);

interface CheckItemProps {
  label: string;
  completed: boolean;
  onToggle: () => any;
}

const CheckItem: React.FC<CheckItemProps> = ({ label, completed, onToggle }) => (
  <div 
    onClick={() => onToggle()}
    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
  >
    <span className={`text-sm font-medium ${completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{label}</span>
    {completed ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    )}
  </div>
);
