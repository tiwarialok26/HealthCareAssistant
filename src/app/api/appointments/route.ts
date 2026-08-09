import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

// Helper to convert HH:MM or HH:MM:SS to minutes since midnight
function timeToMinutes(timeStr: string): number {
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
}

// Helper to add minutes to HH:MM time string and return HH:MM
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins + minutes, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please login.' }, { status: 401 });
    }

    // Verify user is a patient and has completed profile
    const { data: patientProfile, error: profileError } = await supabase
      .from('patient_profiles')
      .select('*, profiles(role)')
      .eq('id', user.id)
      .single();

    if (profileError || !patientProfile) {
      return NextResponse.json({ error: 'Patient profile not found.' }, { status: 404 });
    }

    // Check minimum required profile fields
    if (!patientProfile.full_name || !patientProfile.phone || !patientProfile.date_of_birth || !patientProfile.gender) {
      return NextResponse.json({ 
        error: 'Please complete your patient profile details (Full Name, Date of Birth, Gender, Phone) before booking appointments.' 
      }, { status: 400 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { doctorId, date, startTime, reasonForVisit, patientNotes } = body;

    if (!doctorId || !date || !startTime || !reasonForVisit) {
      return NextResponse.json({ error: 'Missing required booking parameters.' }, { status: 400 });
    }

    // 3. Verify Doctor exists and is VERIFIED
    const { data: doctor, error: doctorError } = await supabase
      .from('doctor_profiles')
      .select('*')
      .eq('id', doctorId)
      .single();

    if (doctorError || !doctor) {
      return NextResponse.json({ error: 'Doctor not found.' }, { status: 404 });
    }

    if (doctor.verification_status !== 'VERIFIED') {
      return NextResponse.json({ error: 'This doctor is not currently verified to accept bookings.' }, { status: 400 });
    }

    if (doctor.accepting_appointments === false) {
      return NextResponse.json({ error: 'This doctor is currently offline and not accepting new appointments.' }, { status: 400 });
    }

    // 4. Verify date is not blocked by doctor
    const { data: blockedDate } = await supabase
      .from('doctor_blocked_dates')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .maybeSingle();

    if (blockedDate) {
      return NextResponse.json({ error: 'The doctor is unavailable on this date. Reason: ' + (blockedDate.reason || 'Blocked') }, { status: 400 });
    }

    // 5. Enforce 10:00 AM to 10:00 PM booking window with 15-minute slots
    const duration = 15;
    const endTime = addMinutesToTime(startTime, duration);

    const bookingStartMin = timeToMinutes(startTime);
    const workStartMin = 10 * 60; // 10:00 AM
    const workEndMin = 22 * 60;   // 10:00 PM

    if (bookingStartMin < workStartMin || bookingStartMin + duration > workEndMin) {
      return NextResponse.json({ error: 'Booking time must be within the permitted hours of 10:00 AM to 10:00 PM.' }, { status: 400 });
    }

    if (bookingStartMin % 15 !== 0) {
      return NextResponse.json({ error: 'Booking slot must fall on exactly a 15-minute interval.' }, { status: 400 });
    }

    // 6. Verify slot is not already booked (double-booking check)
    // Check if there is any booked/confirmed appointment at this start time
    const { data: existingAppt } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .eq('start_time', startTime)
      .neq('appointment_status', 'CANCELLED')
      .maybeSingle();

    if (existingAppt) {
      return NextResponse.json({ error: 'This appointment slot has just been booked. Please choose another time.' }, { status: 409 });
    }

    // 7. Insert the appointment in the database
    const { data: newAppt, error: insertError } = await supabase
      .from('appointments')
      .insert({
        patient_id: user.id,
        doctor_id: doctorId,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        appointment_status: 'BOOKED',
        reason_for_visit: reasonForVisit,
        patient_notes: patientNotes || ''
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert appointment database error:', insertError);
      return NextResponse.json({ error: 'Failed to create appointment in database. Please try again.' }, { status: 500 });
    }

    // 8. Create database notifications
    // Notification for Doctor
    await supabase.from('notifications').insert({
      recipient_user_id: doctorId,
      appointment_id: newAppt.id,
      notification_type: 'APPOINTMENT_BOOKED',
      title: 'New Appointment Booked',
      message: `Patient ${patientProfile.full_name} booked an appointment for ${date} at ${startTime}.`
    });

    // Notification for Patient
    await supabase.from('notifications').insert({
      recipient_user_id: user.id,
      appointment_id: newAppt.id,
      notification_type: 'APPOINTMENT_BOOKED',
      title: 'Appointment Confirmed',
      message: `Your appointment with Dr. ${doctor.full_name} for ${date} at ${startTime} has been successfully booked.`
    });

    // 9. Return success
    return NextResponse.json({
      message: 'Appointment booked successfully.',
      appointment: {
        id: newAppt.id,
        doctorName: doctor.full_name,
        specialization: doctor.specialization,
        date: date,
        time: startTime,
        hospital: doctor.hospital_name,
        status: newAppt.appointment_status
      }
    });

  } catch (error) {
    console.error('Route POST error in appointments route:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
