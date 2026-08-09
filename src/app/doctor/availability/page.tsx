'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  CalendarOff
} from 'lucide-react';

interface AvailabilityDay {
  day_of_week: number;
  isActive: boolean;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  appointment_duration: number;
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function DoctorAvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availabilities, setAvailabilities] = useState<AvailabilityDay[]>(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      isActive: i >= 1 && i <= 5, // Default active Mon-Fri
      start_time: '09:00',
      end_time: '17:00',
      break_start: '13:00',
      break_end: '14:00',
      appointment_duration: 30
    }))
  );

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const fetchAvailabilityData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/doctor/login');
        return;
      }

      // 1. Fetch Availability
      const { data: availData, error: availError } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', user.id);

      if (!availError && availData && availData.length > 0) {
        const mapped = availabilities.map(day => {
          const match = availData.find(a => a.day_of_week === day.day_of_week);
          if (match) {
            return {
              day_of_week: day.day_of_week,
              isActive: true,
              // Convert HH:MM:SS to HH:MM
              start_time: match.start_time.substring(0, 5),
              end_time: match.end_time.substring(0, 5),
              break_start: match.break_start ? match.break_start.substring(0, 5) : '',
              break_end: match.break_end ? match.break_end.substring(0, 5) : '',
              appointment_duration: match.appointment_duration
            };
          }
          return { ...day, isActive: false };
        });
        setAvailabilities(mapped);
      }

      // 2. Fetch Blocked Dates
      const { data: blockedData, error: blockedError } = await supabase
        .from('doctor_blocked_dates')
        .select('*')
        .eq('doctor_id', user.id)
        .order('date', { ascending: true });

      if (!blockedError && blockedData) {
        setBlockedDates(blockedData);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailabilityData();
  }, []);

  const handleToggleDay = (idx: number) => {
    setAvailabilities(prev =>
      prev.map((day, i) => (i === idx ? { ...day, isActive: !day.isActive } : day))
    );
  };

  const handleFieldChange = (idx: number, field: keyof AvailabilityDay, value: any) => {
    setAvailabilities(prev =>
      prev.map((day, i) => (i === idx ? { ...day, [field]: value } : day))
    );
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated');

      // Validate times for active days
      for (const day of availabilities) {
        if (day.isActive) {
          if (!day.start_time || !day.end_time) {
            throw new Error(`Please specify start and end times for ${DAYS_OF_WEEK[day.day_of_week]}.`);
          }
          if (day.start_time >= day.end_time) {
            throw new Error(`Start time must be before end time for ${DAYS_OF_WEEK[day.day_of_week]}.`);
          }
          if (day.break_start && day.break_end) {
            if (day.break_start <= day.start_time || day.break_end >= day.end_time || day.break_start >= day.break_end) {
              throw new Error(`Lunch break must fall within working hours for ${DAYS_OF_WEEK[day.day_of_week]}.`);
            }
          }
        }
      }

      // Delete existing availability rows for this doctor
      await supabase
        .from('doctor_availability')
        .delete()
        .eq('doctor_id', user.id);

      // Insert new active availability rows
      const activeRows = availabilities
        .filter(d => d.isActive)
        .map(d => ({
          doctor_id: user.id,
          day_of_week: d.day_of_week,
          start_time: d.start_time + ':00',
          end_time: d.end_time + ':00',
          break_start: d.break_start ? d.break_start + ':00' : null,
          break_end: d.break_end ? d.break_end + ':00' : null,
          appointment_duration: d.appointment_duration
        }));

      if (activeRows.length > 0) {
        const { error } = await supabase
          .from('doctor_availability')
          .insert(activeRows);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Weekly availability schedule saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save availability schedule.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockedDate) return;
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('doctor_blocked_dates')
        .insert({
          doctor_id: user.id,
          date: newBlockedDate,
          reason: newBlockedReason.trim() || 'Day off'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This date is already blocked.');
        }
        throw error;
      }

      setBlockedDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setNewBlockedDate('');
      setNewBlockedReason('');
      setMessage({ type: 'success', text: `Successfully blocked date ${newBlockedDate}.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to block date.' });
    }
  };

  const handleRemoveBlockedDate = async (id: string) => {
    setMessage(null);
    try {
      const { error } = await supabase
        .from('doctor_blocked_dates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBlockedDates(prev => prev.filter(b => b.id !== id));
      setMessage({ type: 'success', text: 'Blocked date removed successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to remove blocked date.' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Header Info */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-150 dark:border-gray-800 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 dark:text-white flex items-center gap-2">
          Schedule & Availability Settings
        </h1>
        <p className="text-sm text-gray-550 dark:text-gray-400 mt-1">
          Define your consulting days of the week, active slot timings, lunch break periods, and set vacation dates.
        </p>
      </div>

      {/* Response Messages */}
      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-150 dark:bg-green-950/20 dark:text-green-400' 
            : 'bg-red-50 text-red-800 border-red-150 dark:bg-red-950/20 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Availability Scheduler Grid (Take 2 columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-md">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-blue-500" /> Weekly Availability Schedule
          </h2>

          <form onSubmit={handleSaveSchedule} className="space-y-6">
            <div className="divide-y divide-gray-100 dark:divide-gray-800 space-y-4">
              {availabilities.map((day, idx) => (
                <div key={day.day_of_week} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Checkbox day name */}
                  <div className="flex items-center gap-3 w-32 shrink-0">
                    <input
                      type="checkbox"
                      id={`day-${day.day_of_week}`}
                      checked={day.isActive}
                      onChange={() => handleToggleDay(idx)}
                      className="h-4.5 w-4.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`day-${day.day_of_week}`} className={`text-sm font-bold ${day.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                      {DAYS_OF_WEEK[day.day_of_week]}
                    </label>
                  </div>

                  {/* Settings inputs when active */}
                  {day.isActive ? (
                    <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                      
                      {/* Work Timings */}
                      <div>
                        <span className="text-[10px] text-gray-450 uppercase block font-semibold mb-1">Work Hours</span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <input
                            type="time"
                            value={day.start_time}
                            onChange={(e) => handleFieldChange(idx, 'start_time', e.target.value)}
                            className="px-1.5 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs w-full font-mono"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={day.end_time}
                            onChange={(e) => handleFieldChange(idx, 'end_time', e.target.value)}
                            className="px-1.5 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs w-full font-mono"
                          />
                        </div>
                      </div>

                      {/* Lunch Break Timings */}
                      <div>
                        <span className="text-[10px] text-gray-450 uppercase block font-semibold mb-1">Lunch Break</span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <input
                            type="time"
                            value={day.break_start}
                            onChange={(e) => handleFieldChange(idx, 'break_start', e.target.value)}
                            className="px-1.5 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs w-full font-mono"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={day.break_end}
                            onChange={(e) => handleFieldChange(idx, 'break_end', e.target.value)}
                            className="px-1.5 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs w-full font-mono"
                          />
                        </div>
                      </div>

                      {/* Consultation Duration */}
                      <div className="col-span-2 sm:col-span-2">
                        <span className="text-[10px] text-gray-450 uppercase block font-semibold mb-1">Slot Duration</span>
                        <select
                          value={day.appointment_duration}
                          onChange={(e) => handleFieldChange(idx, 'appointment_duration', Number(e.target.value))}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs w-full font-medium"
                        >
                          <option value={15}>15 Minutes</option>
                          <option value={20}>20 Minutes</option>
                          <option value={30}>30 Minutes</option>
                          <option value={45}>45 Minutes</option>
                          <option value={60}>60 Minutes</option>
                        </select>
                      </div>

                    </div>
                  ) : (
                    <div className="flex-grow py-2 text-center text-xs text-gray-400 font-semibold italic bg-gray-50/50 dark:bg-gray-850/20 rounded-xl border border-dashed border-gray-150 dark:border-gray-800">
                      Not available / Day Off
                    </div>
                  )}

                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 px-5 py-2.5 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-55 shadow-md transition"
              >
                {saving ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="h-4.5 w-4.5" /> Save Weekly Schedule</>}
              </button>
            </div>
          </form>
        </div>

        {/* Date Blocker Form (Take 1 column) */}
        <div className="space-y-6">
          
          {/* Add Date Blocker Form */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-md">
            <h3 className="font-bold text-gray-855 dark:text-gray-200 mb-4 flex items-center gap-2 text-sm">
              <CalendarOff className="h-4.5 w-4.5 text-red-500" /> Block Specific Dates
            </h3>

            <form onSubmit={handleAddBlockedDate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-450 mb-1">Select Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-850 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-450 mb-1">Reason (Vacation/Off)</label>
                <input
                  type="text"
                  value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-855 text-xs"
                  placeholder="E.g., Medical conference, personal day off"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-105 text-red-650 text-xs font-semibold rounded-xl transition border border-red-200/50"
              >
                <Plus className="h-4 w-4" /> Block Selected Date
              </button>
            </form>
          </div>

          {/* Blocked Dates List */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-md max-h-[350px] flex flex-col overflow-hidden">
            <h3 className="font-bold text-gray-850 dark:text-gray-250 mb-3 text-xs flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-blue-500" /> Currently Blocked Dates
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2.5 divide-y divide-gray-100 dark:divide-gray-850">
              {blockedDates.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  No blocked dates configured.
                </div>
              ) : (
                blockedDates.map(b => (
                  <div key={b.id} className="pt-2.5 first:pt-0 flex justify-between items-start gap-2 text-xs">
                    <div>
                      <span className="font-bold text-gray-800 dark:text-gray-250 block font-mono">{b.date}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{b.reason}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveBlockedDate(b.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-950/20 transition"
                      title="Unblock Date"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
