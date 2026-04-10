import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Pill, Plus, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion, serverTimestamp, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Badge } from './ui/badge';

export const MedicationTracker: React.FC = () => {
  const [meds, setMeds] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'medications'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMeds(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'medications');
    });

    return () => unsubscribe();
  }, []);

  // Separate effect for reminders to avoid leaks
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      meds.forEach((med: any) => {
        if (med.reminderTime === currentTime) {
          toast(`Time to take your ${med.name}!`, {
            description: `Dosage: ${med.dosage}`,
            icon: <Pill className="h-4 w-4 text-[#5A5A40]" />,
          });
        }
      });
    };

    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [meds]);

  const addMed = async () => {
    if (!newName || !auth.currentUser) return;

    try {
      // Fetch current user's doctorUid
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const doctorUid = userSnap.exists() ? userSnap.data().doctorUid : null;

      await addDoc(collection(db, 'medications'), {
        userId: auth.currentUser.uid,
        doctorUid: doctorUid,
        name: newName,
        dosage: newDosage,
        frequency: newFrequency,
        reminderTime: newTime,
        adherenceLogs: [],
        createdAt: serverTimestamp()
      });
      setNewName('');
      setNewDosage('');
      setNewFrequency('');
      setNewTime('');
      toast.success("Medication added with reminder");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'medications');
    }
  };

  const logAdherence = async (medId: string) => {
    try {
      await updateDoc(doc(db, 'medications', medId), {
        adherenceLogs: arrayUnion(new Date().toISOString())
      });
      toast.success("Dose logged");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'medications');
    }
  };

  const deleteMed = async (medId: string) => {
    try {
      await deleteDoc(doc(db, 'medications', medId));
      toast.success("Medication removed");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'medications');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-2xl flex items-center gap-2">
            <Pill className="h-6 w-6 text-[#5A5A40]" />
            Medication Tracker
          </CardTitle>
          <CardDescription>Manage your prescriptions and track daily adherence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="space-y-2">
              <Label>Medication Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Levodopa" />
            </div>
            <div className="space-y-2">
              <Label>Dosage</Label>
              <Input value={newDosage} onChange={e => setNewDosage(e.target.value)} placeholder="e.g. 100mg" />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Input value={newFrequency} onChange={e => setNewFrequency(e.target.value)} placeholder="e.g. 3x daily" />
            </div>
            <div className="space-y-2">
              <Label>Reminder Time</Label>
              <div className="flex gap-2">
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                <Button onClick={addMed} className="bg-[#5A5A40] hover:bg-[#4A4A30]">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meds.map(med => (
              <Card key={med.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#5A5A40]/10 rounded-xl">
                      <Pill className="h-6 w-6 text-[#5A5A40]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{med.name}</h3>
                      <p className="text-sm text-gray-500">{med.dosage} • {med.frequency}</p>
                      {med.reminderTime && (
                        <p className="text-xs text-[#5A5A40] font-bold mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Reminder: {med.reminderTime}
                        </p>
                      )}
                      
                      {med.adherenceLogs && med.adherenceLogs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {med.adherenceLogs.slice(-3).reverse().map((log: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-[9px] font-normal bg-gray-50">
                              <Clock className="h-2 w-2 mr-1 opacity-50" />
                              {new Date(log).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => logAdherence(med.id)}
                      className="border-green-200 text-green-600 hover:bg-green-50"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Log
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => deleteMed(med.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {meds.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Pill className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No medications added yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
