// src/App.js

import Loader from './components/Loader';
import ErrorPage from './pages/ErrorPage';
import React, { useState, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from './firebaseConfig';
import axios from 'axios';
import { API_AUTH_URL, APP_BASENAME } from './config/api';

const AccountSetting = lazy(() => import('./pages/AccountSetting'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const OtpVerificationPage = lazy(() => import('./pages/OtpVerificationPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
// Import the new ClassroomPage component
const ClassroomPage = lazy(() => import('./pages/ClassroomPage')); // ✨ Add this line

const ClassDetailPage = lazy(() => import('./pages/ClassDetailPage')); // ✨ Add Class Detail Page
const AppSettingsPage = lazy(() => import('./pages/AppSettingsPage')); // ✨ Add App Settings Page
const PrivateClassroomPage = lazy(() => import('./pages/PrivateClassroomPage')); // ✨ Add Private Classroom Page
const ClassroomErrorPage = lazy(() => import('./pages/ClassroomErrorPage')); // ✨ Add Classroom Error Page
const Layout = lazy(() => import('./components/Layout')); // ✨ Add Layout component
const EventPresentationPage = lazy(() => import('./pages/EventPresentationPage')); // ✨ Add Presentation Page
const StreamPage = lazy(() => import('./pages/StreamPage')); // ✨ Add Stream Page
const AssignmentDetailPage = lazy(() => import('./pages/AssignmentDetailPage')); // ✨ Add Assignment Detail Page
const AdminPage = lazy(() => import('./pages/AdminPage')); // 🛡️ Hidden Admin Page

const backendUrl = API_AUTH_URL;

function App() {
    const [user, setUser] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        // อ่านสถานะ sidebar จาก localStorage เมื่อเริ่มต้น
        const savedSidebarState = localStorage.getItem('sidebarOpen');
        // ถ้าไม่มีค่าใน localStorage ให้เริ่มต้นเป็น true (เปิด)
        return savedSidebarState !== null ? savedSidebarState === 'true' : true;
    });
    const [authLoading, setAuthLoading] = useState(true);
    const notificationHandlerRef = useRef(null); // ✨ Ref เพื่อเก็บฟังก์ชัน addNotification

    const setNotificationHandler = useCallback((handler) => {
        // ✨ Callback ที่ Navbar จะเรียกเพื่อส่งฟังก์ชัน addNotification กลับมา
        notificationHandlerRef.current = handler();
    }, []);

    const handleLoginSuccess = (userData) => {
        setUser(userData);
    };

    const handleSignOut = useCallback(async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                // Call backend to trigger logout notification
                try {
                    await axios.post(`${backendUrl}/logout`, {}, {
                        headers: { 'x-auth-token': token }
                    });
                } catch (err) {
                    console.error("Failed to notify server of logout:", err);
                }
            }

            localStorage.removeItem('authToken');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userPhotoURL');
            // รีเซ็ตสถานะ sidebar เมื่อออกจากระบบ เป็นเปิด
            localStorage.setItem('sidebarOpen', 'true');
            setIsSidebarOpen(true);
            if (auth.currentUser) {
                await signOut(auth);
            }
            setUser(null);
        } catch (error) {
            console.error("ข้อผิดพลาดในการออกจากระบบ:", error);
        }
    }, []);

    const toggleSidebar = () => {
        const newSidebarState = !isSidebarOpen;
        setIsSidebarOpen(newSidebarState);
        // บันทึกสถานะ sidebar ลง localStorage
        localStorage.setItem('sidebarOpen', newSidebarState.toString());
    };

    const updateUserProfile = useCallback((updatedData) => {
        setUser(prevUser => ({
            ...prevUser,
            ...updatedData
        }));
        const storedAuthToken = localStorage.getItem('authToken');
        if (storedAuthToken) {
            localStorage.setItem('userProfile', JSON.stringify({
                ...JSON.parse(localStorage.getItem('userProfile')),
                ...updatedData
            }));
            // Also update photoURL separately if it's being updated
            if (updatedData.photoURL) {
                localStorage.setItem('userPhotoURL', updatedData.photoURL);
            }
        }
    }, []);

    useEffect(() => {
        const storedAuthToken = localStorage.getItem('authToken');
        const storedUserProfile = localStorage.getItem('userProfile');
        const storedPhotoURL = localStorage.getItem('userPhotoURL');

        if (storedAuthToken && storedUserProfile) {
            try {
                const parsedUser = JSON.parse(storedUserProfile);
                // Merge photoURL from separate storage if available
                if (storedPhotoURL) {
                    parsedUser.photoURL = storedPhotoURL;
                }
                setUser({ ...parsedUser, token: storedAuthToken });
            } catch (e) {
                console.error("Failed to parse user profile from localStorage", e);
                localStorage.removeItem('authToken');
                localStorage.removeItem('userProfile');
                localStorage.removeItem('userPhotoURL');
                setUser(null);
            } finally {
                // ตั้งค่า loading เป็น false เมื่อโหลดข้อมูลจาก localStorage เสร็จสิ้น
                setAuthLoading(false);
            }
        } else {
            const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                // ไม่เรียก backend /me ด้วย Firebase ID Token อีกต่อไป
                // ให้ LoginPage เป็นผู้ตั้งค่า user และ localStorage ผ่าน onLoginSuccess แทน
                if (!firebaseUser) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userProfile');
                    localStorage.removeItem('userPhotoURL');
                    setUser(null);
                }
                setAuthLoading(false);
            });
            // คืนค่าฟังก์ชัน unsubscribe เพื่อ clean up เมื่อ component ถูก unmount
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        const savedSidebarState = localStorage.getItem('isSidebarOpen');
        if (savedSidebarState !== null) {
            setIsSidebarOpen(savedSidebarState === 'true');
        }
    }, []);

    if (authLoading) {
        return <Loader />;
    }


    return (
        <Router basename={APP_BASENAME}>
            <Suspense fallback={<Loader />}>
                <AppRoutes
                    user={user}
                    onLoginSuccess={handleLoginSuccess}
                    handleSignOut={handleSignOut}
                    updateUserProfile={updateUserProfile}
                    isSidebarOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                    addNotification={notificationHandlerRef.current} // ✨ ส่งฟังก์ชันไปให้ AppRoutes
                    onAddNotification={setNotificationHandler} // ✨ ส่ง callback ไปให้ AppRoutes
                />
            </Suspense>
        </Router>
    );
}

