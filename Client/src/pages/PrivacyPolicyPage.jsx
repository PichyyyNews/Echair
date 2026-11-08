// src/pages/PrivacyPolicyPage.jsx

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaShieldAlt, FaArrowLeft, FaGlobe, FaCheckCircle, FaLock, FaUserCheck } from "react-icons/fa";
import "../CSS/PrivacyPolicy.css";
import echaiLogoIcon from "../image/icon.ico";

const PrivacyPolicyPage = () => {
  const [lang, setLang] = useState("th"); // 'th' or 'en'
  const lastUpdated = "8 พฤศจิกายน 2026 (November 8, 2026)";

  return (
    <div className="legal-container">
      {/* Top Navigation */}
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/login" className="legal-brand">
            <img src={echaiLogoIcon} alt="Echair Logo" />
            <span>Echair</span>
          </Link>

          <div className="legal-nav-actions">
            <div className="legal-lang-toggle" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`legal-lang-btn ${lang === "th" ? "active" : ""}`}
                onClick={() => setLang("th")}
              >
                ไทย
              </button>
              <button
                type="button"
                className={`legal-lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
              >
                English
              </button>
            </div>

            <Link to="/login" className="legal-back-btn">
              <FaArrowLeft size={12} />
              <span>{lang === "th" ? "กลับสู่หน้าเข้าสู่ระบบ" : "Back to Login"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="legal-main">
        <div className="legal-card">
          <span className="legal-badge">Official Policy</span>
          <h1 className="legal-title">
            {lang === "th" ? "นโยบายความเป็นส่วนตัว (Privacy Policy)" : "Privacy Policy"}
          </h1>
          <div className="legal-meta">
            <strong>Domain:</strong> https://echair.online | <strong>Application:</strong> Echair Classroom Management System
            <br />
            <strong>Last Updated:</strong> {lastUpdated}
          </div>

          {lang === "th" ? (
            /* --- Thai Content --- */
            <article>
              <section className="legal-section">
                <h2>1. บทนำและความโปร่งใส</h2>
                <p>
                  ยินดีต้อนรับสู่ <strong>Echair</strong> (ให้บริการผ่านเว็บไซต์{" "}
                  <a href="https://echair.online" target="_blank" rel="noreferrer">
                    https://echair.online
                  </a>
                  ) แพลตฟอร์มบริหารจัดการผังที่นั่งในชั้นเรียน การเช็กชื่อ และการมีส่วนร่วมในห้องเรียนสำหรับสถานศึกษา
                </p>
                <p>
                  เราให้ความสำคัญและเคารพต่อความเป็นส่วนตัวของผู้ใช้งานทุกคน (อาจารย์ บุคลากร และนักศึกษา) นโยบายฉบับนี้อธิบายถึงประเภทข้อมูลที่เราจัดเก็บ วิธีการนำไปใช้ มาตรการรักษาความปลอดภัย และสิทธิ์ที่คุณมีต่อข้อมูลของคุณ
                </p>
              </section>

              <section className="legal-section">
                <h2>2. ข้อมูลที่เราจัดเก็บ</h2>
                <p>เมื่อคุณใช้งาน Echair เราอาจจัดเก็บข้อมูลที่จำเป็นดังต่อไปนี้:</p>
                <ul>
                  <li>
                    <strong>ข้อมูลบัญชีผู้ใช้จากการเข้าสู่ระบบด้วย Google (Google Sign-In):</strong> ได้แก่ ชื่อเต็ม (Display Name), ที่อยู่อีเมล (Email Address), และรูปภาพโปรไฟล์ (Profile Picture URL)
                  </li>
                  <li>
                    <strong>ข้อมูลชั้นเรียนและผังที่นั่ง:</strong> รายชื่อห้องเรียนที่สร้างหรือเข้าร่วม, ตำแหน่งการนั่งในห้องเรียน, ประวัติการเข้าเรียน (Attendance), และคะแนนกิจกรรมในชั้นเรียน
                  </li>
                  <li>
                    <strong>ข้อมูลการสื่อสารและการบ้าน:</strong> ข้อความสนทนาในห้องเรียน, ไฟล์การบ้าน และแบบฝึกหัดที่ส่งผ่านระบบ
                  </li>
                  <li>
                    <strong>ข้อมูลทางเทคนิคและบันทึกการใช้งาน (Log Data):</strong> IP Address, ชนิดของเบราว์เซอร์, อุปกรณ์ที่เข้าใช้ และเวลาเข้าใช้งาน เพื่อวัตถุประสงค์ด้านความปลอดภัยของเซสชันและการป้องกันการโจมตีระบบ
                  </li>
                </ul>
              </section>

              {/* Google API Limited Use Policy Box */}
              <div className="legal-callout">
                <h3><FaLock style={{ marginRight: 6 }} /> มาตรฐานการปฏิบัติตามนโยบายข้อมูลผู้ใช้ของ Google (Google User Data Policy)</h3>
                <p>
                  การใช้งานและส่งต่อข้อมูลที่ได้รับจาก Google APIs ของ Echair เป็นไปตาม{" "}
                  <strong>Google API Services User Data Policy</strong> รวมถึงข้อกำหนด{" "}
                  <strong>Limited Use</strong> อย่างเคร่งครัด
                </p>
                <p>
                  • เรา<strong>ไม่นำ</strong>ข้อมูลโปรไฟล์ Google ของคุณไปใช้เพื่อการโฆษณา หรือการตลาดเชิงพาณิชย์
                  <br />
                  • เรา<strong>ไม่ขาย แลกเปลี่ยน หรือให้เช่า</strong>ข้อมูลส่วนบุคคลของคุณแก่บุคคลภายนอกโดยเด็ดขาด
                  <br />
                  • ข้อมูล Google จะถูกใช้เพื่อวัตถุประสงค์ในการระบุตัวตนและยืนยันสิทธิ์เข้าใช้งานห้องเรียนเท่านั้น
                </p>
              </div>

              <section className="legal-section">
                <h2>3. วัตถุประสงค์การใช้ข้อมูล</h2>
                <p>เรานำข้อมูลที่จัดเก็บไปใช้เพื่อ:</p>
                <ul>
                  <li>ยืนยันตัวตนและรักษาความปลอดภัยของบัญชีผู้ใช้งาน</li>
                  <li>อำนวยความสะดวกในการจัดผังที่นั่งและการแสดงผลแบบเรียลไทม์ระหว่างผู้สอนและผู้เรียน</li>
                  <li>บันทึกคะแนนการมีส่วนร่วม การเช็กชื่อ และการส่งงานภายในวิชาเรียน</li>
                  <li>ส่งการแจ้งเตือนสำคัญเกี่ยวกับห้องเรียนหรือการบ้าน</li>
                  <li>ดูแลรักษาเสถียรภาพและตรวจสอบความปลอดภัยของระบบ</li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>4. ความมั่นคงปลอดภัยของข้อมูล (Data Security)</h2>
                <p>
                  เราใช้มาตรการทางเทคนิคและการบริหารจัดการที่เข้มงวดเพื่อปกป้องข้อมูลของคุณ:
                </p>
                <ul>
                  <li>การเชื่อมต่อทั้งหมดผ่านโปรโตคอลความปลอดภัย <strong>HTTPS (SSL/TLS 256-bit)</strong></li>
                  <li>รหัสผ่าน (ในกรณีใช้งานบัญชีปกติ) ถูกเข้ารหัสทางเดียวด้วยมาตรฐาน <strong>bcrypt</strong> ที่มีความปลอดภัยสูง</li>
                  <li>การยืนยันเซสชันผ่าน <strong>JSON Web Token (JWT)</strong> พร้อมระบบตรวจสอบและเพิกถอนเซสชันที่ผิดปกติ</li>
                  <li>การจำกัดสิทธิ์การเข้าถึงฐานข้อมูลเฉพาะผู้ดูแลระบบที่มีหน้าที่เกี่ยวข้องเท่านั้น</li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>5. สิทธิ์ของผู้ใช้และการลบข้อมูล (Data Retention & Deletion)</h2>
                <p>
                  ผู้ใช้มีสิทธิ์ในการเข้าถึง ขอสำเนา หรือร้องขอให้แก้ไขข้อมูลส่วนบุคคลของตนเองได้ตลอดเวลา นอกจากนี้ หากคุณต้องการลบบัญชีผู้ใช้งานและข้อมูลทั้งหมดของคุณออกจากระบบ Echair คุณสามารถติดต่อผู้ดูแลระบบได้ที่อีเมลด้านล่างนี้ โดยระบบจะดำเนินการลบข้อมูลของคุณภายใน 30 วันทำการ
                </p>
              </section>

              <section className="legal-section">
                <h2>6. ช่องทางการติดต่อ (Contact Us)</h2>
                <p>
                  หากมีข้อสงสัย ข้อเสนอแนะ หรือต้องการใช้สิทธิ์เกี่ยวกับข้อมูลส่วนบุคคลของคุณ สามารถติดต่อเราได้ที่:
                </p>
                <ul>
                  <li><strong>อีเมลสนับสนุน:</strong> support@echair.online</li>
                  <li><strong>ผู้ดูแลระบบ:</strong> newskung43@gmail.com</li>
                  <li><strong>เว็บไซต์:</strong> <a href="https://echair.online">https://echair.online</a></li>
                </ul>
              </section>
            </article>
          ) : (
            /* --- English Content (for Google Review & International Users) --- */
            <article>
              <section className="legal-section">
                <h2>1. Introduction</h2>
                <p>
                  Welcome to <strong>Echair</strong> (accessible at{" "}
                  <a href="https://echair.online" target="_blank" rel="noreferrer">
                    https://echair.online
                  </a>
                  ). Echair is an interactive classroom management and dynamic seating chart platform developed to facilitate engagement between instructors and students in educational environments.
                </p>
                <p>
                  We are deeply committed to protecting your privacy. This Privacy Policy details the types of personal data we collect, how it is used, how it is safeguarded, and your rights concerning your personal information.
                </p>
              </section>

              <section className="legal-section">
                <h2>2. Information We Collect</h2>
                <p>When using Echair, we collect the following necessary information:</p>
                <ul>
                  <li>
                    <strong>Google Sign-In Account Information:</strong> When you sign in using Google, we access basic public profile information provided by Google OAuth, including your full name, email address, and profile picture URL.
                  </li>
                  <li>
                    <strong>Classroom and Academic Data:</strong> Classroom enrollments, interactive seat assignments, real-time attendance records, class participation scores, and assignment submissions.
                  </li>
                  <li>
                    <strong>In-Class Communication:</strong> Messages exchanged in real-time within classroom chat rooms.
                  </li>
                  <li>
                    <strong>Technical and Log Information:</strong> IP address, browser type, operating system, and login session timestamps collected strictly for security auditing, anomaly detection, and account protection.
                  </li>
                </ul>
              </section>

              {/* Google API Limited Use Policy Box */}
              <div className="legal-callout">
                <h3><FaShieldAlt style={{ marginRight: 6 }} /> Google API Services User Data Policy Compliance</h3>
                <p>
                  Echair's use and transfer to any other app of information received from Google APIs adheres to the{" "}
                  <strong>Google API Services User Data Policy</strong>, including the <strong>Limited Use</strong> requirements.
                </p>
                <p>
                  • We <strong>never</strong> use Google user data to serve advertisements or for personalized retargeting.
                  <br />
                  • We <strong>do not sell, rent, or trade</strong> your Google profile data to any third parties or data brokers.
                  <br />
                  • Your Google data is strictly utilized to authenticate your identity and display your academic profile within the Echair classroom environment.
                </p>
              </div>

              <section className="legal-section">
                <h2>3. How We Use Your Information</h2>
                <p>We use the collected information for the following specific purposes:</p>
                <ul>
                  <li>Authenticating user sessions and verifying classroom memberships.</li>
                  <li>Displaying real-time classroom layouts, attendance sheets, and student scorecards.</li>
                  <li>Facilitating classroom messaging and assignment workflows.</li>
                  <li>Maintaining platform stability, preventing unauthorized access, and monitoring security threats.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>4. Data Protection & Security</h2>
                <p>
                  We implement robust technical and operational measures to ensure the highest standards of data security:
                </p>
                <ul>
                  <li>All communications are encrypted in transit using industry-standard <strong>HTTPS (TLS/SSL)</strong>.</li>
                  <li>Native account credentials are hashed using <strong>bcrypt</strong> with salt rounds.</li>
                  <li>Authentication is authorized using cryptographically signed <strong>JSON Web Tokens (JWT)</strong>.</li>
                  <li>Access controls ensure users can only view classrooms and student data they are authorized to access.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>5. Data Retention and Account Deletion</h2>
                <p>
                  We retain personal data only for as long as necessary to provide educational classroom services. Users have the right to request access to their data or request complete deletion of their account and all associated classroom records. To initiate a data deletion request, please reach out via the contact email below.
                </p>
              </section>

              <section className="legal-section">
                <h2>6. Contact Information</h2>
                <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:</p>
                <ul>
                  <li><strong>Support Email:</strong> support@echair.online</li>
                  <li><strong>Developer Email:</strong> newskung43@gmail.com</li>
                  <li><strong>Website:</strong> <a href="https://echair.online">https://echair.online</a></li>
                </ul>
              </section>
            </article>
          )}
        </div>

        <footer className="legal-footer">
          <p>© {new Date().getFullYear()} Echair (https://echair.online). All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
