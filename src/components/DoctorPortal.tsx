import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { User, Activity, Pill, Calendar, ChevronRight, Check, X, Clock, FileText } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { toast } from 'sonner';

export const DoctorPortal: React.FC = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientData, setPatientData] = useState<{ tremors: any[], meds: any[] }>({ tremors: [], meds: [] });
  const [activeView, setActiveView] = useState<'patients' | 'appointments'>('patients');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (selectedPatient) {
      setNote(selectedPatient.doctorNotes || '');
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch patients
    const patientQuery = query(
      collection(db, 'users'),
      where('doctorUid', '==', auth.currentUser.uid)
    );

    const unsubPatients = onSnapshot(patientQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Fetch appointments
    const appQuery = query(
      collection(db, 'appointments'),
      where('doctorId', '==', auth.currentUser.uid)
    );

    const unsubApps = onSnapshot(appQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => {
      unsubPatients();
      unsubApps();
    };
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;

    const tremorQuery = query(collection(db, 'tremors'), where('userId', '==', selectedPatient.id));
    const medQuery = query(collection(db, 'medications'), where('userId', '==', selectedPatient.id));

    const unsubTremors = onSnapshot(tremorQuery, (snapshot) => {
      setPatientData(prev => ({ ...prev, tremors: snapshot.docs.map(doc => doc.data()) }));
    });

    const unsubMeds = onSnapshot(medQuery, (snapshot) => {
      setPatientData(prev => ({ ...prev, meds: snapshot.docs.map(doc => doc.data()) }));
    });

    return () => {
      unsubTremors();
      unsubMeds();
    };
  }, [selectedPatient]);

  const updateAppointmentStatus = async (appId: string, status: 'confirmed' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'appointments', appId), { status });
      toast.success(`Appointment ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const generateReport = () => {
    if (!selectedPatient) return;
    const tremorAvg = patientData.tremors.length > 0 
      ? (patientData.tremors.reduce((acc, t) => acc + t.severity, 0) / patientData.tremors.length).toFixed(1)
      : 'N/A';
    
    toast.info(`Health Report for ${selectedPatient.displayName}`, {
      description: `Avg Severity: ${tremorAvg} | Meds: ${patientData.meds.length} | Logs: ${patientData.meds.reduce((acc, m) => acc + (m.adherenceLogs?.length || 0), 0)}`,
    });
  };

  const saveNote = async () => {
    if (!selectedPatient) return;
    try {
      await updateDoc(doc(db, 'users', selectedPatient.id), {
        doctorNotes: note
      });
      toast.success('Notes saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-12rem)]">
      <div className="flex gap-4">
        <Button 
          variant={activeView === 'patients' ? 'default' : 'outline'}
          onClick={() => setActiveView('patients')}
          className={activeView === 'patients' ? 'bg-[#5A5A40]' : ''}
        >
          <User className="h-4 w-4 mr-2" /> Patients
        </Button>
        <Button 
          variant={activeView === 'appointments' ? 'default' : 'outline'}
          onClick={() => setActiveView('appointments')}
          className={activeView === 'appointments' ? 'bg-[#5A5A40]' : ''}
        >
          <Calendar className="h-4 w-4 mr-2" /> Appointments
          {appointments.filter(a => a.status === 'pending').length > 0 && (
            <Badge className="ml-2 bg-red-500">{appointments.filter(a => a.status === 'pending').length}</Badge>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        {activeView === 'patients' ? (
          <>
            <Card className="lg:col-span-1 border-none shadow-xl bg-white flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-xl flex items-center gap-2 whitespace-nowrap">
                  <User className="h-5 w-5 text-[#5A5A40]" />
                  My Patients
                </CardTitle>
                <CardDescription>Select to view health data.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-4">
                  <div className="space-y-3 pb-4">
                    {patients.map(patient => (
                      <div 
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          selectedPatient?.id === patient.id 
                            ? 'bg-[#5A5A40] border-[#5A5A40] text-white' 
                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 overflow-hidden ${
                            selectedPatient?.id === patient.id ? 'bg-white/20' : 'bg-[#5A5A40]/10 text-[#5A5A40]'
                          }`}>
                            {patient.photoURL ? (
                              <img src={patient.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              patient.displayName?.charAt(0) || 'P'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{patient.displayName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${
                                patient.status === 'critical' ? 'bg-red-500' : 
                                patient.status === 'attention' ? 'bg-amber-500' : 'bg-green-500'
                              }`} />
                              <p className={`text-[9px] uppercase font-bold tracking-wider ${selectedPatient?.id === patient.id ? 'text-white/60' : 'text-gray-400'}`}>
                                {patient.status || 'Stable'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 flex-shrink-0 ${selectedPatient?.id === patient.id ? 'text-white' : 'text-gray-300'}`} />
                      </div>
                    ))}
                    {patients.length === 0 && (
                      <div className="text-center py-12 px-4">
                        <div className="bg-gray-50 rounded-3xl p-6 border-2 border-dashed border-gray-100">
                          <User className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-xs text-gray-400 font-medium">No patients linked yet.</p>
                          <p className="text-[10px] text-gray-300 mt-1">Patients will appear here once they link your UID in their settings.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 border-none shadow-xl bg-white flex flex-col">
              {selectedPatient ? (
                <>
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-serif text-2xl">{selectedPatient.displayName}</CardTitle>
                        <CardDescription>Patient Health Overview</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-xs" onClick={generateReport}>
                          <FileText className="h-3 w-3 mr-1" /> Generate Report
                        </Button>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active Monitoring</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                          <div className="flex items-center gap-2 text-blue-600 mb-2">
                            <Activity className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Tremor History</span>
                          </div>
                          <p className="text-2xl font-serif font-black">{patientData.tremors.length}</p>
                          <p className="text-[10px] text-blue-400">Total recordings</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                          <div className="flex items-center gap-2 text-green-600 mb-2">
                            <Pill className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Medications</span>
                          </div>
                          <p className="text-2xl font-serif font-black">{patientData.meds.length}</p>
                          <p className="text-[10px] text-green-400">Active prescriptions</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Medication Adherence Logs</h4>
                          <div className="space-y-4">
                            {patientData.meds.map((med, i) => (
                              <div key={i} className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <p className="font-bold text-base text-[#141414]">{med.name}</p>
                                    <p className="text-xs text-gray-500">{med.dosage} • {med.frequency}</p>
                                  </div>
                                  <Badge className="bg-[#5A5A40]/10 text-[#5A5A40] border-none">
                                    {med.adherenceLogs?.length || 0} Total Doses
                                  </Badge>
                                </div>
                                
                                {med.adherenceLogs && med.adherenceLogs.length > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Activity</p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {med.adherenceLogs.slice().reverse().slice(0, 3).map((log: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100/50">
                                          <Check className="h-3 w-3 text-green-500" />
                                          <span>Taken on {log.toDate ? log.toDate().toLocaleString() : new Date(log).toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-gray-400 italic">No doses logged yet.</p>
                                )}
                              </div>
                            ))}
                            {patientData.meds.length === 0 && (
                              <div className="p-8 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                                <Pill className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-xs text-gray-400">No medications prescribed.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Clinical Notes</h4>
                            <Button size="sm" onClick={saveNote} className="bg-[#5A5A40] h-8 text-xs">
                              Save Notes
                            </Button>
                          </div>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Write clinical observations, treatment adjustments, or follow-up plans..."
                            className="w-full min-h-[150px] p-4 bg-gray-50 rounded-2xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 resize-none"
                          />
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Tremor History</h4>
                          <div className="space-y-3">
                            {patientData.tremors.slice().sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)).map((tremor, i) => (
                              <div key={i} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-[#5A5A40]/30">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      className={tremor.severity > 7 
                                        ? "bg-red-50 text-red-600 border-red-100" 
                                        : tremor.severity > 4 
                                          ? "bg-orange-50 text-orange-600 border-orange-100"
                                          : "bg-green-50 text-green-600 border-green-100"
                                      }
                                      variant="outline"
                                    >
                                      Severity: {tremor.severity}/10
                                    </Badge>
                                    {tremor.rawSummary && (
                                      <Badge variant="outline" className="text-[9px] text-gray-400 border-gray-100">
                                        Data Logged
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    {tremor.timestamp?.toDate().toLocaleString() || 'Unknown Date'}
                                  </span>
                                </div>
                                <p className="text-xs text-[#141414] leading-relaxed">
                                  {tremor.notes ? `"${tremor.notes}"` : <span className="text-gray-300 italic">No notes provided</span>}
                                </p>
                              </div>
                            ))}
                            {patientData.tremors.length === 0 && (
                              <div className="p-8 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                                <Activity className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-xs text-gray-400">No tremor reports available.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                  <User className="h-16 w-16 mb-4 opacity-10" />
                  <h3 className="text-lg font-serif font-bold text-gray-600">No Patient Selected</h3>
                  <p className="text-sm max-w-xs mt-2">Select a patient from the list on the left to view their detailed health reports and medication adherence.</p>
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card className="md:col-span-3 border-none shadow-xl bg-white flex flex-col">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Appointment Requests</CardTitle>
              <CardDescription>Confirm or reschedule patient consultations.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {appointments.map(app => {
                    const patient = patients.find(p => p.id === app.patientId);
                    return (
                      <Card key={app.id} className="border border-gray-100 shadow-sm">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#5A5A40]">
                                {patient?.displayName?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{patient?.displayName || 'Unknown Patient'}</p>
                                <Badge variant="outline" className="text-[10px] capitalize">{app.type}</Badge>
                              </div>
                            </div>
                            <Badge 
                              variant={app.status === 'confirmed' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary'} 
                              className="capitalize"
                            >
                              {app.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {new Date(app.scheduledAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              {new Date(app.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {app.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => updateAppointmentStatus(app.id, 'confirmed')}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Confirm
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex-1 text-red-600 border-red-100 hover:bg-red-50"
                                  onClick={() => updateAppointmentStatus(app.id, 'rejected')}
                                >
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {appointments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-10" />
                      <p>No appointment requests found.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
