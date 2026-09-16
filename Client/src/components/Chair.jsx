// src/component/Chair.jsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import chroma from 'chroma-js';
import '../CSS/Chair.css';
import NoUserInChair from '../image/ืNoUserInChair.png';
import { FaUser, FaHandPaper } from 'react-icons/fa';
import nullUserPhoto from '../image/nulluser.png';

const Chair = ({ id, initialPosition, onChairMove, containerRef, isDraggable, userPhotoURL, userName, onChairClick, userScore, minScore, maxScore, hasAnyScores, isCreator, rotation = 0, isSelectedForGroup = false, selectionIndex, zoomScale = 1, isHandRaised = false, currentEmoji = null, groupColor = null, showScoreBar = true }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(initialPosition);
    const offset = useRef({ x: 0, y: 0 });
    const chairRef = useRef(null);

    useEffect(() => {
        setPosition(initialPosition);
    }, [initialPosition]);

    // Add useEffect to track userScore changes for debugging
    useEffect(() => {
        console.log(`Chair ${id}: userScore=${userScore}, minScore=${minScore}, maxScore=${maxScore}, hasAnyScores=${hasAnyScores}`);
        console.log(`Chair ${id}: HP percentage: ${getHPPercentage()}%, color: ${getHeatmapColor()}`);
        console.log(`Chair ${id}: userName: ${userName}`);
    }, [userScore, minScore, maxScore, hasAnyScores, id, userName]);

    // Force re-render when userScore changes
    const [renderKey, setRenderKey] = useState(0);
    useEffect(() => {
        setRenderKey(prev => prev + 1);
    }, [userScore]);

    const handleMouseDown = useCallback((e) => {
        if (!isDraggable || !chairRef.current) return;
        if (e.stopPropagation) e.stopPropagation();
        setIsDragging(true);
        const chairRect = chairRef.current.getBoundingClientRect();
        
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

        // Calculate offset based on SCREEN coordinates, no zoom needed here as clientX/Y are screen relative
        offset.current = {
            x: clientX - chairRect.left,
            y: clientY - chairRect.top
        };
    }, [isDraggable]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !chairRef.current) return;

        if (e.cancelable && e.type.startsWith('touch')) {
            e.preventDefault();
        }

        // Use offsetParent to get the correct coordinate space (handling translations of parent groups)
        const parentEl = chairRef.current.offsetParent || containerRef.current;
        if (!parentEl) return;

        const parentRect = parentEl.getBoundingClientRect();
        const chairRect = chairRef.current.getBoundingClientRect();

        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

        // Calculate raw position relative to parent's visual top-left
        let rawX = clientX - parentRect.left - offset.current.x;
        let rawY = clientY - parentRect.top - offset.current.y;

        let newX = rawX / zoomScale;
        let newY = rawY / zoomScale;

        // Correct for 180-degree rotation (inverted view)
        // If rotated, the origin is visual bottom-right, and axis is inverted relative to screen
        if (Math.abs(rotation) === 180) {
            newX = (parentRect.width / zoomScale) - newX - (chairRect.width / zoomScale);
            newY = (parentRect.height / zoomScale) - newY - (chairRect.height / zoomScale);
        }

        // Boundary checks: Allow free dragging in edit mode so container can expand dynamically in all 4 directions
        if (!isDraggable) {
            const logicalContainerWidth = parentRect.width / zoomScale;
            const logicalContainerHeight = parentRect.height / zoomScale;
            const logicalChairWidth = chairRect.width / zoomScale;
            const logicalChairHeight = chairRect.height / zoomScale;

            newX = Math.max(0, Math.min(newX, logicalContainerWidth - logicalChairWidth));
            newY = Math.max(0, Math.min(newY, logicalContainerHeight - logicalChairHeight));
        }

        setPosition({ x: newX, y: newY });
    }, [isDragging, rotation, zoomScale, containerRef]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            onChairMove(id, position.x, position.y);
        }
    }, [isDragging, onChairMove, id, position]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove, { passive: false });
            window.addEventListener('touchend', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleClick = useCallback((e) => {
        // ✨ Allow click propagation even if draggable, to support Selection Mode
        if (onChairClick) {
            onChairClick(id, e);
        }
    }, [id, onChairClick]);

    // Create heatmap color scale using chroma-js
    const getHeatmapColor = () => {
        // If no one has any scores, everyone is gray
        if (!hasAnyScores) {
            return '#9ca3af'; // Gray color
        }

        // If user has no score data, return red
        if (!userScore && userScore !== 0) return '#dc2626';

        // If user score is 0, return red
        if (userScore === 0) return '#dc2626';

        // If maxScore is 0, return gray
        if (maxScore === 0) return '#9ca3af';

        // Calculate percentage relative to maxScore (0-100%)
        const percentage = Math.min((userScore / maxScore), 1);

        // Create a heatmap color scale from red (low) to green (high) based on percentage
        const colorScale = chroma.scale(['#dc2626', '#ef4444', '#f59e0b', '#10b981', '#22c55e']).mode('lch');
        return colorScale(percentage).hex();
    };

    const getHPPercentage = () => {
        // If no one has any scores, show minimal progress
        if (!hasAnyScores) {
            return 5;
        }

        // If user has no score data, show minimal progress
        if (!userScore && userScore !== 0) return 5;

        // If user score is 0, show minimal progress
        if (userScore === 0) return 5;

        // If maxScore is 0, show minimal progress
        if (maxScore === 0) return 5;

        // Calculate percentage relative to the highest scorer (maxScore = 100%)
        const percentage = (userScore / maxScore) * 100;
        return Math.max(5, Math.min(percentage, 100)); // Minimum 5% for visibility
    };

    return (
        <div
            ref={chairRef}
            className="chair-item"
            style={{
                left: position.x + 'px',
                top: position.y + 'px',
                zIndex: isDragging ? 1000 : 10,
                transform: `rotate(${rotation}deg)`, // Apply counter-rotation
                boxShadow: isSelectedForGroup ? '0 0 0 3px #4CAF50, 0 4px 6px rgba(0,0,0,0.1)' : undefined, 
                border: isSelectedForGroup ? '2px solid #fff' : undefined,
                transition: 'box-shadow 0.3s ease, border 0.3s ease',
                touchAction: isDraggable ? 'none' : 'auto' // Prevent scrolling on mobile when draggable
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            onClick={handleClick}
        >
            {/* Selection Number Badge */}
            {selectionIndex > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    width: '24px',
                    height: '24px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    zIndex: 20,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                    {selectionIndex}
                </div>
            )}

            {/* ✨ Raised Hand Indicator */}
            {isHandRaised && (
                <div style={{
                    position: 'absolute',
                    top: '5px',
                    left: '60%',
                    transform: 'translateX(-50%)',
                    fontSize: '36px',
                    zIndex: 25,
                    animation: 'bounce 1s infinite',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                    color: '#fbbf24' // Warning color
                }}>
                    <FaHandPaper />
                </div>
            )}

            {/* ✨ Emoji Indicator */}
            {currentEmoji && (
                <div style={{
                    position: 'absolute',
                    top: '5px',
                    left: '60%',
                    transform: 'translateX(-50%)',
                    fontSize: '40px',
                    zIndex: 30,
                    animation: 'bounce 1s infinite', // Match raise hand animation
                    filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.2))',
                }}>
                    {currentEmoji}
                </div>
            )}

            {/* HP Bar around chair - Conditionally visible based on settings and role */}
            {userName && (isCreator || showScoreBar) && (
                <div
                    className="hp-bar-container"
                    style={{
                        display: 'block',
                        visibility: 'visible'
                    }}
                >
                    <CircularProgressbar
                        value={getHPPercentage()}
                        strokeWidth={6}
                        styles={buildStyles({
                            pathColor: getHeatmapColor(),
                            trailColor: '#e5e7eb',
                            strokeLinecap: 'round',
                            pathTransitionDuration: 0.5,
                            rotation: 0.625,
                        })}
                    />
                    {/* Always show score for everyone */}
                    <div
                        className="score-display"
                        style={{
                            display: 'flex',
                            visibility: 'visible'
                        }}
                    >
                        {userScore || 0}
                    </div>
                </div>
            )}

            <div className="chair-icon" style={{
                backgroundImage: userName && userPhotoURL ? `url(${userPhotoURL})` : (!userName ? `url(${NoUserInChair})` : 'none'),
                backgroundColor: userName && !userPhotoURL ? '#f0f0f0' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundSize: 'cover', // Ensure image covers the chair
                backgroundPosition: 'center'
            }}>
                {userName && !userPhotoURL && <FaUser size={30} color="#555" />}
                {/* Shows user photo if available, generic icon if user present but no photo, NoUserInChair if empty */}
            </div>
            <div 
                className="user-name-under" 
                style={groupColor ? { 
                    backgroundColor: groupColor, 
                    color: chroma(groupColor).luminance() > 0.5 ? '#000' : '#fff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                } : {}}
            >
                {userName || ''}
            </div>
        </div>
    );
};

export default Chair;
