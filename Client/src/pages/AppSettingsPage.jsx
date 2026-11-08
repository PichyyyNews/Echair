// src/pages/AppSettingsPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../CSS/AppSettings.css';
import '../CSS/Main.css';
import {
    FiSettings,
    FiBell,
    FiGlobe,
    FiVolume2,
    FiMessageSquare,
    FiEye,
    FiLayout,
    FiInfo,
    FiCheck,
    FiRefreshCw,
    FiExternalLink,
    FiHelpCircle,
    FiAlertCircle
} from 'react-icons/fi';

import { useTranslation } from 'react-i18next';
import { buildPublicAssetUrl } from '../config/api';

const AppSettingsPage = ({ user: propUser, onSignOut, isSidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [user, setUser] = useState(propUser);
    const [activeSection, setActiveSection] = useState('general');
    const [toastMessage, setToastMessage] = useState('');

    // Preference states loaded from localStorage
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        return localStorage.getItem('notificationsEnabled') !== 'false';
    });
    const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => {
        return localStorage.getItem('soundEffectsEnabled') !== 'false';
    });
    const [autoScrollChat, setAutoScrollChat] = useState(() => {
        return localStorage.getItem('autoScrollChat') !== 'false';
    });
    const [confirmClassLeave, setConfirmClassLeave] = useState(() => {
        return localStorage.getItem('confirmClassLeave') !== 'false';
    });

    // Notification granular preferences
    const [notifSoundAlerts, setNotifSoundAlerts] = useState(() => {
        return localStorage.getItem('notifSoundAlerts') !== 'false';
    });
    const [notifAssignments, setNotifAssignments] = useState(() => {
        return localStorage.getItem('notifAssignments') !== 'false';
    });
    const [notifLiveEvents, setNotifLiveEvents] = useState(() => {
        return localStorage.getItem('notifLiveEvents') !== 'false';
    });
    const [notifAnnouncements, setNotifAnnouncements] = useState(() => {
        return localStorage.getItem('notifAnnouncements') !== 'false';
    });

    // Appearance preferences
    const [themePreference, setThemePreference] = useState(() => {
        return localStorage.getItem('appTheme') || 'light';
    });
    const [seatingDensity, setSeatingDensity] = useState(() => {
        return localStorage.getItem('seatingDensity') || 'comfortable';
    });
    const [showStudentNames, setShowStudentNames] = useState(() => {
        return localStorage.getItem('showStudentNames') !== 'false';
    });
    const [seatAnimations, setSeatAnimations] = useState(() => {
        return localStorage.getItem('seatAnimations') !== 'false';
    });

    useEffect(() => {
        if (propUser) {
            setUser(propUser);
        } else {
            const token = localStorage.getItem('authToken');
            if (!token) {
                navigate('/login');
                return;
            }

            const userData = localStorage.getItem('userProfile');
            if (userData) {
                const parsedUser = JSON.parse(userData);
                const storedPhotoURL = localStorage.getItem('userPhotoURL');
                if (storedPhotoURL) {
                    parsedUser.photoURL = storedPhotoURL;
                }
                setUser({ ...parsedUser, token });
            }
        }
    }, [navigate, propUser]);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const handleToggle = (key, setter, value) => {
        setter(value);
        localStorage.setItem(key, String(value));
    };

    const handleThemeChange = (theme) => {
        setThemePreference(theme);
        localStorage.setItem('appTheme', theme);
        showToast(theme === 'dark' ? 'Dark mode preview activated' : 'Theme set to ' + theme);
    };

    const handleDensityChange = (density) => {
        setSeatingDensity(density);
        localStorage.setItem('seatingDensity', density);
    };

    const handleClearPreferences = () => {
        if (window.confirm(t('settings.help.clearCacheConfirm') || 'Are you sure you want to reset all local UI preferences?')) {
            const keysToReset = [
                'notificationsEnabled',
                'soundEffectsEnabled',
                'autoScrollChat',
                'confirmClassLeave',
                'notifSoundAlerts',
                'notifAssignments',
                'notifLiveEvents',
                'notifAnnouncements',
                'appTheme',
                'seatingDensity',
                'showStudentNames',
                'seatAnimations'
            ];
            keysToReset.forEach(k => localStorage.removeItem(k));
            setNotificationsEnabled(true);
            setSoundEffectsEnabled(true);
            setAutoScrollChat(true);
            setConfirmClassLeave(true);
            setNotifSoundAlerts(true);
            setNotifAssignments(true);
            setNotifLiveEvents(true);
            setNotifAnnouncements(true);
            setThemePreference('light');
            setSeatingDensity('comfortable');
            setShowStudentNames(true);
            setSeatAnimations(true);
            showToast(t('settings.help.clearCacheSuccess') || 'Local preferences have been reset successfully');
        }
    };

    const handleSignOut = async () => {
        if (onSignOut) {
            onSignOut();
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userPhotoURL');
            navigate('/login');
        }
    };

    const handleBackClick = () => {
        navigate('/');
    };

    const renderGeneral = () => (
        <div className="settings-content-fade">
            <div className="settings-section-header">
                <h2>{t('settings.general.title') || 'การตั้งค่าทั่วไป'}</h2>
                <p className="settings-section-subtitle">{t('settings.general.subtitle') || 'ปรับแต่งการใช้งานพื้นฐานของแอปพลิเคชัน'}</p>
            </div>

            <div className="settings-card-clean">
                {/* Language Setting */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiGlobe size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.general.language') || 'ภาษา (Language)'}</label>
                            <span className="settings-row-desc">เลือกภาษาหลักสำหรับส่วนติดต่อผู้ใช้ของระบบ</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <select
                            className="settings-clean-select"
                            value={i18n.language}
                            onChange={(e) => {
                                const newLang = e.target.value;
                                i18n.changeLanguage(newLang);
                                localStorage.setItem('appLanguage', newLang);
                            }}
                        >
                            <option value="th">🇹🇭 ภาษาไทย (Thai)</option>
                            <option value="en">🇬🇧 English (US)</option>
                        </select>
                    </div>
                </div>

                {/* Sound Effects */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiVolume2 size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.general.soundEffects') || 'เสียงเอฟเฟกต์ในชั้นเรียน'}</label>
                            <span className="settings-row-desc">{t('settings.general.soundEffectsDesc') || 'เล่นเสียงเมื่อกด Buzzer, สุ่มลูกเต๋า, หรือหมดเวลานับถอยหลัง'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                checked={soundEffectsEnabled}
                                onChange={(e) => handleToggle('soundEffectsEnabled', setSoundEffectsEnabled, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Auto Scroll Chat */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiMessageSquare size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.general.chatAutoScroll') || 'เลื่อนแชทอัตโนมัติ'}</label>
                            <span className="settings-row-desc">{t('settings.general.chatAutoScrollDesc') || 'เลื่อนไปยังข้อความล่าสุดโดยอัตโนมัติเมื่อมีข้อความหรือกิจกรรมใหม่'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                checked={autoScrollChat}
                                onChange={(e) => handleToggle('autoScrollChat', setAutoScrollChat, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Confirm Class Leave */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiAlertCircle size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.general.confirmLeave') || 'ยืนยันก่อนออกจากห้องเรียน'}</label>
                            <span className="settings-row-desc">{t('settings.general.confirmLeaveDesc') || 'แสดงกล่องยืนยันเมื่อกดออกจากห้องขณะที่คาบเรียนกำลังดำเนินอยู่'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                checked={confirmClassLeave}
                                onChange={(e) => handleToggle('confirmClassLeave', setConfirmClassLeave, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderNotifications = () => (
        <div className="settings-content-fade">
            <div className="settings-section-header">
                <h2>{t('settings.notifications.title') || 'การตั้งค่าการแจ้งเตือน'}</h2>
                <p className="settings-section-subtitle">{t('settings.notifications.subtitle') || 'กำหนดช่องทางและประเภทข้อความแจ้งเตือนที่คุณต้องการรับ'}</p>
            </div>

            <div className="settings-card-clean">
                {/* Master Switch */}
                <div className="settings-row highlight-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill accent-green">
                            <FiBell size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.notifications.master') || 'การแจ้งเตือนทั้งหมด'}</label>
                            <span className="settings-row-desc">{t('settings.notifications.masterDesc') || 'เปิดหรือปิดการแจ้งเตือนทั้งหมดของระบบในแอปนี้'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                checked={notificationsEnabled}
                                onChange={(e) => handleToggle('notificationsEnabled', setNotificationsEnabled, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Sound Chime */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiVolume2 size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.notifications.sound') || 'เสียงเตือนเมื่อมีการแจ้งเตือน'}</label>
                            <span className="settings-row-desc">{t('settings.notifications.soundDesc') || 'ส่งเสียงเตือนเบาๆ เมื่อได้รับข้อความหรือการแจ้งเตือนใหม่'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                disabled={!notificationsEnabled}
                                checked={notificationsEnabled && notifSoundAlerts}
                                onChange={(e) => handleToggle('notifSoundAlerts', setNotifSoundAlerts, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Assignments */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiCheck size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.notifications.assignments') || 'การบ้านและกำหนดส่ง'}</label>
                            <span className="settings-row-desc">{t('settings.notifications.assignmentsDesc') || 'เตือนเมื่อมีการมอบหมายงานใหม่และใกล้ถึงกำหนดส่ง'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                disabled={!notificationsEnabled}
                                checked={notificationsEnabled && notifAssignments}
                                onChange={(e) => handleToggle('notifAssignments', setNotifAssignments, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Live Events */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiMessageSquare size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.notifications.events') || 'กิจกรรมและคำถามสดในห้อง'}</label>
                            <span className="settings-row-desc">{t('settings.notifications.eventsDesc') || 'เตือนเมื่อเริ่มทำ Poll, Quiz, Buzz หรือเช็คชื่อ'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                disabled={!notificationsEnabled}
                                checked={notificationsEnabled && notifLiveEvents}
                                onChange={(e) => handleToggle('notifLiveEvents', setNotifLiveEvents, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Announcements */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiBell size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.notifications.announcements') || 'ประกาศและการตอบกลับ'}</label>
                            <span className="settings-row-desc">{t('settings.notifications.announcementsDesc') || 'เตือนเมื่ออาจารย์โพสต์ประกาศใหม่หรือตอบข้อความของคุณ'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                disabled={!notificationsEnabled}
                                checked={notificationsEnabled && notifAnnouncements}
                                onChange={(e) => handleToggle('notifAnnouncements', setNotifAnnouncements, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAppearance = () => (
        <div className="settings-content-fade">
            <div className="settings-section-header">
                <h2>{t('settings.appearance.title') || 'การแสดงผลและผังที่นั่ง'}</h2>
                <p className="settings-section-subtitle">{t('settings.appearance.subtitle') || 'ปรับขนาดผังห้องเรียน การแสดงผลชื่อ และชุดสี'}</p>
            </div>

            <div className="settings-card-clean">
                {/* Theme Selector */}
                <div className="settings-row vertical-stack">
                    <div className="settings-row-text">
                        <label className="settings-row-title">{t('settings.appearance.theme') || 'ธีมระบบ (Theme)'}</label>
                        <span className="settings-row-desc">{t('settings.appearance.themeDesc') || 'เลือกชุดสีอินเทอร์เฟซที่สบายตาสำหรับการเรียนรู้'}</span>
                    </div>
                    <div className="theme-options-grid">
                        <button
                            type="button"
                            className={`theme-option-box ${themePreference === 'light' ? 'selected' : ''}`}
                            onClick={() => handleThemeChange('light')}
                        >
                            <div className="theme-preview-visual light-mode-preview">
                                <div className="preview-top-bar"></div>
                                <div className="preview-body">
                                    <div className="preview-chip"></div>
                                    <div className="preview-chip"></div>
                                </div>
                            </div>
                            <span className="theme-name">{t('settings.appearance.themeLight') || 'โหมดสว่าง (Light)'}</span>
                            <span className="theme-status-tag active-tag">แนะนำ</span>
                        </button>

                        <button
                            type="button"
                            className={`theme-option-box ${themePreference === 'dark' ? 'selected' : ''}`}
                            onClick={() => handleThemeChange('dark')}
                        >
                            <div className="theme-preview-visual dark-mode-preview">
                                <div className="preview-top-bar"></div>
                                <div className="preview-body">
                                    <div className="preview-chip"></div>
                                    <div className="preview-chip"></div>
                                </div>
                            </div>
                            <span className="theme-name">{t('settings.appearance.themeDark') || 'โหมดมืด (Dark)'}</span>
                            <span className="theme-status-tag beta-tag">เร็วๆ นี้</span>
                        </button>

                        <button
                            type="button"
                            className={`theme-option-box ${themePreference === 'system' ? 'selected' : ''}`}
                            onClick={() => handleThemeChange('system')}
                        >
                            <div className="theme-preview-visual system-mode-preview">
                                <div className="preview-split-left"></div>
                                <div className="preview-split-right"></div>
                            </div>
                            <span className="theme-name">{t('settings.appearance.themeSystem') || 'ตามระบบ (System)'}</span>
                        </button>
                    </div>
                </div>

                {/* Seating Density */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiLayout size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.appearance.seatingDensity') || 'ความหนาแน่นของผังที่นั่ง'}</label>
                            <span className="settings-row-desc">{t('settings.appearance.seatingDensityDesc') || 'ปรับระยะห่างระหว่างเก้าอี้ให้เหมาะกับขนาดหน้าจอของคุณ'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <div className="segment-control">
                            <button
                                type="button"
                                className={`segment-btn ${seatingDensity === 'comfortable' ? 'active' : ''}`}
                                onClick={() => handleDensityChange('comfortable')}
                            >
                                {t('settings.appearance.densityComfortable') || 'สบายตา'}
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${seatingDensity === 'compact' ? 'active' : ''}`}
                                onClick={() => handleDensityChange('compact')}
                            >
                                {t('settings.appearance.densityCompact') || 'กะทัดรัด'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Show Student Names */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiEye size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.appearance.showStudentNames') || 'แสดงชื่อนักศึกษาบนเก้าอี้'}</label>
                            <span className="settings-row-desc">{t('settings.appearance.showStudentNamesDesc') || 'แสดงชื่อ-นามสกุลจริงบนเก้าอี้ผังห้องเรียนตลอดเวลา'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                checked={showStudentNames}
                                onChange={(e) => handleToggle('showStudentNames', setShowStudentNames, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Smooth Animations */}
                <div className="settings-row">
                    <div className="settings-row-main">
                        <div className="settings-icon-pill">
                            <FiRefreshCw size={20} />
                        </div>
                        <div className="settings-row-text">
                            <label className="settings-row-title">{t('settings.appearance.seatAnimations') || 'แอนิเมชันเก้าอี้ที่นุ่มนวล'}</label>
                            <span className="settings-row-desc">{t('settings.appearance.seatAnimationsDesc') || 'เปิดใช้เอฟเฟกต์การสลับตำแหน่งและการเคลื่อนไหวที่นุ่มนวล'}</span>
                        </div>
                    </div>
                    <div className="settings-row-action">
                        <label className="clean-switch">
                            <input
                                type="checkbox"
                                checked={seatAnimations}
                                onChange={(e) => handleToggle('seatAnimations', setSeatAnimations, e.target.checked)}
                            />
                            <span className="clean-switch-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAbout = () => (
        <div className="settings-content-fade">
            <div className="settings-section-header">
                <h2>{t('settings.help.title') || 'เกี่ยวกับและศูนย์ช่วยเหลือ'}</h2>
                <p className="settings-section-subtitle">{t('settings.help.subtitle') || 'ข้อมูลเวอร์ชัน ผู้พัฒนา เอกสาร และการสนับสนุน'}</p>
            </div>

            <div className="settings-card-clean about-clean-card">
                <div className="about-branding-header">
                    <div className="about-logo-wrapper">
                        <img referrerPolicy="no-referrer" src={buildPublicAssetUrl('/favicon.ico')} alt="EChair Logo" />
                    </div>
                    <div className="about-branding-text">
                        <div className="about-app-title">
                            <h3>EChair</h3>
                            <span className="version-pill">v1.0.0</span>
                            <span className="status-pill-stable">Stable</span>
                        </div>
                        <p className="about-app-desc">{t('settings.help.appDesc') || 'ระบบบริหารจัดการห้องเรียนและผังที่นั่งอัจฉริยะแบบเรียลไทม์'}</p>
                    </div>
                </div>

                <div className="clean-divider"></div>

                <div className="about-detail-grid">
                    <div className="about-detail-row">
                        <span className="about-key">{t('settings.help.version') || 'เวอร์ชัน'}</span>
                        <span className="about-val">1.0.0 (Build 2026.11)</span>
                    </div>
                    <div className="about-detail-row">
                        <span className="about-key">{t('settings.help.channel') || 'ช่องทางการเผยแพร่'}</span>
                        <span className="about-val">{t('settings.help.stable') || 'เวอร์ชันเสถียร (Production Stable)'}</span>
                    </div>
                    <div className="about-detail-row">
                        <span className="about-key">{t('settings.help.developer') || 'ทีมผู้พัฒนา'}</span>
                        <span className="about-val font-medium">Tanicha & Pichayut</span>
                    </div>
                    <div className="about-detail-row">
                        <span className="about-key">{t('settings.help.institution') || 'สถาบันการศึกษา'}</span>
                        <span className="about-val">
                            KMUTNB — {t('settings.help.faculty') || 'คณะครุศาสตร์อุตสาหกรรม มจพ.'}
                            <div className="about-val-sub">{t('settings.help.dept') || 'ภาควิชาคอมพิวเตอร์ศึกษา (CED)'}</div>
                        </span>
                    </div>
                </div>

                <div className="clean-divider"></div>

                <div className="about-links-section">
                    <h4 className="about-section-heading">{t('settings.help.legal') || 'ข้อกำหนดและนโยบาย'}</h4>
                    <div className="about-links-row">
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="clean-link-button">
                            <span>{t('settings.help.terms') || 'ข้อกำหนดการให้บริการ (Terms of Service)'}</span>
                            <FiExternalLink size={14} />
                        </a>
                        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="clean-link-button">
                            <span>{t('settings.help.privacy') || 'นโยบายความเป็นส่วนตัว (Privacy Policy)'}</span>
                            <FiExternalLink size={14} />
                        </a>
                    </div>
                </div>

                <div className="clean-divider"></div>

                {/* Reset local cache */}
                <div className="about-reset-section">
                    <div className="about-reset-info">
                        <div className="about-reset-title">{t('settings.help.clearCacheTitle') || 'ล้างแคชการตั้งค่าในเครื่อง'}</div>
                        <div className="about-reset-desc">{t('settings.help.clearCacheDesc') || 'รีเซ็ตการตั้งค่าเฉพาะบนเบราว์เซอร์นี้กลับเป็นค่าเริ่มต้น (ไม่กระทบกับข้อมูลบัญชี)'}</div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClearPreferences}
                        className="clean-reset-btn"
                    >
                        <FiRefreshCw size={14} />
                        <span>{t('settings.help.clearCacheBtn') || 'รีเซ็ตแคช'}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeSection) {
            case 'general':
                return renderGeneral();
            case 'notifications':
                return renderNotifications();
            case 'appearance':
                return renderAppearance();
            case 'about':
                return renderAbout();
            default:
                return renderGeneral();
        }
    };

    if (!user) {
        return <div className="settings-loading-state">{t('common.loading') || 'กำลังโหลด...'}</div>;
    }

    return (
        <>
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                handleSignOut={handleSignOut}
                classrooms={[]}
                isAppSettingPage={true}
                appActiveSection={activeSection}
                onAppSectionChange={setActiveSection}
                onBackClick={handleBackClick}
            />
            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div className="app-settings-container">
                    {/* In-page Tab Navigation for instant accessibility */}
                    <div className="settings-top-tabs">
                        <button
                            type="button"
                            className={`settings-tab-pill ${activeSection === 'general' ? 'active' : ''}`}
                            onClick={() => setActiveSection('general')}
                        >
                            <FiSettings size={16} />
                            <span>{t('navbar.appSettings.general') || 'ทั่วไป'}</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-pill ${activeSection === 'notifications' ? 'active' : ''}`}
                            onClick={() => setActiveSection('notifications')}
                        >
                            <FiBell size={16} />
                            <span>{t('navbar.appSettings.notifications') || 'การแจ้งเตือน'}</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-pill ${activeSection === 'appearance' ? 'active' : ''}`}
                            onClick={() => setActiveSection('appearance')}
                        >
                            <FiLayout size={16} />
                            <span>{t('navbar.appSettings.appearance') || 'การแสดงผล'}</span>
                        </button>
                        <button
                            type="button"
                            className={`settings-tab-pill ${activeSection === 'about' ? 'active' : ''}`}
                            onClick={() => setActiveSection('about')}
                        >
                            <FiInfo size={16} />
                            <span>{t('navbar.appSettings.helpSupport') || 'ช่วยเหลือ & เกี่ยวกับ'}</span>
                        </button>
                    </div>

                    {toastMessage && (
                        <div className="settings-toast-alert">
                            <FiCheck size={16} />
                            <span>{toastMessage}</span>
                        </div>
                    )}

                    {renderContent()}
                </div>
            </main>
        </>
    );
};

export default AppSettingsPage;
