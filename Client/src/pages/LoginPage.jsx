// src/pages/LoginPage.jsx

import React, { useState, useEffect } from "react";
import "../CSS/Login.css";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebaseConfig";
import axios from "axios";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import { useTranslation } from "react-i18next"; // ✨ Add useTranslation hook
import classroomBgImage from "../image/Gemini_Generated_Image_fnyc63fnyc63fnyc.png";
import echaiLogoIcon from "../image/icon.ico";

import { API_AUTH_URL } from '../config/api';
const backendUrl = API_AUTH_URL;
const MySwal = withReactContent(Swal);

/* ===== Inline SVG Icons ===== */
const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// เพิ่ม onLoginSuccess เป็น prop ที่รับจาก App.jsx
const LoginPage = ({ onLoginSuccess, isSidebarOpen = false }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation(); // ✨ Apply hook

  useEffect(() => {
    setPasswordsMatch(password === confirmPassword && confirmPassword !== "");
  }, [password, confirmPassword]);

  // Password strength validation
  const validatePassword = (pwd) => {
    const requirements = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    const score = Object.values(requirements).filter(Boolean).length;
    return { requirements, score, isValid: score >= 4 };
  };

  const passwordValidation = validatePassword(password);

  const getStrengthText = () => {
    if (passwordValidation.score === 0) return '';
    if (passwordValidation.score <= 1) return t('login.pwdStrength.weak') || 'รหัสผ่านคาดเดาง่าย (Weak)';
    if (passwordValidation.score <= 2) return t('login.pwdStrength.fair') || 'รหัสผ่านปลอดภัยปานกลาง (Fair)';
    if (passwordValidation.score <= 3) return t('login.pwdStrength.good') || 'รหัสผ่านปลอดภัยดี (Good)';
    return t('login.pwdStrength.strong') || 'รหัสผ่านปลอดภัยสูง (Strong)';
  };

  /* ===== Auth Handlers (ไม่เปลี่ยน Logic เดิม) ===== */

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      const response = await axios.post(`${backendUrl}/google-login-verify`, { idToken });
      const { token, user, isNewUser } = response.data;

      localStorage.setItem("authToken", token);
      localStorage.setItem("userProfile", JSON.stringify(user));
      if (user.photoURL) {
        localStorage.setItem("userPhotoURL", user.photoURL);
      }

      MySwal.fire({
        title: t('common.success') || "Success!",
        text: isNewUser ? (t('login.success.googleNew') || "Account created and logged in with Google successfully!") : (t('login.success.google') || "Login with Google successful."),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        onLoginSuccess({ ...user, token });
      });
    } catch (error) {
      console.error("Login with Google error:", error);
      const errorMessage = error.response?.data?.msg || t('login.error.googleFail') || "Failed to login with Google. Please try again.";
      MySwal.fire({ title: t('common.error') || "Error!", text: errorMessage, icon: "error" });
    }
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      MySwal.fire({ title: t('common.error') || "Error!", text: t('login.error.missingCreds') || "Please enter both email and password.", icon: "error" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      MySwal.fire({ title: t('common.error') || "Error!", text: t('login.error.invalidEmail') || "Please enter a valid email address.", icon: "error" });
      return;
    }

    setIsLoginLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/login`, {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data.requiresOtp) {
        navigate('/otp-verification', {
          state: { email: email.trim().toLowerCase(), password, tempUserId: response.data.tempUserId }
        });
        return;
      }

      const { token, user } = response.data;
      localStorage.setItem("authToken", token);
      localStorage.setItem("userProfile", JSON.stringify(user));
      if (user.photoURL) {
        localStorage.setItem("userPhotoURL", user.photoURL);
      }

      MySwal.fire({
        title: t('common.success') || "Success!",
        text: t('login.success.login') || "Login successful.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        onLoginSuccess({ ...user, token });
      });
    } catch (error) {
      console.error("Manual login error:", error);
      const errorMessage = error.response?.data?.msg || t('login.error.invalidCreds') || "Invalid email or password.";
      MySwal.fire({ title: t('login.error.loginFailed') || "Login Failed", text: errorMessage, icon: "error" });
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleManualRegister = async (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      MySwal.fire({ icon: 'error', title: t('login.error.invalidEmailTitle') || 'Invalid Email', text: t('login.error.invalidEmail') || 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      MySwal.fire({ icon: 'error', title: t('login.error.pwdShortTitle') || 'Password Too Short', text: t('login.error.pwdShort') || 'Password must be at least 6 characters long.' });
      return;
    }
    if (!passwordsMatch) {
      MySwal.fire({ icon: 'error', title: t('login.error.pwdMismatchTitle') || 'Password Mismatch', text: t('login.error.pwdMismatch') || 'Passwords do not match.' });
      return;
    }
    if (!acceptTerms) {
      MySwal.fire({ icon: 'error', title: t('login.error.termsTitle') || 'Terms and Conditions', text: t('login.error.termsRequired') || 'Please accept the Terms and Conditions to continue.' });
      return;
    }

    setIsRegisterLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/register`, {
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
      });
      const { token, user } = response.data;

      localStorage.setItem("authToken", token);
      localStorage.setItem("userProfile", JSON.stringify(user));
      if (user.photoURL) {
        localStorage.setItem("userPhotoURL", user.photoURL);
      }

      MySwal.fire({
        title: t('common.success') || "Success!",
        text: t('login.success.register') || "Registration successful. You are now logged in.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        onLoginSuccess({ ...user, token });
      });
    } catch (error) {
      console.error("Manual registration error:", error);
      const errorMessage = error.response?.data?.msg || t('login.error.registerFail') || "Registration failed. Please try again.";
      MySwal.fire({ title: t('login.error.registerFailedTitle') || "Registration Failed", text: errorMessage, icon: "error" });
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      MySwal.fire({ icon: "error", title: t('login.forgotPwd.missingEmailTitle') || "Missing Email", text: t('login.forgotPwd.missingEmail') || "Please enter your email address.", confirmButtonColor: "#10b981" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      MySwal.fire({ icon: "error", title: t('login.error.invalidEmailTitle') || "Invalid Email", text: t('login.error.invalidEmail') || "Please enter a valid email address.", confirmButtonColor: "#10b981" });
      return;
    }

    setIsForgotPasswordLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/forgot-password`, { email: forgotPasswordEmail });
      MySwal.fire({ icon: "success", title: t('login.forgotPwd.emailSent') || "Email Sent!", text: response.data.msg, confirmButtonColor: "#10b981", timer: 5000, timerProgressBar: true });
      setShowForgotPasswordModal(false);
      setForgotPasswordEmail("");
    } catch (error) {
      console.error("Forgot password error:", error);
      let errorMessage = t('login.forgotPwd.error') || "An error occurred while sending the reset email.";
      if (error.response?.data?.msg) errorMessage = error.response.data.msg;
      MySwal.fire({ icon: "error", title: t('common.error') || "Error", text: errorMessage, confirmButtonColor: "#10b981" });
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  /* ===== RENDER ===== */
  return (
    <main className={`login-main ${isSidebarOpen ? 'shift' : ''}`}>
      <div className="login-container">
        {/* Mobile Top Accent */}
        <div className="login-mobile-accent"></div>

        {/* Left Panel - Image & Branding (Desktop Only) */}
        <div className="login-left-panel">
          <img referrerPolicy="no-referrer"
            src={classroomBgImage}
            alt="EChair Classroom"
            className="panel-bg-image"
          />
          <div className="panel-overlay"></div>
          <div className="panel-content">
            <h2 className="panel-title">
              {t('login.smart')} <br />
              <span className="highlight">{t('login.classroom')}</span>
            </h2>
            <p className="panel-desc">
              {t('login.description')}
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="login-right-panel">
          {/* Brand / Logo */}
          <div className="login-brand">
            <div className="brand-icon-wrapper">
              <img referrerPolicy="no-referrer" src={echaiLogoIcon} alt="EChair Logo" />
            </div>
            <h1 className="brand-text">
              EChair
            </h1>
          </div>

          {/* Toggle Tabs */}
          <div className="login-toggle-tabs">
            <div className={`tab-slider ${isRegisterMode ? 'tab-register' : 'tab-login'}`}></div>
            <button onClick={() => setIsRegisterMode(false)} className={!isRegisterMode ? 'active' : ''}>
              {t('login.tabLogin') || 'Login'}
            </button>
            <button onClick={() => setIsRegisterMode(true)} className={isRegisterMode ? 'active' : ''}>
              {t('login.tabRegister') || 'Register'}
            </button>
          </div>

          {/* Forms Container */}
          <div className="login-forms-container">
            {/* ===== LOGIN FORM ===== */}
            <form
              onSubmit={handleManualLogin}
              className={`login-form ${isRegisterMode ? 'form-hidden-left' : 'form-visible'}`}
            >
              <div className="input-group">
                <div className="input-icon"><MailIcon /></div>
                <input
                  type="email"
                  id="loginEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('login.emailPlaceholder') || "Your Email"}
                />
              </div>

              <div className="input-group">
                <div className="input-icon"><LockIcon /></div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="loginPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t('login.passwordPlaceholder') || "Password"}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              <div className="forgot-password-link">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="forgot-password-btn"
                >
                  {t('login.forgotPassword') || "Forgot password?"}
                </button>
              </div>

              <button type="submit" className="submit-button btn-login" disabled={isLoginLoading}>
                <span>{isLoginLoading ? (t('login.loggingIn') || "Logging in...") : (t('login.btnLogin') || "Login")}</span>
                {!isLoginLoading && <span className="btn-arrow"><ArrowRightIcon /></span>}
              </button>
            </form>

            {/* ===== REGISTER FORM ===== */}
            <form
              onSubmit={handleManualRegister}
              className={`login-form ${!isRegisterMode ? 'form-hidden-right' : 'form-visible'}`}
            >
              <div className="input-group">
                <div className="input-icon"><UserIcon /></div>
                <input
                  type="text"
                  id="registerDisplayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder={t('login.displayNamePlaceholder') || "Display name"}
                />
              </div>

              <div className="input-group">
                <div className="input-icon"><MailIcon /></div>
                <input
                  type="email"
                  id="registerEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('login.emailPlaceholder') || "Your Email"}
                />
              </div>

              <div className="input-group">
                <div className="input-icon"><LockIcon /></div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="registerPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t('login.createPasswordPlaceholder') || "Create password"}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="password-strength-bar">
                  <div className="strength-track">
                    <div
                      className={`strength-fill strength-${passwordValidation.score}`}
                      style={{ width: `${(passwordValidation.score / 5) * 100}%` }}
                    ></div>
                  </div>
                  <div className={`strength-label ${passwordValidation.score >= 3 ? 'is-strong' : ''}`}>
                    {passwordValidation.score >= 3 ? <CheckCircleIcon /> : <AlertCircleIcon />}
                    <span>{getStrengthText()}</span>
                  </div>
                </div>
              )}

              <div className="input-group">
                <div className="input-icon"><LockIcon /></div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder={t('login.confirmPasswordPlaceholder') || "Confirm password"}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>

                {confirmPassword && (
                  <div className={`match-status-simple ${passwordsMatch ? 'match' : 'no-match'}`}>
                    {passwordsMatch ? '✓' : '✗'}
                  </div>
                )}
              </div>

              {/* Terms and Conditions */}
              <div className="terms-row">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <label htmlFor="terms">
                  {t('login.agreeTo') || "I agree to the"}{' '}
                  <button type="button" className="terms-link" onClick={() => setShowTermsModal(true)}>
                    {t('login.terms') || "Terms of Service"}
                  </button>
                  {' '}{t('login.and') || "and"}{' '}
                  <button type="button" className="terms-link" onClick={() => setShowTermsModal(true)}>
                    {t('login.privacy') || "Privacy Policy"}
                  </button>
                  {' '}{t('login.ofEchair') || "of EChair"}
                </label>
              </div>

              <button type="submit" className="submit-button btn-register" disabled={!acceptTerms || isRegisterLoading}>
                {isRegisterLoading ? (t('login.creatingAccount') || "Creating account...") : (t('login.btnCreate') || "Create Account")}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="login-divider">
            <span>{t('login.orContinue') || "or continue with"}</span>
          </div>

          {/* Google Login */}
          <div className="google-login-section">
            <button onClick={handleGoogleSignIn} className="google-login-button">
              <GoogleIcon />
              <span>{t('login.googleContinue') || "Continue with Google"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Terms and Conditions Modal ===== */}
      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Terms of Service</h3>
              <button className="modal-close" onClick={() => setShowTermsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <h4>1. Acceptance of Terms</h4>
              <p>By using this service, you agree to be bound by these Terms and Conditions.</p>

              <h4>2. User Accounts</h4>
              <p>You are responsible for maintaining the confidentiality of your account credentials.</p>

              <h4>3. Privacy Policy</h4>
              <p>We respect your privacy and handle your data according to our Privacy Policy.</p>

              <h4>4. Prohibited Uses</h4>
              <p>You may not use this service for any unlawful or prohibited activities.</p>

              <h4>5. Limitation of Liability</h4>
              <p>We are not liable for any damages arising from your use of this service.</p>

              <h4>6. Changes to Terms</h4>
              <p>We reserve the right to modify these terms at any time.</p>
            </div>
            <div className="modal-footer">
              <button
                className="modal-accept-btn"
                onClick={() => { setAcceptTerms(true); setShowTermsModal(false); }}
              >
                Accept Terms
              </button>
              <button
                className="modal-cancel-btn"
                onClick={() => setShowTermsModal(false)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Forgot Password Modal ===== */}
      {showForgotPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowForgotPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="modal-close" onClick={() => setShowForgotPasswordModal(false)}>×</button>
            </div>
            <form onSubmit={handleForgotPassword}>
              <div className="modal-body">
                <p>Enter your email address and we'll send you a link to reset your password.</p>
                <div className="form-group">
                  <label htmlFor="forgotEmail">Email Address</label>
                  <input
                    type="email"
                    id="forgotEmail"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={isForgotPasswordLoading}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="modal-accept-btn" disabled={isForgotPasswordLoading}>
                  {isForgotPasswordLoading ? "Sending..." : "Send Reset Link"}
                </button>
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowForgotPasswordModal(false)}
                  disabled={isForgotPasswordLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default LoginPage;

