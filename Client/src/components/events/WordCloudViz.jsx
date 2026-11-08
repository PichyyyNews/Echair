import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import WordCloud from 'wordcloud';
import { useTranslation } from 'react-i18next';
import '../../CSS/ClassroomEvent.css';

// Natural, sophisticated palette matching the reference image (forest green, deep olive, warm walnut, charcoal slate)
const NATURAL_PALETTE = [
    '#2d5016', // Deep forest olive
    '#4a6741', // Muted moss green
    '#1b4332', // Dark pine green
    '#5c4033', // Warm walnut brown
    '#78350f', // Warm bronze / amber
    '#334155', // Slate charcoal
    '#1e293b', // Deep charcoal
    '#3f6212', // Olive leaf
    '#854d0e', // Ochre / brass
    '#2c3e50'  // Dark slate teal
];

const getDeterministicColor = (word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
    }
    return NATURAL_PALETTE[Math.abs(hash) % NATURAL_PALETTE.length];
};

const WordCloudViz = ({ results = [], emptyMessage = "Waiting for responses...", variant = 'card' }) => {
    const { t } = useTranslation();
    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });

    const isFullscreen = variant === 'fullscreen' || variant === 'presentation';

    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const tooltipRef = useRef(null);
    const tooltipWordRef = useRef(null);
    const tooltipCountRef = useRef(null);

    // Track last rendered state to prevent duplicate renders and flickering
    const lastRenderedKeyRef = useRef('');
    const resizeTimeoutRef = useRef(null);

    // Determine dimensions
    const [dimensions, setDimensions] = useState(() => {
        if (typeof window === 'undefined') return { width: 380, height: 240 };
        return {
            width: isFullscreen ? (window.innerWidth || 1200) : 380,
            height: isFullscreen ? (window.innerHeight || 800) : 240
        };
    });

    // Aggregate results into word frequency array
    const words = useMemo(() => {
        const counts = {};
        results.forEach((result) => {
            if (!result?.text) return;
            const text = String(result.text).trim();
            if (text) {
                const lower = text.toLowerCase();
                counts[lower] = counts[lower] || { text, count: 0 };
                counts[lower].count += 1;
            }
        });

        return Object.values(counts)
            .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
    }, [results]);

    // Unique signature key of the current word list
    const wordsKey = useMemo(() => {
        return words.map(w => `${w.text}:${w.count}`).join('|');
    }, [words]);

    // Measure dimensions (debounced, with threshold to eliminate scroll jitter)
    const updateSize = useCallback(() => {
        if (isFullscreen) {
            const w = window.innerWidth || document.documentElement.clientWidth || 1200;
            const h = window.innerHeight || document.documentElement.clientHeight || 800;
            setDimensions(prev => {
                if (Math.abs(prev.width - w) > 20 || Math.abs(prev.height - h) > 20) {
                    return { width: w, height: h };
                }
                return prev;
            });
            return;
        }

        if (!containerRef.current) return;
        const currentWidth = Math.floor(containerRef.current.clientWidth);
        if (!currentWidth) return;

        setDimensions(prev => {
            if (Math.abs(prev.width - currentWidth) >= 20 || prev.width === 0) {
                return { width: currentWidth, height: 240 };
            }
            return prev;
        });
    }, [isFullscreen]);

    useEffect(() => {
        updateSize();

        const handleResize = () => {
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = setTimeout(() => {
                updateSize();
            }, 180);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        };
    }, [updateSize]);

    // Render word cloud on canvas only when wordsKey or dimensions change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || words.length === 0 || !dimensions.width) return;

        const { width, height } = dimensions;
        const renderSignature = `${wordsKey}_${width}_${height}_${variant}`;

        // GUARD: If already rendered this exact data and dimension, skip
        if (lastRenderedKeyRef.current === renderSignature) {
            return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pixelWidth = Math.round(width * dpr);
        const pixelHeight = Math.round(height * dpr);

        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = isFullscreen ? '100vw' : `${width}px`;
        canvas.style.height = isFullscreen ? '100vh' : `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Clean slate with identity transform - DO NOT scale context!
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, pixelWidth, pixelHeight);
        }

        const maxCount = Math.max(...words.map(w => w.count), 1);
        const minCount = Math.min(...words.map(w => w.count), 1);
        const list = words.map(w => [w.text, w.count]);

        const calcFontSize = (weight) => {
            if (typeof weight !== 'number' || isNaN(weight) || weight <= 0) return Math.round(10 * dpr);
            const ratio = Math.max(0, Math.min(1, weight / maxCount));
            const minFont = isFullscreen ? 20 : 13;
            const maxFont = Math.round((isFullscreen ? 88 : 38) * Math.min(width / (isFullscreen ? 900 : 500), 1.4));
            const calculated = minFont + Math.pow(ratio, 0.7) * (maxFont - minFont);
            if (weight < minCount) {
                return Math.max(Math.round(8 * dpr), Math.round(calculated * (weight / minCount) * dpr));
            }
            return Math.max(Math.round(10 * dpr), Math.round(calculated * dpr));
        };

        const onWordCloudStop = () => {
            lastRenderedKeyRef.current = renderSignature;
        };
        canvas.addEventListener('wordcloudstop', onWordCloudStop, { once: true });

        try {
            WordCloud(canvas, {
                list,
                fontFamily: '"Prompt", "Noto Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: (word, weight) => (weight >= maxCount * 0.7 ? '800' : '700'),
                color: (word) => getDeterministicColor(word),
                backgroundColor: 'transparent',
                // Mix vertical and horizontal words matching reference image
                rotateRatio: words.length > 3 ? 0.35 : 0,
                rotationSteps: 2,
                minRotation: -Math.PI / 2, // -90 deg
                maxRotation: 0,             // 0 deg
                gridSize: Math.round((isFullscreen ? 10 : 7) * dpr),
                drawOutOfBound: false,
                shrinkToFit: true,
                ellipticity: isFullscreen ? 0.65 : 0.8,
                weightFactor: (weight) => calcFontSize(weight),
                minSize: Math.round(8 * dpr),
                // Direct DOM Tooltip: Zero React re-renders on mousemove / scroll!
                hover: (item, dimension, event) => {
                    const tooltipEl = tooltipRef.current;
                    if (!tooltipEl) return;

                    if (item && event && containerRef.current) {
                        const bounds = containerRef.current.getBoundingClientRect();
                        tooltipEl.style.display = 'flex';
                        tooltipEl.style.left = `${event.clientX - bounds.left}px`;
                        tooltipEl.style.top = `${event.clientY - bounds.top - 12}px`;
                        if (tooltipWordRef.current) tooltipWordRef.current.textContent = item[0];
                        
                        // Look up true original integer count
                        const orig = words.find(w => w.text.toLowerCase() === String(item[0]).toLowerCase());
                        const trueCount = orig ? orig.count : Math.round(item[1]);
                        if (tooltipCountRef.current) tooltipCountRef.current.textContent = `${trueCount} ${tr('classroomEvent.responsesCount', 'คำตอบ')}`;
                    } else {
                        tooltipEl.style.display = 'none';
                    }
                }
            });
        } catch (err) {
            console.error('Failed to generate WordCloud:', err);
        }

        return () => {
            canvas.removeEventListener('wordcloudstop', onWordCloudStop);
        };
    }, [wordsKey, dimensions, isFullscreen, variant, words, tr]);

    if (words.length === 0) {
        return (
            <div className={`wordcloud-empty ${variant}`} ref={containerRef}>
                <div className="wordcloud-empty-icon">☁️</div>
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={`wordcloud-shell ${variant}`} ref={containerRef}>
            <div
                className="wordcloud-canvas-container"
                style={{ height: isFullscreen ? '100vh' : `${dimensions.height}px` }}
                onMouseLeave={() => {
                    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
                }}
            >
                <canvas ref={canvasRef} className="wordcloud-canvas-element" />

                {/* Direct DOM Tooltip (No state re-render) */}
                <div
                    ref={tooltipRef}
                    className="wordcloud-hover-tooltip"
                    style={{ display: 'none' }}
                >
                    <span ref={tooltipWordRef} className="tooltip-word"></span>
                    <span ref={tooltipCountRef} className="tooltip-count"></span>
                </div>
            </div>

            {/* Subtle response summary badge (Only shown in card mode, not in pure fullscreen) */}
            {!isFullscreen && (
                <div className="wordcloud-meta-footer">
                    <span className="wordcloud-total-tag">
                        {tr('classroomEvent.wordCloudWordStats', '{{unique}} words · {{total}} answers', {
                            unique: words.length,
                            total: results.length
                        })}
                    </span>
                </div>
            )}
        </div>
    );
};

export default WordCloudViz;