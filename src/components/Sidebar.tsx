'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Calendar, 
  Clock, 
  UserSquare, 
  LogOut, 
  Menu, 
  X, 
  Heart,
  ChevronRight
} from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Sidebar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchDoctorProfile(session.user.id);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user);
          fetchDoctorProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDoctorProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('doctor_profiles')
      .select('full_name, specialization, profile_photo, verification_status')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/doctor/login');
    router.refresh();
  };

  // Only show this sidebar inside Doctor Portal routes (/doctor/...)
  // BUT do not show it on login or registration pages
  const isAuthPage = pathname === '/doctor/login' || pathname === '/doctor/register';
  if (!pathname.startsWith('/doctor') || isAuthPage) {
    return null;
  }

  const menuItems = [
    { name: 'Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard },
    { name: 'Appointments', href: '/doctor/appointments', icon: Calendar },
    { name: 'Schedule & Availability', href: '/doctor/availability', icon: Clock },
    { name: 'Professional Profile', href: '/doctor/profile', icon: UserSquare },
  ];

  return (
    <>
      {/* Mobile top bar header */}
      <div className="flex md:hidden items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-250 dark:border-gray-800 px-4 py-3 sticky top-0 z-30">
        <Link href="/doctor/dashboard" className="flex items-center gap-2 font-bold text-lg text-blue-600 dark:text-blue-400">
          <Heart className="h-5 w-5 text-red-500 fill-current" />
          <span>Medicare <span className="font-light text-gray-500 text-sm">Doctor</span></span>
        </Link>
        
        <div className="flex items-center space-x-3">
          {user && <NotificationBell userId={user.id} role="DOCTOR" />}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-150 dark:border-gray-800 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          // Push down on mobile below top bar
          'pt-16 md:pt-0'
        }`}
      >
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Logo Section - Desktop Only */}
          <div className="hidden md:flex items-center gap-2 px-6 py-6 border-b border-gray-150 dark:border-gray-800">
            <Heart className="h-6 w-6 text-red-500 fill-current animate-pulse" />
            <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
              Medicare <span className="font-light text-gray-500 dark:text-gray-400 text-sm">Doctor</span>
            </span>
          </div>

          {/* Doctor Profile Banner */}
          {user && (
            <div className="px-6 py-5 bg-gray-50/50 dark:bg-gray-800/20 border-b border-gray-150 dark:border-gray-850 flex flex-col items-center text-center">
              <div className="relative mb-3">
                {profile?.profile_photo ? (
                  <img
                    src={profile.profile_photo}
                    alt={profile.full_name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-blue-500 shadow-md"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shadow-inner border border-blue-200">
                    {profile?.full_name?.replace('Dr. ', '').charAt(0).toUpperCase() || 'D'}
                  </div>
                )}
                
                {/* Verification Badge */}
                <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900 ${
                  profile?.verification_status === 'VERIFIED'
                    ? 'bg-green-500'
                    : profile?.verification_status === 'REJECTED'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`} title={`Verification Status: ${profile?.verification_status || 'PENDING'}`} />
              </div>

              <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate max-w-[200px]">
                {profile?.full_name || 'Dr. New Doctor'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                {profile?.specialization || 'General Medicine'}
              </p>
              
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 border ${
                profile?.verification_status === 'VERIFIED'
                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400'
                  : profile?.verification_status === 'REJECTED'
                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400'
              }`}>
                {profile?.verification_status || 'PENDING'}
              </span>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-4 space-y-1.5">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10 dark:shadow-none'
                      : 'text-gray-650 dark:text-gray-350 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 transition-colors ${
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'
                    }`} />
                    <span>{item.name}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 opacity-0 transition-all ${
                    isActive ? 'opacity-100 translate-x-0' : 'group-hover:opacity-60 group-hover:translate-x-0.5'
                  }`} />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions (Notifications + Logout) - Desktop Only */}
        <div className="p-4 border-t border-gray-150 dark:border-gray-800">
          <div className="hidden md:flex items-center justify-between mb-4">
            <span className="text-xs text-gray-400 font-medium">Notifications</span>
            {user && <NotificationBell userId={user.id} role="DOCTOR" />}
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-650 dark:border-red-900/30 dark:hover:bg-red-950/20 dark:text-red-400 text-sm font-medium rounded-xl transition duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Dim backdrop when mobile drawer is open */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-30 md:hidden"
        />
      )}
    </>
  );
}
