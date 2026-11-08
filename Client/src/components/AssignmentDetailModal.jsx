import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import WorkPreviewModal from './WorkPreviewModal';
import '../CSS/AssignmentDetailModal.css';
import API_BASE_URL, { buildServerUrl } from '../config/api';

const SvgFile = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </svg>
);

const SvgLink = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
);

const SvgEye = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
);

const SvgUpload = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
);

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

const AssignmentDetailModal = ({ isOpen, onClose, assignment, classId, user, isCreator, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [submissions, setSubmissions] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [pointsAwarded, setPointsAwarded] = useState('');

    // Student multi-file state
    const [attachmentsList, setAttachmentsList] = useState([]);
    const [linkInputUrl, setLinkInputUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    // In-app preview modal (Monaco / PDF / Image)
    const [previewAttachment, setPreviewAttachment] = useState(null);

    const getAuthHeaders = useCallback(() => {
        const token = user?.token || localStorage.getItem('authToken') || '';
        return { 'x-auth-token': token };
    }, [user]);

    useEffect(() => {
        if (isOpen && isCreator && assignment?._id) {
            fetchSubmissions();
        }
        if (isOpen && !isCreator) {
            setAttachmentsList(assignment?.submission?.attachments || []);
        }
    }, [isOpen, isCreator, assignment]);

    const fetchSubmissions = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/api/classwork/${classId}/${assignment._id}/submissions`, {
                headers: getAuthHeaders()
            });
            setSubmissions(res.data || []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching submissions:', err);
            setError('Failed to load submissions');
            setLoading(false);
        }
    };

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
            console.error('Error uploading file:', err);
            setError('อัปโหลดไฟล์ไม่สำเร็จ');
            setUploadingFile(false);
        } finally {
            e.target.value = '';
        }
    };

    const handleAddLink = () => {
        if (!linkInputUrl.trim()) return;
        let url = linkInputUrl.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        setAttachmentsList(prev => [
            ...prev,
            { url, filename: url, fileType: 'link' }
        ]);
        setLinkInputUrl('');
        setShowLinkInput(false);
    };

    const handleRemoveAttachment = (idx) => {
        setAttachmentsList(prev => prev.filter((_, i) => i !== idx));
    };

    const handleTurnIn = async () => {
        try {
            setSubmitting(true);
            setError(null);
            
            const res = await axios.post(
                `${API_BASE_URL}/api/classwork/${classId}/${assignment._id}/submit`, 
                { attachments: attachmentsList }, 
                { headers: getAuthHeaders() }
            );

            if (onUpdate) {
                onUpdate({
                    ...assignment,
                    submission: res.data
                });
            }
            
            setSubmitting(false);
            onClose();
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
                `${API_BASE_URL}/api/classwork/${classId}/${assignment._id}/grade/${submissionId}`, 
                { pointsAwarded: Number(pointsAwarded) }, 
                { headers: getAuthHeaders() }
            );
            
            setSubmissions(prev => prev.map(s => s._id === submissionId ? res.data : s));
            setGradingSubmission(null);
            setSubmitting(false);
        } catch (err) {
            console.error('Error grading:', err);
            setError('Failed to save grade');
            setSubmitting(false);
        }
    };

    if (!isOpen || !assignment) return null;

    const isSubmitted = assignment.submission && (assignment.submission.status === 'submitted' || assignment.submission.status === 'late' || assignment.submission.status === 'graded');

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content assignment-detail-modal" onClick={e => e.stopPropagation()}>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                    
                    <div className="assignment-detail-header">
                        <h2>{assignment.title}</h2>
                        <div className="assignment-meta">
                            <span className="points">{assignment.points} คะแนน</span>
                            {assignment.dueDate && (
                                <span className="due-date">
                                    กำหนดส่ง: {new Date(assignment.dueDate).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="assignment-description">
                        {assignment.description ? (
                            <p>{assignment.description}</p>
                        ) : (
                            <p className="no-description">ไม่มีคำชี้แจงเพิ่มเติม</p>
                        )}
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    {isCreator ? (
                        <div className="submissions-section">
                            <h3>งานที่นักเรียนส่ง ({submissions.length})</h3>
                            {loading ? (
                                <p>กำลังโหลดรายการส่งงาน...</p>
                            ) : submissions.length === 0 ? (
                                <p className="no-submissions">ยังไม่มีนักเรียนส่งงาน</p>
                            ) : (
                                <div className="submissions-list">
                                    {submissions.map(sub => (
                                        <div key={sub._id} className="submission-card">
                                            <div className="submission-card-header">
                                                <div className="student-info">
                                                    <strong>{sub.studentId?.displayName || sub.studentId?.email || 'นักเรียน'}</strong>
                                                </div>
                                                <div className="submission-status-info">
                                                    <span className={`status-badge ${sub.status}`}>{sub.status}</span>
                                                </div>
                                            </div>

                                            {/* Submissions attachments preview */}
                                            {sub.attachments && sub.attachments.length > 0 && (
                                                <div className="adm-attachments-list">
                                                    {sub.attachments.map((att, idx) => {
                                                        const isLink = att.fileType === 'link' || att.type === 'link';
                                                        let safeUrl = String(att.url || '').trim();
                                                        if (isLink && !/^https?:\/\//i.test(safeUrl)) {
                                                            safeUrl = `https://${safeUrl}`;
                                                        } else if (!isLink && !safeUrl.startsWith('http')) {
                                                            safeUrl = buildServerUrl(safeUrl);
                                                        }
                                                        const safeName = cleanFilename(att.filename) || 'ไฟล์แนบ';
                                                        const normAtt = { ...att, url: safeUrl, filename: safeName, fileType: isLink ? 'link' : (att.fileType || 'file') };
                                                        return (
                                                            <div key={idx} className="adm-attachment-item">
                                                                <div className="adm-attachment-name">
                                                                    {isLink ? <SvgLink /> : <SvgFile />}
                                                                    <span>{safeName}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="adm-preview-btn"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setPreviewAttachment(normAtt);
                                                                    }}
                                                                >
                                                                    <SvgEye /> ดูงาน
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="grading-area">
                                                {gradingSubmission === sub._id ? (
                                                    <div className="grade-input-group">
                                                        <input 
                                                            type="number" 
                                                            value={pointsAwarded}
                                                            onChange={(e) => setPointsAwarded(e.target.value)}
                                                            placeholder={`/ ${assignment.points}`}
                                                            max={assignment.points}
                                                            min="0"
                                                        />
                                                        <button 
                                                            onClick={() => handleGrade(sub._id)}
                                                            disabled={submitting}
                                                            className="save-grade-btn"
                                                        >
                                                            บันทึก
                                                        </button>
                                                        <button 
                                                            onClick={() => setGradingSubmission(null)}
                                                            className="cancel-grade-btn"
                                                        >
                                                            ยกเลิก
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="grade-display">
                                                        {sub.status === 'graded' ? (
                                                            <span>คะแนน: <strong>{sub.pointsAwarded}</strong> / {assignment.points}</span>
                                                        ) : (
                                                            <span>ยังไม่ได้ตรวจ</span>
                                                        )}
                                                        <button 
                                                            className="grade-btn" 
                                                            onClick={() => {
                                                                setGradingSubmission(sub._id);
                                                                setPointsAwarded(sub.pointsAwarded !== undefined ? sub.pointsAwarded : '');
                                                            }}
                                                        >
                                                            {sub.status === 'graded' ? 'แก้คะแนน' : 'ให้คะแนน'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="student-work-section">
                            <div className="work-panel">
                                <div className="work-panel-header">
                                    <h3>งานของคุณ</h3>
                                    <span className={`status-text ${assignment.submission ? assignment.submission.status : 'assigned'}`}>
                                        {assignment.submission ? assignment.submission.status : 'ยังไม่ส่ง'}
                                    </span>
                                </div>
                                
                                {assignment.submission?.status === 'graded' && assignment.showScoreToStudents && (
                                    <div className="score-display">
                                        คะแนน: {assignment.submission.pointsAwarded} / {assignment.points}
                                    </div>
                                )}

                                {(!assignment.submission || assignment.submission?.status !== 'graded') ? (
                                    <div className="adm-upload-section">
                                        {/* Multi-file & Link buttons */}
                                        <div className="adm-actions-row">
                                            <label className={`adm-pill-btn ${uploadingFile ? 'disabled' : ''}`}>
                                                <SvgUpload />
                                                {uploadingFile ? 'กำลังอัปโหลด...' : 'แนบไฟล์ (หลายไฟล์)'}
                                                <input
                                                    type="file"
                                                    multiple
                                                    style={{ display: 'none' }}
                                                    onChange={handleMultiFileUpload}
                                                    disabled={uploadingFile}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                className="adm-pill-btn"
                                                onClick={() => setShowLinkInput(!showLinkInput)}
                                            >
                                                <SvgLink /> แนบลิงก์
                                            </button>
                                        </div>

                                        {showLinkInput && (
                                            <div className="adm-link-row">
                                                <input
                                                    type="url"
                                                    placeholder="วางลิงก์ (https://...)"
                                                    value={linkInputUrl}
                                                    onChange={e => setLinkInputUrl(e.target.value)}
                                                    className="adm-link-input"
                                                />
                                                <button
                                                    type="button"
                                                    className="adm-link-add-btn"
                                                    onClick={handleAddLink}
                                                    disabled={!linkInputUrl.trim()}
                                                >
                                                    เพิ่ม
                                                </button>
                                            </div>
                                        )}

                                        {/* Attachment list */}
                                        {attachmentsList.length > 0 && (
                                            <div className="adm-files-list">
                                                {attachmentsList.map((att, idx) => {
                                                    const isLink = att.fileType === 'link' || att.type === 'link';
                                                    let safeUrl = String(att.url || '').trim();
                                                    if (isLink && !/^https?:\/\//i.test(safeUrl)) {
                                                        safeUrl = `https://${safeUrl}`;
                                                    } else if (!isLink && !safeUrl.startsWith('http')) {
                                                        safeUrl = buildServerUrl(safeUrl);
                                                    }
                                                    const safeName = cleanFilename(att.filename) || 'Attachment';
                                                    const normAtt = { ...att, url: safeUrl, filename: safeName, fileType: isLink ? 'link' : (att.fileType || 'file') };
                                                    return (
                                                        <div key={idx} className="adm-file-chip">
                                                            <div className="adm-file-title">
                                                                {isLink ? <SvgLink /> : <SvgFile />}
                                                                <span title={safeName}>{safeName}</span>
                                                            </div>
                                                            <div className="adm-file-actions">
                                                                <button
                                                                    type="button"
                                                                    className="adm-preview-btn"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setPreviewAttachment(normAtt);
                                                                    }}
                                                                >
                                                                    <SvgEye /> ดูตัวอย่าง
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="adm-file-del"
                                                                    onClick={() => handleRemoveAttachment(idx)}
                                                                >
                                                                    &times;
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <button 
                                            className="turn-in-btn" 
                                            onClick={handleTurnIn}
                                            disabled={submitting || uploadingFile || attachmentsList.length === 0}
                                        >
                                            {submitting ? 'กำลังส่งงาน...' : (isSubmitted ? 'ยืนยันส่งงานใหม่' : 'ส่งงาน (Turn In)')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="graded-message">
                                        งานนี้ได้รับการตรวจและให้คะแนนแล้ว ไม่สามารถส่งซ้ำได้
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* In-app Preview Modal with Monaco */}
            <WorkPreviewModal
                isOpen={!!previewAttachment}
                onClose={() => setPreviewAttachment(null)}
                attachment={previewAttachment}
            />
        </>
    );
};

export default AssignmentDetailModal;
