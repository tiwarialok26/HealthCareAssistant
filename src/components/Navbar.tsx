'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Menu, X, Heart, User, LogOut, LayoutDashboard, BrainCircuit, Search } from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check current session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user);
          fetchProfile(session.user.id);
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

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('full_name, profile_photo')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Find Doctors', href: '/doctors', icon: Search },
    { name: 'AI Health Assistant', href: '/assistant', icon: BrainCircuit },
    ...(user ? [{ name: 'My Dashboard', href: '/dashboard', icon: LayoutDashboard }] : []),
  ];

  // Avoid showing patient navbar on doctor portal paths
  if (pathname.startsWith('/doctor')) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-150 dark:border-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400">
              <Heart className="h-6 w-6 fill-current animate-pulse text-red-500" />
              <span>Medicare <span className="font-light text-gray-500 dark:text-gray-400">Hub</span></span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Desktop Right Side Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <NotificationBell userId={user.id} role="PATIENT" />
                
                <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-700" />
                
                <Link
                  href="/profile"
                  className="flex items-center gap-2 hover:opacity-80 transition"
                  title="My Profile"
                >
                  {profile?.profile_photo ? (
                    <img
                      src={profile.profile_photo}
                      alt={profile.full_name || 'Patient'}
                      className="h-8 w-8 rounded-full object-cover border border-blue-100"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      {profile?.full_name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                    {profile?.full_name?.split(' ')[0] || 'Patient'}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 transition focus:outline-none"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-blue-600 dark:text-gray-350 dark:hover:text-blue-400 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition duration-200"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden space-x-3">
            {user && <NotificationBell userId={user.id} role="PATIENT" />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-blue-600 dark:text-gray-350 dark:hover:text-blue-400 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-150 dark:border-gray-700 animate-in slide-in-from-top-4 duration-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-base font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  {link.name}
                </Link>
              );
            })}
          </div>

          <div className="pt-4 pb-4 border-t border-gray-150 dark:border-gray-700 px-4">
            {user ? (
              <div className="flex flex-col gap-3">
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium"
                >
                  <User className="h-5 w-5" />
                  <span>My Profile ({profile?.full_name || 'Patient'})</span>
                </Link>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 text-base font-medium transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base font-medium shadow-md transition"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
