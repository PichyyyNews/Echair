// src/pages/ClassroomErrorPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { FiAlertTriangle, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import API_BASE_URL from '../config/api';
import '../CSS/Navbar.css';
import '../CSS/Main.css';
import '../CSS/ClassroomErrorPage.css';
import { useTranslation } from 'react-i18next';

const ClassroomErrorPage = ({
    user,
    isSidebarOpen,
    toggleSidebar,
    handleSignOut,
    errorMessage
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { classroomId } = useParams();
    const [classrooms, setClassrooms] = useState([]);

    useEffect(() => {
        const fetchClassrooms = async () => {
            const token = user?.token || localStorage.getItem('authToken');
            if (!token) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/api/classrooms`, {
                    headers: { 'x-auth-token': token }
                });
                setClassrooms(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Failed to fetch classrooms for sidebar in error page:', err);
            }
        };
        fetchClassrooms();
    }, [user]);

    const handleGoBack = () => {
        navigate('/');
    };

    const handleTryAgain = () => {
        if (classroomId) {
            navigate(`/classroom/${classroomId}`);
        } else {
            window.location.reload();
        }
    };

    return (
        <>
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                handleSignOut={handleSignOut}
                classrooms={classrooms}
            />

            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div className="classroom-error-container">
                    <div className="classroom-error-content">
                        <div className="error-icon-box">
                            <FiAlertTriangle className="error-icon-svg" size={32} />
                        </div>

                        <h1 className="error-title">
                            {t('classroomErrorPage.title', { defaultValue: 'Classroom Not Available' })}
                        </h1>

                        <p className="error-description">
                            {errorMessage || t('classroomErrorPage.defaultError', { defaultValue: 'Failed to load classroom details.' })}
                        </p>

                        <div className="error-details">
                            <p className="error-details-heading">
                                {t('classroomErrorPage.possibleReasons', { defaultValue: 'Possible reasons:' })}
                            </p>
                            <ul className="error-reasons-list">
                                <li>{t('classroomErrorPage.reasonDeleted', { defaultValue: 'The classroom may have been deleted' })}</li>
                                <li>{t('classroomErrorPage.reasonNoPermission', { defaultValue: 'You may not have permission to access this classroom' })}</li>
                                <li>{t('classroomErrorPage.reasonNetwork', { defaultValue: 'There might be a temporary network issue' })}</li>
                                <li>{t('classroomErrorPage.reasonInvalidId', { defaultValue: 'The classroom ID may be invalid' })}</li>
                            </ul>
                        </div>

                        <div className="error-actions">
                            <button
                                type="button"
                                className="error-btn error-btn-primary"
                                onClick={handleTryAgain}
                            >
                                <FiRefreshCw size={16} />
                                <span>{t('classroomErrorPage.tryAgain', { defaultValue: 'Try Again' })}</span>
                            </button>

                            <button
                                type="button"
                                className="error-btn error-btn-secondary"
                                onClick={handleGoBack}
                            >
                                <FiArrowLeft size={16} />
                                <span>{t('classroomErrorPage.goHome', { defaultValue: 'Go to Dashboard' })}</span>
                            </button>
                        </div>

                        <div className="error-help">
                            <p>
                                {t('classroomErrorPage.helpText', { defaultValue: 'If this problem persists, please contact your teacher or try refreshing the page.' })}
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};

export default ClassroomErrorPage;
