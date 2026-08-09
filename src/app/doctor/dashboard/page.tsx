'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Users, 
  CheckSquare, 
  Bell, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Stethoscope,
  ChevronRight,
  Activity,
  CalendarDays,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_status: 'BOOKED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  reason_for_visit: string;
  patient_notes: string;
  patient_profiles: {
    full_name: string;
    phone: string;
    gender: string;
    date_of_birth: string;
  };
}

export default function DoctorDashboard() {
  const [stats, setStats] = useState({
    todayCount: 0,
    upcomingCount: 0,
    completedCount: 0,
    unreadNotifications: 0
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [togglingAccept, setTogglingAccept] = useState(false);
  const router = useRouter();

  const handleToggleAcceptingAppointments = async () => {
    if (!doctorProfile) return;
    setTogglingAccept(true);
    try {
      const newValue = !doctorProfile.accepting_appointments;
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ accepting_appointments: newValue })
        .eq('id', doctorProfile.id);

      if (!error) {
        setDoctorProfile({
          ...doctorProfile,
          accepting_appointments: newValue
        });
      } else {
        alert('Failed to update status: ' + error.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingAccept(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/doctor/login');
        return;
      }

      // 1. Fetch Doctor details
      const { data: docData } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setDoctorProfile(docData);

      const todayStr = new Date().toISOString().split('T')[0];

      // 2. Fetch Appointments
      const { data: appts, error } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          appointment_date,
          start_time,
          end_time,
          appointment_status,
          reason_for_visit,
          patient_notes,
          patient_profiles (
            full_name,
            phone,
            gender,
            date_of_birth
          )
        `)
        .eq('doctor_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      const apptList = (appts as unknown as Appointment[]) || [];
      setAppointments(apptList);

      // 3. Fetch Notifications for Stats
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_user_id', user.id)
        .eq('is_read', false);

      // Compute Stats
      const todayCount = apptList.filter(a => a.appointment_date === todayStr && a.appointment_status !== 'CANCELLED').length;
      const upcomingCount = apptList.filter(a => a.appointment_date >= todayStr && a.appointment_status === 'BOOKED').length;
      const completedCount = apptList.filter(a => a.appointment_status === 'COMPLETED').length;
      const unreadNotifications = notifs?.length || 0;

      setStats({
        todayCount,
        upcomingCount,
        completedCount,
        unreadNotifications
      });

    } catch (err) {
      console.error('Error fetching doctor dashboard:', err);
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
        .channel(`doctor-dashboard-realtime-${user.id}-${Math.random().toString(36).substring(2)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `doctor_id=eq.${user.id}`
          },
          () => {
            fetchDashboardData(); // Refresh on changes
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${user.id}`
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

  const handleUpdateStatus = async (apptId: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') => {
    let reason = undefined;
    if (status === 'CANCELLED') {
      const inputReason = window.prompt('Please enter the reason for cancellation (e.g. Doctor unavailable, emergency):');
      if (inputReason === null) return; // Cancelled prompt
      reason = inputReason.trim() || 'No specific reason provided';
    }

    setActionLoadingId(apptId);
    try {
      const response = await fetch(`/api/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update appointment.');
      } else {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to calculate age from date of birth
  const calculateAge = (dobString: string) => {
    if (!dobString) return 'N/A';
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Filter lists
  const todayStr = getTodayDateString();
  
  const todayAppointments = appointments.filter(
    a => a.appointment_date === todayStr && a.appointment_status !== 'CANCELLED'
  );

  const pendingAppointments = appointments.filter(
    a => a.appointment_status === 'BOOKED' && a.appointment_date >= todayStr
  );

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-grow">
      
      {/* Verification Notice Banner */}
      {doctorProfile?.verification_status === 'PENDING' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-r-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Doctor Verification Pending</h4>
              <p className="text-xs text-yellow-750 dark:text-yellow-450 mt-0.5">
                Your medical credentials are currently pending verification. You cannot receive bookings from patients until verified.
              </p>
            </div>
          </div>
          <Link
            href="/doctor/profile"
            className="text-xs font-bold bg-yellow-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-yellow-700 transition shadow shrink-0"
          >
            Go Verify Profile
          </Link>
        </div>
      )}

      {/* Welcome message */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 dark:text-white">Welcome back, {doctorProfile?.full_name || 'Doctor'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Here is your daily medical consultation summary.</p>
        </div>

        {/* Online/Offline Status Toggle */}
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-2.5 rounded-2xl shrink-0 border border-gray-200 dark:border-gray-700/60">
          <span className={`h-3 w-3 rounded-full ${doctorProfile?.accepting_appointments ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <div className="text-left">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Booking Status</span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              {doctorProfile?.accepting_appointments ? 'Online (Accepting Slots)' : 'Offline (No Booking)'}
            </span>
          </div>
          <button
            disabled={togglingAccept}
            onClick={handleToggleAcceptingAppointments}
            className={`ml-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow ${
              doctorProfile?.accepting_appointments 
                ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-950/40 dark:text-red-400' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {togglingAccept ? '...' : doctorProfile?.accepting_appointments ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Today Count */}
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Today's Visits</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.todayCount}</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 text-yellow-650 dark:text-yellow-450 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Pending Actions</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.upcomingCount}</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-450 flex items-center justify-center shrink-0">
            <CheckSquare className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Completed Total</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.completedCount}</span>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 flex items-center justify-center shrink-0">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Unread Alerts</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.unreadNotifications}</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Today's Consultation Schedule (Take 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-blue-600" /> Today's Consultation Schedule
            </h2>

            {todayAppointments.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-gray-150 dark:border-gray-850 text-center shadow-sm">
                <CalendarDays className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <h3 className="font-bold text-gray-700 dark:text-gray-350 text-base">No appointments scheduled for today.</h3>
                <p className="text-xs text-gray-500 mt-1">If there are pending bookings for upcoming dates, you can accept them in the list.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map(appt => (
                  <div
                    key={appt.id}
                    className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4"
                  >
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      {/* Patient metadata */}
                      <div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white block">
                          Patient: {appt.patient_profiles?.full_name || 'Anonymous'}
                        </span>
                        <span className="text-[10px] text-gray-450 dark:text-gray-400 font-medium block mt-0.5">
                          Gender: {appt.patient_profiles?.gender || 'N/A'} • Age: {calculateAge(appt.patient_profiles?.date_of_birth)}
                        </span>
                      </div>

                      {/* Consultation Time slot */}
                      <div className="text-left sm:text-right">
                        <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-0.5 rounded-md">
                          {appt.start_time.substring(0, 5)} - {appt.end_time.substring(0, 5)}
                        </span>
                        <span className={`block text-[10px] font-bold mt-1 text-right ${
                          appt.appointment_status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'
                        }`}>
                          Status: {appt.appointment_status}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-100 dark:bg-gray-800/60 p-3 rounded-xl text-xs space-y-1.5 text-gray-800 dark:text-gray-200">
                      <p><span className="font-bold text-gray-700 dark:text-gray-300">Reason:</span> {appt.reason_for_visit}</p>
                      {appt.patient_notes && (
                        <p><span className="font-bold text-gray-700 dark:text-gray-300">Notes:</span> {appt.patient_notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-850 pt-3">
                      {appt.appointment_status === 'BOOKED' && (
                        <button
                          disabled={actionLoadingId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, 'CONFIRMED')}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Accept
                        </button>
                      )}

                      {appt.appointment_status !== 'COMPLETED' && appt.appointment_status !== 'CANCELLED' && (
                        <button
                          disabled={actionLoadingId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')}
                          className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Complete Consultation
                        </button>
                      )}

                      {appt.appointment_status !== 'CANCELLED' && appt.appointment_status !== 'COMPLETED' && (
                        <button
                          disabled={actionLoadingId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                          className="px-3.5 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pending Bookings for review */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Activity className="h-4.5 w-4.5 text-yellow-600" /> Pending Bookings
            </h2>

            {pendingAppointments.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 p-6 border border-gray-150 dark:border-gray-800 rounded-2xl text-center text-xs text-gray-400">
                No pending bookings to approve.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAppointments.slice(0, 5).map(appt => (
                  <div
                    key={appt.id}
                    className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl p-4 shadow-sm space-y-3"
                  >
                    <div>
                      <span className="font-bold text-gray-850 dark:text-gray-200 text-xs block truncate">
                        {appt.patient_profiles?.full_name || 'Patient'}
                      </span>
                      <span className="text-[10px] text-gray-450 dark:text-gray-450 block mt-0.5">
                        Date: {appt.appointment_date} • {appt.start_time.substring(0, 5)}
                      </span>
                    </div>

                    <div className="flex gap-2 justify-end border-t border-gray-50 dark:border-gray-850 pt-2">
                      <button
                        disabled={actionLoadingId === appt.id}
                        onClick={() => handleUpdateStatus(appt.id, 'CONFIRMED')}
                        className="px-2 py-1 bg-blue-600 text-white rounded-md text-[10px] font-bold hover:bg-blue-700 transition"
                      >
                        Accept
                      </button>
                      <button
                        disabled={actionLoadingId === appt.id}
                        onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                        className="px-2.5 py-1 bg-red-650 text-white rounded-md text-[10px] font-bold hover:bg-red-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
