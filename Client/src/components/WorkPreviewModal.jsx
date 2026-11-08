import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import API_BASE_URL, { buildServerUrl } from '../config/api';
import '../CSS/WorkPreviewModal.css';

/* ─── File extension to Monaco language map ─── */
const EXT_LANG_MAP = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    json: 'json',
    sql: 'sql',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    sh: 'shell',
    bash: 'shell',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',
    log: 'plaintext',
    csv: 'plaintext'
};

const getExtension = (filename = '') => {
    const clean = filename.split('?')[0].split('#')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const isCodeFile = (filename = '', mimetype = '') => {
    const ext = getExtension(filename);
    if (EXT_LANG_MAP[ext]) return true;
    if (mimetype && (mimetype.includes('javascript') || mimetype.includes('json') || mimetype.includes('text/plain') || mimetype.includes('xml'))) {
        return true;
    }
    return false;
};

const isImageFile = (filename = '', mimetype = '') => {
    const ext = getExtension(filename);
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return true;
    if (mimetype && mimetype.startsWith('image/')) return true;
    return false;
};

const isPdfFile = (filename = '', mimetype = '') => {
    const ext = getExtension(filename);
    return ext === 'pdf' || mimetype === 'application/pdf';
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

const WorkPreviewModal = ({ isOpen, onClose, attachment, title = 'Preview' }) => {
    const [codeContent, setCodeContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [copied, setCopied] = useState(false);

    const filename = cleanFilename(attachment?.filename || attachment?.originalname || 'File');
    const rawUrl = String(attachment?.url || '').trim();
    const ext = getExtension(filename);
    const language = EXT_LANG_MAP[ext] || 'plaintext';

    const isCode = isCodeFile(filename, attachment?.mimetype || attachment?.fileType);
    const isImage = isImageFile(filename, attachment?.mimetype || attachment?.fileType);
    const isPdf = isPdfFile(filename, attachment?.mimetype || attachment?.fileType);
    const isLink = Boolean(
        attachment?.fileType === 'link' || 
        attachment?.type === 'link' || 
        (!isCode && !isImage && !isPdf && /^https?:\/\//i.test(rawUrl)) ||
        (!isCode && !isImage && !isPdf && !filename.includes('.') && rawUrl.length > 0)
    );

    const fileUrl = useMemo(() => {
        if (!rawUrl) return '';
        if (isLink) {
            if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
            if (rawUrl.startsWith('//')) return `https:${rawUrl}`;
            if (rawUrl.startsWith('/uploads')) return buildServerUrl(rawUrl);
            return `https://${rawUrl}`;
        }
        return rawUrl.startsWith('http') ? rawUrl : buildServerUrl(rawUrl);
    }, [rawUrl, isLink]);

    useEffect(() => {
        if (!isOpen || !isCode || !fileUrl || isLink) return;

        let isMounted = true;
        setLoading(true);
        setFetchError(null);

        axios.get(fileUrl, { responseType: 'text' })
            .then(res => {
                if (isMounted) {
                    setCodeContent(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error('Failed to load code preview:', err);
                    setFetchError('ไม่สามารถโหลดเนื้อหาไฟล์โค้ดได้ (Error reading file content)');
                    setLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [isOpen, fileUrl, isCode, isLink]);

    if (!isOpen || !attachment) return null;

    const handleCopyCode = async () => {
        if (!codeContent) return;
        try {
            await navigator.clipboard.writeText(codeContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const handleCopyLink = async () => {
        if (!fileUrl) return;
        try {
            await navigator.clipboard.writeText(fileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return createPortal(
        <div className="wpm-overlay" onClick={onClose}>
            <div className="wpm-modal" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <header className="wpm-header">
                    <div className="wpm-header-info">
                        <span className="wpm-tag">
                            {isCode ? `Code (${language})` : isImage ? 'Image' : isPdf ? 'PDF' : isLink ? 'Link' : 'Attachment'}
                        </span>
                        <h3 className="wpm-title" title={filename}>{filename}</h3>
                    </div>
                    <div className="wpm-header-actions">
                        {isCode && !loading && !fetchError && (
                            <button
                                type="button"
                                className="wpm-btn wpm-btn-secondary"
                                onClick={handleCopyCode}
                            >
                                {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกโค้ด'}
                            </button>
                        )}
                        {isLink && fileUrl && (
                            <button
                                type="button"
                                className="wpm-btn wpm-btn-secondary"
                                onClick={handleCopyLink}
                            >
                                {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
                            </button>
                        )}
                        {fileUrl && (
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="wpm-btn wpm-btn-secondary"
                                download={!isLink ? filename : undefined}
                            >
                                {isLink ? 'เปิดในแท็บใหม่ ↗' : 'ดาวน์โหลด / เปิดไฟล์ใหม่'}
                            </a>
                        )}
                        <button
                            type="button"
                            className="wpm-close-btn"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                    </div>
                </header>

                {/* Modal Body */}
                <div className="wpm-body">
                    {loading && (
                        <div className="wpm-loading">
                            <div className="wpm-spinner"></div>
                            <p>กำลังโหลดตัวอย่างงาน...</p>
                        </div>
                    )}

                    {fetchError && !loading && (
                        <div className="wpm-error">
                            <p>{fetchError}</p>
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="wpm-btn wpm-btn-primary">
                                เปิดไฟล์โดยตรง
                            </a>
                        </div>
                    )}

                    {!loading && !fetchError && (
                        <>
                            {isLink && (
                                <div className="wpm-link-wrap">
                                    <div className="wpm-link-icon-box">
                                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                        </svg>
                                    </div>
                                    <h4 className="wpm-link-title">{filename}</h4>
                                    <p className="wpm-link-url" title={fileUrl}>{fileUrl}</p>
                                    <div className="wpm-link-actions">
                                        <a
                                            href={fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="wpm-btn wpm-btn-primary"
                                        >
                                            เปิดลิงก์ในแท็บใหม่ ↗
                                        </a>
                                        <button
                                            type="button"
                                            className="wpm-btn wpm-btn-secondary"
                                            onClick={handleCopyLink}
                                        >
                                            {copied ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกลิงก์'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isCode && !isLink && (
                                <div className="wpm-monaco-wrap">
                                    <Editor
                                        height="100%"
                                        language={language}
                                        value={codeContent}
                                        theme="vs-dark"
                                        options={{
                                            readOnly: true,
                                            fontSize: 13,
                                            lineHeight: 20,
                                            minimap: { enabled: false },
                                            scrollBeyondLastLine: false,
                                            renderWhitespace: 'selection',
                                            automaticLayout: true,
                                            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
                                            padding: { top: 12, bottom: 12 }
                                        }}
                                    />
                                </div>
                            )}

                            {isImage && !isLink && (
                                <div className="wpm-image-wrap">
                                    <img
                                        src={fileUrl}
                                        alt={filename}
                                        className="wpm-image-preview"
                                        onError={(e) => {
                                            if (!fileUrl.startsWith('http')) {
                                                e.target.src = buildServerUrl(fileUrl);
                                            } else {
                                                e.target.style.display = 'none';
                                                setFetchError('ไม่สามารถโหลดภาพนี้ได้');
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {isPdf && !isLink && (
                                <div className="wpm-pdf-wrap">
                                    <iframe
                                        src={`${fileUrl}#toolbar=1`}
                                        title={filename}
                                        className="wpm-pdf-frame"
                                    />
                                </div>
                            )}

                            {!isCode && !isImage && !isPdf && !isLink && (
                                <div className="wpm-generic-wrap">
                                    <div className="wpm-generic-icon">📄</div>
                                    <h4>{filename}</h4>
                                    <p>ไฟล์นี้ไม่รองรับการแสดงตัวอย่างในเบราว์เซอร์โดยตรง</p>
                                    <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="wpm-btn wpm-btn-primary"
                                        download={filename}
                                    >
                                        ดาวน์โหลดไฟล์นี้
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default WorkPreviewModal;
