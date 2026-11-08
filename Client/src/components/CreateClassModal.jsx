// src/components/CreateClassModal.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../CSS/Modal.css';
import '../CSS/Chair.css';
import Chair from './Chair';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { FiPlus, FiMinus, FiEye, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import API_BASE_URL from '../config/api';

const PRESET_COLORS = [
    '#10b981', // Emerald (Brand Primary)
    '#059669', // Deep Forest
    '#2563eb', // Royal Blue
    '#4f46e5', // Indigo
    '#7c3aed', // Purple
    '#d97706', // Warm Amber
    '#e11d48', // Crimson Rose
    '#475569'  // Slate Charcoal
];

const SeatingPreviewModal = ({ rows, cols, onClose, onSavePositions, initialSavedPositions }) => {
    const { t } = useTranslation();
    const [currentChairPositions, setCurrentChairPositions] = useState({});
    const containerRef = useRef(null);

    const getContainerDimensions = useCallback(() => {
        if (rows === 0 || cols === 0) return { width: 120, height: 80 };
        const CHAIR_SPACING = 110;
        const PADDING = 60;
        const width = (cols * CHAIR_SPACING) + PADDING;
        const height = (rows * CHAIR_SPACING) + PADDING;
        return { width, height };
    }, [rows, cols]);

    const initializeChairPositions = useCallback(() => {
        const positions = {};
        if (rows === 0 || cols === 0) return positions;
        const CHAIR_SPACING = 110;
        const START_OFFSET = 30;

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
        if (Object.keys(initialSavedPositions || {}).length > 0) {
            setCurrentChairPositions(initialSavedPositions);
        } else {
            setCurrentChairPositions(initializeChairPositions());
        }
    }, [initialSavedPositions, initializeChairPositions]);

    const handleChairMove = useCallback((id, newX, newY) => {
        setCurrentChairPositions(prev => ({
            ...prev,
            [id]: { x: newX, y: newY }
        }));
    }, []);

    const handleSaveClick = () => {
        onSavePositions(currentChairPositions);
        onClose();
    };

    const { width, height } = getContainerDimensions();

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content cc-preview-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="cc-preview-modal-header">
                    <div className="cc-preview-title-group">
                        <h3 className="cc-preview-modal-title">
                            {t('createClassModal.previewTitle', { rows, cols, total: rows * cols }) || `ตัวอย่างผังที่นั่ง ${rows}×${cols} (${rows * cols} ที่นั่ง)`}
                        </h3>
                        <p className="cc-preview-modal-subtitle">
                            {t('createClassModal.dragHint', { defaultValue: 'สามารถลากเก้าอี้เพื่อจัดตำแหน่งตามที่ต้องการได้' })}
                        </p>
                    </div>
                    <button type="button" className="cc-modal-close-icon" onClick={onClose}>
                        <FiX />
                    </button>
                </div>

                <div className="cc-preview-board-banner">
                    <span>กระดานหน้าชั้นเรียน / Front of Class</span>
                </div>

                <div className="cc-preview-canvas-viewport">
                    <div
                        ref={containerRef}
                        className="cc-preview-canvas-inner"
                        style={{ width: `${width}px`, height: `${height}px` }}
                    >
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

                <div className="cc-preview-footer">
                    <button
                        type="button"
                        className="cc-btn cc-btn-cancel"
                        onClick={onClose}
                    >
                        {t('common.cancel') || 'ยกเลิก'}
                    </button>
                    <button
                        type="button"
                        className="cc-btn cc-btn-submit"
                        onClick={handleSaveClick}
                    >
                        {t('createClassModal.saveArrangement') || 'บันทึกการจัดผัง'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateClassModal = ({ onClose, onClassCreated, user }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [subname, setSubname] = useState('');
    const [color, setColor] = useState('#10b981');
    const [rows, setRows] = useState(1);
    const [cols, setCols] = useState(1);
    const [showPreview, setShowPreview] = useState(false);
    const [savedSeatingPositions, setSavedSeatingPositions] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const colorInputRef = useRef(null);

    const initializeGridSeating = useCallback(() => {
        const initialPositions = {};
        if (rows < 1 || cols < 1) return initialPositions;

        const CHAIR_SPACING = 110;
        const START_OFFSET = 30;

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
            Swal.fire(t('common.error') || 'Error', t('createClassModal.notLoggedIn') || "Please log in to create a class.", 'error');
            return;
        }

        if (rows < 1 || rows > 10 || cols < 1 || cols > 10) {
            Swal.fire(t('common.error') || 'Error', t('createClassModal.invalidRowsCols') || "Rows and columns must be between 1 and 10.", 'error');
            return;
        }

        let finalSeatingPositions = savedSeatingPositions;
        if (Object.keys(finalSeatingPositions || {}).length === 0 && rows >= 1 && cols >= 1) {
            finalSeatingPositions = initializeGridSeating();
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/classrooms/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': user.token,
                },
                body: JSON.stringify({
                    name: name.trim(),
                    subname: subname.trim(),
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
            onClassCreated(data.class.name);
        } catch (error) {
            Swal.fire(t('common.error') || 'Error', error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePreviewClick = (e) => {
        e.preventDefault();
        if (rows >= 1 && cols >= 1 && rows <= 10 && cols <= 10) {
            setShowPreview(true);
        } else {
            Swal.fire(t('common.error') || 'Error', t('createClassModal.invalidPreview') || "Please enter valid numbers for rows and columns (1-10) to preview.", 'warning');
        }
    };

    const handleSaveSeatingPositions = (positions) => {
        setSavedSeatingPositions(positions);
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose}>
                <div className="modal-content create-class-modal clean-ui-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="cc-modal-header">
                        <h2 className="cc-modal-title">{t('createClassModal.title') || 'Create New Class'}</h2>
                        <button type="button" className="cc-modal-close-icon" onClick={onClose} aria-label="Close">
                            <FiX />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="cc-modal-form">
                        {/* Class Name */}
                        <div className="cc-form-group">
                            <label className="cc-label">
                                {t('createClassModal.className') || 'Class Name'}
                                <span className="cc-required">*</span>
                            </label>
                            <input
                                type="text"
                                className="cc-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('createClassModal.classNamePlaceholder', { defaultValue: 'e.g. Science 101, Grade 10A' })}
                                required
                                autoFocus
                            />
                        </div>

                        {/* Description / Subtitle */}
                        <div className="cc-form-group">
                            <label className="cc-label">
                                {t('createClassModal.description') || 'Description'}
                            </label>
                            <input
                                type="text"
                                className="cc-input"
                                value={subname}
                                onChange={(e) => setSubname(e.target.value)}
                                placeholder={t('createClassModal.subnamePlaceholder', { defaultValue: 'e.g. Section 2, Fall 2026' })}
                            />
                        </div>

                        {/* Color Selector */}
                        <div className="cc-form-group">
                            <label className="cc-label">
                                {t('createClassModal.classColor') || 'Class Color'}
                            </label>
                            <div className="cc-color-palette-row">
                                <div className="cc-swatches-list">
                                    {PRESET_COLORS.map((hex) => {
                                        const isSelected = color.toLowerCase() === hex.toLowerCase();
                                        return (
                                            <button
                                                key={hex}
                                                type="button"
                                                className={`cc-swatch-dot ${isSelected ? 'active' : ''}`}
                                                style={{ backgroundColor: hex }}
                                                onClick={() => setColor(hex)}
                                                title={hex}
                                            >
                                                {isSelected && <FiCheck className="cc-swatch-check" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="cc-custom-color-wrapper">
                                    <button
                                        type="button"
                                        className="cc-custom-color-trigger"
                                        style={{ backgroundColor: color }}
                                        onClick={() => colorInputRef.current?.click()}
                                        title="Pick custom color"
                                    >
                                        <span className="cc-custom-color-hex">{color}</span>
                                    </button>
                                    <input
                                        ref={colorInputRef}
                                        type="color"
                                        className="cc-native-color-hidden"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seating Arrangement Box */}
                        <div className="cc-seating-box">
                            <div className="cc-seating-box-header">
                                <span className="cc-seating-box-title">
                                    {t('createClassModal.seatingGrid', { defaultValue: 'ผังที่นั่งห้องเรียน' })}
                                </span>
                                <span className="cc-total-chairs-pill">
                                    <FiUsers className="cc-pill-icon" />
                                    <span>{rows * cols} {t('common.chairs', { defaultValue: 'ที่นั่ง' })}</span>
                                </span>
                            </div>

                            <div className="cc-steppers-grid">
                                {/* Rows Stepper (min 1, max 10) */}
                                <div className="cc-stepper-item">
                                    <label className="cc-stepper-label">{t('createClassModal.rowsLabel') || 'Rows (1-10)'}</label>
                                    <div className="cc-stepper-control">
                                        <button
                                            type="button"
                                            className="cc-stepper-btn"
                                            onClick={() => setRows(prev => Math.max(1, prev - 1))}
                                            disabled={rows <= 1}
                                            aria-label="Decrease rows"
                                        >
                                            <FiMinus />
                                        </button>
                                        <input
                                            type="number"
                                            className="cc-stepper-num"
                                            min="1"
                                            max="10"
                                            value={rows}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setRows(isNaN(val) ? 1 : Math.min(10, Math.max(1, val)));
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="cc-stepper-btn"
                                            onClick={() => setRows(prev => Math.min(10, prev + 1))}
                                            disabled={rows >= 10}
                                            aria-label="Increase rows"
                                        >
                                            <FiPlus />
                                        </button>
                                    </div>
                                </div>

                                {/* Columns Stepper (min 1, max 10) */}
                                <div className="cc-stepper-item">
                                    <label className="cc-stepper-label">{t('createClassModal.colsLabel') || 'Columns (1-10)'}</label>
                                    <div className="cc-stepper-control">
                                        <button
                                            type="button"
                                            className="cc-stepper-btn"
                                            onClick={() => setCols(prev => Math.max(1, prev - 1))}
                                            disabled={cols <= 1}
                                            aria-label="Decrease columns"
                                        >
                                            <FiMinus />
                                        </button>
                                        <input
                                            type="number"
                                            className="cc-stepper-num"
                                            min="1"
                                            max="10"
                                            value={cols}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setCols(isNaN(val) ? 1 : Math.min(10, Math.max(1, val)));
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="cc-stepper-btn"
                                            onClick={() => setCols(prev => Math.min(10, prev + 1))}
                                            disabled={cols >= 10}
                                            aria-label="Increase columns"
                                        >
                                            <FiPlus />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Preview Seating Button */}
                            <button
                                type="button"
                                className="cc-preview-trigger-btn"
                                onClick={handlePreviewClick}
                            >
                                <FiEye className="cc-preview-btn-icon" />
                                <span>{t('createClassModal.previewBtn') || 'ดูตัวอย่างและจัดผังที่นั่ง'}</span>
                            </button>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="cc-footer-actions">
                            <button
                                type="button"
                                className="cc-btn cc-btn-cancel"
                                onClick={onClose}
                            >
                                {t('common.cancel') || 'ยกเลิก'}
                            </button>
                            <button
                                type="submit"
                                className="cc-btn cc-btn-submit"
                                disabled={isSubmitting || !name.trim()}
                            >
                                {isSubmitting ? (t('common.creating') || 'กำลังสร้าง...') : (t('createClassModal.createBtn') || 'สร้างห้องเรียน')}
                            </button>
                        </div>
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
