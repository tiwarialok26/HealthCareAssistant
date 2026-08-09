'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, Check, Trash2, MailOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  recipient_user_id: string;
  appointment_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell({ userId, role }: { userId: string; role: 'PATIENT' | 'DOCTOR' }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    // Fetch existing unread notifications
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Subscribe to real-time notification inserts/updates for this specific user
    const channel = supabase
      .channel(`user-notifications-${userId}-${Math.random().toString(36).substring(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
            setUnreadCount(c => c + 1);
            
            // Optional: Simple browser voice/beep or Toast notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new window.Notification(newNotif.title, { body: newNotif.message });
            }
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            // Re-fetch to keep simple and consistent
            fetchNotifications();
          }
        }
      )
      .subscribe();

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, appointmentId: string | null) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(c => Math.max(0, c - 1));
      
      // If appointment_id is present, redirect to details page
      if (appointmentId) {
        setIsOpen(false);
        if (role === 'DOCTOR') {
          router.push(`/doctor/appointments?id=${appointmentId}`);
        } else {
          router.push(`/dashboard?id=${appointmentId}`);
        }
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_user_id', userId)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleClearAll = async () => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_user_id', userId);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 focus:outline-none transition"
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden transform origin-top-right transition-all">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-750">
            <h3 className="font-semibold text-gray-700 dark:text-gray-250">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <MailOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">You're all caught up.</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.appointment_id)}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition flex flex-col gap-1 ${
                    !notif.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-semibold ${!notif.is_read ? 'text-blue-900 dark:text-blue-200' : 'text-gray-700 dark:text-gray-350'}`}>
                      {notif.title}
                    </span>
                    {!notif.is_read && (
                      <span className="h-2 w-2 bg-blue-600 rounded-full mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 text-center">
              <button
                onClick={handleClearAll}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
