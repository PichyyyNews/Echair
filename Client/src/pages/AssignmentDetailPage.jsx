import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Lottie from 'lottie-react';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import WorkPreviewModal from '../components/WorkPreviewModal';
import assignmentDetailWorkspaceAnimation from '../assets/assignment-detail-workspace.json';
import { getProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import '../CSS/AssignmentDetailPage.css';
import API_BASE_URL, { buildServerUrl } from '../config/api';

const CLASSWORK_ANIMATION_COLORS = {
    'color1': [0.4941, 0.7608, 0.5098, 1], // Light green token #7ec282
    'color2': [1, 1, 1, 1],
    'color3': [0.12, 0.16, 0.22, 1],
    'color4': [0.08, 0.11, 0.15, 1],
    'color5': [0.45, 0.52, 0.60, 1]
};

const createThemedAssignmentAnimation = (animationData) => {
    if (!animationData) return null;
    const themedAnimation = JSON.parse(JSON.stringify(animationData));

    const applyThemeToLayers = (layers = []) => {
        layers.forEach((layer) => {
            if (Array.isArray(layer?.ef)) {
                layer.ef.forEach((effect) => {
                    const normalizedKey = (effect?.nm || '').replace(/\s+/g, '').toLowerCase();
                    const nextColor = CLASSWORK_ANIMATION_COLORS[normalizedKey] || CLASSWORK_ANIMATION_COLORS[effect?.nm];
                    const control = effect?.ef?.[0];
                    if (nextColor && control?.v) {
                        control.v.k = nextColor;
                    }
                });
            }

            if (Array.isArray(layer?.shapes)) {
                const scanShapes = (shapes = []) => {
                    shapes.forEach(shape => {
                        if (shape.it && Array.isArray(shape.it)) {
                            scanShapes(shape.it);
                        } else if (shape.ty === 'fl' && shape.c?.k) {
                            const c = shape.c.k;
                            if (Array.isArray(c) && c.length >= 3 && Math.abs(c[0] - 1) < 0.05 && Math.abs(c[1] - 0.505) < 0.05) {
                                shape.c.k = [0.4941, 0.7608, 0.5098, 1];
                            }
                        }
                    });
                };
                scanShapes(layer.shapes);
            }

            if (Array.isArray(layer?.layers)) {
                applyThemeToLayers(layer.layers);
            }
        });
    };

    applyThemeToLayers(themedAnimation.layers);
    themedAnimation.assets?.forEach((asset) => {
        if (Array.isArray(asset?.layers)) {
            applyThemeToLayers(asset.layers);
        }
    });

    return themedAnimation;
};

const formatDateTime = (value, lang = 'en') => {
    if (!value) return lang === 'th' ? 'ไม่มีกำหนดส่ง' : 'No due date';
    const isTh = lang === 'th';
    return new Date(value).toLocaleString(isTh ? 'th-TH' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getSubmissionStatusLabel = (status = 'assigned', tr = (k, v) => v) => {
    switch (status) {
        case 'submitted':
            return tr('assignmentDetail.status.submitted', 'Turned In');
        case 'late':
            return tr('assignmentDetail.status.late', 'Late');
        case 'graded':
            return tr('assignmentDetail.status.graded', 'Graded');
        default:
            return tr('assignmentDetail.status.assigned', 'Assigned');
    }
};

const getSubmissionIdentity = (submission) => {
    const student = submission?.studentId;
    const name = student?.displayName || student?.email || student?.uid || 'Unknown';

    return {
        name,
        email: student?.email || ''
    };
};

const getSubmissionAvatar = (submission) => {
    const student = submission?.studentId;
    const { name } = getSubmissionIdentity(submission);
    const avatarSrc = getProfileImageSrc(student?.photoURL, student ? isGoogleUser(student) : false);

    return avatarSrc || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=ECF7F0&color=0F766E`;
};

const isClassCreatorUser = (classroom, assignment, user) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const currentUserId = String(user.id || user._id || user.uid || '').trim();
    if (!currentUserId) return false;

    if (classroom?.creator) {
        const creators = Array.isArray(classroom.creator) ? classroom.creator : [classroom.creator];
        const isMatch = creators.some(c => {
            if (!c) return false;
            if (typeof c === 'string') return c.trim() === currentUserId;
            const cid = String(c._id || c.id || c.uid || '').trim();
            return cid === currentUserId;
        });
        if (isMatch) return true;
    }

    if (assignment?.creator) {
        const ac = assignment.creator;
        if (typeof ac === 'string' && ac.trim() === currentUserId) return true;
        const acid = String(ac._id || ac.id || ac.uid || '').trim();
        if (acid === currentUserId) return true;
    }

    return false;
};

const cleanFilename = (rawName = '') => {
    if (!rawName || typeof rawName !== 'string') return 'File';
    let name = rawName;
    if (name.includes('%')) {
        try {
            name = decodeURIComponent(name);
        } catch {}
    }
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\u00C0-\u00FF]/.test(name)) {
        try {
            const bytes = new Uint8Array(name.length);
            let valid = true;
            for (let i = 0; i < name.length; i++) {
                const code = name.charCodeAt(i);
                if (code > 255) {
                    valid = false;
                    break;
                }
                bytes[i] = code;
            }
            if (valid) {
                const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
                if (decoded && !decoded.includes('\uFFFD')) {
                    name = decoded;
                }
            }
        } catch {}
        try {
            const decoded = decodeURIComponent(escape(name));
            if (decoded && !decoded.includes('\uFFFD')) {
                name = decoded;
            }
        } catch {}
    }
    return name;
};

const normalizeAttachmentForPreview = (att) => {
    if (!att) return null;
    const rawUrl = String(att.url || '').trim();
    const isLinkType = att.fileType === 'link' || att.type === 'link';
    let safeUrl = rawUrl;

    if (isLinkType) {
        if (!/^https?:\/\//i.test(safeUrl)) {
            safeUrl = safeUrl.startsWith('//') ? `https:${safeUrl}` : `https://${safeUrl}`;
        }
    } else if (safeUrl.startsWith('/uploads')) {
        safeUrl = buildServerUrl(safeUrl);
    } else if (!/^https?:\/\//i.test(safeUrl)) {
        safeUrl = buildServerUrl(safeUrl);
    }

    const nameCandidate = att.filename || att.originalname || (isLinkType ? safeUrl : 'Attachment');
    return {
        ...att,
        url: safeUrl,
        filename: cleanFilename(nameCandidate),
        fileType: isLinkType ? 'link' : (att.fileType || att.mimetype || 'file')
    };
};

/* ───────── SVG Icons ───────── */
const SvgClipboard = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
);
const SvgEdit = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
);
const SvgTrash = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
);
const SvgUsers = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
);
const SvgChat = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);
const SvgUpload = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
);
const SvgFile = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </svg>
);
const SvgSend = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
);
const SvgCheckCircle = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
);
const SvgClock = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
);
const SvgStar = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
);
const SvgEye = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
);
const SvgLink = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
);
const SvgFileText = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

