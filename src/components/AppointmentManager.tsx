import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar, Clock, Video, MapPin, Plus, CheckCircle2, XCircle, UserPlus } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Badge } from './ui/badge';

export const AppointmentManager: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'virtual' | 'in-person'>('virtual');
  const [doctorUid, setDoctorUid] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch user's assigned doctor
    const fetchUser = async () => {
      const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser!.uid)));
      if (!userSnap.empty) {
        setDoctorUid(userSnap.docs[0].data().doctorUid || null);
      }
    };
    fetchUser();

    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      setAppointments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, []);

  const linkToSelf = async () => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { doctorUid: auth.currentUser.uid });
      setDoctorUid(auth.currentUser.uid);
      toast.success("Linked to self as doctor (Testing Mode)");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const bookAppointment = async () => {
    if (!date || !time || !auth.currentUser) return;
    if (!doctorUid) {
      toast.error("No doctor linked. Please link a doctor first.");
      return;
    }

    try {
      const scheduledAt = new Date(`${date}T${time}`);
      await addDoc(collection(db, 'appointments'), {
        patientId: auth.currentUser.uid,
        doctorId: doctorUid,
        scheduledAt: scheduledAt.toISOString(),
        status: 'pending',
        type,
        createdAt: serverTimestamp()
      });
      setDate('');
      setTime('');
      toast.success("Appointment request sent!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    }
  };

  return (
    <div className="space-y-6">
      {!doctorUid && (
        <Card className="border-none shadow-xl bg-amber-50 border-amber-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="h-6 w-6 text-amber-600" />
              <div>
                <p className="font-bold text-amber-900">No Doctor Linked</p>
                <p className="text-xs text-amber-700">You need to link a doctor before booking appointments.</p>
              </div>
            </div>
            <Button onClick={linkToSelf} variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100">
              Link to Self (Demo)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-xl bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-2xl flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#5A5A40]" />
            Appointments
          </CardTitle>
          <CardDescription>Schedule and manage your consultations with your doctor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button 
                  variant={type === 'virtual' ? 'default' : 'outline'} 
                  onClick={() => setType('virtual')}
                  className={type === 'virtual' ? 'bg-[#5A5A40]' : ''}
                >
                  <Video className="h-4 w-4 mr-2" /> Virtual
                </Button>
                <Button 
                  variant={type === 'in-person' ? 'default' : 'outline'} 
                  onClick={() => setType('in-person')}
                  className={type === 'in-person' ? 'bg-[#5A5A40]' : ''}
                >
                  <MapPin className="h-4 w-4 mr-2" /> In-Person
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={bookAppointment} className="w-full bg-[#5A5A40] hover:bg-[#4A4A30]">
                <Plus className="mr-2 h-4 w-4" /> Book Now
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-serif text-lg font-bold">Upcoming Consultations</h3>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No upcoming appointments.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointments.map(app => (
                  <Card key={app.id} className="border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${app.type === 'virtual' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {app.type === 'virtual' ? <Video className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className="font-bold text-lg">
                            {new Date(app.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock className="h-3 w-3" />
                            {new Date(app.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <Badge variant="secondary" className="ml-2 capitalize">{app.status}</Badge>
                          </div>
                        </div>
                      </div>
                      {app.status === 'pending' && (
                        <XCircle className="h-5 w-5 text-gray-300 cursor-pointer hover:text-red-400 transition-colors" />
                      )}
                      {app.status === 'confirmed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
