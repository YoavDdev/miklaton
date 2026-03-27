'use client';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { he };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const SHIFT_COLORS = {
  '24h': { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', badge: 'bg-blue-100 text-blue-800' },
  'morning': { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', badge: 'bg-amber-100 text-amber-800' },
  'evening': { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B', badge: 'bg-red-100 text-red-800' },
  'night': { bg: '#EDE9FE', border: '#8B5CF6', text: '#5B21B6', badge: 'bg-purple-100 text-purple-800' },
  'sleep': { bg: '#F3E8FF', border: '#A855F7', text: '#7E22CE', badge: 'bg-violet-100 text-violet-800' },
  'default': { bg: '#F0FDF4', border: '#10B981', text: '#065F46', badge: 'bg-emerald-100 text-emerald-800' },
};

function getShiftType(startHour, endHour, notes) {
  if (notes?.includes('[לן]')) return 'sleep';
  if (startHour === 8 && endHour === 8) return '24h';
  if (startHour === 8 && endHour === 16) return 'morning';
  if (startHour === 16 && endHour === 0) return 'evening';
  if (startHour === 0 && endHour === 8) return 'night';
  if (startHour === 20 && endHour === 8) return 'sleep';
  return 'default';
}

function getShiftLabel(startHour, endHour, notes) {
  const type = getShiftType(startHour, endHour, notes);
  const labels = {
    '24h': '🔄 24h',
    'morning': '🌅 בוקר',
    'evening': '🌆 ערב',
    'night': '🌙 לילה',
    'sleep': '🛏️ לן',
  };
  return labels[type] || '⏰';
}

export default function WeeklyCalendar({ duties, contacts, onSelectSlot, onSelectEvent, onEventDrop }) {
  // Convert duty roster to calendar events
  const events = duties.map(duty => {
    const contact = contacts.find(c => c.id === duty.contact_id);
    const dayOfWeek = duty.day_of_week;
    
    // Get current week's date for that day
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const diff = dayOfWeek - currentDayOfWeek;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    
    // Create start and end times
    const start = new Date(targetDate);
    start.setHours(duty.start_hour, 0, 0, 0);
    
    const end = new Date(targetDate);
    if (duty.end_hour === 0) {
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
    } else if (duty.end_hour < duty.start_hour) {
      end.setDate(end.getDate() + 1);
      end.setHours(duty.end_hour, 0, 0, 0);
    } else {
      end.setHours(duty.end_hour, 0, 0, 0);
    }
    
    const shiftType = getShiftType(duty.start_hour, duty.end_hour, duty.notes);
    const colors = SHIFT_COLORS[shiftType];
    
    return {
      id: duty.id,
      title: contact?.full_name || 'לא ידוע',
      start,
      end,
      resource: {
        dutyId: duty.id,
        contactId: duty.contact_id,
        contactName: contact?.full_name,
        contactPhone: contact?.phone,
        contactRole: contact?.role,
        shiftType,
        colors,
        startHour: duty.start_hour,
        endHour: duty.end_hour,
        notes: duty.notes,
      }
    };
  });

  // Custom event style
  const eventStyleGetter = (event) => {
    const colors = event.resource?.colors || SHIFT_COLORS.default;
    return {
      style: {
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        color: colors.text,
        borderRadius: '6px',
        padding: '8px 10px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        transition: 'all 0.15s',
      }
    };
  };

  // Custom event component
  const EventComponent = ({ event }) => {
    let label = 'כונן';
    let badgeClass = 'bg-gray-100 text-gray-800';
    
    if (event.resource?.shiftType === '24h') { label = '24h'; badgeClass = 'bg-blue-100 text-blue-800'; }
    if (event.resource?.shiftType === 'morning') { label = 'בוקר'; badgeClass = 'bg-amber-100 text-amber-800'; }
    if (event.resource?.shiftType === 'evening') { label = 'ערב'; badgeClass = 'bg-red-100 text-red-800'; }
    if (event.resource?.shiftType === 'night') { label = 'לילה'; badgeClass = 'bg-purple-100 text-purple-800'; }
    if (event.resource?.shiftType === 'sleep') { label = 'לן'; badgeClass = 'bg-violet-100 text-violet-800'; }
    
    const startTime = String(event.resource?.startHour).padStart(2, '0') + ':00';
    const endTime = String(event.resource?.endHour).padStart(2, '0') + ':00';
    
    // Calculate duration in hours
    let duration = event.resource?.endHour - event.resource?.startHour;
    if (duration < 0) duration += 24; // Handle overnight shifts
    
    // Check if this event is happening NOW
    const now = new Date();
    const isHappeningNow = now >= event.start && now <= event.end;
    
    // Tooltip text for hover
    const tooltipText = `${event.resource?.contactName} | ${label} | ${startTime}-${endTime}${event.resource?.contactRole ? ' | ' + event.resource?.contactRole : ''}${isHappeningNow ? ' | 🟢 פעיל עכשיו' : ''}`;
    
    // Short event (< 2 hours) - minimal display
    if (duration < 2) {
      return (
        <div className="flex items-center gap-1 h-full px-2" title={tooltipText}>
          {isHappeningNow && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          <div className="font-bold text-xs truncate flex-1">{event.resource?.contactName}</div>
          <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${badgeClass}`}>
            {label}
          </div>
          {isHappeningNow && <div className="text-[9px] font-bold text-green-600 whitespace-nowrap">עכשיו</div>}
        </div>
      );
    }
    
    // Medium event (2-4 hours) - compact display
    if (duration < 4) {
      return (
        <div className="flex flex-col h-full p-1.5" title={tooltipText}>
          <div className="flex items-center gap-1">
            {isHappeningNow && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            <div className="font-bold text-sm leading-tight truncate flex-1">{event.resource?.contactName}</div>
            {isHappeningNow && <span className="text-[10px] font-bold text-green-600 px-1.5 py-0.5 bg-green-50 rounded">עכשיו</span>}
          </div>
          <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
            {label} • {startTime}-{endTime}
          </div>
        </div>
      );
    }
    
    // Long event (4+ hours) - full display
    return (
      <div className="flex flex-col h-full p-2" title={tooltipText}>
        <div className="flex items-center gap-1.5 mb-1">
          {isHappeningNow && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          <div className="font-bold text-base leading-tight flex-1">{event.resource?.contactName}</div>
          {isHappeningNow && <span className="text-xs font-bold text-green-600 px-2 py-0.5 bg-green-50 rounded border border-green-300">🟢 עכשיו</span>}
        </div>
        <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mb-1 ${badgeClass}`}>
          {label}
        </div>
        <div className="text-xs font-medium text-gray-600">{startTime} - {endTime}</div>
        {event.resource?.contactRole && (
          <div className="text-xs text-gray-500 mt-1 truncate">{event.resource?.contactRole}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[900px] bg-white rounded-lg shadow-lg p-4" dir="ltr">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView="week"
        views={['week']}
        step={60}
        timeslots={2}
        showMultiDayTimes
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        eventPropGetter={eventStyleGetter}
        components={{
          event: EventComponent,
        }}
        messages={{
          week: 'שבוע',
          day: 'יום',
          today: 'היום',
          previous: 'קודם',
          next: 'הבא',
          showMore: (total) => `+${total} נוספים`,
        }}
        culture="he"
        rtl={false}
        min={new Date(0, 0, 0, 0, 0, 0)}
        max={new Date(0, 0, 0, 23, 59, 59)}
      />
    </div>
  );
}
