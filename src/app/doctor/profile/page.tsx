'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Phone, 
  MapPin, 
  Award, 
  ShieldCheck, 
  DollarSign, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Stethoscope,
  Globe
} from 'lucide-react';

function DoctorProfileContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    fullName: '',
    specialization: 'General Medicine',
    qualification: '',
    medicalRegistrationNumber: '',
    experienceYears: 0,
    hospitalName: '',
    hospitalAddress: '',
    consultationFee: 0,
    languages: '',
    about: '',
    profilePhoto: '',
    verificationStatus: 'PENDING'
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams.get('new') === 'true';

  useEffect(() => {
    const checkDoctor = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/doctor/login');
        return;
      }

      // Fetch profile
      const { data: doctorData, error: profileError } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && doctorData) {
        setProfile({
          fullName: doctorData.full_name || '',
          specialization: doctorData.specialization || 'General Medicine',
          qualification: doctorData.qualification || '',
          medicalRegistrationNumber: doctorData.medical_registration_number || '',
          experienceYears: doctorData.experience_years || 0,
          hospitalName: doctorData.hospital_name || '',
          hospitalAddress: doctorData.hospital_address || '',
          consultationFee: Number(doctorData.consultation_fee) || 0,
          languages: doctorData.languages ? doctorData.languages.join(', ') : '',
          about: doctorData.about || '',
          profilePhoto: doctorData.profile_photo || '',
          verificationStatus: doctorData.verification_status || 'PENDING'
        });
      }
      setLoading(false);
    };

    checkDoctor();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!profile.fullName || !profile.qualification || !profile.medicalRegistrationNumber || !profile.hospitalName || !profile.hospitalAddress) {
      setMessage({ type: 'error', text: 'Please fill in all required credentials.' });
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthenticated');

      // Parse languages into string array
      const langArray = profile.languages
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const { error } = await supabase
        .from('doctor_profiles')
        .update({
          full_name: profile.fullName,
          specialization: profile.specialization,
          qualification: profile.qualification,
          medical_registration_number: profile.medicalRegistrationNumber,
          experience_years: Number(profile.experienceYears),
          hospital_name: profile.hospitalName,
          hospital_address: profile.hospitalAddress,
          consultation_fee: Number(profile.consultationFee),
          languages: langArray,
          about: profile.about,
          profile_photo: profile.profilePhoto,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Professional details updated successfully!' });
      
      if (isNew) {
        setTimeout(() => {
          router.push('/doctor/availability?new=true'); // Guide them to schedule setup next!
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  // Demo Self-Verification Trigger
  const handleSelfVerify = async () => {
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('doctor_profiles')
        .update({ verification_status: 'VERIFIED' })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, verificationStatus: 'VERIFIED' }));
      setMessage({ type: 'success', text: 'Demo Account Self-Verified! You are now active to receive patient bookings.' });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Verification update failed.' });
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
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header Bio banner */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-150 dark:border-gray-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 dark:text-white flex items-center gap-2">
            Professional Profile
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-405 mt-1">
            Complete your professional credentials so patients can find and book appointments with you.
          </p>
        </div>

        {/* Verification banner */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold uppercase">Status:</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              profile.verificationStatus === 'VERIFIED'
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400'
                : 'bg-yellow-50 text-yellow-750 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400'
            }`}>
              {profile.verificationStatus}
            </span>
          </div>

          {profile.verificationStatus === 'PENDING' && (
            <button
              onClick={handleSelfVerify}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/10 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-900/25"
            >
              Demo: Self-Verify Profile
            </button>
          )}
        </div>
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
        
        {/* Photo URL */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-850">
          {profile.profilePhoto ? (
            <img
              src={profile.profilePhoto}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover border-2 border-blue-500 shadow-md"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-blue-50 dark:bg-blue-900/35 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-2xl border border-blue-100">
              {profile.fullName?.replace('Dr. ', '').charAt(0).toUpperCase() || 'D'}
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
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
              placeholder="https://images.unsplash.com/... or any image URL"
            />
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name * (with Dr. prefix)
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
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Specialization *
            </label>
            <select
              id="specialization"
              value={profile.specialization}
              onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
            >
              <option value="General Medicine">General Medicine</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Dermatology">Dermatology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Neurology">Neurology</option>
              <option value="Psychiatry">Psychiatry</option>
              <option value="Gynecology">Gynecology</option>
              <option value="Ophthalmology">Ophthalmology</option>
              <option value="ENT">ENT</option>
            </select>
          </div>

          <div>
            <label htmlFor="qualification" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Qualifications *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Award className="h-4.5 w-4.5" />
              </div>
              <input
                id="qualification"
                type="text"
                required
                value={profile.qualification}
                onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
                placeholder="MBBS, MD - General Medicine"
              />
            </div>
          </div>

          <div>
            <label htmlFor="medicalReg" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Medical License/Registration Number *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <input
                id="medicalReg"
                type="text"
                required
                value={profile.medicalRegistrationNumber}
                onChange={(e) => setProfile({ ...profile, medicalRegistrationNumber: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
                placeholder="MCI-12345"
              />
            </div>
          </div>

          <div>
            <label htmlFor="experience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Years of Experience
            </label>
            <input
              id="experience"
              type="number"
              min={0}
              value={profile.experienceYears}
              onChange={(e) => setProfile({ ...profile, experienceYears: Number(e.target.value) })}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div>
            <label htmlFor="fee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Consultation Fee (Rs.)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <DollarSign className="h-4.5 w-4.5 text-green-500" />
              </div>
              <input
                id="fee"
                type="number"
                min={0}
                value={profile.consultationFee}
                onChange={(e) => setProfile({ ...profile, consultationFee: Number(e.target.value) })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
                placeholder="500"
              />
            </div>
          </div>
        </div>

        {/* Hospital Address details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-850">
          <div>
            <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hospital/Clinic Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Stethoscope className="h-4.5 w-4.5" />
              </div>
              <input
                id="hospitalName"
                type="text"
                required
                value={profile.hospitalName}
                onChange={(e) => setProfile({ ...profile, hospitalName: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
                placeholder="Medicare Hub Hospital"
              />
            </div>
          </div>

          <div>
            <label htmlFor="languages" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Languages Spoken (comma separated)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Globe className="h-4.5 w-4.5" />
              </div>
              <input
                id="languages"
                type="text"
                value={profile.languages}
                onChange={(e) => setProfile({ ...profile, languages: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
                placeholder="English, Hindi, Hinglish"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="hospitalAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hospital/Clinic Address *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-3 flex items-start pointer-events-none text-gray-400">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              <textarea
                id="hospitalAddress"
                rows={2}
                required
                value={profile.hospitalAddress}
                onChange={(e) => setProfile({ ...profile, hospitalAddress: e.target.value })}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
                placeholder="Building B, MG Road, Sector 4, New Delhi"
              />
            </div>
          </div>
        </div>

        {/* Professional Statement */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-850">
          <label htmlFor="about" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Professional Statement / About
          </label>
          <textarea
            id="about"
            rows={4}
            value={profile.about}
            onChange={(e) => setProfile({ ...profile, about: e.target.value })}
            className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-750 rounded-xl bg-white dark:bg-gray-800 text-sm"
            placeholder="Introduce yourself, describe your expertise, specialties, treatments..."
          />
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
                <Save className="h-4.5 w-4.5" /> Save Professional Profile
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}

export default function DoctorProfilePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>}>
      <DoctorProfileContent />
    </Suspense>
  );
}