// 
function AppRoutes({ user, onLoginSuccess, handleSignOut, updateUserProfile, isSidebarOpen, toggleSidebar, addNotification, onAddNotification }) {
    const navigate = useNavigate();

    // 
    const handleSignOutAndNavigate = async () => {
        await handleSignOut();
        navigate('/login');
    };


    return (
        <Suspense fallback={<Loader />}>
            <Routes>
                <Route
                    path="/login"
                    element={user ? <Navigate to="/" /> :
                        <LoginPage onLoginSuccess={onLoginSuccess} />
                    }
                />
                <Route
                    path="/reset-password/:token"
                    element={user ? <Navigate to="/" /> :
                        <Layout user={null} handleSignOut={handleSignOut} classrooms={[]} isLoginPage={true} onAddNotification={onAddNotification}>
                            <ResetPasswordPage />
                        </Layout>
                    }
                />
                <Route
                    path="/otp-verification"
                    element={user ? <Navigate to="/" /> :
                        <OtpVerificationPage onLogin={onLoginSuccess} />
                    }
                />
                <Route
                    path="/"
                    element={user ? <DashboardPage
                        user={user}
                        updateUserProfile={updateUserProfile}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        onSignOut={handleSignOutAndNavigate} // ส่งฟังก์ชันใหม่ไปที่ DashboardPage
                        addNotification={addNotification} // ✨ ส่งฟังก์ชัน addNotification
                        onAddNotification={onAddNotification} // ✨ ส่ง callback onAddNotification
                    /> : <Navigate to="/login" />}
                />
                <Route
                    path="/account-setting"
                    element={user ? <AccountSetting
                        user={user}
                        updateUserProfile={updateUserProfile}
                        onSignOut={handleSignOutAndNavigate} // ส่งฟังก์ชันใหม่
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                    /> : <Navigate to="/login" />}
                />
                <Route
                    path="/app-settings"
                    element={user ? <AppSettingsPage
                        user={user}
                        updateUserProfile={updateUserProfile}
                        onSignOut={handleSignOutAndNavigate}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                    /> : <Navigate to="/login" />}
                />
                {/* 🛡️ Hidden Admin Page Route */}
                <Route
                    path="/admin"
                    element={user ? <AdminPage
                        user={user}
                        updateUserProfile={updateUserProfile}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        onSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                />
                {/* Add a new route for the classroom details page */}
                <Route
                    path="/classroom/:classId"
                    element={user ? <ClassroomPage
                        user={user}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        handleSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                /> {/* ✨ Add this new route */}

                {/* Add a new route for the class detail page */}
                <Route
                    path="/classroom/:classId/detail"
                    element={user ? <ClassDetailPage
                        user={user}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        handleSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                /> {/* ✨ Add Class Detail route */}
                <Route
                    path="/classroom/:classId/stream"
                    element={user ? <StreamPage
                        user={user}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        handleSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                /> {/* ✨ Add Stream route */}
                {/* Add a new route for the assignment detail page */}
                <Route
                    path="/classroom/:classId/classwork/:assignmentId"
                    element={user ? <AssignmentDetailPage
                        user={user}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        handleSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                /> {/* ✨ Add Assignment Detail route */}
                <Route
                    path="/classroom/:classroomId/private"
                    element={user ? <PrivateClassroomPage
                        user={user}
                        updateUserProfile={updateUserProfile}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        handleSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                /> {/* ✨ Add Private Classroom route */}
                <Route
                    path="/classroom/:classroomId/error"
                    element={user ? <ClassroomErrorPage
                        user={user}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        handleSignOut={handleSignOutAndNavigate}
                    /> : <Navigate to="/login" />}
                /> {/* ✨ Add Classroom Error route */}
                <Route 
                    path="/presentation/:classId/:eventId" 
                    element={<EventPresentationPage />} 
                /> {/* ✨ Add Presentation route */}
                <Route path="*" element={<p style={{ textAlign: 'center', fontSize: '2em', marginTop: '100px' }}>404 Page Not Found</p>} />
            </Routes>
        </Suspense>
    );
}

export default App;
