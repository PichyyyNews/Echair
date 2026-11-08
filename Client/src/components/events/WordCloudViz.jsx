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
    const lastWidthRef = useRef(0);
    const resizeTimeoutRef = useRef(null);

    // Determine dimensions
    const [dimensions, setDimensions] = useState(() => {
        if (typeof window === 'undefined') return { width: 380, height: 240 };
        return {
            width: isFullscreen ? window.innerWidth : 380,
            height: isFullscreen ? window.innerHeight : 240
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
            const w = window.innerWidth;
            const h = window.innerHeight;
            if (Math.abs(w - dimensions.width) > 30 || Math.abs(h - dimensions.height) > 30) {
                setDimensions({ width: w, height: h });
            }
            return;
        }

        if (!containerRef.current) return;
        const currentWidth = Math.floor(containerRef.current.clientWidth);
        if (!currentWidth) return;

        if (Math.abs(currentWidth - lastWidthRef.current) >= 25 || lastWidthRef.current === 0) {
            lastWidthRef.current = currentWidth;
            setDimensions({ width: currentWidth, height: 240 });
        }
    }, [isFullscreen, dimensions.width, dimensions.height]);

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

    // Render word cloud on canvas only when wordsKey or dimensions change significantly
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || words.length === 0 || !dimensions.width) return;

        const { width, height } = dimensions;
        const renderSignature = `${wordsKey}_${width}_${height}_${variant}`;

        // GUARD: If already rendered this exact data and dimension, DO NOT redraw!
        if (lastRenderedKeyRef.current === renderSignature) {
            return;
        }

        // Stop any running WordCloud operations before starting a new one
        if (typeof WordCloud.stop === 'function') {
            WordCloud.stop();
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = isFullscreen ? '100vw' : `${width}px`;
        canvas.style.height = isFullscreen ? '100vh' : `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, width, height);
        }

        const maxCount = Math.max(...words.map(w => w.count), 1);
        const minCount = Math.min(...words.map(w => w.count), 1);
        const list = words.map(w => [w.text, w.count]);

        lastRenderedKeyRef.current = renderSignature;

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
                gridSize: isFullscreen ? 10 : 6,
                drawOutOfBound: false,
                shrinkToFit: true,
                ellipticity: isFullscreen ? 0.65 : 0.8,
                weightFactor: (size) => {
                    if (maxCount === minCount) {
                        return (isFullscreen ? 56 : 26) * Math.min(width / (isFullscreen ? 800 : 600), 1.5);
                    }
                    const normalized = (size - minCount) / (maxCount - minCount);
                    const minFont = isFullscreen ? 20 : 14;
                    const maxFont = (isFullscreen ? 104 : 42) * Math.min(width / (isFullscreen ? 900 : 600), 1.5);
                    return minFont + Math.pow(normalized, 0.75) * (maxFont - minFont);
                },
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
                        if (tooltipCountRef.current) tooltipCountRef.current.textContent = `${item[1]} ${tr('classroomEvent.responsesCount', 'คำตอบ')}`;
                    } else {
                        tooltipEl.style.display = 'none';
                    }
                }
            });
        } catch (err) {
            console.error('Failed to generate WordCloud:', err);
        }

        return () => {
            if (typeof WordCloud.stop === 'function') {
                WordCloud.stop();
            }
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
