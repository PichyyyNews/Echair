// src/component/ClassActionModal.jsx

import React, { useState } from 'react';
import '../CSS/Modal.css';
import CreateClassModal from './CreateClassModal';
import JoinClassModal from './JoinClassModal';
import { useTranslation } from 'react-i18next';

const ClassActionModal = ({ onClose, onClassCreated, onClassJoined, user, initialMode = null }) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState(initialMode);

    const handleCreateClick = () => {
        setMode('create');
    };

    const handleJoinClick = () => {
        setMode('join');
    };

    if (mode === 'create') {
        return <CreateClassModal onClose={onClose} onClassCreated={onClassCreated} user={user} />;
    }

    if (mode === 'join') {
        return <JoinClassModal onClose={onClose} onClassJoined={onClassJoined} user={user} />;
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content class-action-modal-card" onClick={e => e.stopPropagation()}>
                <div className="class-action-header">
                    <h2 className="class-action-heading">{t('classActionModal.title') || 'Classroom'}</h2>
                    <button className="class-action-close-btn" onClick={onClose} aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="class-action-grid">
                    {/* Create Class Card */}
                    <button type="button" className="class-action-tile create-tile" onClick={handleCreateClick}>
                        <div className="action-tile-icon-box create-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </div>
                        <div className="action-tile-info">
                            <span className="action-tile-title">{t('classActionModal.createClassBtn') || 'Create class'}</span>
                            <span className="action-tile-desc">{t('classActionModal.createClassDesc') || 'Start a new classroom'}</span>
                        </div>
                        <div className="action-tile-arrow">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </div>
                    </button>

                    {/* Join Class Card */}
                    <button type="button" className="class-action-tile join-tile" onClick={handleJoinClick}>
                        <div className="action-tile-icon-box join-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" />
                                <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                        </div>
                        <div className="action-tile-info">
                            <span className="action-tile-title">{t('classActionModal.joinClassBtn') || 'Join class'}</span>
                            <span className="action-tile-desc">{t('classActionModal.joinClassDesc') || 'Enter with class code'}</span>
                        </div>
                        <div className="action-tile-arrow">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClassActionModal;
