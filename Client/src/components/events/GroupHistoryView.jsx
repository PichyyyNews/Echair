import React, { useState, useMemo } from 'react';
import { FaLayerGroup, FaClock, FaUsers, FaChevronDown, FaChevronUp, FaCheckCircle, FaTrash, FaEllipsisV } from 'react-icons/fa';
import '../../CSS/EventHistory.css';
import { getProfileImageSrc, isGoogleUser, handleImageError } from '../../utils/profileImageHelper';
import { useSocket } from '../../hooks/useSocket';
import Swal from 'sweetalert2';

const GroupHistoryView = ({ classroom, user, onRefresh }) => {
    const [expandedEvent, setExpandedEvent] = useState(null);

    const { emitRemoveStudentFromGroup, emitMoveStudentGroup } = useSocket(
        classroom?._id,
        user,
        null, null, null, null, null, null, null, null, null, null, null, null,
        () => onRefresh && onRefresh(), // onClassroomUpdated
        () => onRefresh && onRefresh(), // onGroupMemberRemoved
        () => onRefresh && onRefresh()  // onGroupMemberMoved
    );

    const handleRemoveStudent = (eventId, studentId, source) => {
        Swal.fire({
            title: 'Remove Student?',
            text: "Are you sure you want to remove this student from the group?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, remove'
        }).then((result) => {
            if (result.isConfirmed) {
                emitRemoveStudentFromGroup(eventId, studentId, source);
            }
        });
    };

    const handleMoveStudent = (event, eventId, studentId, currentGroupId, source) => {
        const availableGroups = event.config?.groups || [];
        const otherGroups = availableGroups.filter(g => (g.id || g.name) !== currentGroupId);

        if (otherGroups.length === 0) {
            Swal.fire('No other groups', 'There are no other groups to move this student to.', 'info');
            return;
        }

        // Build beautiful custom HTML for the move modal
        const groupCardsHtml = otherGroups.map(g => {
            const gid = g.id || g.name;
            const color = g.color || '#6b7280';
            const memberCount = (event.results || []).filter(r => r.text === gid).length;
            const maxMembers = g.maxMembers || '∞';
            return `
                <button class="swal-group-card" data-group-id="${gid}" data-group-name="${g.name}" style="
                    display: flex; align-items: center; gap: 14px;
                    width: 100%; padding: 14px 18px; margin-bottom: 10px;
                    border: 1px solid ${color}40; border-radius: 12px;
                    background: white; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit; text-align: left;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                " onMouseOver="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${color}20'; this.style.borderColor='${color}';" onMouseOut="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)'; this.style.borderColor='${color}40';">
                    <div style="
                        width: 40px; height: 40px; border-radius: 10px;
                        background: ${color}15; display: flex; align-items: center;
                        justify-content: center; color: ${color}; font-weight: bold;
                        font-size: 18px; flex-shrink: 0;
                    ">
                        ${g.name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #1f2937; font-size: 15px;">${g.name}</div>
                        <div style="font-size: 13px; color: #6b7280; margin-top: 3px;">
                            ${memberCount} <span style="opacity: 0.7">/</span> ${maxMembers} members
                        </div>
                    </div>
                    <div style="
                        width: 28px; height: 28px; border-radius: 50%;
                        background: #f3f4f6; display: flex; align-items: center; justify-content: center;
                        color: #9ca3af; font-size: 14px; transition: all 0.2s;
                    " class="swal-group-arrow">→</div>
                </button>
            `;
        }).join('');

        Swal.fire({
            html: `
                <div style="text-align: left; padding: 4px 8px;">
                    <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 700;">Move to Group</h3>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Select a new group for this student.</p>
                    <div class="swal-group-list" style="max-height: 320px; overflow-y: auto; padding-right: 6px;">
                        ${groupCardsHtml}
                    </div>
                </div>
                <style>
                    .swal-group-card:hover .swal-group-arrow { background: #3b82f6 !important; color: white !important; }
                    .swal-group-card:active { transform: scale(0.98) !important; }
                    .swal-group-list::-webkit-scrollbar { width: 6px; }
                    .swal-group-list::-webkit-scrollbar-track { background: transparent; }
                    .swal-group-list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
                    .swal-group-list::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
                </style>
            `,
            showConfirmButton: false,
            showCancelButton: false,
            showCloseButton: true,
            width: 420,
            padding: '24px',
            background: '#ffffff',
            borderRadius: '16px',
            didOpen: () => {
                const buttons = Swal.getPopup().querySelectorAll('.swal-group-card');
                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetGroupId = btn.getAttribute('data-group-id');
                        const targetGroupName = btn.getAttribute('data-group-name');
                        const member = (event.results || []).find(r => r.userId === studentId);

                        emitMoveStudentGroup(
                            eventId,
                            studentId,
                            targetGroupId,
                            targetGroupName,
                            source,
                            member?.userName,
                            member?.photoURL
                        );
                        Swal.close();
                    });
                });
            }
        });
    };

    // Show action sheet when clicking 3-dots
    const handleActionMenu = (event, eventId, member, groupId, source) => {
        const photoSrc = getProfileImageSrc(member.photoURL, isGoogleUser(member));
        
        Swal.fire({
            html: `
                <div style="text-align: left; padding: 4px;">
                    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
                        <img referrerPolicy="no-referrer" src="${photoSrc}" 
                             style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" 
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%239ca3af%22><circle cx=%2212%22 cy=%228%22 r=%224%22/><path d=%22M12 14c-6 0-8 3-8 3v1h16v-1s-2-3-8-3z%22/></svg>'" />
                        <div>
                            <div style="font-weight: 700; color: #111827; font-size: 16px;">${member.userName || 'Unknown User'}</div>
                            <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">Action Menu</div>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="swal-move-btn" style="
                            display: flex; align-items: center; justify-content: space-between;
                            width: 100%; padding: 14px 18px;
                            border: 1px solid #e5e7eb; border-radius: 12px;
                            background: white; cursor: pointer; font-family: inherit; 
                            transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                        " onMouseOver="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 4px 12px rgba(59,130,246,0.1)';" onMouseOut="this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 16px;">
                                    <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                                </div>
                                <span style="color: #1f2937; font-weight: 600; font-size: 15px;">Move to group</span>
                            </div>
                            <div style="color: #9ca3af;">→</div>
                        </button>
                        
                        <button id="swal-remove-btn" style="
                            display: flex; align-items: center; justify-content: space-between;
                            width: 100%; padding: 14px 18px;
                            border: 1px solid #fecaca; border-radius: 12px;
                            background: #fff5f5; cursor: pointer; font-family: inherit; 
                            transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                        " onMouseOver="this.style.borderColor='#ef4444'; this.style.boxShadow='0 4px 12px rgba(239,68,68,0.1)';" onMouseOut="this.style.borderColor='#fecaca'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #fee2e2; display: flex; align-items: center; justify-content: center; color: #ef4444; font-size: 16px;">
                                    <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </div>
                                <span style="color: #b91c1c; font-weight: 600; font-size: 15px;">Remove from group</span>
                            </div>
                            <div style="color: #ef4444; opacity: 0.5;">×</div>
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: false,
            showCloseButton: true,
            width: 380,
            padding: '24px',
            background: '#ffffff',
            borderRadius: '16px',
            didOpen: () => {
                const moveBtn = document.getElementById('swal-move-btn');
                const removeBtn = document.getElementById('swal-remove-btn');
                
                if (moveBtn) moveBtn.addEventListener('click', () => {
                    Swal.close();
                    setTimeout(() => {
                        handleMoveStudent(event, eventId, member.userId, groupId, source);
                    }, 250);
                });
                
                if (removeBtn) removeBtn.addEventListener('click', () => {
                    Swal.close();
                    setTimeout(() => {
                        handleRemoveStudent(eventId, member.userId, source);
                    }, 250);
                });
            }
        });
    };

    // Merge active + archived 'grouping' events
    const groupingEvents = useMemo(() => {
        const active = (classroom?.classroomEvents || [])
            .filter(e => e.type === 'grouping')
            .map(e => ({ ...e, _source: 'active' }));
        const archived = (classroom?.eventHistory || [])
            .filter(e => e.type === 'grouping')
            .map(e => ({ ...e, _source: 'archived' }));
            
        return [...active, ...archived].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA; // Newest first
        });
    }, [classroom]);

    const formatDate = (ts) => {
        if (!ts) return '—';
        const d = new Date(ts);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) +
            ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status) => {
        if (status === 'ended') return <span className="eh-status-badge ended"><FaCheckCircle /> Ended</span>;
        if (status === 'deleted') return <span className="eh-status-badge deleted"><FaTrash /> Deleted</span>;
        if (status === 'active') return <span className="eh-status-badge active"><FaClock /> Active</span>;
        return <span className="eh-status-badge idle"><FaClock /> Idle</span>;
    };

    const getParticipantCount = (results) => {
        if (!results || !Array.isArray(results)) return 0;
        const unique = new Set(results.map(r => r.userId).filter(Boolean));
        return unique.size;
    };

    if (!groupingEvents || groupingEvents.length === 0) {
        return (
            <div className="eh-container">
                 <div className="eh-header">
                    <div className="eh-header-left">
                        <div className="eh-header-icon">
                            <FaLayerGroup size={20} />
                        </div>
                        <div>
                            <h2>Group History</h2>
                            <p>No grouping events recorded yet.</p>
                        </div>
                    </div>
                </div>
                <div className="eh-empty">No grouping events found.</div>
            </div>
        );
    }

    return (
        <div className="eh-container">
            {/* Header */}
            <div className="eh-header">
                <div className="eh-header-left">
                    <div className="eh-header-icon">
                        <FaLayerGroup size={20} />
                    </div>
                    <div>
                        <h2>Group History</h2>
                        <p>{groupingEvents.length} grouping sessions recorded</p>
                    </div>
                </div>
            </div>

            <div className="eh-section">
                <div className="eh-event-list">
                    {groupingEvents.map(event => (
                        <div key={event._id || event.id} className={`eh-event-card ${event.status === 'deleted' ? 'deleted' : ''}`}>
                            <div className="eh-event-main" onClick={() => setExpandedEvent(expandedEvent === (event._id || event.id) ? null : (event._id || event.id))}>
                                <div className="eh-event-icon" style={{ background: '#8b5cf6' }}>
                                    <FaLayerGroup />
                                </div>
                                <div className="eh-event-info">
                                    <h4>{event.title || 'Grouping Session'}</h4>
                                    <div className="eh-event-meta">
                                        <span><FaClock size={10} /> {formatDate(event.createdAt)}</span>
                                        <span><FaUsers size={10} /> {getParticipantCount(event.results)} participants</span>
                                        <span><FaLayerGroup size={10} /> {event.config?.groups?.length || 0} groups</span>
                                    </div>
                                </div>
                                {getStatusBadge(event.status)}
                                <div className="eh-expand-icon">
                                    {expandedEvent === (event._id || event.id) ? <FaChevronUp /> : <FaChevronDown />}
                                </div>
                            </div>

                            {/* Expanded Detail showing Groups */}
                            {expandedEvent === (event._id || event.id) && (
                                <div className="eh-event-detail" style={{ padding: '20px', backgroundColor: '#f9fafb' }}>
                                    <h5 style={{ marginBottom: '16px', color: '#4b5563', fontSize: '15px' }}>Generated Groups ({event.config?.groups?.length || 0})</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                                        {event.config?.groups?.map((group, idx) => {
                                            const members = (event.results || []).filter(r => r.text === (group.id || group.name));
                                            
                                            return (
                                                <div key={group.id || idx} style={{
                                                    backgroundColor: 'white',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${group.color || '#e5e7eb'}`,
                                                    overflow: 'hidden',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                }}>
                                                    <div style={{
                                                        backgroundColor: group.color || '#e5e7eb',
                                                        color: '#fff',
                                                        padding: '10px 16px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        fontWeight: 'bold',
                                                        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                    }}>
                                                        <span>{group.name}</span>
                                                        <span style={{ fontSize: '12px', opacity: 0.9 }}>{members.length}/{group.maxMembers || '∞'}</span>
                                                    </div>
                                                    <div style={{ padding: '12px 16px' }}>
                                                        {members.length === 0 ? (
                                                            <div style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                                                                No members joined
                                                            </div>
                                                        ) : (
                                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                                {members.map((member, mIdx) => {
                                                                    let photoURL = member.photoURL;
                                                                    let isGoogle = isGoogleUser(member);
                                                                    const imgSrc = getProfileImageSrc(photoURL, isGoogle);

                                                                    return (
                                                                        <li key={mIdx} style={{
                                                                            padding: '8px 0',
                                                                            fontSize: '14px',
                                                                            color: '#374151',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            borderBottom: mIdx < members.length - 1 ? '1px solid #f3f4f6' : 'none'
                                                                        }}>
                                                                            <img referrerPolicy="no-referrer" 
                                                                                src={imgSrc} 
                                                                                alt={member.userName || 'User'} 
                                                                                onError={handleImageError}
                                                                                style={{
                                                                                    width: '24px',
                                                                                    height: '24px',
                                                                                    borderRadius: '50%',
                                                                                    marginRight: '10px',
                                                                                    objectFit: 'cover',
                                                                                    backgroundColor: '#e5e7eb',
                                                                                    border: '1px solid #e5e7eb'
                                                                                }}
                                                                            />
                                                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.userName || 'Unknown User'}</span>
                                                                            <button 
                                                                                onClick={(e) => { 
                                                                                    e.stopPropagation(); 
                                                                                    handleActionMenu(event, event.id || event._id, member, group.id || group.name, event._source); 
                                                                                }}
                                                                                style={{
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    cursor: 'pointer',
                                                                                    padding: '4px 6px',
                                                                                    color: '#9ca3af',
                                                                                    borderRadius: '4px',
                                                                                    transition: 'all 0.15s'
                                                                                }}
                                                                                onMouseEnter={(e) => { e.target.style.backgroundColor = '#f3f4f6'; e.target.style.color = '#4b5563'; }}
                                                                                onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#9ca3af'; }}
                                                                            >
                                                                                <FaEllipsisV size={12} />
                                                                            </button>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GroupHistoryView;

