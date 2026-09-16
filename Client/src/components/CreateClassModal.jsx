// src/component/CreateClassModal.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../CSS/Modal.css';
import '../CSS/Chair.css';
import Chair from './Chair';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import API_BASE_URL from '../config/api';

const SeatingPreviewModal = ({ rows, cols, onClose, onSavePositions, initialSavedPositions }) => {
    const { t } = useTranslation();
    const [currentChairPositions, setCurrentChairPositions] = useState({});
    const containerRef = useRef(null);
    
    // Precise container sizing
    const getContainerDimensions = useCallback(() => {
        if (rows === 0 || cols === 0) return { width: 120, height: 80 };
        
        const CHAIR_SIZE = 45;
        const CHAIR_SPACING = 110; // Increased spacing for better room between chairs
        const PADDING = 50; // More padding to prevent overflow
        
        const width = (cols * CHAIR_SPACING) + PADDING;
        const height = (rows * CHAIR_SPACING) + PADDING;
        
        return { width, height };
    }, [rows, cols]);

    const initializeChairPositions = useCallback(() => {
        const positions = {};
        if (rows === 0 || cols === 0) return positions;
        
        const CHAIR_SPACING = 110;
        const START_OFFSET = 25; // More offset from edges
        
        let seatIndex = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = START_OFFSET + (col * CHAIR_SPACING);
                const y = START_OFFSET + (row * CHAIR_SPACING);
                
                positions[`seat-${seatIndex}`] = { x, y };
                seatIndex++;
            }
        }
        return positions;
    }, [rows, cols]);

    useEffect(() => {
        if (Object.keys(initialSavedPositions).length > 0) {
            setCurrentChairPositions(initialSavedPositions);
        } else {
            setCurrentChairPositions(initializeChairPositions());
        }
    }, [initialSavedPositions, initializeChairPositions]);

    useEffect(() => {
        if (Object.keys(initialSavedPositions).length === 0) {
            setCurrentChairPositions(initializeChairPositions());
        }
    }, [rows, cols, initializeChairPositions, initialSavedPositions]);


    const handleChairMove = useCallback((id, newX, newY) => {
        setCurrentChairPositions(prevPositions => ({
            ...prevPositions,
            [id]: { x: newX, y: newY }
        }));
    }, []);

    const handleSaveClick = () => {
        onSavePositions(currentChairPositions);
        onClose();
    };

    const { width, height } = getContainerDimensions();
    
    return (
        <div className="modal-backdrop">
            <div className="modal-content" style={{
                width: '550px',
                height: '600px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <button className="modal-close-button" onClick={onClose}>&times;</button>
                <h3 style={{ 
                    fontSize: '1.1em', 
                    marginBottom: '15px',
                    textAlign: 'center',
                    margin: '0 0 15px 0'
                }}>{t('createClassModal.previewTitle', { rows, cols, total: rows * cols }) || `Preview ${rows}×${cols} (${rows * cols} chairs)`}</h3>
                
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9',
                    marginBottom: '15px'
                }}>
                    <div ref={containerRef} style={{
                        width: width + 'px',
                        height: height + 'px',
                        position: 'relative',
                        minWidth: '100%',
                        minHeight: '100%'
                    }}>
                        {Object.entries(currentChairPositions).map(([id, pos]) => (
                            <Chair
                                key={id}
                                id={id}
                                initialPosition={pos}
                                onChairMove={handleChairMove}
                                isDraggable={true}
                                containerRef={containerRef}
                            />
                        ))}
                    </div>
                </div>
                
                <button 
                    className="modal-action-button" 
                    onClick={handleSaveClick}
                    style={{ 
                        width: '100%',
                        padding: '12px',
                        fontSize: '1em'
                    }}
                >
                    {t('createClassModal.saveArrangement') || 'Save Arrangement'}
                </button>
            </div>
        </div>
    );
};

