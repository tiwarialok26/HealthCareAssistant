'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  UserCheck, 
  MapPin, 
  DollarSign, 
  Clock, 
  Languages, 
  FileText, 
  Calendar as CalendarIcon, 
  User, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

interface DoctorProfile {
  id: string;
  full_name: string;
  profile_photo: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  hospital_name: string;
  hospital_address: string;
  consultation_fee: number;
  languages: string[];
  about: string;
  verification_status: string;
  accepting_appointments?: boolean;
}

interface Availability {
  day_of_week: number;
  start_time: string;
  end_time: string;
  appointment_duration: number;
  break_start: string;
  break_end: string;
}

interface Appointment {
  appointment_date: string;
  start_time: string;
}

function DoctorDetailContent() {
  const { id: doctorId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rescheduleId = searchParams.get('reschedule');

  const doctorProfileId = Array.isArray(doctorId) ? doctorId[0] : doctorId;

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Booking States
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState(rescheduleId ? 'Rescheduling Appointment' : '');
  const [notes, setNotes] = useState('');
  
  const [slots, setSlots] = useState<{ time: string; status: 'available' | 'booked' | 'break' | 'passed' }[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    if (!doctorProfileId) return;

    const fetchDoctorDetails = async () => {
      setLoading(true);
      try {
        // 1. Fetch Doctor Profile
        const { data: docData, error: docError } = await supabase
          .from('doctor_profiles')
          .select('*')
          .eq('id', doctorProfileId)
          .single();

        if (docError || !docData) {
          setErrorMsg('Doctor profile not found.');
          setLoading(false);
          return;
        }
        setDoctor(docData);

        // 2. Fetch Availability
        const { data: availData } = await supabase
          .from('doctor_availability')
          .select('*')
          .eq('doctor_id', doctorProfileId);
        
        setAvailabilities(availData || []);

        // 3. Fetch Blocked Dates
        const { data: blockedData } = await supabase
          .from('doctor_blocked_dates')
          .select('date')
          .eq('doctor_id', doctorProfileId);

        setBlockedDates(blockedData?.map(d => d.date) || []);

      } catch (err) {
        console.error('Error fetching doctor details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorDetails();
  }, [doctorProfileId]);

  // Load appointments and generate slots for today's date
  useEffect(() => {
    if (!selectedDate || !doctor) return;

    const loadDateSlots = async () => {
      setSelectedSlot('');
      
      // Fetch appointments for doctor on this date
      const { data: appts } = await supabase
        .from('appointments')
        .select('appointment_date, start_time')
        .eq('doctor_id', doctor.id)
        .eq('appointment_date', selectedDate)
        .neq('appointment_status', 'CANCELLED');

      const bookedSlots = appts || [];

      // Generate slots from 10:00 to 22:00 at 15-minute intervals
      const startMins = 10 * 60; // 10:00 AM
      const endMins = 22 * 60;   // 10:00 PM
      const duration = 15;
      
      const currentMins = new Date().getHours() * 60 + new Date().getMinutes();
      const todayStr = new Date().toISOString().split('T')[0];
      const list: { time: string; status: 'available' | 'booked' | 'break' | 'passed' }[] = [];
      const pad = (n: number) => n.toString().padStart(2, '0');

      let temp = startMins;
      while (temp < endMins) {
        const h = Math.floor(temp / 60);
        const m = temp % 60;
        const timeString = `${pad(h)}:${pad(m)}`;

        let status: 'available' | 'booked' | 'break' | 'passed' = 'available';

        // 1. Check if slot has passed (if booking is for today)
        if (selectedDate === todayStr && temp <= currentMins) {
          status = 'passed';
        } else {
          // 2. Check if already booked
          const isBooked = bookedSlots.some(appt => {
            const apptStart = appt.start_time.substring(0, 5);
            return apptStart === timeString;
          });
          if (isBooked) {
            status = 'booked';
          }
        }

        list.push({ time: timeString, status });
        temp += duration;
      }

      setSlots(list);
    };

    loadDateSlots();
  }, [selectedDate, doctor]);

  const timeToMinutes = (tStr: string) => {
    const [h, m] = tStr.split(':').map(Number);
    return h * 60 + m;
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) {
      setErrorMsg('Please select a date and time slot.');
      return;
    }

    setErrorMsg(null);
    setBookingLoading(true);

    try {
      let response;
      if (rescheduleId) {
        // RESCHEDULING FLOW
        response = await fetch(`/api/appointments/${rescheduleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            startTime: selectedSlot
          })
        });
      } else {
        // FRESH BOOKING FLOW
        response = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: doctor?.id,
            date: selectedDate,
            startTime: selectedSlot,
            reasonForVisit: reason,
            patientNotes: notes
          })
        });
      }

      const resData = await response.json();

      if (!response.ok) {
        setErrorMsg(resData.error || 'Failed to complete appointment action. Please try again.');
        setBookingLoading(false);
        return;
      }

      setSuccessData(resData.appointment);
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      setBookingLoading(false);
    }
  };

  // Get tomorrow's date string for input minimum constraint
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (errorMsg && !doctor) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-50 text-red-700 rounded-2xl text-center border border-red-200 dark:bg-red-950/20 dark:text-red-400">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500" />
        <h2 className="text-lg font-bold">Error Loading Doctor Details</h2>
        <p className="text-sm mt-1">{errorMsg}</p>
        <Link href="/doctors" className="mt-4 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Back to Doctors Search
        </Link>
      </div>
    );
  }

  if (successData) {
    return (
      <div className="max-w-2xl mx-auto my-10 p-8 sm:p-10 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-xl text-center">
        <div className="flex justify-center mb-4 text-green-500">
          <CheckCircle className="h-16 w-16 fill-current animate-bounce" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Appointment Booked Successfully!</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Your reservation has been confirmed and registered in our database.
        </p>

        {/* Appointment details block */}
        <div className="bg-gray-50 dark:bg-gray-800/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 text-left my-8 space-y-3.5 text-sm">
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <span className="text-gray-550 dark:text-gray-400 font-medium">Appointment ID:</span>
            <span className="font-mono text-xs text-gray-900 dark:text-white font-bold">{successData.id}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <span className="text-gray-550 dark:text-gray-400 font-medium">Doctor:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{successData.doctorName} ({successData.specialization})</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <span className="text-gray-550 dark:text-gray-400 font-medium">Date & Time:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{successData.date} at {successData.time}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <span className="text-gray-550 dark:text-gray-400 font-medium">Clinic/Hospital:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{successData.hospital}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-550 dark:text-gray-400 font-medium">Status:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-2.5 py-0.5 rounded-full text-xs">
              {successData.status}
            </span>
          </div>
        </div>

        {/* Navigation CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm transition"
          >
            Go to My Dashboard
          </Link>
          <Link
            href="/doctors"
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-xl font-semibold text-sm transition"
          >
            Find More Doctors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
      
      {/* Back button */}
      <Link href="/doctors" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-blue-600 transition mb-6">
        <ChevronLeft className="h-4 w-4" /> Back to Search
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Doctor Profile Bio & Credentials */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-md">
            
            {/* Header info */}
            <div className="text-center pb-6 border-b border-gray-100 dark:border-gray-800 flex flex-col items-center">
              {doctor?.profile_photo ? (
                <img
                  src={doctor.profile_photo}
                  alt={doctor.full_name}
                  className="h-28 w-28 rounded-full object-cover border-4 border-blue-50 shadow-md mb-4"
                />
              ) : (
                <div className="h-28 w-28 rounded-full bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-3xl mb-4 border border-blue-100">
                  {doctor?.full_name?.replace('Dr. ', '').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex items-center gap-1.5 justify-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{doctor?.full_name}</h1>
                {doctor?.verification_status === 'VERIFIED' && (
                  <span className="bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 p-0.5 rounded-full" title="Verified Professional">
                    <UserCheck className="h-4.5 w-4.5" />
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-0.5">{doctor?.specialization}</p>
              <p className="text-xs text-gray-500 dark:text-gray-405 mt-1">{doctor?.qualification}</p>
              <p className="text-xs text-gray-450 dark:text-gray-400 font-medium mt-0.5">{doctor?.experience_years} Years Professional Experience</p>
            </div>

            {/* Quick specifications */}
            <div className="pt-6 space-y-4 text-sm text-gray-650 dark:text-gray-350">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-250">Hospital/Clinic</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{doctor?.hospital_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{doctor?.hospital_address}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-850 pt-3">
                <span className="flex items-center gap-1.5 font-medium"><DollarSign className="h-4.5 w-4.5 text-green-500" /> Consultation Fee</span>
                <span className="font-bold text-gray-900 dark:text-white">Rs. {doctor?.consultation_fee}</span>
              </div>

              {doctor?.languages && doctor.languages.length > 0 && (
                <div className="flex items-start gap-2.5 border-t border-gray-50 dark:border-gray-850 pt-3">
                  <Languages className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-250">Languages Spoken</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{doctor?.languages.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bio block */}
          {doctor?.about && (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-md">
              <h3 className="font-bold text-gray-850 dark:text-gray-200 mb-3 flex items-center gap-1.5"><FileText className="h-4.5 w-4.5 text-blue-500" /> About Doctor</h3>
              <p className="text-xs text-gray-550 dark:text-gray-400 leading-relaxed whitespace-pre-line">{doctor.about}</p>
            </div>
          )}
        </div>

        {/* Right Column: Appointment Scheduler */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-500" /> Schedule Your Appointment
            </h2>

            {/* Error notifications */}
            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg text-sm mb-6 dark:bg-red-950/20 dark:text-red-400">
                <span className="font-semibold">Booking Error: </span>
                {errorMsg}
              </div>
            )}

            {doctor?.accepting_appointments === false ? (
              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-5 rounded-r-2xl text-xs dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30 shadow-sm flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <h4 className="font-bold text-sm">Doctor Currently Offline</h4>
                  <p className="mt-1">
                    {doctor.full_name} is currently offline and not accepting new consultation appointments. Please check back later or search for other online specialists.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookAppointment} className="space-y-6">
              
              {/* Step 1: Booking Date (Fixed to Today) */}
              <div>
                <label className="block text-sm font-semibold text-gray-750 dark:text-gray-300 mb-2">
                  Booking Date (Today)
                </label>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-850 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-150 dark:border-gray-800 flex items-center gap-2">
                  <CalendarIcon className="h-4.5 w-4.5 text-blue-500" />
                  {selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...'}
                </div>
              </div>

              {/* Step 2: Time Slots */}
              {selectedDate && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    2. Select Available Time Slot
                  </label>

                  {slots.length === 0 ? (
                    <div className="p-6 text-center bg-gray-50 dark:bg-gray-800/20 border border-dashed border-gray-250 dark:border-gray-800 rounded-2xl text-gray-500 text-xs">
                      The doctor is not working or has blocked this date. Please choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2">
                      {slots.map(slot => {
                        const isAvailable = slot.status === 'available';
                        const isSelected = selectedSlot === slot.time;
                        
                        let btnStyle = "border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-350 bg-white dark:bg-gray-850 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200";
                        if (isSelected) {
                          btnStyle = "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10";
                        } else if (!isAvailable) {
                          btnStyle = "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-800/40 text-gray-400 dark:text-gray-600 border-gray-150 dark:border-gray-850 line-through";
                        }

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => setSelectedSlot(slot.time)}
                            className={`py-2 px-1 text-center font-mono rounded-lg text-xs font-semibold transition ${btnStyle}`}
                            title={
                              slot.status === 'booked' 
                                ? 'Already booked' 
                                : slot.status === 'break' 
                                ? 'Doctor on break' 
                                : slot.status === 'passed' 
                                ? 'Time slot passed' 
                                : 'Available'
                            }
                          >
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Details & Confirmation */}
              {selectedSlot && (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-300">
                  <div>
                    <label htmlFor="reason" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      3. Reason for Visit *
                    </label>
                    <input
                      id="reason"
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="E.g., Yearly health checkup, skin rash, follow-up"
                    />
                  </div>

                  <div>
                    <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Patient Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add any medical details or history notes here..."
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={bookingLoading}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-55 shadow-lg shadow-blue-500/10 transition duration-200"
                    >
                      {bookingLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span>Confirm Appointment Booking</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DoctorDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>}>
      <DoctorDetailContent />
    </Suspense>
  );
}
