'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  Clock, 
  Search, 
  UserCheck, 
  AlertCircle, 
  User,
  Filter,
  CheckCircle,
  Activity
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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
    address: string;
    emergency_contact: string;
  };
}

function DoctorAppointmentsContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('id'); // Used if redirected from notification click!

  const fetchAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
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
            date_of_birth,
            address,
            emergency_contact
          )
        `)
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (!error && data) {
        setAppointments(data as unknown as Appointment[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
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

      if (response.ok) {
        await fetchAppointments();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to update appointment.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const calculateAge = (dobString: string) => {
    if (!dobString) return 'N/A';
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  // Filter list
  const filteredAppointments = appointments.filter(appt => {
    const matchesSearch = 
      appt.patient_profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.reason_for_visit?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || appt.appointment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 flex-grow">
      
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white">Patient Appointments Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Review, confirm, complete, or cancel consultations registered with your profile.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row gap-4">
        
        {/* Search Input */}
        <div className="flex-grow relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4.5 w-4.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search patient name or visit reason..."
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs focus:outline-none font-semibold text-gray-650"
          >
            <option value="">All Statuses</option>
            <option value="BOOKED">BOOKED (Pending)</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-2xl p-10 text-center shadow-sm">
          <Calendar className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <h3 className="font-bold text-gray-700 dark:text-gray-300">No appointments found matching your search.</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map(appt => {
            const isHighlighted = appt.id === highlightId;
            return (
              <div
                key={appt.id}
                className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 shadow-sm space-y-4 transition ${
                  isHighlighted 
                    ? 'border-blue-550 bg-blue-50/20 dark:bg-blue-900/10 ring-2 ring-blue-500/20' 
                    : 'border-gray-150 dark:border-gray-800'
                }`}
              >
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 font-bold">
                      {appt.patient_profiles?.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{appt.patient_profiles?.full_name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">ID: {appt.id}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5">
                        Gender: {appt.patient_profiles?.gender || 'N/A'} • Age: {calculateAge(appt.patient_profiles?.date_of_birth)} • Contact: {appt.patient_profiles?.phone || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${
                      appt.appointment_status === 'COMPLETED'
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-450'
                        : appt.appointment_status === 'CANCELLED'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-450'
                        : 'bg-blue-50 text-blue-750 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {appt.appointment_status}
                    </span>
                    <div className="text-xs text-gray-700 dark:text-gray-300 font-semibold flex sm:justify-end items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> {appt.appointment_date}
                    </div>
                    <div className="text-[11px] text-gray-450 dark:text-gray-400 mt-0.5 flex sm:justify-end items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {appt.start_time.substring(0, 5)} - {appt.end_time.substring(0, 5)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-100 dark:bg-gray-800/50 p-4 rounded-xl text-xs text-gray-800 dark:text-gray-200">
                  <div>
                    <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-blue-500" /> Patient Request Details</h4>
                    <p><span className="font-semibold text-gray-500">Reason:</span> {appt.reason_for_visit}</p>
                    {appt.patient_notes && (
                      <p className="mt-1"><span className="font-semibold text-gray-500">Notes:</span> {appt.patient_notes}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><User className="h-3.5 w-3.5 text-blue-500" /> Administrative Info</h4>
                    <p><span className="font-semibold text-gray-500">Residential Address:</span> {appt.patient_profiles?.address || 'Not supplied'}</p>
                    {appt.patient_profiles?.emergency_contact && (
                      <p className="mt-1"><span className="font-semibold text-gray-550 text-red-500">Emergency Contact:</span> {appt.patient_profiles.emergency_contact}</p>
                    )}
                  </div>
                </div>

                 {/* Status updates buttons */}
                 <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-850 pt-3">
                   {appt.appointment_status === 'BOOKED' && (
                     <button
                       disabled={actionLoadingId === appt.id}
                       onClick={() => handleUpdateStatus(appt.id, 'CONFIRMED')}
                       className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                     >
                       Accept Booked Time
                     </button>
                   )}

                   {appt.appointment_status !== 'COMPLETED' && appt.appointment_status !== 'CANCELLED' && (
                     <button
                       disabled={actionLoadingId === appt.id}
                       onClick={() => handleUpdateStatus(appt.id, 'COMPLETED')}
                       className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1"
                     >
                       <CheckCircle className="h-3.5 w-3.5" /> Mark Completed
                     </button>
                   )}

                   {appt.appointment_status !== 'CANCELLED' && appt.appointment_status !== 'COMPLETED' && (
                     <button
                       disabled={actionLoadingId === appt.id}
                       onClick={() => handleUpdateStatus(appt.id, 'CANCELLED')}
                       className="px-3.5 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
                     >
                       Cancel Consultation
                     </button>
                   )}
                 </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default function DoctorAppointmentsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>}>
      <DoctorAppointmentsContent />
    </Suspense>
  );
}
