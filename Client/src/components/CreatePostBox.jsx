// src/components/CreatePostBox.jsx

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    FaBullhorn,
    FaImage,
    FaLink,
    FaPaperclip,
    FaTimes
} from 'react-icons/fa';
import { getProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import API_BASE_URL, { buildServerUrl } from '../config/api';

const resolveAttachmentUrl = (url) => {
    if (!url) return '';
    return buildServerUrl(url);
};

const CreatePostBox = ({ classId, user, onPostCreated, classroomName, accentColor = '#10b981' }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'createPostBox' });
    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });

    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [linkInput, setLinkInput] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);

    const currentUserImage = getProfileImageSrc(user?.photoURL, user ? isGoogleUser(user) : false);
    const canSubmit = Boolean(title.trim() || content.trim() || attachments.length);

    const resetComposer = () => {
        setTitle('');
        setContent('');
        setAttachments([]);
        setShowLinkInput(false);
        setLinkInput('');
        setIsExpanded(false);
    };

    const handleAddLink = () => {
        if (!linkInput.trim()) return;
        setAttachments((prev) => [
            ...prev,
            { type: 'link', url: linkInput.trim(), name: linkInput.trim() }
        ]);
        setLinkInput('');
        setShowLinkInput(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            Swal.fire(tr('swal.fileTooLarge', 'File too large'), tr('swal.fileTooLargeDesc', 'Please upload a file smaller than 20 MB.'), 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploadingFile(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'x-auth-token': user.token
                }
            });

            const isImageFile = file.type.startsWith('image/');
            setAttachments((prev) => [
                ...prev,
                {
                    type: isImageFile ? 'image' : 'file',
                    url: response.data.url,
                    name: file.name
                }
            ]);
        } catch (error) {
            console.error('Upload Error:', error);
            Swal.fire(tr('swal.uploadFailed', 'Upload failed'), tr('swal.uploadFailedDesc', 'We could not upload that file. Please try again.'), 'error');
        } finally {
            setUploadingFile(false);
            e.target.value = null;
        }
    };

    const handleRemoveAttachment = (index) => {
        setAttachments((prev) => prev.filter((_, attachmentIndex) => attachmentIndex !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canSubmit) {
            Swal.fire(tr('swal.error', 'Error'), tr('swal.titleRequired', 'Add a title, message, or attachment before posting.'), 'error');
            return;
        }

        const normalizedContent = content.trim();
        const derivedTitle = title.trim()
            || normalizedContent.split('\n').find(Boolean)?.slice(0, 72)
            || tr('defaultAnnouncementTitle', 'Class announcement');

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/stream/${classId}`, {
                title: derivedTitle,
                content: normalizedContent,
                attachments
            }, {
                headers: { 'x-auth-token': user.token }
            });

            onPostCreated(response.data);
            resetComposer();
            Swal.fire(tr('swal.success', 'Success'), tr('swal.postCreated', 'Post created successfully.'), 'success');
        } catch (error) {
            console.error('Error creating post:', error);
            Swal.fire(tr('swal.error', 'Error'), tr('swal.postFailed', 'Failed to create post.'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`cpb-container ${isExpanded ? 'cpb-container--expanded' : ''}`} style={{ '--stream-accent': accentColor }}>
            {!isExpanded ? (
                <button type="button" className="cpb-placeholder" onClick={() => setIsExpanded(true)}>
                    <img
                        referrerPolicy="no-referrer"
                        className="cpb-avatar"
                        src={currentUserImage}
                        alt={tr('currentUserAvatarAlt', 'Profile')}
                        onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Me'; }}
                    />

                    <div className="cpb-placeholder-copy">
                        {/* <span className="cpb-placeholder-kicker">{classroomName || tr('classroomLabel', 'Class stream')}</span>*/}
                        <strong className="cpb-placeholder-title">{tr('placeholder', 'Share an announcement with your class')}</strong>
                        <span className="cpb-placeholder-subtitle">{tr('placeholderSubtext', 'Post notes, lesson images, files, or quick reminders for students.')}</span>
                    </div>

                    <div className="cpb-quick-actions">
                        <span className="cpb-quick-chip">
                            <FaBullhorn />
                            {tr('quickAnnouncement', 'Announcement')}
                        </span>
                        <span className="cpb-quick-chip">
                            <FaImage />
                            {tr('quickImage', 'Image')}
                        </span>
                        <span className="cpb-quick-chip">
                            <FaPaperclip />
                            {tr('quickFile', 'File')}
                        </span>
                    </div>
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="cpb-form">
                    <div className="cpb-form-header">
                        <img
                            referrerPolicy="no-referrer"
                            className="cpb-avatar cpb-avatar--large"
                            src={currentUserImage}
                            alt={tr('currentUserAvatarAlt', 'Profile')}
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Me'; }}
                        />

                        <div className="cpb-form-copy">
                            {/* <span className="cpb-form-kicker">{classroomName || tr('classroomLabel', 'Class stream')}</span>*/}
                            <h3>{tr('composerTitle', 'Create a class update')}</h3>
                            <p>{tr('composerSubtitle', 'Students will see this in the stream and can comment underneath it.')}</p>
                        </div>
                    </div>

                    <div className="cpb-form-fields">
                        <input
                            className="cpb-title-input"
                            type="text"
                            placeholder={tr('titlePlaceholder', 'Headline (optional)')}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />

                        <textarea
                            className="cpb-content-input"
                            placeholder={tr('contentPlaceholder', 'Write the details of your announcement, reminder, or lesson update...')}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                        />
                    </div>

                    {showLinkInput && (
                        <div className="cpb-link-input-row">
                            <input
                                className="cpb-link-input"
                                type="url"
                                placeholder={tr('linkPlaceholder', 'Paste a website or resource link')}
                                value={linkInput}
                                onChange={(e) => setLinkInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                                autoFocus
                            />
                            <button type="button" className="cpb-link-add-btn" onClick={handleAddLink}>
                                {tr('btnAdd', 'Add')}
                            </button>
                            <button type="button" className="cpb-link-cancel-btn" onClick={() => setShowLinkInput(false)}>
                                <FaTimes />
                            </button>
                        </div>
                    )}

                    {attachments.length > 0 && (
                        <div className="cpb-attachments">
                            {attachments.map((attachment, index) => {
                                const isImageAttachment = attachment.type === 'image';
                                return (
                                    <div
                                        key={`${attachment.url}-${index}`}
                                        className={`cpb-attachment-item ${isImageAttachment ? 'cpb-attachment-item--image' : ''}`}
                                    >
                                        <div className="cpb-attachment-preview">
                                            {isImageAttachment ? (
                                                <img
                                                    referrerPolicy="no-referrer"
                                                    src={resolveAttachmentUrl(attachment.url)}
                                                    alt={attachment.name || tr('imageAttachment', 'Image attachment')}
                                                    className="cpb-attachment-image"
                                                />
                                            ) : (
                                                <span className="cpb-attachment-icon">
                                                    {attachment.type === 'link' ? <FaLink /> : <FaPaperclip />}
                                                </span>
                                            )}
                                        </div>

                                        <div className="cpb-attachment-info">
                                            <span className="cpb-attachment-kind">
                                                {attachment.type === 'image'
                                                    ? tr('attachmentTypeImage', 'Image')
                                                    : attachment.type === 'link'
                                                        ? tr('attachmentTypeLink', 'Link')
                                                        : tr('attachmentTypeFile', 'File')}
                                            </span>
                                            <span className="cpb-attachment-name">{attachment.name || attachment.url}</span>
                                        </div>

                                        <button type="button" className="cpb-attachment-remove" onClick={() => handleRemoveAttachment(index)}>
                                            <FaTimes />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="cpb-actions">
                        <div className="cpb-actions-left">
                            <button type="button" className="cpb-action-btn" onClick={() => setShowLinkInput((prev) => !prev)}>
                                <FaLink />
                                {tr('btnLink', 'Add link')}
                            </button>

                            <label className={`cpb-action-btn ${uploadingFile ? 'cpb-action-btn--disabled' : ''}`}>
                                <FaPaperclip />
                                {uploadingFile ? tr('uploading', 'Uploading...') : tr('btnFile', 'Add file')}
                                <input
                                    type="file"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                    disabled={uploadingFile}
                                />
                            </label>
                        </div>

                        <div className="cpb-actions-right">
                            <button type="button" className="cpb-cancel-btn" onClick={resetComposer}>
                                {tr('btnCancel', 'Cancel')}
                            </button>
                            <button
                                type="submit"
                                className={`cpb-submit-btn ${loading ? 'cpb-submit-btn--loading' : ''}`}
                                disabled={loading || !canSubmit}
                            >
                                <FaBullhorn />
                                {loading ? tr('posting', 'Posting...') : tr('btnPost', 'Post update')}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

export default CreatePostBox;
