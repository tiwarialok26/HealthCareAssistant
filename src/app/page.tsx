import Link from 'next/link';
import { 
  Heart, 
  Stethoscope, 
  BrainCircuit, 
  CalendarDays, 
  UserCheck, 
  PhoneCall, 
  ShieldCheck, 
  CheckCircle,
  Activity,
  ChevronRight
} from 'lucide-react';

export default function Home() {
  const specialties = [
    { name: 'General Medicine', description: 'Primary healthcare checkups, coughs, colds, and chronic management.', icon: Stethoscope, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/10' },
    { name: 'Cardiology', description: 'Heart disease diagnosis, hypertension, ECG evaluations, and heart care.', icon: Activity, color: 'text-red-500 bg-red-50 dark:bg-red-900/10' },
    { name: 'Dermatology', description: 'Skin rashes, acne, psoriasis, hair loss treatments, and mole assessments.', icon: Heart, color: 'text-pink-500 bg-pink-50 dark:bg-pink-900/10' },
    { name: 'Pediatrics', description: 'Child growth monitoring, vaccinations, pediatric illnesses, and infant care.', icon: UserCheck, color: 'text-green-500 bg-green-50 dark:bg-green-900/10' },
  ];

  return (
    <div className="flex-grow flex flex-col bg-white dark:bg-gray-950">
      
      {/* 1. Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50/20 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900/40 py-20 lg:py-28 overflow-hidden border-b border-gray-100 dark:border-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Hero Left Content */}
          <div className="space-y-6 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider rounded-full">
              <span className="h-2 w-2 bg-blue-500 rounded-full animate-ping" />
              Real-time Hospital Portal
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight">
              Your Health, <br />
              <span className="text-blue-600 dark:text-blue-400">Connected.</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-655 dark:text-gray-400 leading-relaxed">
              Book real consultations with certified hospital specialists, view actual slot calendars, and get instant medical guidance using our multilingual voice AI healthcare assistant.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/doctors"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl text-center shadow-lg shadow-blue-500/15 hover:shadow-xl transition-all"
              >
                Book an Appointment
              </Link>
              <Link
                href="/assistant"
                className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 font-semibold text-sm rounded-xl transition"
              >
                <BrainCircuit className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" /> Talk to AI Health Assistant
              </Link>
            </div>

            {/* Quick trust items */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-150 dark:border-gray-850 text-xs text-gray-500 dark:text-gray-405">
              <div className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> 100% Real Doctors</div>
              <div className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Live Availability</div>
              <div className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Secure Encryption</div>
            </div>
          </div>

          {/* Hero Right Card/Visualizer */}
          <div className="relative justify-center hidden lg:flex">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transition duration-300">
              
              {/* Abstract decorative graphic */}
              <div className="absolute top-0 right-0 h-28 w-28 bg-blue-500/5 rounded-full -mr-10 -mt-10" />
              
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Instant Health Assistance</h3>
              <div className="space-y-4">
                
                {/* Simulated message block 1 */}
                <div className="flex gap-2.5 items-start">
                  <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">P</div>
                  <div className="bg-blue-600 text-white rounded-2xl rounded-tl-none p-3 text-xs leading-relaxed max-w-[80%] shadow-sm">
                    Mujhe 2 din se fever hai aur throat me pain ho raha hai.
                  </div>
                </div>

                {/* Simulated message block 2 */}
                <div className="flex gap-2.5 items-start">
                  <div className="h-7 w-7 rounded-full bg-gray-150 dark:bg-gray-800 text-blue-500 flex items-center justify-center shrink-0"><BrainCircuit className="h-4 w-4" /></div>
                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl rounded-tl-none p-3 text-xs leading-relaxed max-w-[80%] shadow-sm">
                    Aapko seasonal flu ya throat infection ho sakta hai. Kripya rest karein, gargles karein aur is specialized doctor se consultation book karein:
                    
                    <div className="mt-2.5 p-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-850 rounded-xl flex items-center justify-between text-[10px]">
                      <span className="font-bold text-gray-800 dark:text-gray-200">Dr. Rajesh Kumar (ENT)</span>
                      <span className="text-blue-500 font-semibold flex items-center">Book &rarr;</span>
                    </div>
                  </div>
                </div>

              </div>
              <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-850 text-center">
                <Link
                  href="/assistant"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition"
                >
                  Experience Voice Consultation Now <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. Specialties Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-gray-100 dark:border-gray-900">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Hospital Specializations</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Select a specialty to browse available medical professionals and book appointment calendars.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {specialties.map(spec => {
            const Icon = spec.icon;
            return (
              <div
                key={spec.name}
                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 ${spec.color}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2">{spec.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6">{spec.description}</p>
                </div>
                
                <Link
                  href={`/doctors?specialty=${spec.name}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition group"
                >
                  Browse Doctors <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Steps/Features Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">How Medicare Hub Works</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Our platform guarantees a real connection between patients and hospital systems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Step 1 */}
          <div className="text-center space-y-3 p-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-lg font-bold">1</div>
            <h3 className="font-bold text-gray-800 dark:text-gray-250">Search Verified Doctors</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Find qualified specialists based on specialty, experience, fees, clinic locations, and spoken languages.
            </p>
          </div>

          {/* Step 2 */}
          <div className="text-center space-y-3 p-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-lg font-bold">2</div>
            <h3 className="font-bold text-gray-800 dark:text-gray-250">Select Available Slot</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Inspect active schedule calendars. Our double-booking protection locks your selection instantly.
            </p>
          </div>

          {/* Step 3 */}
          <div className="text-center space-y-3 p-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-lg font-bold">3</div>
            <h3 className="font-bold text-gray-800 dark:text-gray-250">Real-time Notifications</h3>
            <p className="text-xs text-gray-550 leading-relaxed max-w-xs mx-auto">
              Upon booking, doctors receive real-time alerts. Manage, reschedule, or cancel bookings in your dashboard.
            </p>
          </div>

        </div>
      </section>

      {/* 4. Help CTA Banner */}
      <section className="bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-150 dark:border-gray-850">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Emergency Support Services</h3>
              <p className="text-xs text-gray-500 mt-0.5">Need immediate life-saving care? Please dial emergency response directly.</p>
            </div>
          </div>
          <a
            href="tel:108"
            className="w-full md:w-auto px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-center font-bold text-sm shadow-md transition shrink-0 animate-pulse"
          >
            Call Emergency (108 / 911)
          </a>
        </div>
      </section>

    </div>
  );
}
