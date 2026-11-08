// src/pages/AccountSetting.jsx

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
import '../CSS/GoogleAccount.css';

import Navbar from '../components/Navbar';
import '../CSS/Navbar.css';
import '../CSS/Main.css';
import { getProfileImageSrc, getCurrentUserProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import { useTranslation } from 'react-i18next';
import API_BASE_URL from '../config/api';

import {
    FiUser,
    FiMail,
    FiPhone,
    FiMapPin,
    FiCalendar,
    FiShield,
    FiKey,
    FiLock,
    FiClock,
    FiCamera,
    FiTrash2,
    FiEdit2,
    FiCheck,
    FiX,
    FiRefreshCw,
    FiAlertCircle,
    FiSmartphone,
    FiMonitor,
    FiLogOut
} from 'react-icons/fi';

const AccountSetting = ({ user, updateUserProfile, onSignOut, isSidebarOpen, toggleSidebar }) => {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState('account');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(user.photoURL);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');
    const [showCropper, setShowCropper] = useState(false);

    // Editable profile states
    const [isEditing, setIsEditing] = useState({});
    const [profileData, setProfileData] = useState({
        displayName: user.displayName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        bio: user.bio || '',
        dateOfBirth: user.dateOfBirth || '',
        gender: user.gender || ''
    });

    // Cropper states
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [imageSrcToCrop, setImageSrcToCrop] = useState(null);

    // Security section states
    const [securityData, setSecurityData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        twoFactorCode: ''
    });
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(user.twoFactorEnabled || false);
    const [loginHistory, setLoginHistory] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [show2FAVerification, setShow2FAVerification] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    const isGoogleAccount = isGoogleUser(user);

    const showToast = (msg, type = 'success') => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => setMessage(''), 4000);
    };

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            const fileReader = new FileReader();
            fileReader.onload = () => {
                setImageSrcToCrop(fileReader.result);
                setShowCropper(true);
            };
            fileReader.readAsDataURL(file);
        } else {
            setSelectedFile(null);
            setPreviewUrl(user.photoURL);
        }
    };

    const handleCropAndUpload = async () => {
        setLoading(true);
        setMessage('');
        setShowCropper(false);

        try {
            const croppedImageBlob = await getCroppedImg(imageSrcToCrop, croppedAreaPixels);
            const formData = new FormData();
            formData.append('profileImage', croppedImageBlob, selectedFile?.name || 'profile.jpg');

            const response = await fetch(`${API_BASE_URL}/api/auth/profile/update-photo`, {
                method: 'POST',
                headers: {
                    'x-auth-token': user.token,
                },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                updateUserProfile(data.user);
                setPreviewUrl(data.user.photoURL);
                localStorage.setItem('userPhotoURL', data.user.photoURL);
                const cachedProfile = localStorage.getItem('userProfile');
                if (cachedProfile) {
                    localStorage.setItem('userProfile', JSON.stringify({
                        ...JSON.parse(cachedProfile),
                        photoURL: data.user.photoURL
                    }));
                }
                showToast(t('accountSettingsPage.profile.photoUpdateSuccess') || 'Profile picture updated successfully!');
            } else {
                const errorMessage = typeof data.msg === 'string' ? data.msg : (t('accountSettingsPage.profile.photoUpdateError') || 'Failed to update profile picture.');
                showToast(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error cropping or uploading photo:', error);
            showToast(t('accountSettingsPage.profile.serverError') || 'Server error. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePhoto = async () => {
        setLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/profile/delete-photo`, {
                method: 'DELETE',
                headers: {
                    'x-auth-token': user.token,
                },
            });

            const data = await response.json();

            if (response.ok) {
                updateUserProfile(data.user);
                setPreviewUrl(null);
                localStorage.removeItem('userPhotoURL');
                const cachedProfile = localStorage.getItem('userProfile');
                if (cachedProfile) {
                    const parsed = JSON.parse(cachedProfile);
                    delete parsed.photoURL;
                    localStorage.setItem('userProfile', JSON.stringify(parsed));
                }
                showToast(t('accountSettingsPage.profile.photoRemoveSuccess') || 'Profile picture removed successfully!');
            } else {
                showToast(data.msg || (t('accountSettingsPage.profile.photoRemoveError') || 'Failed to remove profile picture.'), 'error');
            }
        } catch (error) {
            console.error('Error deleting photo:', error);
            showToast(t('accountSettingsPage.profile.serverError') || 'Server error. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEditToggle = (field) => {
        setIsEditing(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handleInputChange = (field, value) => {
        setProfileData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSaveField = async (field) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/profile/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': user.token,
                },
                body: JSON.stringify({
                    [field]: profileData[field]
                }),
            });

            const data = await response.json();

            if (response.ok) {
                updateUserProfile(data.user);
                setIsEditing(prev => ({ ...prev, [field]: false }));
                showToast(t('accountSettingsPage.profile.updateSuccess', { field }) || `${field} updated successfully!`);
            } else {
                showToast(data.msg || (t('accountSettingsPage.profile.updateError') || 'Failed to update profile.'), 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(t('accountSettingsPage.profile.serverError') || 'Server error. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = (field) => {
        setProfileData(prev => ({
            ...prev,
            [field]: user[field] || ''
        }));
        setIsEditing(prev => ({ ...prev, [field]: false }));
    };

    // Fetch security data
    const fetchLoginHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login-history`, {
                headers: { 'x-auth-token': user.token }
            });
            const data = await response.json();
            if (response.ok) {
                setLoginHistory(data.history || []);
            }
        } catch (error) {
            console.error('Error fetching login history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, [user.token]);

    const fetchActiveSessions = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/active-sessions`, {
                headers: { 'x-auth-token': user.token }
            });
            const data = await response.json();
            if (response.ok) {
                setActiveSessions(data.sessions || []);
            }
        } catch (error) {
            console.error('Error fetching active sessions:', error);
        }
    }, [user.token]);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (securityData.newPassword !== securityData.confirmPassword) {
            showToast(t('accountSettingsPage.security.passObj.notMatch') || 'New passwords do not match', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': user.token
                },
                body: JSON.stringify({
                    currentPassword: securityData.currentPassword,
                    newPassword: securityData.newPassword
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(t('accountSettingsPage.security.passObj.success') || 'Password changed successfully!');
                setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '', twoFactorCode: '' });
                setShowChangePassword(false);
            } else {
                showToast(data.msg || (t('accountSettingsPage.security.passObj.error') || 'Failed to change password'), 'error');
            }
        } catch (error) {
            showToast(t('accountSettingsPage.profile.serverError') || 'Server error. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle2FA = async (enable) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/2fa/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': user.token
                },
                body: JSON.stringify({ enable })
            });

            const data = await response.json();
            if (response.ok) {
                if (enable) {
                    setShow2FAVerification(true);
                    if (data.devCode) {
                        setSecurityData(prev => ({ ...prev, twoFactorCode: data.devCode }));
                        showToast(`รหัสยืนยัน 2FA ของคุณคือ: ${data.devCode}`);
                    } else {
                        showToast(t('accountSettingsPage.security.twoFactor.checkEmail') || 'Check your email for verification code');
                    }
                } else {
                    setTwoFactorEnabled(false);
                    if (updateUserProfile) {
                        updateUserProfile({ ...user, twoFactorEnabled: false });
                    }
                    showToast(t('accountSettingsPage.security.twoFactor.disabledSuccess') || 'Two-factor authentication disabled');
                }
            } else {
                showToast(data.msg || (t('accountSettingsPage.security.twoFactor.updateError') || 'Failed to update 2FA settings'), 'error');
            }
        } catch (error) {
            showToast(t('accountSettingsPage.profile.serverError') || 'Server error. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/2fa/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': user.token
                },
                body: JSON.stringify({ code: securityData.twoFactorCode })
            });

            const data = await response.json();
            if (response.ok) {
                setTwoFactorEnabled(true);
                setShow2FAVerification(false);
                setSecurityData(prev => ({ ...prev, twoFactorCode: '' }));
                if (updateUserProfile) {
                    updateUserProfile({ ...user, twoFactorEnabled: true });
                }
                showToast(t('accountSettingsPage.security.twoFactor.enabledSuccess') || 'Two-factor authentication enabled successfully!');
            } else {
                showToast(data.msg || (t('accountSettingsPage.security.twoFactor.invalidCode') || 'Invalid verification code'), 'error');
            }
        } catch (error) {
            showToast(t('accountSettingsPage.profile.serverError') || 'Server error. Please try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleTerminateSession = async (sessionId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': user.token }
            });

            if (response.ok) {
                setActiveSessions(prev => prev.filter(s => s._id !== sessionId));
                showToast(t('accountSettingsPage.security.activeSessions.terminateSuccess') || 'Session terminated successfully');
            } else {
                showToast(t('accountSettingsPage.security.activeSessions.terminateError') || 'Error terminating session', 'error');
            }
        } catch (error) {
            showToast(t('accountSettingsPage.security.activeSessions.terminateError') || 'Error terminating session', 'error');
        }
    };

    useEffect(() => {
        if (activeSection === 'security') {
            fetchLoginHistory();
            fetchActiveSessions();
        }
    }, [activeSection, fetchActiveSessions, fetchLoginHistory]);

    const photoSrc = previewUrl && previewUrl !== 'null' && previewUrl !== null && previewUrl !== ''
        ? (previewUrl.startsWith('blob:') ? previewUrl : getProfileImageSrc(previewUrl, isGoogleAccount))
        : getCurrentUserProfileImageSrc(user.photoURL, isGoogleAccount);

    const getRoleBadge = (role) => {
        const r = (role || 'student').toLowerCase();
        if (r === 'admin') {
            return <span className="clean-role-badge admin">{t('accountSettingsPage.profile.roleAdmin') || 'ผู้ดูแลระบบ (Admin)'}</span>;
        }
        if (r === 'teacher' || r === 'creator') {
            return <span className="clean-role-badge teacher">{t('accountSettingsPage.profile.roleTeacher') || 'อาจารย์ / ผู้สอน (Teacher)'}</span>;
        }
        return <span className="clean-role-badge student">{t('accountSettingsPage.profile.roleStudent') || 'นักศึกษา (Student)'}</span>;
    };

    const renderEditableField = (label, field, type = 'text', options = null, icon = null) => {
        const inEditMode = isEditing[field];
        const val = profileData[field];

        return (
            <div className={`clean-field-row ${inEditMode ? 'editing' : ''}`} key={field}>
                <div className="clean-field-meta">
                    <div className="clean-field-icon">
                        {icon || <FiUser size={16} />}
                    </div>
                    <div className="clean-field-labels">
                        <span className="clean-field-title">{label}</span>
                        {!inEditMode && (
                            <span className={`clean-field-display ${!val ? 'placeholder' : ''}`}>
                                {val || (t('accountSettingsPage.profile.noInfo', { label: label.toLowerCase() }) || `ยังไม่ได้ระบุ${label}`)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="clean-field-action-zone">
                    {inEditMode ? (
                        <div className="clean-inline-editor">
                            {type === 'select' ? (
                                <select
                                    value={val}
                                    onChange={(e) => handleInputChange(field, e.target.value)}
                                    className="clean-field-input"
                                >
                                    <option value="">{t('accountSettingsPage.profile.selectInfo', { label }) || `เลือก${label}`}</option>
                                    {options && options.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            ) : type === 'textarea' ? (
                                <textarea
                                    value={val}
                                    onChange={(e) => handleInputChange(field, e.target.value)}
                                    className="clean-field-textarea"
                                    rows={3}
                                    maxLength={250}
                                    placeholder={t('accountSettingsPage.profile.enterInfo', { label: label.toLowerCase() }) || `กรอก${label}`}
                                />
                            ) : (
                                <input
                                    type={type}
                                    value={val}
                                    onChange={(e) => handleInputChange(field, e.target.value)}
                                    className="clean-field-input"
                                    placeholder={t('accountSettingsPage.profile.enterInfo', { label: label.toLowerCase() }) || `กรอก${label}`}
                                />
                            )}
                            <div className="clean-editor-buttons">
                                <button
                                    type="button"
                                    className="clean-btn-save"
                                    onClick={() => handleSaveField(field)}
                                    disabled={loading}
                                >
                                    <FiCheck size={14} />
                                    <span>{t('common.save') || 'บันทึก'}</span>
                                </button>
                                <button
                                    type="button"
                                    className="clean-btn-cancel"
                                    onClick={() => handleCancelEdit(field)}
                                    disabled={loading}
                                >
                                    <FiX size={14} />
                                    <span>{t('common.cancel') || 'ยกเลิก'}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="clean-btn-edit-trigger"
                            onClick={() => handleEditToggle(field)}
                            disabled={loading}
                            title={`แก้ไข ${label}`}
                        >
                            <FiEdit2 size={14} />
                            <span>{t('common.edit') || 'แก้ไข'}</span>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderAccountSection = () => (
        <div className="account-settings-fade">
            {/* Group 1: Basic Information */}
            <div className="clean-settings-card">
                <div className="clean-card-header">
                    <div className="clean-card-header-icon">
                        <FiUser size={18} />
                    </div>
                    <div>
                        <h3>{t('accountSettingsPage.profile.basicSection') || 'ข้อมูลบัญชีและการติดต่อ'}</h3>
                        <p>{t('accountSettingsPage.profile.basicSectionDesc') || 'ข้อมูลหลักที่ใช้ในการระบุตัวตนและติดต่อในระบบ'}</p>
                    </div>
                </div>

                <div className="clean-fields-list">
                    {/* Display Name */}
                    {renderEditableField(
                        t('accountSettingsPage.profile.nameLabel') || 'ชื่อ-นามสกุล',
                        'displayName',
                        'text',
                        null,
                        <FiUser size={16} />
                    )}

                    {/* Email (Readonly) */}
                    <div className="clean-field-row readonly">
                        <div className="clean-field-meta">
                            <div className="clean-field-icon">
                                <FiMail size={16} />
                            </div>
                            <div className="clean-field-labels">
                                <span className="clean-field-title">อีเมล (Email)</span>
                                <span className="clean-field-display">{user.email || profileData.email}</span>
                            </div>
                        </div>
                        <div className="clean-field-action-zone">
                            <span className="clean-readonly-badge" title={t('accountSettingsPage.profile.emailNotice') || 'อีเมลใช้สำหรับการเข้าสู่ระบบ ไม่สามารถแก้ไขได้'}>
                                <FiLock size={12} />
                                <span>{t('accountSettingsPage.profile.verified') || 'ยืนยันแล้ว'}</span>
                            </span>
                        </div>
                    </div>

                    {/* Phone Number */}
                    {renderEditableField(
                        t('accountSettingsPage.profile.phoneLabel') || 'เบอร์โทรศัพท์',
                        'phoneNumber',
                        'tel',
                        null,
                        <FiPhone size={16} />
                    )}
                </div>
            </div>

            {/* Group 2: Personal Details */}
            <div className="clean-settings-card">
                <div className="clean-card-header">
                    <div className="clean-card-header-icon">
                        <FiCalendar size={18} />
                    </div>
                    <div>
                        <h3>{t('accountSettingsPage.profile.detailsSection') || 'ข้อมูลส่วนตัวและประวัติ'}</h3>
                        <p>{t('accountSettingsPage.profile.detailsSectionDesc') || 'รายละเอียดส่วนตัวเพิ่มเติมสำหรับการเรียนการสอน'}</p>
                    </div>
                </div>

                <div className="clean-fields-list">
                    {/* Bio */}
                    {renderEditableField(
                        t('accountSettingsPage.profile.bioLabel') || 'คำแนะนำตัว (Bio)',
                        'bio',
                        'textarea',
                        null,
                        <FiUser size={16} />
                    )}

                    {/* Gender */}
                    {renderEditableField(
                        t('accountSettingsPage.profile.genderLabel') || 'เพศ',
                        'gender',
                        'select',
                        [
                            t('accountSettingsPage.profile.genderOptions.male') || 'ชาย',
                            t('accountSettingsPage.profile.genderOptions.female') || 'หญิง',
                            t('accountSettingsPage.profile.genderOptions.other') || 'อื่นๆ',
                            t('accountSettingsPage.profile.genderOptions.preferNotToSay') || 'ไม่ต้องการระบุ'
                        ],
                        <FiUser size={16} />
                    )}

                    {/* Date of Birth */}
                    {renderEditableField(
                        t('accountSettingsPage.profile.dobLabel') || 'วันเกิด',
                        'dateOfBirth',
                        'date',
                        null,
                        <FiCalendar size={16} />
                    )}

                    {/* Address */}
                    {renderEditableField(
                        t('accountSettingsPage.profile.addressLabel') || 'ที่อยู่',
                        'address',
                        'text',
                        null,
                        <FiMapPin size={16} />
                    )}
                </div>
            </div>

            {/* Sign Out Card */}
            <div className="clean-settings-card clean-danger-zone">
                <div className="danger-zone-content">
                    <div className="danger-zone-text">
                        <h4>ออกจากระบบ (Sign Out)</h4>
                        <p>สิ้นสุดเซสชันการใช้งานปัจจุบันบนอุปกรณ์นี้</p>
                    </div>
                    <button type="button" onClick={onSignOut} className="clean-btn-signout">
                        <FiLogOut size={16} />
                        <span>{t('accountSettingsPage.profile.signOut') || 'ออกจากระบบ'}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSecuritySection = () => (
        <div className="account-settings-fade">
            {/* Password Management */}
            <div className="clean-settings-card">
                <div className="clean-card-header">
                    <div className="clean-card-header-icon">
                        <FiKey size={18} />
                    </div>
                    <div>
                        <h3>{t('accountSettingsPage.security.passObj.title') || 'รหัสผ่าน (Password)'}</h3>
                        <p>{t('accountSettingsPage.security.passObj.desc') || 'เปลี่ยนรหัสผ่านเป็นประจำเพื่อความปลอดภัยของบัญชี'}</p>
                    </div>
                </div>

                <div className="clean-card-body">
                    {isGoogleAccount ? (
                        <div className="clean-info-box">
                            <FiAlertCircle size={18} className="clean-info-icon" />
                            <div className="clean-info-text">
                                <strong>เข้าสู่ระบบด้วย Google</strong>
                                <span>{t('accountSettingsPage.profile.googlePassNotice') || 'บัญชีของคุณเชื่อมต่อด้วย Google การจัดการรหัสผ่านจะดำเนินการผ่านบัญชี Google โดยตรง'}</span>
                            </div>
                        </div>
                    ) : !showChangePassword ? (
                        <div className="clean-action-row">
                            <div className="clean-action-meta">
                                <span className="clean-meta-title">รหัสผ่านปัจจุบัน</span>
                                <span className="clean-meta-sub">อัปเดตล่าสุดเพื่อความปลอดภัย</span>
                            </div>
                            <button
                                type="button"
                                className="clean-btn-secondary"
                                onClick={() => setShowChangePassword(true)}
                            >
                                <FiKey size={14} />
                                <span>{t('accountSettingsPage.security.passObj.changeBtn') || 'เปลี่ยนรหัสผ่าน'}</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleChangePassword} className="clean-password-form">
                            <div className="clean-form-group">
                                <label>รหัสผ่านปัจจุบัน</label>
                                <input
                                    type="password"
                                    placeholder={t('accountSettingsPage.security.passObj.currentPass') || 'กรอกรหัสผ่านปัจจุบัน'}
                                    value={securityData.currentPassword}
                                    onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                                    required
                                    className="clean-field-input"
                                />
                            </div>
                            <div className="clean-form-row-dual">
                                <div className="clean-form-group">
                                    <label>รหัสผ่านใหม่</label>
                                    <input
                                        type="password"
                                        placeholder={t('accountSettingsPage.security.passObj.newPass') || 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)'}
                                        value={securityData.newPassword}
                                        onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                                        minLength={6}
                                        required
                                        className="clean-field-input"
                                    />
                                </div>
                                <div className="clean-form-group">
                                    <label>ยืนยันรหัสผ่านใหม่</label>
                                    <input
                                        type="password"
                                        placeholder={t('accountSettingsPage.security.passObj.confirmNewPass') || 'ยืนยันรหัสผ่านใหม่อีกครั้ง'}
                                        value={securityData.confirmPassword}
                                        onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                                        required
                                        className="clean-field-input"
                                    />
                                </div>
                            </div>
                            <div className="clean-form-actions">
                                <button type="submit" className="clean-btn-save" disabled={loading}>
                                    <FiCheck size={14} />
                                    <span>{loading ? (t('accountSettingsPage.security.passObj.changing') || 'กำลังบันทึก...') : (t('accountSettingsPage.security.passObj.changeBtn') || 'บันทึกรหัสผ่านใหม่')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="clean-btn-cancel"
                                    onClick={() => {
                                        setShowChangePassword(false);
                                        setSecurityData({ ...securityData, currentPassword: '', newPassword: '', confirmPassword: '' });
                                    }}
                                >
                                    <span>{t('common.cancel') || 'ยกเลิก'}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className="clean-settings-card">
                <div className="clean-card-header">
                    <div className="clean-card-header-icon">
                        <FiShield size={18} />
                    </div>
                    <div>
                        <h3>{t('accountSettingsPage.security.twoFactor.title') || 'การยืนยันตัวตนแบบสองขั้นตอน (2FA)'}</h3>
                        <p>{t('accountSettingsPage.security.twoFactor.desc') || 'เพิ่มความปลอดภัยอีกระดับด้วยรหัสยืนยัน OTP ทางอีเมลเมื่อเข้าสู่ระบบ'}</p>
                    </div>
                </div>

                <div className="clean-card-body">
                    <div className="clean-action-row">
                        <div className="clean-action-meta">
                            <span className="clean-meta-title">สถานะความปลอดภัย</span>
                            <span className={`clean-status-pill ${twoFactorEnabled ? 'active' : 'inactive'}`}>
                                {twoFactorEnabled ? (t('accountSettingsPage.security.twoFactor.enabled') || 'เปิดใช้งานแล้ว') : (t('accountSettingsPage.security.twoFactor.disabled') || 'ปิดใช้งานอยู่')}
                            </span>
                        </div>
                        <button
                            type="button"
                            className={`clean-btn-secondary ${twoFactorEnabled ? 'danger' : 'success'}`}
                            onClick={() => handleToggle2FA(!twoFactorEnabled)}
                            disabled={loading}
                        >
                            {twoFactorEnabled ? (t('accountSettingsPage.security.twoFactor.disableBtn') || 'ปิดการใช้งาน') : (t('accountSettingsPage.security.twoFactor.enableBtn') || 'เปิดใช้งาน')}
                        </button>
                    </div>

                    {show2FAVerification && (
                        <form onSubmit={handleVerify2FA} className="clean-verification-box">
                            <p className="clean-verify-prompt">{t('accountSettingsPage.security.twoFactor.enterCode') || 'กรอกรหัสยืนยัน 6 หลักที่ส่งไปยังอีเมลของคุณ:'}</p>
                            <div className="clean-verify-input-wrap">
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={securityData.twoFactorCode}
                                    onChange={(e) => setSecurityData({ ...securityData, twoFactorCode: e.target.value })}
                                    maxLength="6"
                                    required
                                    className="clean-field-input text-center font-mono letter-spacing-lg"
                                />
                                <button
                                    type="submit"
                                    className="clean-btn-save"
                                    disabled={loading || securityData.twoFactorCode.length !== 6}
                                >
                                    <FiCheck size={14} />
                                    <span>{loading ? (t('accountSettingsPage.security.twoFactor.verifyingBtn') || 'กำลังตรวจสอบ...') : (t('accountSettingsPage.security.twoFactor.verifyBtn') || 'ยืนยันรหัส')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="clean-btn-cancel"
                                    onClick={() => {
                                        setShow2FAVerification(false);
                                        setSecurityData(prev => ({ ...prev, twoFactorCode: '' }));
                                    }}
                                >
                                    <span>{t('common.cancel') || 'ยกเลิก'}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Active Sessions */}
            <div className="clean-settings-card">
                <div className="clean-card-header between">
                    <div className="clean-header-title-group">
                        <div className="clean-card-header-icon">
                            <FiMonitor size={18} />
                        </div>
                        <div>
                            <h3>{t('accountSettingsPage.security.activeSessions.title') || 'อุปกรณ์ที่เข้าสู่ระบบอยู่ (Active Sessions)'}</h3>
                            <p>{t('accountSettingsPage.security.activeSessions.desc') || 'อุปกรณ์และเบราว์เซอร์ที่กำลังลงชื่อเข้าใช้บัญชีของคุณ'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="clean-btn-icon-refresh"
                        onClick={fetchActiveSessions}
                        title="รีเฟรชข้อมูลเซสชัน"
                    >
                        <FiRefreshCw size={14} />
                        <span>รีเฟรช</span>
                    </button>
                </div>

                <div className="clean-card-body p-0">
                    <div className="clean-sessions-list">
                        {activeSessions.length > 0 ? (
                            activeSessions.map((session, index) => (
                                <div key={session._id || index} className="clean-session-row">
                                    <div className="clean-session-info">
                                        <div className="clean-device-icon">
                                            {session.userAgent?.toLowerCase().includes('mobile') ? <FiSmartphone size={18} /> : <FiMonitor size={18} />}
                                        </div>
                                        <div className="clean-session-details">
                                            <div className="clean-session-name-row">
                                                <strong className="clean-session-device">
                                                    {session.userAgent ? session.userAgent.split(' ')[0] : 'อุปกรณ์ไม่ทราบชื่อ'}
                                                </strong>
                                                {index === 0 && (
                                                    <span className="current-device-tag">อุปกรณ์นี้</span>
                                                )}
                                            </div>
                                            <span className="clean-session-sub">
                                                IP: {session.ipAddress || '127.0.0.1'} • {t('accountSettingsPage.security.activeSessions.lastActive') || 'ใช้งานล่าสุด:'} {new Date(session.lastActivity || session.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="clean-session-actions">
                                        <button
                                            type="button"
                                            className="clean-btn-terminate"
                                            onClick={() => handleTerminateSession(session._id)}
                                        >
                                            {t('accountSettingsPage.security.activeSessions.terminateBtn') || 'ยุติเซสชัน'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="clean-empty-state">
                                <p>{t('accountSettingsPage.security.activeSessions.noData') || 'ไม่พบเซสชันที่ใช้งานอยู่'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Login History */}
            <div className="clean-settings-card">
                <div className="clean-card-header between">
                    <div className="clean-header-title-group">
                        <div className="clean-card-header-icon">
                            <FiClock size={18} />
                        </div>
                        <div>
                            <h3>{t('accountSettingsPage.security.loginHistory.title') || 'ประวัติการเข้าใช้งาน (Login History)'}</h3>
                            <p>{t('accountSettingsPage.security.loginHistory.desc') || 'ประวัติกิจกรรมการเข้าสู่ระบบล่าสุด'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="clean-btn-icon-refresh"
                        onClick={fetchLoginHistory}
                        disabled={historyLoading}
                        title="รีเฟรชประวัติ"
                    >
                        <FiRefreshCw size={14} className={historyLoading ? 'spin' : ''} />
                        <span>รีเฟรช</span>
                    </button>
                </div>

                <div className="clean-card-body p-0">
                    <div className="clean-history-list">
                        {historyLoading ? (
                            <div className="clean-empty-state">
                                <p>{t('accountSettingsPage.security.loginHistory.loading') || 'กำลังโหลดประวัติ...'}</p>
                            </div>
                        ) : loginHistory.length > 0 ? (
                            loginHistory.slice(0, 10).map((entry, index) => (
                                <div key={entry._id || index} className="clean-history-row">
                                    <div className="clean-history-main">
                                        <div className="clean-history-action-badge">
                                            {entry.action || 'เข้าสู่ระบบ'}
                                        </div>
                                        <div className="clean-history-text">
                                            <span className="clean-history-time">
                                                {new Date(entry.timestamp).toLocaleString()}
                                            </span>
                                            <span className="clean-history-meta">
                                                IP: {entry.ipAddress || 'N/A'} • {entry.location?.city ? `${entry.location.city}, ` : ''}{entry.location?.country || 'ตำแหน่งไม่ระบุ'}
                                            </span>
                                        </div>
                                    </div>
                                    {(entry.device || entry.browser) && (
                                        <div className="clean-history-device-tag">
                                            {entry.browser?.name || entry.device?.type || 'เบราว์เซอร์'}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="clean-empty-state">
                                <p>{t('accountSettingsPage.security.loginHistory.noData') || 'ไม่มีประวัติการเข้าสู่ระบบ'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                handleSignOut={onSignOut}
                isAccountSettingPage={true}
                accountActiveSection={activeSection}
                onAccountSectionChange={setActiveSection}
            />
            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div className="main-content-scrollable-area">
                    <div className="account-settings-container">
                    {/* Hero Profile Overview Card */}
                    <div className="profile-hero-card">
                        <div className="profile-avatar-wrapper">
                            <img
                                referrerPolicy="no-referrer"
                                src={photoSrc}
                                alt="Profile"
                                className="profile-hero-avatar"
                            />
                            <label className="avatar-edit-overlay" title={t('accountSettingsPage.profile.changePhoto') || 'เปลี่ยนรูปโปรไฟล์'}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden-file-input"
                                    disabled={loading}
                                />
                                <FiCamera size={18} />
                            </label>
                        </div>

                        <div className="profile-hero-content">
                            <div className="profile-hero-name-row">
                                <h1 className="profile-hero-name">
                                    {profileData.displayName || (t('accountSettingsPage.profile.noName') || 'ไม่มีชื่อ')}
                                </h1>
                                {getRoleBadge(user.role)}
                            </div>
                            <div className="profile-hero-sub-row">
                                <span className="profile-hero-email">
                                    <FiMail size={14} />
                                    <span>{profileData.email || user.email}</span>
                                </span>
                                <span className="profile-hero-divider">•</span>
                                <span className="profile-provider-pill">
                                    {isGoogleAccount ? (
                                        <>
                                            <span className="google-dot">G</span>
                                            <span>Google Account</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiShield size={12} />
                                            <span>EChair Account</span>
                                        </>
                                    )}
                                </span>
                            </div>
                            {user.photoURL && (
                                <button
                                    type="button"
                                    onClick={handleDeletePhoto}
                                    className="clean-btn-remove-photo"
                                    disabled={loading}
                                >
                                    <FiTrash2 size={13} />
                                    <span>{t('accountSettingsPage.profile.removePhoto') || 'ลบรูปโปรไฟล์'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* In-page Tab Navigation */}
                    <div className="account-top-tabs">
                        <button
                            type="button"
                            className={`account-tab-pill ${activeSection === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveSection('account')}
                        >
                            <FiUser size={16} />
                            <span>{t('navbar.accountSettings.account') || 'ข้อมูลบัญชี'}</span>
                        </button>
                        <button
                            type="button"
                            className={`account-tab-pill ${activeSection === 'security' ? 'active' : ''}`}
                            onClick={() => setActiveSection('security')}
                        >
                            <FiShield size={16} />
                            <span>{t('navbar.accountSettings.security') || 'ความปลอดภัย'}</span>
                        </button>
                    </div>

                    {/* Toast Notification */}
                    {message && (
                        <div className={`account-toast-alert ${messageType}`}>
                            {messageType === 'error' ? <FiAlertCircle size={16} /> : <FiCheck size={16} />}
                            <span>{message}</span>
                        </div>
                    )}

                    {/* Active Section Content */}
                    {activeSection === 'account' && renderAccountSection()}
                    {activeSection === 'security' && renderSecuritySection()}
                </div>
            </div>
        </main>

            {/* Cropper Modal Dialog */}
            {showCropper && createPortal(
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-dialog">
                        <div className="cropper-modal-header">
                            <h3>ปรับตำแหน่งรูปโปรไฟล์</h3>
                            <button type="button" onClick={() => setShowCropper(false)} className="cropper-btn-close">
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="cropper-canvas-wrapper">
                            <Cropper
                                image={imageSrcToCrop}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        <div className="cropper-modal-footer">
                            <div className="cropper-zoom-row">
                                <span className="zoom-label">ย่อ-ขยาย:</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="clean-slider"
                                />
                            </div>
                            <div className="cropper-modal-buttons">
                                <button type="button" onClick={() => setShowCropper(false)} className="clean-btn-cancel">
                                    {t('common.cancel') || 'ยกเลิก'}
                                </button>
                                <button type="button" onClick={handleCropAndUpload} className="clean-btn-save">
                                    <FiCheck size={14} />
                                    <span>{t('accountSettingsPage.profile.cropBtn') || 'ครอบตัดและบันทึก'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AccountSetting;