const CreateClassModal = ({ onClose, onClassCreated, user }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [subname, setSubname] = useState('');
    const [color, setColor] = useState('#4CAF50');
    const [rows, setRows] = useState(0);
    const [cols, setCols] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [savedSeatingPositions, setSavedSeatingPositions] = useState({});

    // ฟังก์ชันนี้จะถูกใช้เป็นค่าเริ่มต้นสำหรับสร้างคลาส
    const initializeGridSeating = useCallback(() => {
        const initialPositions = {};
        if (rows === 0 || cols === 0) return initialPositions;
        
        const CHAIR_SPACING = 110;
        const START_OFFSET = 25;
        
        let seatIndex = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                initialPositions[`seat-${seatIndex}`] = { 
                    x: START_OFFSET + (c * CHAIR_SPACING), 
                    y: START_OFFSET + (r * CHAIR_SPACING) 
                };
                seatIndex++;
            }
        }
        return initialPositions;
    }, [rows, cols]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user || !user.token) {
            console.error("User or token is not available. Cannot create class.");
            Swal.fire(t('common.error') || 'Error', t('createClassModal.notLoggedIn') || "Please log in to create a class.", 'error');
            return;
        }

        if (rows < 0 || rows > 10 || cols < 0 || cols > 10) {
            Swal.fire(t('common.error') || 'Error', t('createClassModal.invalidRowsCols') || "Rows and columns must be between 0 and 10.", 'error');
            return;
        }

        let finalSeatingPositions = savedSeatingPositions;
        // หากไม่มีการบันทึกตำแหน่งจากหน้า preview ให้สร้างตำแหน่งเริ่มต้น
        if (Object.keys(finalSeatingPositions).length === 0 && rows > 0 && cols > 0) {
            finalSeatingPositions = initializeGridSeating();
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/classrooms/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': user.token,
                },
                body: JSON.stringify({
                    name,
                    subname,
                    color,
                    imageUrl: 'https://via.placeholder.com/50',
                    rows,
                    cols,
                    seatingPositions: finalSeatingPositions
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || t('createClassModal.createFailed') || 'Failed to create class');
            }

            const data = await response.json();
            console.log('Class created:', data.class);

            onClassCreated(data.class.name); // ✨ ส่งชื่อห้องกลับไป
        } catch (error) {
            Swal.fire(t('common.error') || 'Error', error.message, 'error');
        }
    };

    const handlePreviewClick = (e) => {
        e.preventDefault();
        if (rows > 0 && cols > 0 && rows <= 10 && cols <= 10) {
            setShowPreview(true);
        } else {
            Swal.fire(t('common.error') || 'Error', t('createClassModal.invalidPreview') || "Please enter valid numbers for rows and columns (1-10) to preview.", 'warning');
        }
    };

    const handleSaveSeatingPositions = (positions) => {
        setSavedSeatingPositions(positions);
        console.log("Saved seating positions:", positions);
    };

    return (
        <>
            <div className="modal-backdrop">
                <div className="modal-content create-class-modal">
                    <button className="modal-close-button" onClick={onClose}>&times;</button>
                    <h2>{t('createClassModal.title') || 'Create New Class'}</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>{t('createClassModal.className') || 'Class Name'}</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('createClassModal.description') || 'Description'}</label>
                            <input
                                type="text"
                                value={subname}
                                onChange={(e) => setSubname(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('createClassModal.classColor') || 'Class Color'}</label>
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                            />
                        </div>
                        <div className="form-group-inline">
                            <div className="form-group">
                                <label>{t('createClassModal.rowsLabel') || 'Rows (1-10)'}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={rows}
                                    onChange={(e) => setRows(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('createClassModal.colsLabel') || 'Columns (1-10)'}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={cols}
                                    onChange={(e) => setCols(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <button type="button" className="modal-preview-button" onClick={handlePreviewClick}>
                                {t('createClassModal.previewBtn') || 'Preview Seating'}
                            </button>
                        </div>
                        <button type="submit" className="modal-action-button">{t('createClassModal.createBtn') || 'Create Class'}</button>
                    </form>
                </div>
            </div>
            {showPreview && (
                <SeatingPreviewModal
                    rows={rows}
                    cols={cols}
                    onClose={() => setShowPreview(false)}
                    onSavePositions={handleSaveSeatingPositions}
                    initialSavedPositions={savedSeatingPositions}
                />
            )}
        </>
    );
};

export default CreateClassModal;
