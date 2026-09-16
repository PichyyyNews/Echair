// src/component/AssignRate.jsx

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiStar } from 'react-icons/fi';
import RatePresetModal from './RatePresetModal';
import Loader from './Loader';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../CSS/AssignRate.css';
import API_BASE_URL from '../config/api';

const AssignRate = ({ classId, user }) => {
    const [ratePresets, setRatePresets] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRatePresets();
    }, [classId]);

    useEffect(() => {
        // Create default presets if none exist
        if (ratePresets.length === 0 && !loading) {
            createDefaultPresets();
        }
    }, [ratePresets, loading]);

    const fetchRatePresets = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/presets?classroomId=${classId}`, {
                headers: { 'x-auth-token': user.token }
            });
            // Handle both response structures (wrapped in data or direct array)
            const rawPresets = response.data.data || response.data;
            const presetsArray = Array.isArray(rawPresets) ? rawPresets : [];

            const transformedPresets = presetsArray.map(preset => {
                return {
                    _id: preset._id,
                    name: preset.name,
                    emoji: preset.emoji || '⭐',
                    type: preset.type || 'positive',
                    notifyStudent: preset.notifyStudent !== undefined ? preset.notifyStudent : true,
                    scoreType: preset.scoreType || 'add',
                    scoreValue: preset.scoreValue || preset.totalMaxScore || 5,
                    criteria: preset.criteria
                };
            }) || [];

            // Merge with default presets instead of replacing them
            const defaultPresets = getDefaultPresets();
            const allPresets = [...defaultPresets, ...transformedPresets];

            // Remove duplicates based on name to avoid conflicts
            const uniquePresets = allPresets.filter((preset, index, self) =>
                index === self.findIndex(p => p.name === preset.name)
            );

            setRatePresets(uniquePresets);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching rate presets:', error);
            // If API doesn't exist yet, only use default presets
            const defaultPresets = getDefaultPresets();
            setRatePresets(defaultPresets);
            setLoading(false);
        }
    };

    const getDefaultPresets = () => {
        return [
            {
                _id: 'default-1',
                name: 'Good Participation',
                emoji: '👍',
                type: 'positive',
                notifyStudent: true,
                scoreType: 'add',
                scoreValue: 5
            },
            {
                _id: 'default-2',
                name: 'Excellent Work',
                emoji: '⭐',
                type: 'positive',
                notifyStudent: true,
                scoreType: 'add',
                scoreValue: 10
            },
            {
                _id: 'default-3',
                name: 'Late Arrival',
                emoji: '⏰',
                type: 'negative',
                notifyStudent: false,
                scoreType: 'subtract',
                scoreValue: 2
            }
        ];
    };

    const createDefaultPresets = () => {
        const defaultPresets = getDefaultPresets();
        setRatePresets(defaultPresets);
    };

    const handleCreatePreset = () => {
        setEditingPreset(null);
        setIsModalOpen(true);
    };

    const handleEditPreset = (preset) => {
        setEditingPreset(preset);
        setIsModalOpen(true);
    };

    const handleDeletePreset = async (presetId) => {
        try {
            // Prevent deletion of default presets
            if (presetId.startsWith('default-')) {
                Swal.fire('Cannot Delete', 'Default presets cannot be deleted. You can edit them instead.', 'warning');
                return;
            }

            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will permanently delete the rate preset.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                if (presetId.startsWith('local-')) {
                    // Handle local presets
                    setRatePresets(prev => prev.filter(preset => preset._id !== presetId));
                    Swal.fire('Deleted!', 'Rate preset has been deleted locally.', 'success');
                } else {
                    // Handle API presets
                    await axios.delete(`${API_BASE_URL}/api/presets/${presetId}`, {
                        headers: { 'x-auth-token': user.token }
                    });
                    await fetchRatePresets();
                    Swal.fire('Deleted!', 'Rate preset has been deleted.', 'success');
                }
            }
        } catch (error) {
            console.error('Error deleting rate preset:', error);
            Swal.fire('Error', 'Failed to delete rate preset.', 'error');
        }
    };

    const handleSavePreset = async (presetData) => {
        try {
            // Transform presetData to match new API format
            const transformedData = {
                name: presetData.name,
                description: `${presetData.type} rating preset`,
                classroomId: classId,
                criteria: [{
                    name: presetData.name,
                    maxScore: presetData.scoreValue,
                    weight: 1,
                    description: `${presetData.type === 'positive' ? 'Positive' : 'Negative'} rating`
                }],
                isPublic: false,
                isTemplate: false,
                tags: [presetData.type],
                emoji: presetData.emoji,
                type: presetData.type,
                scoreType: presetData.scoreType,
                scoreValue: presetData.scoreValue,
                notifyStudent: presetData.notifyStudent
            };

            if (editingPreset) {
                // Check if it's a default preset (cannot be edited via API)
                if (editingPreset._id.startsWith('default-')) {
                    // For default presets, just update locally
                    const updatedPresets = ratePresets.map(preset =>
                        preset._id === editingPreset._id
                            ? { ...preset, ...presetData }
                            : preset
                    );
                    setRatePresets(updatedPresets);
                    Swal.fire('Updated!', 'Rate preset has been updated locally.', 'success');
                } else {
                    // For API presets, update via API
                    await axios.put(`${API_BASE_URL}/api/presets/${editingPreset._id}`, transformedData, {
                        headers: { 'x-auth-token': user.token }
                    });
                    await fetchRatePresets(); // Refresh to get updated data
                    Swal.fire('Updated!', 'Rate preset has been updated.', 'success');
                }
            } else {
                // Creating new preset - always save to API
                await axios.post(`${API_BASE_URL}/api/presets`, transformedData, {
                    headers: { 'x-auth-token': user.token }
                });
                await fetchRatePresets(); // Refresh to include new preset
                Swal.fire('Created!', 'Rate preset has been created.', 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving rate preset:', error);
            // If API fails, still allow local creation for new presets
            if (!editingPreset) {
                const newPreset = {
                    _id: `local-${Date.now()}`,
                    ...presetData,
                    // Ensure proper type and scoreType mapping for local presets
                    type: presetData.type,
                    scoreType: presetData.scoreType
                };
                setRatePresets(prev => [...prev, newPreset]);
                setIsModalOpen(false);
                Swal.fire('Created!', 'Rate preset has been created locally.', 'success');
            } else {
                Swal.fire('Error', 'Failed to save rate preset.', 'error');
            }
        }
    };

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="assign-rate-container">
            <div className="assign-rate-header">
                <div className="assign-rate-header-left">
                    <div className="assign-rate-header-icon">
                        <FiStar size={22} />
                    </div>
                    <div>
                        <h2>Assign Rate</h2>
                        <p>Create and manage rating presets for your classroom</p>
                    </div>
                </div>
            </div>

            <div className="rate-presets-grid">
                {/* Create New Preset Card */}
                <div className="rate-preset-card create-card" onClick={handleCreatePreset}>
                    <div className="create-card-content">
                        <FiPlus size={48} />
                        <h3>Create New Preset</h3>
                        <p>Add a new rating preset</p>
                    </div>
                </div>

                {/* Existing Presets */}
                {ratePresets.map((preset) => (
                    <div key={preset._id} className="rate-preset-card">
                        <div className="preset-card-header">
                            <div className="preset-emoji">{preset.emoji}</div>
                            <div className="preset-actions">
                                <button
                                    className="action-btn edit-btn"
                                    onClick={() => handleEditPreset(preset)}
                                    title="Edit preset"
                                >
                                    <FiEdit2 size={16} />
                                </button>
                                <button
                                    className="action-btn delete-btn"
                                    onClick={() => handleDeletePreset(preset._id)}
                                    title="Delete preset"
                                >
                                    <FiTrash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="preset-card-content">
                            <h3>{preset.name}</h3>
                            <div className="preset-details">
                                <div className={`preset-type ${preset.type}`}>
                                    {preset.type === 'positive' ? '✓ Positive' : '✗ Negative'}
                                </div>
                                <div className="preset-score">
                                    {preset.scoreType === 'add' ? '+' : '-'}{preset.scoreValue} points
                                </div>
                                {preset.notifyStudent && (
                                    <div className="preset-notification">
                                        🔔 Notify Student
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {ratePresets.length === 0 && (
                <div className="empty-state">
                    <h3>No Rate Presets Yet</h3>
                    <p>Create your first rating preset to start evaluating students</p>
                </div>
            )}

            <RatePresetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePreset}
                preset={editingPreset}
            />
        </div>
    );
};

export default AssignRate;
