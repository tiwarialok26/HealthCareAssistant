'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Search, UserCheck, Star, Award, Stethoscope, MapPin, DollarSign, Filter, RefreshCw, X } from 'lucide-react';

interface DoctorProfile {
  id: string;
  full_name: string;
  profile_photo: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  hospital_name: string;
  consultation_fee: number;
  languages: string[];
  verification_status: string;
  accepting_appointments?: boolean;
}

export default function FindDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter States
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [minExp, setMinExp] = useState('');
  const [selectedLang, setSelectedLang] = useState('');
  
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [languagesList, setLanguagesList] = useState<string[]>([]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      // Build Supabase Query
      let query = supabase
        .from('doctor_profiles')
        .select('*');

      const { data, error } = await query;

      if (!error && data) {
        setDoctors(data);

        // Extract unique specialties and languages for filters
        const specs = new Set<string>();
        const langs = new Set<string>();
        data.forEach(doc => {
          if (doc.specialization) specs.add(doc.specialization);
          if (doc.languages && Array.isArray(doc.languages)) {
            doc.languages.forEach((l: string) => langs.add(l));
          }
        });
        setSpecialties(Array.from(specs));
        setLanguagesList(Array.from(langs));
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSpecialty('');
    setMaxFee('');
    setMinExp('');
    setSelectedLang('');
  };

  // Client-side filtering for immediate responsive feedback
  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = 
      doc.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.hospital_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSpecialty = !selectedSpecialty || doc.specialization === selectedSpecialty;
    const matchesFee = !maxFee || Number(doc.consultation_fee) <= Number(maxFee);
    const matchesExp = !minExp || doc.experience_years >= Number(minExp);
    const matchesLang = !selectedLang || doc.languages?.includes(selectedLang);

    return matchesSearch && matchesSpecialty && matchesFee && matchesExp && matchesLang;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow flex flex-col">
      
      {/* Title Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Find a Medical Specialist</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Search real hospital doctors, check real-time slot availability, and book instantly.
        </p>
      </div>

      {/* Main Search Bar & Top Filters */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-md mb-8 flex flex-col md:flex-row gap-4">
        
        {/* Search Input */}
        <div className="flex-grow relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search doctors by name, specialization, or clinic..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {(selectedSpecialty || maxFee || minExp || selectedLang || searchTerm) && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 text-sm font-medium transition"
            >
              <X className="h-4 w-4" /> Reset
            </button>
          )}
          
          <button
            onClick={fetchDoctors}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium transition"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-grow">
        
        {/* Sidebar Filters */}
        <div className="space-y-6 lg:col-span-1 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-md h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="font-semibold text-gray-800 dark:text-gray-250 flex items-center gap-1.5">
              <Filter className="h-4 w-4" /> Filters
            </span>
          </div>

          {/* Specialty Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Specialization
            </label>
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">All Specializations</option>
              {specialties.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>

          {/* Max Fee Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Max Consultation Fee
            </label>
            <input
              type="number"
              value={maxFee}
              onChange={(e) => setMaxFee(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm"
              placeholder="E.g. 500"
            />
          </div>

          {/* Experience Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Min Experience (Years)
            </label>
            <select
              value={minExp}
              onChange={(e) => setMinExp(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">Any Experience</option>
              <option value="1">1+ Years</option>
              <option value="3">3+ Years</option>
              <option value="5">5+ Years</option>
              <option value="10">10+ Years</option>
            </select>
          </div>

          {/* Language Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Language Spoken
            </label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">Any Language</option>
              {languagesList.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results List */}
        <div className="lg:col-span-3 flex flex-col justify-start">
          {loading ? (
            <div className="flex items-center justify-center p-20 flex-grow">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center flex-grow">
              <Stethoscope className="h-14 w-14 text-gray-300 dark:text-gray-650 mb-3" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {doctors.length === 0 ? 'No doctors are currently registered.' : 'No matching doctors found.'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                {doctors.length === 0 
                  ? 'Please register a doctor account in the Doctor Portal to populate this list.'
                  : 'Try modifying your search criteria or resetting the filters.'}
              </p>
              {doctors.length > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDoctors.map(doc => (
                <div
                  key={doc.id}
                  className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="p-5 flex gap-4">
                    {/* Photo */}
                    <div className="shrink-0">
                      {doc.profile_photo ? (
                        <img
                          src={doc.profile_photo}
                          alt={doc.full_name}
                          className="h-16 w-16 rounded-2xl object-cover border border-blue-100 shadow-sm"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/35 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-100">
                          {doc.full_name?.replace('Dr. ', '').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-white text-base truncate block max-w-[150px]">
                          {doc.full_name}
                        </span>
                        {doc.verification_status === 'VERIFIED' && (
                          <span className="bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 p-0.5 rounded-full" title="Verified Professional">
                            <UserCheck className="h-4 w-4" />
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          doc.accepting_appointments !== false 
                            ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-450' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {doc.accepting_appointments !== false ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block mt-0.5">
                        {doc.specialization}
                      </span>
                      
                      <p className="text-xs text-gray-550 dark:text-gray-400 truncate mt-1 flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" /> {doc.qualification || 'MBBS'}
                      </p>

                      <p className="text-xs text-gray-500 dark:text-gray-405 mt-0.5 flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" /> {doc.experience_years} Years Experience
                      </p>
                    </div>
                  </div>

                  {/* Clinic and Consultation Detail */}
                  <div className="px-5 py-3.5 bg-gray-50/50 dark:bg-gray-800/10 border-t border-gray-100 dark:border-gray-850 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-gray-650 dark:text-gray-350">
                      <span className="flex items-center gap-1 text-gray-500">
                        <MapPin className="h-3.5 w-3.5 text-blue-500" /> {doc.hospital_name || 'Medicare Clinic'}
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-250 flex items-center">
                        <DollarSign className="h-3.5 w-3.5 text-green-500" />{doc.consultation_fee || '0'}
                      </span>
                    </div>
                    {doc.languages && doc.languages.length > 0 && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                        Languages: {doc.languages.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Booking Link */}
                  <div className="p-4 border-t border-gray-100 dark:border-gray-850 bg-gray-50/30 dark:bg-gray-800/20 text-center">
                    {doc.accepting_appointments !== false ? (
                      <Link
                        href={`/doctors/${doc.id}`}
                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2 rounded-xl transition shadow-sm hover:shadow-md"
                      >
                        Book Appointment
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="block w-full bg-gray-150 dark:bg-gray-800 text-gray-400 dark:text-gray-650 font-semibold text-sm py-2 rounded-xl cursor-not-allowed border border-gray-200/40 dark:border-gray-800/30"
                      >
                        Offline (Not Accepting Bookings)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
