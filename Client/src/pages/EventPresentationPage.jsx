import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import WordCloudViz from '../components/events/WordCloudViz';
import { FaCloud, FaTimes, FaExpand, FaCompress } from 'react-icons/fa';
import API_BASE_URL, { createSocketClient } from '../config/api';
import '../CSS/ClassroomEvent.css';

const EventPresentationPage = () => {
    const { classId, eventId } = useParams();
    const { t } = useTranslation();
    const [eventData, setEventData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });

    useEffect(() => {
        let socket = null;

        const fetchDataAndConnect = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const config = {
                    headers: {
                        'x-auth-token': token
                    }
                };
                
                const res = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}`, config);
                if (res.data) {
                    const foundEvent = res.data.classroomEvents?.find(e => String(e.id) === String(eventId));
                    if (foundEvent) {
                        setEventData(foundEvent);
                    } else {
                        console.error('Event not found in list');
                    }
                }

                socket = createSocketClient(io, {
                    auth: { token }
                });

                socket.on('connect', () => {
                    console.log('Presentation socket connected');
                    socket.emit('join-classroom', {
                        classId,
                        userId: 'presentation-view',
                        userName: 'Presentation View'
                    });
                });

                socket.on('classroom-event-updated', (data) => {
                    if (String(data.eventId) === String(eventId) && data.updates) {
                        setEventData(prev => ({ ...prev, ...data.updates }));
                    }
                });

                socket.on('classroom-event-triggered', (data) => {
                    if (String(data.eventId) === String(eventId) && data.updates) {
                        setEventData(prev => ({ ...prev, ...data.updates }));
                    }
                });

            } catch (err) {
                console.error("Error initializing presentation page:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDataAndConnect();

        return () => {
            if (socket) socket.disconnect();
        };
    }, [classId, eventId]);

    const toggleNativeFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
        }
    };

    if (loading) return <div className="pres-fullscreen-loading">{tr('classroomEvent.loadingWordCloud', 'Loading Word Cloud...')}</div>;
    if (!eventData) return <div className="pres-fullscreen-error">{tr('classroomEvent.presentationEventNotFound', 'Event not found.')}</div>;

    const wordCount = eventData.results?.length || 0;
    const uniqueWordCount = new Set(
        (eventData.results || [])
            .map(result => (result?.text || '').trim().toLowerCase())
            .filter(Boolean)
    ).size;

    return (
        <div className="pres-pure-fullscreen">
            {/* Pure Fullscreen WordCloud2 Canvas Engine */}
            {eventData.type === 'wordcloud' && (
                <WordCloudViz results={eventData.results || []} variant="fullscreen" />
            )}

            {/* Discreet floating overlay with topic and controls */}
            <div className="pres-floating-bar">
                <div className="pres-topic-pill">
                    <FaCloud className="pres-topic-icon" />
                    <span className="pres-topic-text">{eventData.config?.topic || eventData.title}</span>
                </div>

                <div className="pres-controls-right">
                    <div className="pres-stats-pill">
                        <span className="pres-live-dot"></span>
                        <span>{uniqueWordCount} {tr('classroomEvent.uniqueWords', 'words')} · {wordCount} {tr('classroomEvent.answers', 'answers')}</span>
                    </div>

                    <button
                        type="button"
                        className="pres-icon-btn"
                        onClick={toggleNativeFullscreen}
                        title={tr('classroomEvent.toggleFullscreen', 'Toggle Fullscreen')}
                    >
                        {isFullscreen ? <FaCompress /> : <FaExpand />}
                    </button>

                    <button
                        type="button"
                        className="pres-icon-btn pres-close-btn"
                        onClick={() => window.close()}
                        title={tr('classroomEvent.closeWindow', 'Close Window')}
                    >
                        <FaTimes />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventPresentationPage;
