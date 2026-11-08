// src/pages/TermsOfServicePage.jsx

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaFileContract, FaArrowLeft, FaShieldAlt, FaUserCheck, FaGavel } from "react-icons/fa";
import "../CSS/PrivacyPolicy.css";
import echaiLogoIcon from "../image/icon.ico";

const TermsOfServicePage = () => {
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
          <span className="legal-badge">Terms & Conditions</span>
          <h1 className="legal-title">
            {lang === "th" ? "ข้อกำหนดและเงื่อนไขการใช้บริการ (Terms of Service)" : "Terms of Service"}
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
                <h2>1. การยอมรับข้อกำหนด (Acceptance of Terms)</h2>
                <p>
                  ยินดีต้อนรับสู่ <strong>Echair</strong> แพลตฟอร์มบริหารจัดการผังที่นั่ง การเช็กชื่อ และการเรียนการสอนในห้องเรียนแบบเรียลไทม์ ผ่านเว็บไซต์{" "}
                  <a href="https://echair.online" target="_blank" rel="noreferrer">
                    https://echair.online
                  </a>
                </p>
                <p>
                  การเข้าใช้งาน การสมัครสมาชิก หรือการเข้าสู่ระบบผ่าน Google Sign-In ถือว่าท่านได้อ่าน ทำความเข้าใจ และตกลงที่จะปฏิบัติตามข้อกำหนดและเงื่อนไขฉบับนี้ รวมถึง{" "}
                  <Link to="/privacypolicy" style={{ color: "#2563eb", textDecoration: "underline" }}>
                    นโยบายความเป็นส่วนตัว (Privacy Policy)
                  </Link>{" "}
                  ของเราทุกประการ หากท่านไม่เห็นด้วยกับข้อกำหนดข้อใดข้อหนึ่ง โปรดระงับการใช้งานระบบทันที
                </p>
              </section>

              <section className="legal-section">
                <h2>2. บัญชีผู้ใช้และความปลอดภัย (User Accounts & Security)</h2>
                <ul>
                  <li>
                    <strong>การยืนยันตัวตน:</strong> ผู้ใช้สามารถเข้าสู่ระบบด้วยบัญชี Google หรืออีเมลที่ได้รับอนุญาต ท่านต้องรับผิดชอบในการรักษาความลับของบัญชีและรหัสผ่านของตนเอง
                  </li>
                  <li>
                    <strong>ความถูกต้องของข้อมูล:</strong> ท่านตกลงที่จะให้ข้อมูลที่เป็นจริง ถูกต้อง และเป็นปัจจุบันในการสร้างหรือแก้ไขโปรไฟล์
                  </li>
                  <li>
                    <strong>การแจ้งเตือนเหตุผิดปกติ:</strong> หากพบการเข้าถึงบัญชีโดยไม่ได้รับอนุญาตหรือเหตุการณ์ที่อาจกระทบต่อความปลอดภัย ท่านต้องแจ้งผู้ดูแลระบบทันที
                  </li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>3. แนวทางการใช้งานที่เหมาะสม (Acceptable Use Policy)</h2>
                <p>ในการใช้งาน Echair ผู้ใช้ตกลงที่จะไม่กระทำการใดๆ ดังต่อไปนี้:</p>
                <ul>
                  <li>ใช้ระบบเพื่อการกระทำที่ผิดกฎหมาย ละเมิดสิทธิผู้อื่น หรือขัดต่อศีลธรรมอันดี</li>
                  <li>ส่งข้อความ รูปรวม หรือสื่อที่มีลักษณะคุกคาม ก่อกวน ลามกอนาจาร หรือสร้างความเกลียดชังในระบบแชตของห้องเรียน</li>
                  <li>พยายามเจาะระบบ ขัดขวางการทำงาน ส่งไวรัส หรือเข้าถึงข้อมูลห้องเรียนและข้อมูลผู้ใช้อื่นโดยมิชอบ</li>
                  <li>ปลอมแปลงตัวตน แอบอ้างเป็นบุคคลอื่น หรือทำการเช็กชื่อ/ส่งงานแทนผู้อื่นอันเป็นการทุจริตทางวิชาการ</li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>4. สิทธิ์ในทรัพย์สินทางปัญญา (Intellectual Property)</h2>
                <p>
                  ซอฟต์แวร์ ซอร์สโค้ด เครื่องหมายการค้า โลโก้ และการออกแบบส่วนติดต่อผู้ใช้ (UI/UX) ทั้งหมดของ Echair เป็นทรัพย์สินทางปัญญาของผู้พัฒนาระบบ ห้ามมิให้ผู้ใดคัดลอก ดัดแปลง แจกจ่าย หรือทำซ้ำเพื่อผลประโยชน์ทางการค้าโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
                </p>
                <p>
                  เนื้อหา ไฟล์งาน หรือสื่อการสอนที่อาจารย์และนักศึกษาอัปโหลดขึ้นสู่ระบบ ยังคงเป็นกรรมสิทธิ์ของเจ้าของเนื้อหา โดยผู้ใช้อนุญาตให้ Echair มีสิทธิ์ประมวลผลและแสดงผลเนื้อหาดังกล่าวเพื่อการจัดการเรียนการสอนภายในห้องเรียนเท่านั้น
                </p>
              </section>

              <section className="legal-section">
                <h2>5. การระงับและการยกเลิกการให้บริการ (Suspension & Termination)</h2>
                <p>
                  ผู้ดูแลระบบขอสงวนสิทธิ์ในการตักเตือน ระงับการใช้งานชั่วคราว หรือเพิกถอนบัญชีผู้ใช้ทันทีโดยไม่ต้องแจ้งให้ทราบล่วงหน้า หากพบว่ามีการละเมิดข้อกำหนดการใช้งานฉบับนี้ หรือมีพฤติกรรมที่สร้างความเสียหายต่อระบบและผู้ใช้งานท่านอื่น
                </p>
              </section>

              <section className="legal-section">
                <h2>6. การจำกัดความรับผิดชอบ (Limitation of Liability)</h2>
                <p>
                  Echair ให้บริการระบบ "ตามสภาพที่เป็นอยู่" (AS IS) และ "ตามความพร้อมใช้งาน" (AS AVAILABLE) แม้ว่าทีมงานจะพยายามอย่างเต็มที่เพื่อรักษาความต่อเนื่องและความปลอดภัยของระบบ แต่เราไม่สามารถรับประกันได้ว่าระบบจะปราศจากข้อผิดพลาด 100% หรือไม่เกิดการหยุดชะงักจากปัจจัยภายนอก (เช่น เครือข่ายอินเทอร์เน็ต เซิร์ฟเวอร์ผู้ให้บริการภายนอก)
                </p>
              </section>

              <section className="legal-section">
                <h2>7. การแก้ไขเปลี่ยนแปลงข้อกำหนด (Modifications)</h2>
                <p>
                  เราอาจปรับปรุงหรือแก้ไขข้อกำหนดฉบับนี้เป็นครั้งคราวตามความเหมาะสม โดยจะแสดงวันที่อัปเดตล่าสุดที่ด้านบนของหน้านี้ การที่ท่านยังคงใช้งานระบบต่อไปหลังจากการเปลี่ยนแปลง ถือว่าท่านยอมรับข้อกำหนดที่แก้ไขแล้ว
                </p>
              </section>

              <section className="legal-section">
                <h2>8. ช่องทางการติดต่อ (Contact Us)</h2>
                <p>หากท่านมีข้อสงสัยเกี่ยวกับข้อกำหนดการใช้งานฉบับนี้ กรุณาติดต่อ:</p>
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
                <h2>1. Acceptance of Terms</h2>
                <p>
                  Welcome to <strong>Echair</strong>, an educational classroom management, interactive seating chart, and attendance system accessible via{" "}
                  <a href="https://echair.online" target="_blank" rel="noreferrer">
                    https://echair.online
                  </a>
                  .
                </p>
                <p>
                  By accessing, browsing, registering an account, or signing in via Google Sign-In, you agree to be bound by these Terms of Service and our{" "}
                  <Link to="/privacypolicy" style={{ color: "#2563eb", textDecoration: "underline" }}>
                    Privacy Policy
                  </Link>
                  . If you do not agree to these terms, please discontinue using the service immediately.
                </p>
              </section>

              <section className="legal-section">
                <h2>2. User Accounts and Responsibilities</h2>
                <ul>
                  <li>
                    <strong>Authentication:</strong> You may sign in using your authorized Google Account or email credentials. You are responsible for safeguarding your login credentials.
                  </li>
                  <li>
                    <strong>Accuracy of Information:</strong> You agree to provide accurate and truthful profile information during the registration and classroom participation process.
                  </li>
                  <li>
                    <strong>Security Notification:</strong> You must immediately notify the platform administrator of any unauthorized use or security breach related to your account.
                  </li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>3. Acceptable Use Policy</h2>
                <p>Users must not engage in any of the following prohibited behaviors:</p>
                <ul>
                  <li>Using the platform for any illegal, infringing, or harmful purposes.</li>
                  <li>Posting or transmitting harassing, defamatory, abusive, or obscene material through classroom chats.</li>
                  <li>Attempting to probe, disrupt, exploit, or bypass system authentication and security boundaries.</li>
                  <li>Impersonating another student or teacher, or manipulating seating charts and attendance records dishonestly.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h2>4. Intellectual Property</h2>
                <p>
                  All software, code, logos, visual designs, and interface components of Echair are the exclusive intellectual property of the developers. You may not reproduce, copy, or redistribute any portion without prior written permission.
                </p>
                <p>
                  Educational materials uploaded by teachers and students remain the property of their respective owners, with a limited license granted to Echair to display and store them for the intended classroom purposes.
                </p>
              </section>

              <section className="legal-section">
                <h2>5. Account Suspension and Termination</h2>
                <p>
                  We reserve the right to suspend, terminate, or revoke access to any account that violates these Terms of Service or poses a security risk to other users without prior notice.
                </p>
              </section>

              <section className="legal-section">
                <h2>6. Disclaimer of Warranties and Limitation of Liability</h2>
                <p>
                  Echair is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind. We do not guarantee uninterrupted or error-free operation of the services. In no event shall Echair be held liable for indirect, incidental, or consequential damages resulting from platform usage.
                </p>
              </section>

              <section className="legal-section">
                <h2>7. Changes to Terms</h2>
                <p>
                  We may revise these Terms of Service periodically. Changes take effect upon posting to this page. Continued usage of Echair indicates acceptance of the revised terms.
                </p>
              </section>

              <section className="legal-section">
                <h2>8. Contact Information</h2>
                <p>If you have any questions or feedback regarding these terms, please contact us at:</p>
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

export default TermsOfServicePage;
