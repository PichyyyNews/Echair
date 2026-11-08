import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import axios from 'axios';
import BeautifulDateTimePicker from './BeautifulDateTimePicker';
import '../CSS/CreateAssignmentModal.css';
import API_BASE_URL from '../config/api';

/* ─── SVG Icons ─── */
const SvgLink = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
);
const SvgUpload = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
);
const SvgImage = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
);
const SvgFile = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </svg>
);
const SvgX = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);

const isImageMimetype = (mimetype) => mimetype && mimetype.startsWith('image/');
const isImageUrl = (url) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);

const CreateAssignmentModal = ({ isOpen, onClose, classId, user, onAssignmentCreated, assignment }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'createAssignmentModal' });
    const [title, setTitle] = useState(assignment?.title || '');
    const [description, setDescription] = useState(assignment?.description || '');
    const [dueDate, setDueDate] = useState(
        assignment?.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : ''
    );
    const [points, setPoints] = useState(assignment?.points || 10);
    const [allowLateSubmission, setAllowLateSubmission] = useState(assignment?.allowLateSubmission || false);
    const [showScoreToStudents, setShowScoreToStudents] = useState(assignment?.showScoreToStudents ?? true);
    const [attachments, setAttachments] = useState(assignment?.attachments || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Attachment UI states
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkName, setLinkName] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);

    // Update state when assignment prop changes
    React.useEffect(() => {
        if (assignment) {
            setTitle(assignment.title || '');
            setDescription(assignment.description || '');
            setDueDate(assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : '');
            setPoints(assignment.points || 10);
            setAllowLateSubmission(assignment.allowLateSubmission || false);
            setShowScoreToStudents(assignment.showScoreToStudents ?? true);
            setAttachments(assignment.attachments || []);
        } else {
            setTitle('');
            setDescription('');
            setDueDate('');
            setPoints(10);
            setAllowLateSubmission(false);
            setShowScoreToStudents(true);
            setAttachments([]);
        }
        setShowLinkInput(false);
        setLinkUrl('');
        setLinkName('');
    }, [assignment, isOpen]);

    const handleAddLink = () => {
        if (!linkUrl.trim()) return;
        const name = linkName.trim() || linkUrl.trim();
        const type = isImageUrl(linkUrl.trim()) ? 'image' : 'link';
        setAttachments(prev => [...prev, { type, url: linkUrl.trim(), filename: name, mimetype: type === 'image' ? 'image/url' : 'text/url' }]);
        setLinkUrl('');
        setLinkName('');
        setShowLinkInput(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setUploadingFile(true);
            setError(null);
            const formData = new FormData();
            formData.append('file', file);
            const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'x-auth-token': (user?.token || localStorage.getItem('authToken') || '') }
            });
            const type = isImageMimetype(res.data.mimetype) ? 'image' : 'file';
            setAttachments(prev => [...prev, {
                type,
                url: res.data.url,
                filename: res.data.originalname,
                mimetype: res.data.mimetype
            }]);
        } catch (err) {
            console.error('Error uploading file:', err);
            setError(t('errorUpload'));
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleRemoveAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) { setError(t('errorTitle')); return; }
        setLoading(true);
        setError(null);
        try {
            const payload = {
                title, description,
                dueDate: dueDate || null,
                points,
                allowLateSubmission,
                showScoreToStudents,
                attachments
            };

            let res;
            if (assignment) {
                res = await axios.put(`${API_BASE_URL}/api/classwork/${classId}/${assignment._id}`, payload, {
                    headers: { 'x-auth-token': (user?.token || localStorage.getItem('authToken') || '') }
                });
            } else {
                res = await axios.post(`${API_BASE_URL}/api/classwork/${classId}`, payload, {
                    headers: { 'x-auth-token': (user?.token || localStorage.getItem('authToken') || '') }
                });
            }
            
            onAssignmentCreated(res.data);
            handleClose();
        } catch (err) {
            setError(err.response?.data?.msg || (assignment ? t('errorUpdate') : t('errorCreate')));
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!assignment) {
            setTitle(''); setDescription(''); setDueDate('');
            setPoints(10); setAllowLateSubmission(false); setShowScoreToStudents(true);
            setAttachments([]);
        }
        setError(null); setLoading(false);
        setShowLinkInput(false); setLinkUrl(''); setLinkName('');
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
            <div className="create-assignment-modal">
                <h2>{assignment ? t('editTitle') : t('createTitle')}</h2>
                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="assignment-form">
                    {/* Title */}
                    <div className="form-group">
                        <label>{t('labelTitle')}</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={t('placeholderTitle')}
                            required
                            autoFocus
                        />
                    </div>

                    {/* Instructions */}
                    <div className="form-group">
                        <label>{t('labelInstructions')}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={t('placeholderInstructions')}
                            rows="4"
                        />
                    </div>

                    {/* ═══ Attachments Section ═══ */}
                    <div className="cam-attachments-section">
                        <label className="cam-attachments-label">{t('labelAttachments')}</label>

                        {/* Attachment buttons */}
                        <div className="cam-attach-buttons">
                            <button type="button" className="cam-attach-btn" onClick={() => setShowLinkInput(!showLinkInput)}>
                                <SvgLink /> {t('btnAddLink')}
                            </button>
                            <label className={`cam-attach-btn ${uploadingFile ? 'cam-attach-btn--disabled' : ''}`}>
                                <SvgUpload /> {uploadingFile ? t('uploading') : t('btnUploadFile')}
                                <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingFile} />
                            </label>
                        </div>

                        {/* Link input popover (now rendered as a modal) */}
                        {showLinkInput && (
                            <div className="cam-link-modal-overlay" onClick={() => { setShowLinkInput(false); setLinkUrl(''); setLinkName(''); }}>
                                <div className="cam-link-modal" onClick={e => e.stopPropagation()}>
                                    <div className="cam-link-modal-header">
                                        <h3>{t('linkModal.title')}</h3>
                                        <button className="cam-link-modal-close" onClick={() => { setShowLinkInput(false); setLinkUrl(''); setLinkName(''); }}>
                                            <SvgX />
                                        </button>
                                    </div>
                                    <div className="cam-link-input-area">
                                        <input
                                            type="url"
                                            placeholder={t('linkModal.placeholderUrl')}
                                            value={linkUrl}
                                            onChange={e => setLinkUrl(e.target.value)}
                                            className="cam-link-url-input"
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            placeholder={t('linkModal.placeholderName')}
                                            value={linkName}
                                            onChange={e => setLinkName(e.target.value)}
                                            className="cam-link-name-input"
                                        />
                                        <div className="cam-link-actions">
                                            <button type="button" className="cam-link-cancel-btn" onClick={() => { setShowLinkInput(false); setLinkUrl(''); setLinkName(''); }}>
                                                {t('linkModal.cancel')}
                                            </button>
                                            <button type="button" className="cam-link-add-btn" onClick={handleAddLink} disabled={!linkUrl.trim()}>
                                                {t('linkModal.add')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Attachment list */}
                        {attachments.length > 0 && (
                            <div className="cam-attachment-list">
                                {attachments.map((att, i) => (
                                    <div key={i} className={`cam-attachment-item cam-attachment-item--${att.type}`}>
                                        {att.type === 'image' ? (
                                            <div className="cam-attachment-thumb">
                                                <img referrerPolicy="no-referrer" 
                                                    src={att.url.startsWith('http') ? att.url : `${API_BASE_URL}${att.url}`} 
                                                    alt={att.filename} 
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="cam-attachment-icon">
                                                {att.type === 'link' ? <SvgLink /> : <SvgFile />}
                                            </div>
                                        )}
                                        <span className="cam-attachment-name" title={att.filename}>{att.filename}</span>
                                        <button type="button" className="cam-attachment-remove" onClick={() => handleRemoveAttachment(i)} title="Remove">
                                            <SvgX />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Due date + points */}
                    <div className="form-row">
                        <div className="form-group half">
                            <label>{t('labelDueDate')}</label>
                            <BeautifulDateTimePicker 
                                value={dueDate}
                                onChange={setDueDate}
                                placeholder={t('placeholderDueDate')}
                            />
                        </div>
                        <div className="form-group half">
                            <label>{t('labelPoints')}</label>
                            <input
                                type="number"
                                value={points}
                                onChange={e => setPoints(Number(e.target.value))}
                                min="0"
                                max="1000"
                            />
                        </div>
                    </div>

                    {/* Toggle tiles */}
                    <div className="toggle-tiles">
                        <label className="toggle-tile">
                            <input
                                type="checkbox"
                                checked={allowLateSubmission}
                                onChange={e => setAllowLateSubmission(e.target.checked)}
                            />
                            <span className="toggle-switch" />
                            <span className="toggle-tile-text">{t('allowLate')}</span>
                        </label>
                        <label className="toggle-tile">
                            <input
                                type="checkbox"
                                checked={showScoreToStudents}
                                onChange={e => setShowScoreToStudents(e.target.checked)}
                            />
                            <span className="toggle-switch" />
                            <span className="toggle-tile-text">{t('showScore')}</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={handleClose} disabled={loading}>
                            {t('btnCancel')}
                        </button>
                        <button type="submit" className="primary-btn" disabled={loading}>
                            {loading ? (assignment ? t('updating') : t('assigning')) : (assignment ? t('btnSaveChanges') : t('btnAssign'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateAssignmentModal;

