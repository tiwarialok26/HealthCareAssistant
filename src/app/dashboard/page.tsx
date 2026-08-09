'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Activity, 
  User, 
  Loader2, 
  FileText,
  XCircle,
  CalendarDays,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';

interface Appointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_status: 'BOOKED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  reason_for_visit: string;
  patient_notes: string;
  doctor_profiles: {
    full_name: string;
    specialization: string;
    hospital_name: string;
    hospital_address: string;
  };
}

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch patient profile
      const { data: profData } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setPatientProfile(profData);

      // 2. Fetch appointments
      const { data: apptsData, error: apptsError } = await supabase
        .from('appointments')
        .select(`
          id,
          doctor_id,
          appointment_date,
          start_time,
          end_time,
          appointment_status,
          reason_for_visit,
          patient_notes,
          doctor_profiles (
            full_name,
            specialization,
            hospital_name,
            hospital_address
          )
        `)
        .eq('patient_id', user.id)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!apptsError && apptsData) {
        setAppointments(apptsData as unknown as Appointment[]);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time listener for appointments changes so dashboard refreshes instantly
    const getSessionAndSubscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`patient-dashboard-realtime-${user.id}-${Math.random().toString(36).substring(2)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `patient_id=eq.${user.id}`
          },
          () => {
            fetchDashboardData(); // Refresh on changes
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const unsubscribePromise = getSessionAndSubscribe();

    return () => {
      unsubscribePromise.then(unsub => unsub?.());
    };
  }, []);

  const handleCancelAppointment = async (apptId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    
    setActionLoadingId(apptId);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/appointments/${apptId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Failed to cancel appointment.');
        setActionLoadingId(null);
        return;
      }

      // Re-fetch appointments to refresh
      await fetchDashboardData();
    } catch (err) {
      setErrorMsg('An error occurred. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Categorize Appointments
  const todayStr = getTodayDateString();
  const upcomingAppointments = appointments.filter(
    a => a.appointment_status !== 'CANCELLED' && a.appointment_status !== 'COMPLETED' && a.appointment_date >= todayStr
  );
  
  const pastAppointments = appointments.filter(
    a => a.appointment_status === 'COMPLETED' || (a.appointment_status !== 'CANCELLED' && a.appointment_date < todayStr)
  );

  const cancelledAppointments = appointments.filter(
    a => a.appointment_status === 'CANCELLED'
  );

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow space-y-8">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Hello, {patientProfile?.full_name || 'Patient'}</h1>
          <p className="text-blue-100 text-sm mt-1">Manage your consultations, book doctors, and monitor your upcoming appointments.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/doctors"
            className="px-4 py-2 bg-white text-blue-600 font-bold text-sm rounded-xl shadow-md hover:bg-blue-50 transition"
          >
            Find & Book Doctor
          </Link>
          <Link
            href="/assistant"
            className="px-4 py-2 bg-blue-500/30 border border-blue-400/30 text-white font-bold text-sm rounded-xl hover:bg-blue-500/40 transition"
          >
            Talk to AI Health Bot
          </Link>
        </div>
      </div>

      {/* Profile Incompletion Alert */}
      {(!patientProfile?.phone || !patientProfile?.date_of_birth) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-r-2xl flex items-start gap-3 text-sm dark:bg-yellow-950/25 dark:text-yellow-450 dark:border-yellow-900/30 shadow-sm">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold">Complete Your Profile Details</h4>
            <p className="text-xs text-yellow-750 dark:text-yellow-400 mt-0.5">
              To book medical specialists, you must supply your Date of Birth, Gender, and Phone number.
            </p>
            <Link href="/profile" className="font-semibold text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2 block">
              Set Up Profile Now &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-2xl text-sm dark:bg-red-950/25 dark:text-red-400 shadow-sm">
          <span className="font-semibold">Action Error: </span>
          {errorMsg}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upcoming Appointments (Take most space) */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-650" /> Upcoming Consultations
            </h2>

            {upcomingAppointments.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-gray-150 dark:border-gray-800 text-center shadow-sm">
                <CalendarDays className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <h3 className="font-bold text-gray-700 dark:text-gray-350 text-base">You don't have any upcoming appointments.</h3>
                <p className="text-xs text-gray-500 mt-1">Book your doctor today to schedule a checkup or treatment consultation.</p>
                <Link
                  href="/doctors"
                  className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700 transition"
                >
                  Book Doctor Consultation
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map(appt => (
                  <div
                    key={appt.id}
                    className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-md flex flex-col justify-between"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      
                      {/* Left: Doc & Hosp details */}
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 font-bold">
                          {appt.doctor_profiles.full_name?.replace('Dr. ', '').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white text-sm block">
                            {appt.doctor_profiles.full_name}
                          </span>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                            {appt.doctor_profiles.specialization}
                          </span>
                          <p className="text-[10px] text-gray-450 dark:text-gray-450 mt-1 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" /> {appt.doctor_profiles.hospital_name}
                          </p>
                        </div>
                      </div>

                      {/* Right: Date Time and Status */}
                      <div className="text-left sm:text-right shrink-0">
                        <span className="inline-block bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                          {appt.appointment_status}
                        </span>
                        <div className="text-xs text-gray-700 dark:text-gray-300 font-medium flex sm:justify-end items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> {appt.appointment_date}
                        </div>
                        <div className="text-xs text-gray-550 dark:text-gray-400 mt-0.5 flex sm:justify-end items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {appt.start_time.substring(0, 5)} - {appt.end_time.substring(0, 5)}
                        </div>
                      </div>
                    </div>

                    {/* Details and Actions */}
                    <div className="border-t border-gray-100 dark:border-gray-850 mt-4 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-bold">Reason:</span> {appt.reason_for_visit}
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <Link
                          href={`/doctors/${appt.doctor_id}?reschedule=${appt.id}`}
                          className="flex-1 sm:flex-none text-center px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-850 transition"
                        >
                          Reschedule
                        </Link>
                        
                        <button
                          disabled={actionLoadingId === appt.id}
                          onClick={() => handleCancelAppointment(appt.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          {actionLoadingId === appt.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Cancel'
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: History List (Past and Cancelled) */}
        <div className="space-y-6">
          
          {/* Past consultations */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-green-600" /> Past Consultations
            </h2>

            {pastAppointments.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 p-6 border border-gray-150 dark:border-gray-800 rounded-2xl text-center text-xs text-gray-400">
                No past consultations recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {pastAppointments.map(appt => (
                  <div
                    key={appt.id}
                    className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-gray-800 dark:text-gray-250 text-xs block">{appt.doctor_profiles.full_name}</span>
                        <span className="text-[10px] text-gray-450 dark:text-gray-400 block mt-0.5">{appt.doctor_profiles.specialization}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        appt.appointment_status === 'COMPLETED'
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                          : 'bg-gray-50 text-gray-700 dark:bg-gray-850 dark:text-gray-400'
                      }`}>
                        {appt.appointment_status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2.5 pt-2 border-t border-gray-50 dark:border-gray-850">
                      <span>{appt.appointment_date}</span>
                      <span>{appt.start_time.substring(0, 5)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cancelled consultations */}
          {cancelledAppointments.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-gray-650 dark:text-gray-300 flex items-center gap-2 mb-3">
                <XCircle className="h-4.5 w-4.5 text-red-500" /> Cancelled Bookings
              </h2>
              <div className="space-y-2">
                {cancelledAppointments.map(appt => (
                  <div
                    key={appt.id}
                    className="bg-white dark:bg-gray-900 border border-red-100/50 dark:border-red-950/20 rounded-xl p-3 shadow-inner flex justify-between items-center opacity-65"
                  >
                    <div>
                      <span className="font-bold text-gray-800 dark:text-gray-300 text-xs block">{appt.doctor_profiles.full_name}</span>
                      <span className="text-[9px] text-gray-400 block">{appt.appointment_date} • {appt.start_time.substring(0, 5)}</span>
                    </div>
                    <span className="text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 px-2 py-0.5 rounded-full">
                      Cancelled
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
