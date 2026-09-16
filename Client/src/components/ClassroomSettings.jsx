// src/components/ClassroomSettings.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../CSS/EditClassroomPage.css';
import { getProfileImageSrc, isGoogleUser, handleImageError } from '../utils/profileImageHelper';
import { FaPalette, FaUsers, FaEllipsisH, FaCrown, FaUserGraduate, FaArrowUp, FaArrowDown, FaUserSlash, FaCopy, FaCheck, FaSpinner, FaCog } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import API_BASE_URL from '../config/api';

const DEBOUNCE_DELAY = 800;

const ClassroomSettings = ({ classId, user, classroom, onRefresh }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'classroomSettings' });
    const [activeTab, setActiveTab] = useState('theme');

    // Auto-save status
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');

    // Debounce refs
    const themeDebounceRef = useRef(null);
    const settingsDebounceRef = useRef(null);

    // Theme settings
    const [themeData, setThemeData] = useState({
        name: '',
        subname: '',
        color: '#4CAF50',
        bannerUrl: ''
    });

    // Role management
    const [classroomMembers, setClassroomMembers] = useState({
        creator: [],
        participants: []
    });

    // Other settings
    const [otherSettings, setOtherSettings] = useState({
        classCode: '',
        isPublic: false,
        allowSelfJoin: true
    });

    // Initialize state from classroom prop
    useEffect(() => {
        if (!classroom) return;

        setThemeData({
            name: classroom.name || '',
            subname: classroom.subname || '',
            color: classroom.color || '#4CAF50',
            bannerUrl: classroom.bannerUrl || ''
        });

        const creators = classroom.creator || [];
        const creatorIds = new Set(creators.map(c => c._id));
        const participants = (classroom.participants || []).filter(p => !creatorIds.has(p._id));
        setClassroomMembers({ creator: creators, participants });

        setOtherSettings({
            classCode: classroom.classCode || '',
            isPublic: classroom.isPublic || false,
            allowSelfJoin: classroom.allowSelfJoin !== false
        });
    }, [classroom]);

    // Auto-save theme settings
    const autoSaveTheme = useCallback(async (data) => {
        setSaving(true);
        setSaveStatus('saving');
        try {
            const updatedThemeData = {
                name: data.name,
                subname: data.subname,
                color: data.color,
                bannerUrl: data.bannerUrl || ''
            };
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/theme`, updatedThemeData, {
                headers: { 'x-auth-token': user.token }
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(''), 2000);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Failed to save theme:', error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(''), 3000);
        } finally {
            setSaving(false);
        }
    }, [classId, user, onRefresh]);

    // Auto-save other settings
    const autoSaveSettings = useCallback(async (data) => {
        setSaving(true);
        setSaveStatus('saving');
        try {
            await axios.put(
                `${API_BASE_URL}/api/classrooms/${classId}/settings`,
                { isPublic: data.isPublic, allowSelfJoin: data.allowSelfJoin },
                { headers: { 'x-auth-token': user.token } }
            );
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (err) {
            console.error("Failed to update settings:", err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(''), 3000);
        } finally {
            setSaving(false);
        }
    }, [classId, user]);

    // Handle theme data change with debounce
    const handleThemeChange = useCallback((newThemeData) => {
        setThemeData(newThemeData);
        if (themeDebounceRef.current) clearTimeout(themeDebounceRef.current);
        themeDebounceRef.current = setTimeout(() => {
            autoSaveTheme(newThemeData);
        }, DEBOUNCE_DELAY);
    }, [autoSaveTheme]);

    // Handle other settings change with debounce
    const handleOtherSettingsChange = useCallback((newSettings) => {
        setOtherSettings(newSettings);
        if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
        settingsDebounceRef.current = setTimeout(() => {
            autoSaveSettings(newSettings);
        }, DEBOUNCE_DELAY);
    }, [autoSaveSettings]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (themeDebounceRef.current) clearTimeout(themeDebounceRef.current);
            if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
        };
    }, []);

    // Role management handlers
    const handlePromoteMember = async (memberId, memberName) => {
        try {
            const result = await Swal.fire({
                title: t('swal.promoteTitle', { name: memberName }),
                text: t('swal.promoteText'),
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: t('swal.promoteConfirm'),
                cancelButtonText: t('swal.cancel')
            });
            if (result.isConfirmed) {
                await axios.put(
                    `${API_BASE_URL}/api/classrooms/${classId}/promote`,
                    { userId: memberId },
                    { headers: { 'x-auth-token': user.token } }
                );
                Swal.fire(t('swal.success'), t('swal.promoteSuccess', { name: memberName }), 'success');
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            Swal.fire(t('swal.error'), t('swal.promoteError'), 'error');
        }
    };

    const handleDemoteMember = async (memberId, memberName) => {
        try {
            const result = await Swal.fire({
                title: t('swal.demoteTitle', { name: memberName }),
                text: t('swal.demoteText'),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#3085d6',
                confirmButtonText: t('swal.demoteConfirm'),
                cancelButtonText: t('swal.cancel')
            });
            if (result.isConfirmed) {
                await axios.put(
                    `${API_BASE_URL}/api/classrooms/${classId}/demote`,
                    { userId: memberId },
                    { headers: { 'x-auth-token': user.token } }
                );
                Swal.fire(t('swal.success'), t('swal.demoteSuccess', { name: memberName }), 'success');
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            Swal.fire(t('swal.error'), err.response?.data?.msg || t('swal.demoteError'), 'error');
        }
    };

    const handleKickMember = async (memberId, memberName) => {
        const result = await Swal.fire({
            title: t('swal.kickTitle', { name: memberName }),
            text: t('swal.kickText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: t('swal.kickConfirm'),
            cancelButtonText: t('swal.cancel'),
            confirmButtonColor: '#e74c3c'
        });
        if (result.isConfirmed) {
            try {
                await axios.put(
                    `${API_BASE_URL}/api/classrooms/${classId}/kick`,
                    { userId: memberId },
                    { headers: { 'x-auth-token': user.token } }
                );
                Swal.fire(t('swal.success'), t('swal.kickSuccess', { name: memberName }), 'success');
                if (onRefresh) onRefresh();
            } catch (err) {
                Swal.fire(t('swal.error'), t('swal.kickError'), 'error');
            }
        }
    };

    // === Render Sections ===

    const renderThemeSection = () => (
        <div className="edit-section">
            <h2 className="section-title">
                <FaPalette className="section-icon" />
                {t('themeSection.title')}
            </h2>
            <div className="theme-settings-container">
                <div className="setting-item">
                    <div className="setting-header">
                        <span className="setting-title">{t('themeSection.nameTitle')}</span>
                    </div>
                    <p className="setting-description">{t('themeSection.nameDesc')}</p>
                    <input
                        type="text"
                        value={themeData.name}
                        onChange={(e) => handleThemeChange({ ...themeData, name: e.target.value })}
                        placeholder={t('themeSection.namePlaceholder')}
                        className="theme-input"
                    />
                </div>
                <div className="setting-item">
                    <div className="setting-header">
                        <span className="setting-title">{t('themeSection.descTitle')}</span>
                    </div>
                    <p className="setting-description">{t('themeSection.descDesc')}</p>
                    <input
                        type="text"
                        value={themeData.subname}
                        onChange={(e) => handleThemeChange({ ...themeData, subname: e.target.value })}
                        placeholder={t('themeSection.descPlaceholder')}
                        className="theme-input"
                    />
                </div>
                <div className="setting-item">
                    <div className="setting-header">
                        <span className="setting-title">{t('themeSection.colorTitle')}</span>
                    </div>
                    <p className="setting-description">{t('themeSection.colorDesc')}</p>
                    <div className="color-picker-container">
                        <input
                            type="color"
                            value={themeData.color}
                            onChange={(e) => handleThemeChange({ ...themeData, color: e.target.value })}
                            className="color-input"
                        />
                        <div className="color-preview" style={{ backgroundColor: themeData.color }}>
                            <span className="color-code">{themeData.color}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderRoleSection = () => (
        <div className="edit-section">
            <h2 className="section-title">
                <FaUsers className="section-icon" />
                {t('roleSection.title')}
            </h2>
            <div className="role-section">
                <h3>
                    <FaCrown style={{ color: '#4CAF50' }} />
                    {t('roleSection.creators')}
                    <span className="role-count">{classroomMembers.creator.length}</span>
                </h3>
                <div className="members-list">
                    {classroomMembers.creator.map(creator => (
                        <div key={creator._id} className="member-card creator">
                            <img referrerPolicy="no-referrer" src={getProfileImageSrc(creator.photoURL, isGoogleUser(creator))} alt={creator.displayName} onError={handleImageError} />
                            <div className="member-info">
                                <span className="member-name">{creator.displayName}</span>
                                {creator.email && <span className="member-email">{creator.email}</span>}
                                <span className="role-badge creator-badge">
                                    <FaCrown size={10} /> {t('roleSection.creatorBadge')}
                                </span>
                            </div>
                            {user.id !== creator._id && (
                                <div className="member-actions">
                                    <button
                                        className="action-btn demote-btn"
                                        onClick={() => handleDemoteMember(creator._id, creator.displayName)}
                                        title={t('roleSection.demoteBtn')}
                                    >
                                        <FaArrowDown />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="role-section">
                <h3>
                    <FaUserGraduate style={{ color: '#2196F3' }} />
                    {t('roleSection.participants')}
                    <span className="role-count">{classroomMembers.participants.length}</span>
                </h3>
                <div className="members-list">
                    {classroomMembers.participants.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic', width: '100%' }}>
                            {t('roleSection.noParticipants')}
                        </div>
                    ) : (
                        classroomMembers.participants.map(participant => (
                            <div key={participant._id} className="member-card participant">
                                <img referrerPolicy="no-referrer" src={getProfileImageSrc(participant.photoURL, isGoogleUser(participant))} alt={participant.displayName} onError={handleImageError} />
                                <div className="member-info">
                                    <span className="member-name">{participant.displayName}</span>
                                    {participant.email && <span className="member-email">{participant.email}</span>}
                                    <span className="role-badge participant-badge">
                                        <FaUserGraduate size={10} /> {t('roleSection.studentBadge')}
                                    </span>
                                </div>
                                <div className="member-actions">
                                    <button
                                        className="action-btn promote-btn"
                                        onClick={() => handlePromoteMember(participant._id, participant.displayName)}
                                        title={t('roleSection.promoteBtn')}
                                    >
                                        <FaArrowUp />
                                    </button>
                                    <button
                                        className="action-btn kick-btn"
                                        onClick={() => handleKickMember(participant._id, participant.displayName)}
                                        title={t('roleSection.kickBtn')}
                                    >
                                        <FaUserSlash />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    const renderOtherSection = () => (
        <div className="edit-section">
            <h2 className="section-title">
                <FaEllipsisH className="section-icon" />
                {t('generalSection.title')}
            </h2>
            <div className="other-settings-section">
                <div className="setting-item">
                    <div className="setting-header">
                        <span className="setting-title">{t('generalSection.classCodeTitle')}</span>
                    </div>
                    <p className="setting-description">{t('generalSection.classCodeDesc')}</p>
                    <div className="class-code-display" style={{ marginTop: '12px' }}>
                        <input
                            type="text"
                            value={otherSettings.classCode}
                            readOnly
                            className="readonly-input"
                        />
                        <button
                            className="copy-btn"
                            onClick={() => {
                                navigator.clipboard.writeText(otherSettings.classCode);
                                Swal.fire({
                                    icon: 'success',
                                    title: t('generalSection.copiedTitle'),
                                    text: t('generalSection.copiedText'),
                                    timer: 1500,
                                    showConfirmButton: false,
                                    toast: true,
                                    position: 'top-end'
                                });
                            }}
                        >
                            <FaCopy /> {t('generalSection.copyBtn')}
                        </button>
                    </div>
                </div>
                <div className="setting-item">
                    <div className="setting-header">
                        <div>
                            <span className="setting-title">{t('generalSection.publicTitle')}</span>
                            <p className="setting-description">{t('generalSection.publicDesc')}</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={otherSettings.isPublic}
                                onChange={(e) => handleOtherSettingsChange({ ...otherSettings, isPublic: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                <div className="setting-item">
                    <div className="setting-header">
                        <div>
                            <span className="setting-title">{t('generalSection.selfJoinTitle')}</span>
                            <p className="setting-description">{t('generalSection.selfJoinDesc')}</p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={otherSettings.allowSelfJoin}
                                onChange={(e) => handleOtherSettingsChange({ ...otherSettings, allowSelfJoin: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const tabs = [
        { id: 'theme', label: t('tabs.theme'), icon: <FaPalette /> },
        { id: 'members', label: t('tabs.members'), icon: <FaUsers /> },
        { id: 'general', label: t('tabs.general'), icon: <FaEllipsisH /> }
    ];

    return (
        <div className="edit-classroom-container">
            <div className="edit-header" style={{ marginBottom: '24px', position: 'relative' }}>
                <div className="edit-header-left">
                    <div className="edit-header-icon">
                        <FaCog size={20} />
                    </div>
                    <div>
                        <h1>{t('title')}</h1>
                        <p>{t('subtitle')}</p>
                    </div>
                </div>
                <div className="save-status-indicator">
                    {saveStatus === 'saving' && (
                        <span className="status-saving" style={{ color: '#fde047' }}>
                            <FaSpinner className="fa-spin" /> {t('saveStatus.saving')}
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="status-saved" style={{ color: '#86efac' }}>
                            <FaCheck /> {t('saveStatus.saved')}
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="status-error" style={{ color: '#fca5a5' }}>
                            {t('saveStatus.error')}
                        </span>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="edit-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`edit-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="edit-main-content">
                {activeTab === 'theme' && renderThemeSection()}
                {activeTab === 'members' && renderRoleSection()}
                {activeTab === 'general' && renderOtherSection()}
            </div>
        </div>
    );
};

export default ClassroomSettings;

