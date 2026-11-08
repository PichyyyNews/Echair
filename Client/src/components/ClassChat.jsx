// src/components/ClassChat.jsx

import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaUsers, FaChevronRight } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getProfileImageSrc, handleImageError } from '../utils/profileImageHelper';

const ClassChat = ({
    user,
    isCreator,
    chatMessages,
    classroomEvents,
    emitChatMessage,
    onSubmitAnswer,
    isSidebarMode = false,
    onClose,
    variant = 'default'
}) => {
    const { t } = useTranslation();
    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });
    const [newMessage, setNewMessage] = useState('');
    const chatContainerRef = useRef(null);
    const isStreamVariant = variant === 'stream';

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            emitChatMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    const renderGroupingCard = (msg, groupingData, index, isMe) => {
        const groupEvent = classroomEvents?.find((eventItem) => eventItem.id === groupingData.eventId);
        const hasJoined = groupEvent?.results?.some((result) => result.userId === user.id);

        return (
            <div
                key={index}
                className={isStreamVariant ? `stream-chat-special ${isMe ? 'is-me' : ''}` : ''}
                style={isStreamVariant ? undefined : { marginBottom: '12px', maxWidth: '85%', marginLeft: isMe ? 'auto' : '0', marginRight: isMe ? '0' : 'auto' }}
            >
                <div style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.22)'
                }}>
                    <div style={{ padding: '14px 16px', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <FaUsers />
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{tr('classChat.groupingTitle', 'Student Groups')}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>{tr('classChat.groupingSubtitle', 'Choose your group below')}</p>
                    </div>

                    <div style={{ background: 'white', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {groupingData.groups.map((group, groupIndex) => {
                            const members = groupEvent?.results?.filter((result) => result.text === (group.id || group.name)) || [];
                            const maxMembers = group.maxMembers || 99;
                            const percentage = Math.min(100, Math.round((members.length / maxMembers) * 100));
                            const isFull = members.length >= maxMembers;

                            return (
                                <button
                                    key={groupIndex}
                                    onClick={() => {
                                        if (!isCreator && !hasJoined && !isFull && groupEvent && onSubmitAnswer) {
                                            onSubmitAnswer(groupEvent, group.id || group.name);
                                        }
                                    }}
                                    disabled={isCreator || hasJoined || isFull}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid #e5e7eb',
                                        borderLeft: `4px solid ${group.color}`,
                                        borderRadius: '10px',
                                        background: isFull ? '#fef2f2' : hasJoined ? '#f0fdf4' : '#fff',
                                        cursor: (isCreator || hasJoined || isFull) ? 'default' : 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left',
                                        opacity: (isCreator || hasJoined || isFull) ? 0.7 : 1
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                                        <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500, color: 'rgb(65, 65, 65)' }}>{group.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{members.length}/{maxMembers}</span>
                                        {isFull && (
                                            <span style={{ padding: '1px 5px', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>
                                                {tr('classChat.groupFull', 'FULL')}
                                            </span>
                                        )}
                                    </div>

                                    {members.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
                                            {members.slice(0, 5).map((member, memberIndex) => (
                                                <img
                                                    referrerPolicy="no-referrer"
                                                    key={memberIndex}
                                                    src={getProfileImageSrc(member.photoURL, false)}
                                                    alt={member.userName}
                                                    style={{
                                                        width: '22px',
                                                        height: '22px',
                                                        borderRadius: '50%',
                                                        border: '2px solid #fff',
                                                        objectFit: 'cover',
                                                        marginLeft: memberIndex === 0 ? 0 : '-6px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                    }}
                                                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.userName || '?')}&background=random&size=24`; }}
                                                />
                                            ))}
                                            {members.length > 5 && (
                                                <span style={{
                                                    width: '22px',
                                                    height: '22px',
                                                    borderRadius: '50%',
                                                    background: '#e5e7eb',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.6rem',
                                                    color: '#6b7280',
                                                    fontWeight: 600,
                                                    marginLeft: '-6px',
                                                    border: '2px solid #fff'
                                                }}>
                                                    +{members.length - 5}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            borderRadius: '2px',
                                            width: `${percentage}%`,
                                            background: isFull ? '#ef4444' : group.color,
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                </button>
                            );
                        })}

                        {hasJoined && (
                            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#059669', fontWeight: 500, padding: '4px 0' }}>
                                {tr('classChat.groupJoined', "You've joined a group")}
                            </div>
                        )}
                    </div>
                </div>

                <div className={isStreamVariant ? 'stream-chat-meta system' : ''} style={isStreamVariant ? undefined : { fontSize: '11px', color: '#999', marginTop: '3px', textAlign: isMe ? 'right' : 'left' }}>
                    {msg.senderName} {' | '} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        );
    };

    const renderMessage = (msg, index) => {
        const isMe = msg.senderId === user.id;
        const isSystem = msg.senderId === 'system' || msg.isSystem;

        if (isSystem) {
            return isStreamVariant ? (
                <div key={index} className="stream-chat-system">
                    {msg.message}
                </div>
            ) : (
                <div key={index} style={{
                    textAlign: 'center',
                    margin: '15px 0',
                    color: '#666',
                    fontSize: '0.85rem',
                    background: '#f8f9fa',
                    padding: '8px 15px',
                    borderRadius: '20px',
                    border: '1px solid #eee',
                    alignSelf: 'center',
                    width: 'fit-content',
                    marginLeft: 'auto',
                    marginRight: 'auto'
                }}>
                    {msg.message}
                </div>
            );
        }

        let groupingData = null;
        try {
            if (typeof msg.message === 'string' && msg.message.startsWith('{"type":"grouping"')) {
                groupingData = JSON.parse(msg.message);
            }
        } catch (error) {
            groupingData = null;
        }

        if (groupingData) {
            return renderGroupingCard(msg, groupingData, index, isMe);
        }

        if (isStreamVariant) {
            return (
                <div key={index} className={`stream-chat-row ${isMe ? 'is-me' : ''}`}>
                    <img
                        referrerPolicy="no-referrer"
                        src={getProfileImageSrc(msg.senderPhoto, false)}
                        alt={msg.senderName}
                        onError={handleImageError}
                        className="stream-chat-avatar"
                    />
                    <div className="stream-chat-message-group">
                        <div className={`stream-chat-bubble ${isMe ? 'is-me' : ''}`}>
                            {msg.message}
                        </div>
                        <div className="stream-chat-meta">
                            {isMe ? tr('classChat.meLabel', 'Me') : msg.senderName} {' | '} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div key={index} style={{
                marginBottom: '10px',
                display: 'flex',
                gap: '10px',
                flexDirection: isMe ? 'row-reverse' : 'row'
            }}>
                <img
                    referrerPolicy="no-referrer"
                    src={getProfileImageSrc(msg.senderPhoto, false)}
                    alt={msg.senderName}
                    onError={handleImageError}
                    style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                />
                <div style={{ alignItems: isMe ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column', maxWidth: '70%' }}>
                    <div style={{
                        background: isMe ? '#e3f2fd' : '#f1f1f1',
                        padding: '8px 12px',
                        borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                        wordBreak: 'break-word',
                        color: '#202124',
                        fontSize: '0.9rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                        {msg.message}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                        {isMe ? tr('classChat.meLabel', 'Me') : msg.senderName} {' | '} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={isStreamVariant ? 'stream-chat-root' : `chat-container ${isSidebarMode ? 'sidebar-mode' : ''}`}
            style={isStreamVariant ? undefined : {
                background: '#fff',
                borderRadius: isSidebarMode ? '0' : '12px',
                border: isSidebarMode ? 'none' : '1px solid #dadce0',
                display: 'flex',
                flexDirection: 'column',
                height: isSidebarMode ? '100%' : '600px',
                overflow: 'hidden',
                boxShadow: isSidebarMode ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'
            }}
        >
            <div
                className={isStreamVariant ? 'stream-chat-header' : 'chat-header'}
                style={isStreamVariant ? undefined : {
                    padding: '15px 20px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    margin: '0px'
                }}
            >
                <div className={isStreamVariant ? 'stream-chat-header-copy' : undefined}>
                    <h3 className={isStreamVariant ? 'stream-chat-title' : undefined} style={isStreamVariant ? undefined : { fontSize: '1.1rem', margin: 0, color: '#3c4043' }}>
                        {tr('classChat.title', 'Class Chat')}
                    </h3>
                    {isStreamVariant && (
                        <p className="stream-chat-subtitle">
                            {tr('classChat.subtitle', 'Live discussion and classroom activity updates')}
                        </p>
                    )}
                </div>

                {isStreamVariant ? (
                    <span className="stream-chat-live">
                        <span className="stream-chat-live-dot" />
                        {tr('classChat.liveLabel', 'Live')}
                    </span>
                ) : (
                    isSidebarMode && onClose && (
                        <button
                            onClick={onClose}
                            title={tr('classChat.closeTitle', 'Close Chat')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            <FaTimes size={18} color="#666" />
                        </button>
                    )
                )}
            </div>

            <div
                className={isStreamVariant ? 'stream-chat-messages custom-scrollbar' : 'chat-messages'}
                ref={chatContainerRef}
                style={isStreamVariant ? undefined : {
                    flex: 1,
                    overflowY: 'auto',
                    padding: '15px',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className={isStreamVariant ? 'stream-chat-date' : undefined} style={isStreamVariant ? undefined : { textAlign: 'center', color: '#888', fontSize: '0.85rem', marginBottom: '15px' }}>
                    {new Date().toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </div>

                {chatMessages.length === 0 ? (
                    <div className={isStreamVariant ? 'stream-chat-empty' : undefined} style={isStreamVariant ? undefined : { textAlign: 'center', color: '#aaa', marginTop: '20px', fontStyle: 'italic' }}>
                        {tr('classChat.empty', 'No messages yet. Start the conversation!')}
                    </div>
                ) : (
                    chatMessages.map((msg, index) => renderMessage(msg, index))
                )}
            </div>

            <form
                onSubmit={handleSubmit}
                className={isStreamVariant ? 'stream-chat-composer' : undefined}
                style={isStreamVariant ? undefined : {
                    padding: '15px',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    gap: '10px',
                    background: '#fff'
                }}
            >
                <input
                    type="text"
                    placeholder={tr('classChat.inputPlaceholder', 'Type a message...')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className={isStreamVariant ? 'stream-chat-input' : undefined}
                    style={isStreamVariant ? undefined : {
                        flex: 1,
                        padding: '10px 15px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    onFocus={isStreamVariant ? undefined : (e) => { e.target.style.borderColor = '#4CAF50'; }}
                    onBlur={isStreamVariant ? undefined : (e) => { e.target.style.borderColor = '#ddd'; }}
                />
                <button
                    type="submit"
                    className={isStreamVariant ? `stream-chat-send ${newMessage.trim() ? 'is-active' : ''}` : undefined}
                    disabled={!newMessage.trim()}
                    style={isStreamVariant ? undefined : {
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}
                >
                    <FaChevronRight size={16} />
                </button>
            </form>
        </div>
    );
};

export default ClassChat;
