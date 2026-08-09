import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

function timeToMinutes(timeStr: string): number {
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins + minutes, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// PATCH /api/appointments/[id] - Reschedule or update status of an appointment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const resolvedParams = await params;
    const appointmentId = resolvedParams.id;

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 2. Fetch existing appointment and profiles to determine role
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*, doctor_profiles(full_name, hospital_name, specialization)')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 403 });
    }

    const body = await req.json();
    const { date, startTime, status, reason } = body;

    // A. Handle Status Updates (Cancel/Complete)
    if (status) {
      // Validate permissions
      const isPatient = profile.role === 'PATIENT' && appointment.patient_id === user.id;
      const isDoctor = profile.role === 'DOCTOR' && appointment.doctor_id === user.id;

      if (!isPatient && !isDoctor) {
        return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      }

      // Check transition rules
      if (status === 'CANCELLED' && appointment.appointment_status === 'COMPLETED') {
        return NextResponse.json({ error: 'Cannot cancel a completed appointment.' }, { status: 400 });
      }

      const { data: updatedAppt, error: updateError } = await supabase
        .from('appointments')
        .update({
          appointment_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update status.' }, { status: 500 });
      }

      // Write notification for the counterpart
      const recipientId = isPatient ? appointment.doctor_id : appointment.patient_id;
      const title = status === 'CANCELLED' ? 'Appointment Cancelled' : 'Appointment Update';
      const actorName = isPatient ? 'Patient' : 'Doctor';
      const cancelReasonText = reason ? ` Reason: ${reason}` : '';
      const message = status === 'CANCELLED'
        ? `Your appointment on ${appointment.appointment_date} has been cancelled by the ${actorName}.${cancelReasonText}`
        : `Appointment on ${appointment.appointment_date} has been marked as ${status} by the ${actorName}.`;

      await supabase.from('notifications').insert({
        recipient_user_id: recipientId,
        appointment_id: appointmentId,
        notification_type: 'APPOINTMENT_CANCELLED',
        title,
        message
      });

      return NextResponse.json({ message: 'Appointment status updated.', appointment: updatedAppt });
    }

    // B. Handle Rescheduling
    if (date && startTime) {
      // Only patient can reschedule their own appointment
      if (profile.role !== 'PATIENT' || appointment.patient_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
      }

      const doctorId = appointment.doctor_id;

      // 1. Verify doctor's blocked dates
      const { data: blockedDate } = await supabase
        .from('doctor_blocked_dates')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('date', date)
        .maybeSingle();

      if (blockedDate) {
        return NextResponse.json({ error: 'The doctor is unavailable on this date.' }, { status: 400 });
      }

      // 2. Enforce 10:00 AM to 10:00 PM booking window with 15-minute slots
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

      // 3. Verify slot is not already booked (exclude current appointment being rescheduled)
      const { data: existingAppt } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', date)
        .eq('start_time', startTime)
        .neq('id', appointmentId) // Exclude self
        .neq('appointment_status', 'CANCELLED')
        .maybeSingle();

      if (existingAppt) {
        return NextResponse.json({ error: 'This time slot is already booked.' }, { status: 409 });
      }

      // 4. Update the appointment row
      const { data: updatedAppt, error: updateError } = await supabase
        .from('appointments')
        .update({
          appointment_date: date,
          start_time: startTime,
          end_time: endTime,
          appointment_status: 'BOOKED', // reset status to booked upon reschedule
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: 'Failed to reschedule appointment.' }, { status: 550 });
      }

      // 5. Notify doctor and patient
      await supabase.from('notifications').insert({
        recipient_user_id: doctorId,
        appointment_id: appointmentId,
        notification_type: 'APPOINTMENT_RESCHEDULED',
        title: 'Appointment Rescheduled',
        message: `Appointment was rescheduled to ${date} at ${startTime}.`
      });

      await supabase.from('notifications').insert({
        recipient_user_id: user.id,
        appointment_id: appointmentId,
        notification_type: 'APPOINTMENT_RESCHEDULED',
        title: 'Appointment Rescheduled',
        message: `Your appointment with Dr. ${appointment.doctor_profiles.full_name} has been rescheduled to ${date} at ${startTime}.`
      });

      return NextResponse.json({
        message: 'Rescheduled successfully.',
        appointment: {
          id: updatedAppt.id,
          doctorName: appointment.doctor_profiles.full_name,
          specialization: appointment.doctor_profiles.specialization,
          date: date,
          time: startTime,
          hospital: appointment.doctor_profiles.hospital_name,
          status: updatedAppt.appointment_status
        }
      });
    }

    return NextResponse.json({ error: 'Invalid update parameters.' }, { status: 400 });

  } catch (error) {
    console.error('Error in appointment detail route:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] - Cancel an appointment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const resolvedParams = await params;
    const appointmentId = resolvedParams.id;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appt) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    // Check ownership
    if (appt.patient_id !== user.id && appt.doctor_id !== user.id) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Cancel appointment by setting status to CANCELLED
    const { data: cancelledAppt, error: cancelError } = await supabase
      .from('appointments')
      .update({
        appointment_status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (cancelError) {
      return NextResponse.json({ error: 'Failed to cancel appointment.' }, { status: 500 });
    }

    // Send notification to the other party
    const isPatient = appt.patient_id === user.id;
    const recipientId = isPatient ? appt.doctor_id : appt.patient_id;

    await supabase.from('notifications').insert({
      recipient_user_id: recipientId,
      appointment_id: appointmentId,
      notification_type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      message: `The appointment scheduled for ${appt.appointment_date} at ${appt.start_time} has been cancelled.`
    });

    return NextResponse.json({ message: 'Appointment cancelled successfully.', appointment: cancelledAppt });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
