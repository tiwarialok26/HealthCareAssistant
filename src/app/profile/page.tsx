'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Phone, MapPin, Calendar, Heart, Save, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function PatientProfileContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    fullName: '',
    dob: '',
    gender: 'Male',
    phone: '',
    address: '',
    emergencyContact: '',
    profilePhoto: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams.get('new') === 'true';

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Fetch profile
      const { data: patientData, error: profileError } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && patientData) {
        setProfile({
          fullName: patientData.full_name || '',
          dob: patientData.date_of_birth || '',
          gender: patientData.gender || 'Male',
          phone: patientData.phone || '',
          address: patientData.address || '',
          emergencyContact: patientData.emergency_contact || '',
          profilePhoto: patientData.profile_photo || '',
        });
      }
      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!profile.fullName || !profile.phone || !profile.dob || !profile.gender) {
      setMessage({ type: 'error', text: 'Full Name, Phone, Date of Birth, and Gender are required fields.' });
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated');

      const { error } = await supabase
        .from('patient_profiles')
        .update({
          full_name: profile.fullName,
          date_of_birth: profile.dob,
          gender: profile.gender,
          phone: profile.phone,
          address: profile.address,
          emergency_contact: profile.emergencyContact,
          profile_photo: profile.profilePhoto,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile saved successfully!' });
      
      // If patient was redirected here to complete setup, redirect to dashboard after a delay
      if (isNew) {
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Navigation Breadcrumb */}
      {!isNew && (
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-blue-600 transition mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      )}

      {/* Header Info */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-md mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-950 dark:text-white flex items-center gap-2">
          Patient Profile Details
        </h1>
        <p className="text-sm text-gray-550 dark:text-gray-400 mt-1">
          {isNew 
            ? 'Complete your profile details below to unlock appointment booking.' 
            : 'Update your medical demographics and contact information.'}
        </p>
        
        {isNew && (
          <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg flex items-start gap-2.5 border border-yellow-100 text-xs dark:bg-yellow-950/25 dark:text-yellow-450 dark:border-yellow-900/30">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Medicare rule: You must fill in your Full Name, Phone, Gender, and Date of Birth to schedule appointments.</span>
          </div>
        )}
      </div>

      {/* Response Messages */}
      {message && (
        <div className={`p-4 rounded-xl mb-8 flex items-start gap-3 border ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-150 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/20' 
            : 'bg-red-50 text-red-800 border-red-150 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg p-6 sm:p-8 space-y-6">
        
        {/* Profile photo URL */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
          {profile.profilePhoto ? (
            <img
              src={profile.profilePhoto}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover border-2 border-blue-500 shadow-md"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-2xl border border-blue-100 dark:border-blue-900/30">
              {profile.fullName?.charAt(0).toUpperCase() || 'P'}
            </div>
          )}
          <div className="flex-1 w-full">
            <label htmlFor="photoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Profile Photo URL
            </label>
            <input
              id="photoUrl"
              type="url"
              value={profile.profilePhoto}
              onChange={(e) => setProfile({ ...profile, profilePhoto: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://images.unsplash.com/... or any image link"
            />
          </div>
        </div>

        {/* Demographics Group */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <User className="h-4.5 w-4.5" />
              </div>
              <input
                id="fullName"
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Rahul Sharma"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Phone className="h-4.5 w-4.5" />
              </div>
              <input
                id="phone"
                type="tel"
                required
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <input
                id="dob"
                type="date"
                required
                value={profile.dob}
                onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender *
            </label>
            <select
              id="gender"
              value={profile.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Address and Contacts */}
        <div className="space-y-6">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Residential Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-3 flex items-start pointer-events-none text-gray-400">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              <textarea
                id="address"
                rows={3}
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Flat No, Street, Landmark, City, State, PIN"
              />
            </div>
          </div>

          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Emergency Contact (Name & Phone)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Heart className="h-4.5 w-4.5 text-red-500" />
              </div>
              <input
                id="emergencyContact"
                type="text"
                value={profile.emergencyContact}
                onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="E.g., Amit Sharma (Brother) - 98765 00000"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-55 shadow-md hover:shadow-lg transition-all duration-200"
          >
            {saving ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Save className="h-4.5 w-4.5" /> Save Profile Details
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}

export default function PatientProfilePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>}>
      <PatientProfileContent />
    </Suspense>
  );
}
