import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  setHours,
  setMinutes
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import '../CSS/BeautifulDateTimePicker.css';

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
);
const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

const toISOLocal = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const BeautifulDateTimePicker = ({ value, onChange, placeholder = "เลือกวันและเวลาส่งงาน" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [popoverCoords, setPopoverCoords] = useState({ isMobile: false, top: 0, left: 0, placement: 'bottom' });
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  // Parse current value or use safe default
  const selectedDate = useMemo(() => {
    if (!value) return null;
    try {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }, [value]);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
      setPopoverCoords({ isMobile: true, top: 0, left: 0, placement: 'center' });
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const popoverHeight = 400;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6;
    let placement = 'bottom';

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      top = Math.max(10, rect.top - popoverHeight - 6);
      placement = 'top';
    }

    let left = rect.left;
    const popoverWidth = 430;
    if (left + popoverWidth > window.innerWidth) {
      left = Math.max(10, window.innerWidth - popoverWidth - 16);
    }

    setPopoverCoords({ isMobile: false, top, left, placement });
  };

  const toggleOpen = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        popoverRef.current && !popoverRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar logic
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45, 59];

  const handleDateClick = (day) => {
    let newDate = selectedDate ? new Date(selectedDate) : new Date();
    newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    if (!selectedDate) {
      newDate.setHours(23, 59, 0, 0);
    }
    onChange(toISOLocal(newDate));
  };

  const handleTimeClick = (type, val) => {
    let newDate = selectedDate ? new Date(selectedDate) : new Date();
    if (type === 'hour') {
      newDate = setHours(newDate, val);
    } else {
      newDate = setMinutes(newDate, val);
    }
    onChange(toISOLocal(newDate));
  };

  const setPreset = (type) => {
    const now = new Date();
    let target = new Date();
    if (type === 'none') {
      onChange('');
      setIsOpen(false);
      return;
    }
    if (type === 'tomorrow') {
      target = addDays(now, 1);
    } else if (type === '3days') {
      target = addDays(now, 3);
    } else if (type === 'nextweek') {
      target = addDays(now, 7);
    }
    target.setHours(23, 59, 0, 0);
    onChange(toISOLocal(target));
    setIsOpen(false);
  };

  return (
    <div className="bdp-container" ref={containerRef}>
      {/* Quick preset chips */}
      <div className="bdp-preset-row">
        <button type="button" className={`bdp-preset-btn ${!value ? 'is-active' : ''}`} onClick={() => setPreset('none')}>
          ไม่มีกำหนด
        </button>
        <button type="button" className="bdp-preset-btn" onClick={() => setPreset('tomorrow')}>
          พรุ่งนี้ 23:59
        </button>
        <button type="button" className="bdp-preset-btn" onClick={() => setPreset('3days')}>
          อีก 3 วัน
        </button>
        <button type="button" className="bdp-preset-btn" onClick={() => setPreset('nextweek')}>
          สัปดาห์หน้า
        </button>
      </div>

      <div className="bdp-input-wrapper" onClick={toggleOpen}>
        <div className="bdp-icon"><CalendarIcon /></div>
        <div className={`bdp-value ${!value ? 'bdp-placeholder' : ''}`}>
          {selectedDate ? format(selectedDate, 'dd/MM/yyyy HH:mm น.') : placeholder}
        </div>
        {value && (
          <button
            type="button"
            className="bdp-clear-icon"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            title="ล้างกำหนดส่ง"
          >
            &times;
          </button>
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {popoverCoords.isMobile && (
                <div className="bdp-mobile-backdrop" onClick={() => setIsOpen(false)} />
              )}
              <motion.div
                ref={popoverRef}
                className={`bdp-popover ${popoverCoords.isMobile ? 'bdp-popover--mobile' : ''}`}
                style={popoverCoords.isMobile ? {} : {
                  top: `${popoverCoords.top}px`,
                  left: `${popoverCoords.left}px`,
                }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                {/* Calendar Part */}
                <div className="bdp-calendar">
                  <div className="bdp-header">
                    <span className="bdp-month-title">{format(viewDate, 'MMMM yyyy')}</span>
                    <div className="bdp-nav">
                      <button type="button" className="bdp-nav-btn" onClick={() => setViewDate(subMonths(viewDate, 1))}><ChevronLeft /></button>
                      <button type="button" className="bdp-nav-btn" onClick={() => setViewDate(addMonths(viewDate, 1))}><ChevronRight /></button>
                    </div>
                  </div>

                  <div className="bdp-weekdays">
                    {weekdays.map((d, idx) => <div key={idx} className="bdp-weekday">{d}</div>)}
                  </div>

                  <div className="bdp-days-grid">
                    {days.map((day, i) => (
                      <div 
                        key={i} 
                        className={`bdp-day ${!isSameMonth(day, monthStart) ? 'bdp-day-other' : ''} ${isSameDay(day, new Date()) ? 'bdp-day-today' : ''} ${selectedDate && isSameDay(day, selectedDate) ? 'bdp-day-selected' : ''}`}
                        onClick={() => handleDateClick(day)}
                      >
                        {format(day, 'd')}
                      </div>
                    ))}
                  </div>

                  <div className="bdp-footer">
                    <button type="button" className="bdp-clear-btn" onClick={() => setPreset('none')}>ไม่มีกำหนด</button>
                    <button type="button" className="bdp-today-btn" onClick={() => setPreset('tomorrow')}>พรุ่งนี้</button>
                    <button type="button" className="bdp-done-btn" onClick={() => setIsOpen(false)}>เสร็จสิ้น</button>
                  </div>
                </div>

                {/* Time Part */}
                <div className="bdp-time">
                  <div className="bdp-time-header">เลือกเวลา</div>
                  <div className="bdp-time-sections">
                    <div className="bdp-time-col">
                      <span className="bdp-col-title">ชั่วโมง</span>
                      {hourOptions.map(h => (
                        <div 
                          key={h} 
                          className={`bdp-time-item ${selectedDate && selectedDate.getHours() === h ? 'bdp-time-item-selected' : ''}`}
                          onClick={() => handleTimeClick('hour', h)}
                        >
                          {h.toString().padStart(2, '0')}
                        </div>
                      ))}
                    </div>
                    <div className="bdp-time-col">
                      <span className="bdp-col-title">นาที</span>
                      {minuteOptions.map(m => (
                        <div 
                          key={m} 
                          className={`bdp-time-item ${selectedDate && selectedDate.getMinutes() === m ? 'bdp-time-item-selected' : ''}`}
                          onClick={() => handleTimeClick('minute', m)}
                        >
                          :{m.toString().padStart(2, '0')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default BeautifulDateTimePicker;
