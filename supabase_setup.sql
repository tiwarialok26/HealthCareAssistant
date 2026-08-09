-- HOSPITAL APPOINTMENT & AI HEALTHCARE ASSISTANT PLATFORM
-- DATABASE SETUP SCRIPT FOR SUPABASE SQL EDITOR

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing triggers and functions if they exist (for clean runs)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Create PROFILES Table (role mapping)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create PATIENT PROFILES Table
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  phone TEXT,
  address TEXT,
  emergency_contact TEXT,
  profile_photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create DOCTOR PROFILES Table
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  profile_photo TEXT,
  specialization TEXT NOT NULL,
  qualification TEXT,
  medical_registration_number TEXT,
  experience_years INTEGER CHECK (experience_years >= 0),
  hospital_name TEXT,
  hospital_address TEXT,
  consultation_fee NUMERIC(10, 2) CHECK (consultation_fee >= 0),
  languages TEXT[] DEFAULT '{}'::TEXT[],
  about TEXT,
  verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  accepting_appointments BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create DOCTOR AVAILABILITY Table
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES public.doctor_profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  appointment_duration INTEGER DEFAULT 30 NOT NULL,
  break_start TIME WITHOUT TIME ZONE,
  break_end TIME WITHOUT TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT valid_times CHECK (start_time < end_time),
  CONSTRAINT valid_break CHECK (break_start IS NULL OR (break_start > start_time AND break_end < end_time AND break_start < break_end))
);

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

-- 7. Create DOCTOR BLOCKED DATES Table
CREATE TABLE IF NOT EXISTS public.doctor_blocked_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES public.doctor_profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (doctor_id, date)
);

ALTER TABLE public.doctor_blocked_dates ENABLE ROW LEVEL SECURITY;

-- 8. Create APPOINTMENTS Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patient_profiles(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctor_profiles(id) ON DELETE CASCADE NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  appointment_status TEXT DEFAULT 'BOOKED' CHECK (appointment_status IN ('BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
  reason_for_visit TEXT,
  patient_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT valid_appointment_times CHECK (start_time < end_time)
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create unique index to prevent double bookings on non-cancelled slots
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_doctor_appointment 
ON public.appointments (doctor_id, appointment_date, start_time) 
WHERE (appointment_status != 'CANCELLED');

-- 9. Create NOTIFICATIONS Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 10. Create CHAT SESSIONS Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patient_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- 11. Create CHAT MESSAGES Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('PATIENT', 'AI')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;


-- 12. Create Auth Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'PATIENT')
  );
  
  -- Create empty profiles depending on the role
  IF COALESCE(new.raw_user_meta_data->>'role', 'PATIENT') = 'PATIENT' THEN
    INSERT INTO public.patient_profiles (id, full_name)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'New Patient'));
  ELSIF COALESCE(new.raw_user_meta_data->>'role', 'PATIENT') = 'DOCTOR' THEN
    INSERT INTO public.doctor_profiles (id, full_name, specialization)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Dr. New Doctor'), 'General Medicine');
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to Auth.Users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Profiles Policies
CREATE POLICY "Users can view their own profile info" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Anyone can view doctor profile roles" ON public.profiles
  FOR SELECT USING (role = 'DOCTOR');

-- Patient Profiles Policies
CREATE POLICY "Patients can view/edit their own details" ON public.patient_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Doctors can view profile of patients booked with them" ON public.patient_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE appointments.patient_id = patient_profiles.id
        AND appointments.doctor_id = auth.uid()
    )
  );

-- Doctor Profiles Policies
CREATE POLICY "Anyone can view doctor profiles" ON public.doctor_profiles
  FOR SELECT USING (true); -- Set to true so patients can search and view all doctors

CREATE POLICY "Doctors can manage their own professional details" ON public.doctor_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Availability & Blocked Dates
CREATE POLICY "Anyone can view availability details" ON public.doctor_availability
  FOR SELECT USING (true);

CREATE POLICY "Doctors can manage their availability" ON public.doctor_availability
  FOR ALL USING (auth.uid() = doctor_id) WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Anyone can view blocked dates" ON public.doctor_blocked_dates
  FOR SELECT USING (true);

CREATE POLICY "Doctors can manage their blocked dates" ON public.doctor_blocked_dates
  FOR ALL USING (auth.uid() = doctor_id) WITH CHECK (auth.uid() = doctor_id);

-- Appointments Policies
CREATE POLICY "Patients can view/manage their appointments" ON public.appointments
  FOR ALL USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view/manage their appointments" ON public.appointments
  FOR ALL USING (auth.uid() = doctor_id) WITH CHECK (auth.uid() = doctor_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = recipient_user_id);

-- Chat Sessions & Messages Policies
CREATE POLICY "Patients can manage their own chat sessions" ON public.chat_sessions
  FOR ALL USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can view/add messages to their sessions" ON public.chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
        AND chat_sessions.patient_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
        AND chat_sessions.patient_id = auth.uid()
    )
  );