const AssignmentDetailPage = ({ user, isSidebarOpen, toggleSidebar, handleSignOut }) => {
    const { classId, assignmentId } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const tr = useCallback((key, defaultValue, options = {}) => t(key, { defaultValue, ...options }), [t]);
    
    const [classroom, setClassroom] = useState(null);
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Teacher states
    const [submissions, setSubmissions] = useState([]);
    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [pointsAwarded, setPointsAwarded] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isTeacherAuthorized, setIsTeacherAuthorized] = useState(false);
    
    // Student states - Multi attachments
    const [attachmentsList, setAttachmentsList] = useState([]);
    const [attachmentUrl, setAttachmentUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [isResubmitting, setIsResubmitting] = useState(false);

    // In-app preview modal (Monaco / PDF / Image / Link)
    const [previewAttachment, setPreviewAttachment] = useState(null);

    // Comment states
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    const themedAssignmentAnimation = useMemo(
        () => createThemedAssignmentAnimation(assignmentDetailWorkspaceAnimation),
        []
    );

    const getAuthHeaders = useCallback(() => {
        const token = user?.token || localStorage.getItem('authToken') || '';
        return { 'x-auth-token': token };
    }, [user]);

    const isCreator = useMemo(() => {
        return isTeacherAuthorized || isClassCreatorUser(classroom, assignment, user);
    }, [isTeacherAuthorized, classroom, assignment, user]);

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            const headers = getAuthHeaders();
            const classRes = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}`, { headers });
            const fetchedClass = classRes.data;
            setClassroom(fetchedClass);

            const assignRes = await axios.get(`${API_BASE_URL}/api/classwork/${classId}/${assignmentId}`, { headers });
            const fetchedAssign = assignRes.data;
            setAssignment(fetchedAssign);

            const initialCreatorCheck = isClassCreatorUser(fetchedClass, fetchedAssign, user);

            // Always attempt to fetch submissions from server.
            // If the server returns 200 array, the user is authorized as teacher.
            let submissionsOk = false;
            try {
                const subsRes = await axios.get(`${API_BASE_URL}/api/classwork/${classId}/${assignmentId}/submissions`, { headers });
                if (Array.isArray(subsRes.data)) {
                    setSubmissions(subsRes.data);
                    submissionsOk = true;
                }
            } catch (subsErr) {
                // 403 Forbidden is expected for student accounts
                if (subsErr.response?.status !== 403) {
                    console.warn('Submissions fetch check:', subsErr.message);
                }
            }

            const effectiveIsCreator = initialCreatorCheck || submissionsOk;
            setIsTeacherAuthorized(effectiveIsCreator);

            if (!effectiveIsCreator && fetchedAssign.submission?.attachments?.length > 0) {
                setAttachmentsList(fetchedAssign.submission.attachments);
            } else if (!effectiveIsCreator && (!fetchedAssign.submission || !fetchedAssign.submission.attachments)) {
                setAttachmentsList([]);
            }

            try {
                const commentsRes = await axios.get(`${API_BASE_URL}/api/classwork/${classId}/${assignmentId}/comments`, { headers });
                setComments(commentsRes.data || []);
            } catch {
                setComments([]);
            }
            
            setLoading(false);
        } catch (err) {
            console.error('Error fetching assignment details:', err);
            setError('Failed to load assignment details.');
            setLoading(false);
        }
    }, [classId, assignmentId, user, getAuthHeaders]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    // Multi-file upload
    const handleMultiFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        try {
            setUploadingFile(true);
            setError(null);
            const headers = getAuthHeaders();

            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data', ...headers }
                });
                // Prioritize browser file.name which preserves genuine OS/UTF-8 international filenames
                const safeFilename = cleanFilename(file.name || res.data.originalname || res.data.filename);
                setAttachmentsList(prev => [
                    ...prev,
                    {
                        url: res.data.url,
                        filename: safeFilename,
                        fileType: res.data.mimetype || file.type || 'file'
                    }
                ]);
            }
            setUploadingFile(false);
        } catch (err) {
            console.error('Error uploading file(s):', err);
            setError('อัปโหลดไฟล์ไม่สำเร็จ (Failed to upload file)');
            setUploadingFile(false);
        } finally {
            e.target.value = '';
        }
    };

    const handleAddLink = () => {
        if (!attachmentUrl.trim()) return;
        let url = attachmentUrl.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        setAttachmentsList(prev => [
            ...prev,
            { url, filename: url, fileType: 'link' }
        ]);
        setAttachmentUrl('');
    };

    const handleRemoveAttachment = (index) => {
        setAttachmentsList(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || submittingComment) return;
        try {
            setSubmittingComment(true);
            const res = await axios.post(
                `${API_BASE_URL}/api/classwork/${classId}/${assignmentId}/comment`,
                { text: newComment.trim() },
                { headers: getAuthHeaders() }
            );
            setComments(res.data);
            setNewComment('');
        } catch (err) {
            console.error('Error adding comment:', err);
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await axios.delete(
                `${API_BASE_URL}/api/classwork/${classId}/${assignmentId}/comment/${commentId}`,
                { headers: getAuthHeaders() }
            );
            setComments(prev => prev.filter(c => c._id !== commentId));
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    };

    const handleTurnIn = async () => {
        try {
            setSubmitting(true);
            setError(null);
            const res = await axios.post(
                `${API_BASE_URL}/api/classwork/${classId}/${assignmentId}/submit`,
                { attachments: attachmentsList },
                { headers: getAuthHeaders() }
            );
            setAssignment(prev => ({ ...prev, submission: res.data }));
            setAttachmentsList(res.data?.attachments || attachmentsList);
            setIsResubmitting(false);
            setSubmitting(false);
        } catch (err) {
            console.error('Error submitting assignment:', err);
            setError(err.response?.data?.msg || 'ไม่สามารถส่งงานได้');
            setSubmitting(false);
        }
    };

    const handleGrade = async (submissionId) => {
        try {
            setSubmitting(true);
            const res = await axios.put(
                `${API_BASE_URL}/api/classwork/${classId}/${assignmentId}/grade/${submissionId}`,
                { pointsAwarded: Number(pointsAwarded) },
                { headers: getAuthHeaders() }
            );
            setSubmissions(prev => prev.map(s => (s._id === submissionId ? res.data : s)));
            setGradingSubmission(null);
            setSubmitting(false);
        } catch (err) {
            console.error('Error grading:', err);
            setError('Failed to save grade');
            setSubmitting(false);
        }
    };

    const handleDeleteAssignment = async () => {
        if (!window.confirm('Are you sure you want to delete this assignment?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/classwork/${classId}/${assignmentId}`, {
                headers: getAuthHeaders()
            });
            navigate(`/classroom/${classId}`);
        } catch (err) {
            console.error('Error deleting assignment:', err);
            setError('Failed to delete assignment');
        }
    };

    const handleAssignmentUpdate = (updatedAssignment) => {
        setAssignment(updatedAssignment);
        setIsEditModalOpen(false);
    };

    if (loading) return <Loader />;
    if (error && !assignment) return <div className="ad-error-page">{error}</div>;
    if (!assignment) return <div className="ad-error-page">Assignment not found</div>;

    const rosterCount = classroom?.students?.length || 0;
    const turnedIn = submissions.filter(s => s.status === 'submitted' || s.status === 'late').length;
    const graded = submissions.filter(s => s.status === 'graded').length;
    const pending = rosterCount - (turnedIn + graded);

    const isDue = assignment.dueDate && new Date(assignment.dueDate) < new Date();
    const dueLabel = formatDateTime(assignment.dueDate);
    const studentSubmissionStatus = assignment.submission?.status || 'assigned';

    const heroKicker = isCreator ? 'Review and grade work' : 'Submit and track your work';
    const heroDescription = isCreator
        ? 'Keep directions, student submissions, scores, and class feedback in one organized workspace.'
        : 'Read the brief, attach your work, and keep your submission status in one organized workspace.';
    const heroNote = isCreator
        ? `${graded} graded · ${pending} pending review`
        : assignment.submission?.status === 'graded' && assignment.showScoreToStudents
            ? `Score posted: ${assignment.submission.pointsAwarded ?? 0} / ${assignment.points}`
            : assignment.submission
                ? 'Your latest submission is saved here and ready for review.'
                : 'Add a link or file when you are ready to turn in.';

    return (
        <>
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                handleSignOut={handleSignOut}
                classroom={classroom}
                isAssignmentDetailPage={true}
                classId={classId}
                onClassroomBackClick={() => navigate(`/classroom/${classId}/stream`, { state: { activeTab: 'classwork' } })}
            />

            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div className="class-detail-container">
                    <div className={`ad-container ${isCreator ? 'is-creator' : 'is-student'}`}>
                        {/* ═══ BENTO GRID ═══ */}
                        <div className={`ad-bento ${isCreator ? 'is-creator' : 'is-student'}`}>
                            {/* ── Tile: Header ── */}
                            <div className="ad-tile ad-header-tile" style={{ '--delay': '0' }}>
                                <div className="ad-header-top">
                                    <div className="ad-header-copy">
                                        <span className="ad-header-kicker">{heroKicker}</span>
                                        <div className="ad-header-title-row">
                                            <div className="ad-header-info">
                                                <h1>{assignment.title}</h1>
                                                <p className="ad-header-description">{heroDescription}</p>
                                            </div>
                                        </div>
                                        <div className="ad-header-meta">
                                            <span className="ad-meta-chip points"><SvgStar /> {assignment.points} {tr('assignmentDetail.pointsUnit', 'pts')}</span>
                                            <span className={`ad-meta-chip due ${isDue ? 'overdue' : ''}`}>
                                                <SvgClock /> {assignment.dueDate ? `Due ${dueLabel}` : tr('assignmentDetail.noDueDate', 'No due date')}
                                            </span>
                                            <span className={`ad-meta-chip status ${isCreator ? (pending > 0 ? 'submitted' : 'graded') : studentSubmissionStatus}`}>
                                                {isCreator ? <SvgUsers /> : <SvgCheckCircle />}
                                                {isCreator ? `${studentSubmissions.length} ${tr('assignmentDetail.submissions', 'submissions')}` : getSubmissionStatusLabel(studentSubmissionStatus, tr)}
                                            </span>
                                            {assignment.allowLateSubmission && (
                                                <span className="ad-meta-chip late-ok">Late OK</span>
                                            )}
                                            {isCreator && (
                                                <>
                                                    <button className="ad-action-btn edit" onClick={() => setIsEditModalOpen(true)} title="Edit"><SvgEdit /></button>
                                                    <button className="ad-action-btn delete" onClick={handleDeleteAssignment} title="Delete"><SvgTrash /></button>
                                                </>
                                            )}
                                        </div>
                                        <p className="ad-header-note">{heroNote}</p>
                                    </div>
                                    <div className="ad-header-side">
                                        <div className="ad-header-art" aria-hidden="true">
                                            <div className="ad-header-art-panel">
                                                <Lottie
                                                    animationData={themedAssignmentAnimation}
                                                    loop
                                                    autoplay
                                                    className="ad-header-lottie"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Tile: Instructions ── */}
                            <div className="ad-tile ad-instructions-tile" style={{ '--delay': '1' }}>
                                <div className="ad-tile-header">
                                    <SvgClipboard />
                                    <h3>{tr('assignmentDetail.instructionsTitle', 'Instructions / Details')}</h3>
                                </div>
                                {assignment.description ? (
                                    <p className="ad-instructions-text">{assignment.description}</p>
                                ) : (
                                    <div className="ad-instructions-empty-state">
                                        <div className="ad-empty-icon-wrap">
                                            <SvgFileText />
                                        </div>
                                        <div className="ad-empty-title">{tr('assignmentDetail.empty.title', 'No written instructions provided for this assignment')}</div>
                                        <p className="ad-empty-desc">
                                            {tr('assignmentDetail.empty.desc', 'The instructor may have explained the assignment in class. You can review details and submit your work through "Your Work" on the right.')}
                                        </p>
                                        <div className="ad-empty-specs-grid">
                                            <div className="ad-empty-spec-card">
                                                <span className="ad-spec-label">{tr('assignmentDetail.empty.pointsLabel', 'Total Points')}</span>
                                                <span className="ad-spec-val">{assignment.points ?? 0} {tr('assignmentDetail.pointsUnit', 'pts')}</span>
                                            </div>
                                            <div className="ad-empty-spec-card">
                                                <span className="ad-spec-label">{tr('assignmentDetail.empty.dueLabel', 'Due Date')}</span>
                                                <span className="ad-spec-val">{formatDateTime(assignment.dueDate, i18n.language)}</span>
                                            </div>
                                            <div className="ad-empty-spec-card">
                                                <span className="ad-spec-label">{tr('assignmentDetail.empty.submissionPolicyLabel', 'Submission Policy')}</span>
                                                <span className="ad-spec-val">
                                                    {assignment.allowLateSubmission ? tr('assignmentDetail.lateAllowed', 'Late allowed') : tr('assignmentDetail.onTimeOnly', 'On time only')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ad-empty-tip">
                                            <span>💡 {tr('assignmentDetail.empty.tip', 'Please double-check your files or links before turning in your work.')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── Attachments Display ── */}
                                {assignment.attachments && assignment.attachments.length > 0 && (
                                    <div className="ad-attachments-display">
                                        <div className="ad-attachments-title">
                                            {tr('assignmentDetail.teacherAttachments', 'Teacher Attachments ({{count}})', { count: assignment.attachments.length })}
                                        </div>
                                        <div className="ad-attachments-grid">
                                            {assignment.attachments.map((att, i) => {
                                                const normAtt = normalizeAttachmentForPreview(att);
                                                return (
                                                    <div key={i} className="ad-attach-card">
                                                        <div className={`ad-attach-icon-box ad-attach-icon--${normAtt.fileType === 'link' ? 'link' : 'file'}`}>
                                                            {normAtt.fileType === 'link' ? <SvgLink /> : <SvgFile />}
                                                        </div>
                                                        <span className="ad-attach-label" title={normAtt.filename}>{normAtt.filename}</span>
                                                        <button
                                                            type="button"
                                                            className="ad-preview-btn"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setPreviewAttachment(normAtt);
                                                            }}
                                                            title={tr('assignmentDetail.preview', 'Preview')}
                                                        >
                                                            <SvgEye /> {tr('assignmentDetail.preview', 'Preview')}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Tile: Student Work (Student View) ── */}
                            {!isCreator && (
                                <div className="ad-tile ad-work-tile" style={{ '--delay': '2' }}>
                                    <div className="ad-tile-header">
                                        <SvgUpload />
                                        <h3>{tr('assignmentDetail.yourWorkTitle', 'Your Work')}</h3>
                                        <span className={`ad-status-badge ${studentSubmissionStatus}`}>
                                            {getSubmissionStatusLabel(studentSubmissionStatus, tr)}
                                        </span>
                                    </div>

                                    {assignment.submission?.status === 'graded' && assignment.showScoreToStudents && (
                                        <div className="ad-score-display">
                                            <span className="ad-score-val">{assignment.submission.pointsAwarded}</span>
                                            <span className="ad-score-total">/ {assignment.points}</span>
                                        </div>
                                    )}

                                    {(!assignment.submission || assignment.submission?.status !== 'graded') ? (
                                        <>
                                            {/* Already submitted & NOT in resubmit mode */}
                                            {assignment.submission && !isResubmitting ? (
                                                <>
                                                    {assignment.submission.attachments?.length > 0 && (
                                                        <div className="ad-attachment-area">
                                                            {assignment.submission.attachments.map((att, i) => {
                                                                const normAtt = normalizeAttachmentForPreview(att);
                                                                return (
                                                                    <div key={i} className="ad-uploaded-file">
                                                                        <div className="ad-file-info">
                                                                            {normAtt.fileType === 'link' ? <SvgLink /> : <SvgFile />}
                                                                            <span className="ad-file-name" title={normAtt.filename}>{normAtt.filename}</span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            className="ad-preview-btn"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setPreviewAttachment(normAtt);
                                                                            }}
                                                                            title={tr('assignmentDetail.preview', 'Preview')}
                                                                        >
                                                                            <SvgEye /> {tr('assignmentDetail.preview', 'Preview')}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="ad-turnin-btn resubmit"
                                                        onClick={() => {
                                                            setIsResubmitting(true);
                                                            setAttachmentsList(assignment.submission.attachments || []);
                                                        }}
                                                    >
                                                        <SvgCheckCircle /> {tr('assignmentDetail.resubmit', 'Resubmit work')}
                                                    </button>
                                                </>
                                            ) : (
                                                /* Adding files & submitting */
                                                <>
                                                    <div className="ad-attachment-area">
                                                        {/* Link input */}
                                                        <div className="ad-link-input-row">
                                                            <input
                                                                type="url"
                                                                placeholder={tr('assignmentDetail.linkPlaceholder', 'Paste link (https://...)')}
                                                                value={attachmentUrl}
                                                                onChange={(e) => setAttachmentUrl(e.target.value)}
                                                                className="ad-url-input"
                                                                disabled={uploadingFile}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="ad-add-link-btn"
                                                                onClick={handleAddLink}
                                                                disabled={!attachmentUrl.trim()}
                                                            >
                                                                {tr('assignmentDetail.addLink', 'Add link')}
                                                            </button>
                                                        </div>

                                                        <div className="ad-separator">{tr('assignmentDetail.or', 'or')}</div>

                                                        {/* Upload Button */}
                                                        <label className={`ad-upload-btn ${uploadingFile ? 'disabled' : ''}`}>
                                                            {uploadingFile ? tr('assignmentDetail.uploading', 'Uploading...') : (<><SvgUpload /> {tr('assignmentDetail.attachFiles', 'Attach files (select multiple files)')}</>)}
                                                            <input
                                                                type="file"
                                                                multiple
                                                                style={{ display: 'none' }}
                                                                onChange={handleMultiFileUpload}
                                                                disabled={uploadingFile}
                                                            />
                                                        </label>

                                                        {/* Attached items list */}
                                                        {attachmentsList.length > 0 && (
                                                            <div className="ad-uploaded-list">
                                                                {attachmentsList.map((att, i) => {
                                                                    const normAtt = normalizeAttachmentForPreview(att);
                                                                    return (
                                                                        <div key={i} className="ad-uploaded-file">
                                                                            <div className="ad-file-info">
                                                                                {normAtt.fileType === 'link' ? <SvgLink /> : <SvgFile />}
                                                                                <span className="ad-file-name" title={normAtt.filename}>{normAtt.filename}</span>
                                                                            </div>
                                                                            <div className="ad-uploaded-actions">
                                                                                <button
                                                                                    type="button"
                                                                                    className="ad-preview-btn"
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        setPreviewAttachment(normAtt);
                                                                                    }}
                                                                                    title={tr('assignmentDetail.preview', 'Preview')}
                                                                                >
                                                                                    <SvgEye /> {tr('assignmentDetail.preview', 'Preview')}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="ad-file-remove"
                                                                                    onClick={() => handleRemoveAttachment(i)}
                                                                                    title="ลบ"
                                                                                >
                                                                                    &times;
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {error && <div className="ad-inline-error">{error}</div>}

                                                    <div className="ad-submit-btns-row">
                                                        <button
                                                            type="button"
                                                            className={`ad-turnin-btn ${isResubmitting ? 'resubmit' : ''}`}
                                                            onClick={handleTurnIn}
                                                            disabled={submitting || uploadingFile || attachmentsList.length === 0}
                                                        >
                                                            <SvgCheckCircle />
                                                            {submitting ? tr('assignmentDetail.turningIn', 'Turning in...') : (isResubmitting ? tr('assignmentDetail.confirmResubmit', 'Confirm new submission') : tr('assignmentDetail.turnIn', 'Turn In'))}
                                                        </button>
                                                        {isResubmitting && (
                                                            <button
                                                                type="button"
                                                                className="ad-turnin-btn ghost"
                                                                onClick={() => {
                                                                    setIsResubmitting(false);
                                                                    setAttachmentsList(assignment.submission?.attachments || []);
                                                                }}
                                                            >
                                                                ยกเลิก
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="ad-graded-msg">{tr('assignmentDetail.gradedNotice', 'This work has been graded and cannot be resubmitted.')}</div>
                                    )}
                                </div>
                            )}

                            {/* ── Tile: Teacher Stats (Teacher View) ── */}
                            {isCreator && (
                                <div className="ad-tile ad-teacher-stats-tile" style={{ '--delay': '2' }}>
                                    <div className="ad-tile-header">
                                        <SvgUsers />
                                        <h3>Submission Overview</h3>
                                    </div>
                                    <div className="ad-stats-mini-grid">
                                        <div className="ad-stat-card turned-in">
                                            <span className="ad-stat-num">{turnedIn}</span>
                                            <span className="ad-stat-label">{tr('assignmentDetail.turnedIn', 'Turned In')}</span>
                                        </div>
                                        <div className="ad-stat-card graded-stat">
                                            <span className="ad-stat-num">{graded}</span>
                                            <span className="ad-stat-label">{tr('assignmentDetail.graded', 'Graded')}</span>
                                        </div>
                                        <div className="ad-stat-card not-sub">
                                            <span className="ad-stat-num">{pending}</span>
                                            <span className="ad-stat-label">{tr('assignmentDetail.pending', 'Pending')}</span>
                                        </div>
                                    </div>
                                    {submissions.length > 0 && (
                                        <div className="ad-progress-row">
                                            <div className="ad-progress-bar-lg">
                                                <div className="ad-progress-fill-lg graded-fill" style={{ width: `${rosterCount > 0 ? (graded / rosterCount) * 100 : 0}%` }}></div>
                                                <div className="ad-progress-fill-lg turned-fill" style={{ width: `${rosterCount > 0 ? (turnedIn / rosterCount) * 100 : 0}%` }}></div>
                                            </div>
                                            <span className="ad-progress-label">{graded + turnedIn}/{rosterCount} {tr('assignmentDetail.complete', 'complete')}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Tile: Student Submissions (Teacher View) ── */}
                            {isCreator && (
                                <div className="ad-tile ad-submissions-tile" style={{ '--delay': '3' }}>
                                    <div className="ad-tile-header">
                                        <SvgUsers />
                                        <h3>Student Submissions ({submissions.length})</h3>
                                    </div>
                                    {submissions.length === 0 ? (
                                        <div className="ad-no-submissions">No submissions yet.</div>
                                    ) : (
                                        <div className="ad-submissions-grid">
                                            {submissions.map(sub => {
                                                const submissionIdentity = getSubmissionIdentity(sub);
                                                const submissionAvatar = getSubmissionAvatar(sub);

                                                return (
                                                    <div key={sub._id} className="ad-sub-card">
                                                        <div className="ad-sub-top">
                                                            <div className="ad-sub-student">
                                                                <img
                                                                    referrerPolicy="no-referrer"
                                                                    className="ad-sub-avatar"
                                                                    src={submissionAvatar}
                                                                    alt=""
                                                                    onError={e => { e.target.src = submissionAvatar; }}
                                                                />
                                                                <div className="ad-sub-student-copy">
                                                                    <span className="ad-sub-name">{submissionIdentity.name}</span>
                                                                    <span className="ad-sub-meta">{submissionIdentity.email || formatDateTime(sub.submittedAt, i18n.language)}</span>
                                                                </div>
                                                            </div>
                                                            <span className={`ad-sub-pill ${sub.status}`}>{getSubmissionStatusLabel(sub.status, tr)}</span>
                                                        </div>

                                                        {/* Multiple attachments display in teacher submission card */}
                                                        {sub.attachments && sub.attachments.length > 0 ? (
                                                            <div className="ad-sub-attachments-list">
                                                                {sub.attachments.map((att, idx) => {
                                                                    const normAtt = normalizeAttachmentForPreview(att);
                                                                    return (
                                                                        <div key={idx} className="ad-sub-attachment-item">
                                                                            <div className="ad-sub-attachment-info">
                                                                                {normAtt.fileType === 'link' ? <SvgLink /> : <SvgFile />}
                                                                                <span className="ad-sub-file-title" title={normAtt.filename}>{normAtt.filename || 'Attachment'}</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                className="ad-preview-btn ad-preview-btn--small"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    setPreviewAttachment(normAtt);
                                                                                }}
                                                                                title={tr('assignmentDetail.preview', 'Preview')}
                                                                            >
                                                                                <SvgEye /> {tr('assignmentDetail.preview', 'Preview')}
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="ad-sub-no-file">No attachments</div>
                                                        )}

                                                        <div className="ad-sub-grade-section">
                                                            {gradingSubmission === sub._id ? (
                                                                <div className="ad-grade-input-area">
                                                                    <input
                                                                        type="number"
                                                                        value={pointsAwarded}
                                                                        onChange={(e) => setPointsAwarded(e.target.value)}
                                                                        placeholder={`/ ${assignment.points}`}
                                                                        max={assignment.points}
                                                                        min="0"
                                                                        className="ad-grade-input"
                                                                    />
                                                                    <div className="ad-grade-btns">
                                                                        <button onClick={() => handleGrade(sub._id)} disabled={submitting} className="ad-btn-save">Save</button>
                                                                        <button onClick={() => setGradingSubmission(null)} className="ad-btn-cancel">Cancel</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="ad-grade-display">
                                                                    <div className="ad-current-grade">
                                                                        {sub.status === 'graded' ? (
                                                                            <span><span className="ad-score-awarded">{sub.pointsAwarded}</span> / {assignment.points}</span>
                                                                        ) : (
                                                                            <span className="ad-not-graded">Not graded</span>
                                                                        )}
                                                                    </div>
                                                                    <button className="ad-btn-grade" onClick={() => {
                                                                        setGradingSubmission(sub._id);
                                                                        setPointsAwarded(sub.pointsAwarded !== undefined ? sub.pointsAwarded : '');
                                                                    }}>
                                                                        {sub.status === 'graded' ? 'Regrade' : 'Grade'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Tile: Comments ── */}
                            <div className="ad-tile ad-comments-tile" style={{ '--delay': '4' }}>
                                <div className="ad-tile-header">
                                    <SvgChat />
                                    <h3>{tr('assignmentDetail.commentsTitle', 'Class Comments ({{count}})', { count: comments.length })}</h3>
                                </div>

                                {comments.length > 0 && (
                                    <div className="ad-comments-list">
                                        {comments.map(comment => {
                                            const cImg = getProfileImageSrc(comment.author?.photoURL, comment.author ? isGoogleUser(comment.author) : false);
                                            const isOwn = comment.author?._id === user?.id || comment.author?.id === user?.id;
                                            const canDel = isCreator || isOwn;
                                            return (
                                                <div key={comment._id} className="ad-comment-item">
                                                    <img referrerPolicy="no-referrer" className="ad-comment-avatar" src={cImg || 'https://ui-avatars.com/api/?name=U'} alt="" onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=U'; }} />
                                                    <div className="ad-comment-body">
                                                        <div className="ad-comment-meta">
                                                            <span className="ad-comment-author">{comment.author?.displayName || comment.author?.email || 'Unknown'}</span>
                                                            <span className="ad-comment-time">{formatDateTime(comment.createdAt, i18n.language)}</span>
                                                        </div>
                                                        <p className="ad-comment-text">{comment.text}</p>
                                                    </div>
                                                    {canDel && (
                                                        <button className="ad-comment-del" onClick={() => handleDeleteComment(comment._id)} title="Delete">
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <form className="ad-comment-form" onSubmit={handleAddComment}>
                                    <img referrerPolicy="no-referrer" className="ad-comment-avatar" src={getProfileImageSrc(user?.photoURL, isGoogleUser(user)) || 'https://ui-avatars.com/api/?name=Me'} alt="" onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=Me'; }} />
                                    <div className="ad-comment-input-row">
                                        <input
                                            type="text"
                                            className="ad-comment-input"
                                            placeholder={tr('assignmentDetail.addCommentPlaceholder', 'Add a class comment...')}
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            disabled={submittingComment}
                                        />
                                        <button type="submit" className={`ad-comment-send ${newComment.trim() ? 'active' : ''}`} disabled={!newComment.trim() || submittingComment}>
                                            <SvgSend />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* In-app file / code preview modal with Monaco Editor */}
            <WorkPreviewModal
                isOpen={!!previewAttachment}
                onClose={() => setPreviewAttachment(null)}
                attachment={previewAttachment}
            />

            {isCreator && (
                <CreateAssignmentModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    classId={classId}
                    user={user}
                    onAssignmentCreated={handleAssignmentUpdate}
                    assignment={assignment}
                />
            )}
        </>
    );
};

export default AssignmentDetailPage;
