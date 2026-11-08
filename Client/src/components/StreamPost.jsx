// src/components/StreamPost.jsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import {
    FaBullhorn,
    FaCalendarAlt,
    FaChalkboardTeacher,
    FaClipboardList,
    FaCommentDots,
    FaEdit,
    FaFileAlt,
    FaLink,
    FaPaperclip,
    FaStar,
    FaTimes,
    FaTrash
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import API_BASE_URL, { buildServerUrl } from '../config/api';

const resolveAttachmentUrl = (url) => {
    if (!url) return '';
    return buildServerUrl(url);
};

const renderTextWithLinks = (text, className = 'sp-inline-link') => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a key={`${part}-${index}`} href={part} target="_blank" rel="noopener noreferrer" className={className}>
                    {part}
                </a>
            );
        }
        return part;
    });
};

const formatDateTime = (value) => new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

const formatTimeOnly = (value) => new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
});

const StreamPost = ({ post, user, isCreator, creatorIds = [], classId, onDelete, onUpdate, onAddComment, onDeleteComment }) => {
    const { t } = useTranslation();
    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });

    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const navigate = useNavigate();

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(post.title || '');
    const [editContent, setEditContent] = useState(post.content || '');
    const [editAttachments, setEditAttachments] = useState(post.attachments ? [...post.attachments] : []);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkInput, setLinkInput] = useState('');

    useEffect(() => {
        setEditTitle(post.title || '');
        setEditContent(post.content || '');
        setEditAttachments(post.attachments ? [...post.attachments] : []);
    }, [post]);

    const authorImage = getProfileImageSrc(post.author?.photoURL, post.author ? isGoogleUser(post.author) : false);
    const currentUserImage = getProfileImageSrc(user?.photoURL, user ? isGoogleUser(user) : false);

    const isAssignmentPost = post.type === 'assignment';
    const normalizedAuthorId = String(post.author?._id || post.author?.id || '');
    const isTeacherAuthor = creatorIds.includes(normalizedAuthorId);
    const isOverdue = Boolean(isAssignmentPost && post.assignmentMeta?.dueDate && new Date() > new Date(post.assignmentMeta.dueDate));
    const canManage = isCreator || normalizedAuthorId === String(user?.id);

    const imageAttachments = (post.attachments || []).filter((attachment) => attachment.type === 'image');
    const fileAttachments = (post.attachments || []).filter((attachment) => attachment.type !== 'image');
    const commentCount = post.comments?.length || 0;

    useEffect(() => {
        if (!selectedImage) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setSelectedImage(null);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [selectedImage]);

    const handleAddLink = () => {
        if (!linkInput.trim()) return;
        setEditAttachments((prev) => [
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
                    'x-auth-token': user?.token
                }
            });

            const isImageFile = file.type.startsWith('image/');
            setEditAttachments((prev) => [
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
        setEditAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSaveEdit = async () => {
        if (!editTitle.trim() && !editContent.trim() && editAttachments.length === 0) {
            Swal.fire(tr('streamPost.editEmptyTitle', 'ข้อผิดพลาด'), tr('streamPost.editEmptyText', 'กรุณาระบุหัวข้อหรือเนื้อหาของโพสต์'), 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const res = await axios.put(
                `${API_BASE_URL}/api/stream/${classId}/${post._id}`,
                {
                    title: editTitle.trim() || 'ประกาศ',
                    content: editContent,
                    attachments: editAttachments
                },
                {
                    headers: { 'x-auth-token': user?.token }
                }
            );

            if (onUpdate) {
                onUpdate(res.data);
            }
            setIsEditing(false);
            Swal.fire({
                title: tr('streamPost.editSuccessTitle', 'สำเร็จ'),
                text: tr('streamPost.editSuccessText', 'แก้ไขโพสต์เรียบร้อยแล้ว'),
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error updating post:', err);
            Swal.fire(tr('streamPost.editErrorTitle', 'เกิดข้อผิดพลาด'), err.response?.data?.message || tr('streamPost.editErrorText', 'ไม่สามารถแก้ไขโพสต์ได้'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            if (onAddComment) {
                await onAddComment(post._id, newComment.trim());
                setNewComment('');
            }
        } catch (err) {
            Swal.fire(tr('streamPost.commentErrorTitle', 'Error'), tr('streamPost.commentErrorText', 'Failed to add comment.'), 'error');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteCommentClick = (commentId) => {
        Swal.fire({
            title: tr('streamPost.deleteCommentTitle', 'Delete comment?'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: tr('streamPost.deleteCommentConfirm', 'Delete'),
            cancelButtonText: tr('streamPost.deleteCommentCancel', 'Cancel')
        }).then((result) => {
            if (result.isConfirmed && onDeleteComment) {
                onDeleteComment(post._id, commentId);
            }
        });
    };

    const handleDelete = () => {
        Swal.fire({
            title: tr('streamPost.deletePostTitle', 'Delete post?'),
            text: tr('streamPost.deletePostText', 'This cannot be undone.'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: tr('streamPost.deletePostConfirm', 'Delete'),
            cancelButtonText: tr('streamPost.deletePostCancel', 'Cancel')
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            try {
                await axios.delete(`${API_BASE_URL}/api/stream/${classId}/${post._id}`, {
                    headers: { 'x-auth-token': user.token }
                });
                onDelete(post._id);
            } catch (error) {
                Swal.fire(tr('streamPost.deletePostErrorTitle', 'Error'), tr('streamPost.deletePostErrorText', 'Failed to delete post.'), 'error');
            }
        });
    };

    const cleanedTitle = isAssignmentPost
        ? post.title.replace(/^.*New Assignment:\s*/i, '')
        : post.title;

    return (
        <>
            <article className={`sp-card ${isAssignmentPost ? 'sp-card--assignment' : ''}`}>
                <div className="sp-header">
                    <div className="sp-author">
                        <img
                            referrerPolicy="no-referrer"
                            className="sp-avatar"
                            src={authorImage || 'https://ui-avatars.com/api/?name=User'}
                            alt={post.author?.displayName || '?'}
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=User'; }}
                        />
                        <div className="sp-author-copy">
                            <div className="sp-author-heading">
                                <div className="sp-author-name-row">
                                    <span className="sp-author-name">{post.author?.displayName || tr('streamPost.unknownAuthor', 'Unknown')}</span>
                                    <div className="sp-author-badges">
                                        {isTeacherAuthor && (
                                            <span
                                                className="sp-badge-icon sp-badge-icon--teacher"
                                                aria-label={tr('streamPost.teacherBadge', 'Teacher')}
                                            >
                                                <FaChalkboardTeacher />
                                                <span className="sp-tooltip">{tr('streamPost.teacherBadge', 'Teacher')}</span>
                                            </span>
                                        )}
                                        <span
                                            className={`sp-badge-icon sp-badge-icon--${isAssignmentPost ? 'assignment' : 'announcement'}`}
                                            aria-label={isAssignmentPost ? tr('streamPost.assignmentChip', 'Assignment') : tr('streamPost.announcementChip', 'Announcement')}
                                        >
                                            {isAssignmentPost ? <FaClipboardList /> : <FaBullhorn />}
                                            <span className="sp-tooltip">
                                                {isAssignmentPost ? tr('streamPost.assignmentChip', 'Assignment') : tr('streamPost.announcementChip', 'Announcement')}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                                <div className="sp-author-meta">
                                    <span>{formatDateTime(post.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {canManage && (
                        <div className="sp-header-actions">
                            {isAssignmentPost ? (
                                <button
                                    type="button"
                                    className="sp-action-btn sp-edit-btn"
                                    onClick={() => navigate(`/classroom/${classId}/classwork/${post.assignmentId}`)}
                                    title={tr('streamPost.editAssignmentTitle', 'แก้ไขงานในชั้นเรียน')}
                                >
                                    <FaEdit />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className={`sp-action-btn sp-edit-btn ${isEditing ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setIsEditing(!isEditing);
                                        setEditTitle(post.title || '');
                                        setEditContent(post.content || '');
                                        setEditAttachments(post.attachments ? [...post.attachments] : []);
                                        setShowLinkInput(false);
                                    }}
                                    title={tr('streamPost.editPostTitle', 'แก้ไขโพสต์')}
                                >
                                    <FaEdit />
                                </button>
                            )}
                            <button
                                type="button"
                                className="sp-action-btn sp-delete-btn"
                                onClick={handleDelete}
                                title={tr('streamPost.deletePostTitle', 'Delete post')}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="sp-body sp-body--editing">
                        <div className="cpb-form-fields">
                            <input
                                className="cpb-title-input"
                                type="text"
                                placeholder={tr('streamPost.editTitlePlaceholder', 'หัวข้อประกาศ (ไม่บังคับ)')}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                            />
                            <textarea
                                className="cpb-content-input"
                                placeholder={tr('streamPost.editContentPlaceholder', 'เนื้อหาประกาศ...')}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={4}
                            />
                        </div>

                        {showLinkInput && (
                            <div className="cpb-link-input-row" style={{ marginTop: '12px' }}>
                                <input
                                    className="cpb-link-input"
                                    type="url"
                                    placeholder={tr('streamPost.linkPlaceholder', 'วางลิงก์เว็บไซต์หรือทรัพยากร...')}
                                    value={linkInput}
                                    onChange={(e) => setLinkInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                                    autoFocus
                                />
                                <button type="button" className="cpb-link-add-btn" onClick={handleAddLink}>
                                    {tr('streamPost.btnAddLink', 'เพิ่ม')}
                                </button>
                                <button type="button" className="cpb-link-cancel-btn" onClick={() => setShowLinkInput(false)}>
                                    <FaTimes />
                                </button>
                            </div>
                        )}

                        {editAttachments.length > 0 && (
                            <div className="cpb-attachments" style={{ marginTop: '12px' }}>
                                {editAttachments.map((attachment, index) => {
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
                                                        alt={attachment.name || 'Attachment'}
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
                                                    {attachment.type === 'image' ? tr('streamPost.attImage', 'รูปภาพ') : attachment.type === 'link' ? tr('streamPost.attLink', 'ลิงก์') : tr('streamPost.attFile', 'ไฟล์')}
                                                </span>
                                                <span className="cpb-attachment-name">{attachment.name || attachment.url}</span>
                                            </div>

                                            <button
                                                type="button"
                                                className="cpb-attachment-remove"
                                                onClick={() => handleRemoveAttachment(index)}
                                                title={tr('streamPost.removeAttachment', 'ลบไฟล์แนบ')}
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="cpb-actions" style={{ marginTop: '16px' }}>
                            <div className="cpb-actions-left">
                                <label className={`cpb-action-btn ${uploadingFile ? 'cpb-action-btn--disabled' : ''}`}>
                                    <FaPaperclip />
                                    <span>{uploadingFile ? tr('streamPost.uploading', 'กำลังอัปโหลด...') : tr('streamPost.attachFile', 'แนบไฟล์')}</span>
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                        disabled={uploadingFile}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="cpb-action-btn"
                                    onClick={() => setShowLinkInput((prev) => !prev)}
                                >
                                    <FaLink />
                                    <span>{tr('streamPost.addLink', 'เพิ่มลิงก์')}</span>
                                </button>
                            </div>

                            <div className="cpb-actions-right">
                                <button
                                    type="button"
                                    className="cpb-cancel-btn"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditTitle(post.title || '');
                                        setEditContent(post.content || '');
                                        setEditAttachments(post.attachments ? [...post.attachments] : []);
                                        setShowLinkInput(false);
                                    }}
                                    disabled={isSaving}
                                >
                                    {tr('streamPost.cancelEdit', 'ยกเลิก')}
                                </button>
                                <button
                                    type="button"
                                    className="cpb-submit-btn"
                                    onClick={handleSaveEdit}
                                    disabled={isSaving || uploadingFile}
                                >
                                    {isSaving ? tr('streamPost.saving', 'กำลังบันทึก...') : tr('streamPost.saveEdit', 'บันทึกการแก้ไข')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="sp-body">
                        <h3 className="sp-title">{cleanedTitle}</h3>

                        {post.content && (
                            <div className="sp-content">
                                {renderTextWithLinks(post.content)}
                            </div>
                        )}

                        {isAssignmentPost && (
                            <div className="sp-assignment-panel">
                                <div className="sp-assignment-meta">
                                    {post.assignmentMeta?.points != null && (
                                        <span className="sp-meta-item">
                                            <FaStar />
                                            {tr('streamPost.assignmentPoints', '{{points}} pts', { points: post.assignmentMeta.points })}
                                        </span>
                                    )}
                                    {post.assignmentMeta?.dueDate && (
                                        <span className={`sp-meta-item ${isOverdue ? 'is-overdue' : ''}`}>
                                            <FaCalendarAlt />
                                            {tr('streamPost.assignmentDue', 'Due {{date}}', { date: formatDateTime(post.assignmentMeta.dueDate) })}
                                        </span>
                                    )}
                                </div>

                                {post.assignmentId && (
                                    <button
                                        type="button"
                                        className="sp-view-assignment-btn"
                                        onClick={() => navigate(`/classroom/${classId}/classwork/${post.assignmentId}`)}
                                    >
                                        {tr('streamPost.viewAssignment', 'View assignment')}
                                    </button>
                                )}
                            </div>
                        )}

                        {imageAttachments.length > 0 && (
                            <div className={`sp-image-grid ${imageAttachments.length === 1 ? 'single' : ''}`}>
                                {imageAttachments.map((attachment, index) => (
                                    <button
                                        type="button"
                                        key={`${attachment.url}-${index}`}
                                        className={`sp-att-image-wrap ${imageAttachments.length === 1 ? 'single' : ''}`}
                                        onClick={() => setSelectedImage({
                                            src: resolveAttachmentUrl(attachment.url),
                                            name: attachment.name || tr('streamPost.imageAttachment', 'Attachment')
                                        })}
                                    >
                                        <img
                                            referrerPolicy="no-referrer"
                                            src={resolveAttachmentUrl(attachment.url)}
                                            alt={attachment.name || tr('streamPost.imageAttachment', 'Attachment')}
                                            className="sp-att-image"
                                        />
                                        <span className="sp-att-image-badge">
                                            {tr('streamPost.previewImage', 'Open image')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {fileAttachments.length > 0 && (
                            <div className="sp-attachment-list">
                                {fileAttachments.map((attachment, index) => {
                                    const isLinkAttachment = attachment.type === 'link';
                                    const url = isLinkAttachment ? attachment.url : resolveAttachmentUrl(attachment.url);

                                    return (
                                        <a
                                            key={`${attachment.url}-${index}`}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="sp-att-link"
                                            download={!isLinkAttachment ? attachment.name : undefined}
                                        >
                                            <div className="sp-att-icon">
                                                {isLinkAttachment ? <FaLink /> : <FaFileAlt />}
                                            </div>
                                            <div className="sp-att-info">
                                                <span className="sp-att-name">{attachment.name || attachment.url}</span>
                                                <span className="sp-att-type">
                                                    {isLinkAttachment ? tr('streamPost.linkAttachment', 'Link') : tr('streamPost.fileAttachment', 'File')}
                                                </span>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="sp-comments">
                    {commentCount > 0 && (
                        <div className="sp-comment-summary">
                            <FaCommentDots />
                            <span>
                                {tr('streamPost.commentCount', '{{count}} class comments', {
                                    count: commentCount
                                })}
                            </span>
                        </div>
                    )}

                    {commentCount > 0 && (
                        <div className="sp-comment-list">
                            {post.comments.map((comment) => {
                                const cImg = getProfileImageSrc(comment.author?.photoURL, comment.author ? isGoogleUser(comment.author) : false);
                                const commentAuthorId = String(comment.author?._id || comment.author?.id || '');
                                const isOwnComment = commentAuthorId === String(user?.id);
                                const canDeleteComment = isCreator || isOwnComment;
                                const isCommentTeacher = creatorIds.includes(commentAuthorId);

                                return (
                                    <div key={comment._id} className="sp-comment">
                                        <div className="sp-comment-rail" />
                                        <img
                                            referrerPolicy="no-referrer"
                                            className="sp-comment-avatar"
                                            src={cImg || 'https://ui-avatars.com/api/?name=U'}
                                            alt=""
                                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=U'; }}
                                        />

                                        <div className="sp-comment-body">
                                            <div className="sp-comment-meta">
                                                <span className="sp-comment-author">{comment.author?.displayName || tr('streamPost.unknownAuthor', 'Unknown')}</span>
                                                {isCommentTeacher && (
                                                    <span
                                                        className="sp-badge-icon sp-badge-icon--teacher sp-badge-icon--sm"
                                                        aria-label={tr('streamPost.teacherBadge', 'Teacher')}
                                                    >
                                                        <FaChalkboardTeacher />
                                                        <span className="sp-tooltip">{tr('streamPost.teacherBadge', 'Teacher')}</span>
                                                    </span>
                                                )}
                                                <span className="sp-comment-time">{formatTimeOnly(comment.createdAt)}</span>
                                            </div>
                                            <p className="sp-comment-text">{renderTextWithLinks(comment.text, 'sp-inline-link')}</p>
                                        </div>

                                        {canDeleteComment && (
                                            <button
                                                type="button"
                                                className="sp-comment-del-btn"
                                                onClick={() => handleDeleteCommentClick(comment._id)}
                                                title={tr('streamPost.deleteCommentTitle', 'Delete comment')}
                                            >
                                                <FaTimes />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="sp-comment-form-wrap">
                        <img
                            referrerPolicy="no-referrer"
                            className="sp-comment-avatar"
                            src={currentUserImage || 'https://ui-avatars.com/api/?name=Me'}
                            alt={tr('streamPost.youLabel', 'You')}
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Me'; }}
                        />

                        <form className="sp-comment-form" onSubmit={handleCommentSubmit}>
                            <input
                                className="sp-comment-input"
                                type="text"
                                placeholder={tr('streamPost.commentPlaceholder', 'Add a class comment...')}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                disabled={isSubmittingComment}
                            />
                            <button
                                type="submit"
                                className={`sp-send-btn ${newComment.trim() ? 'sp-send-btn--active' : ''}`}
                                disabled={!newComment.trim() || isSubmittingComment}
                            >
                                {tr('streamPost.commentSend', 'Send')}
                            </button>
                        </form>
                    </div>
                </div>
            </article>

            {selectedImage && ReactDOM.createPortal(
                <div className="sp-image-modal" onClick={() => setSelectedImage(null)}>
                    <div className="sp-image-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="sp-image-modal-close" onClick={() => setSelectedImage(null)}>
                            <FaTimes />
                        </button>
                        <img
                            referrerPolicy="no-referrer"
                            src={selectedImage.src}
                            alt={selectedImage.name || tr('streamPost.previewImage', 'Image preview')}
                            className="sp-image-modal-preview"
                        />
                        <div className="sp-image-modal-caption">{selectedImage.name || tr('streamPost.previewImage', 'Image preview')}</div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default StreamPost;
