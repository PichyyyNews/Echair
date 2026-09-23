# 🚀 Echair System Handoff Document

> **Last Updated:** 23 กันยายน 2026  
> **Repository:** [https://github.com/PichyyyNews/Echair.git](https://github.com/PichyyyNews/Echair.git)  
> **Active Branch:** `main`  
> **Status:** All tests passing, Vite production build verified, Git committed & pushed.

---

## 📌 1. Executive Project Overview

**Echair (Web App Chair)** คือแพลตฟอร์มบริหารจัดการห้องเรียน ผังที่นั่งอัจฉริยะ (Interactive Seating Chart) การเช็กชื่อ (Attendance Tracking) ระบบการบ้านและส่งงาน (Assignment Submission) และระบบแชตสื่อสารแบบเรียลไทม์ โดยมีระบบผู้ดูแลระบบ (Admin Portal) ในตัว

### Tech Stack ปัจจุบัน:
- **Frontend:**
  - **Framework:** React 19 (`react`, `react-dom`)
  - **Bundler:** Vite 8 (`@vitejs/plugin-react`) — Build time ~1.6 วินาที
  - **Styling:** Custom Modular CSS with CSS Grid / Flexbox, Framer Motion, Lottie React
  - **Icons:** React Icons (`fi`, `fa`, `md`)
  - **HTTP & State:** Axios, React Context API (`AuthContext`, `SocketContext`), SweetAlert2
- **Backend:**
  - **Runtime:** Node.js (Express.js)
  - **Database:** MongoDB (Mongoose ODM) with compound indexes
  - **Cache:** Redis (`ioredis`) with resilient in-memory fallback
  - **Object Storage:** MinIO / AWS S3 SDK v3 (`@aws-sdk/client-s3`) with Local Disk fallback & Sharp WebP image processing
  - **Background Jobs:** BullMQ (`emailQueue`, `cleanupQueue`) with inline execution fallback
  - **Validation:** Zod schema validation
  - **Real-time:** Socket.IO with Redis Adapter support
  - **Monitoring:** Sentry Node SDK (`@sentry/node`)

---

## 🏗️ 2. Architectural Highlights & Upgrades

### 2.1 Stack Modernization (Priority High & Medium)
1. **Redis Caching Layer (`Server/config/redis.js`, `Server/utils/cache.js`)**:
   - แคชข้อมูลห้องเรียน (`/api/classrooms/:id` - TTL 30s), ข้อมูลผู้ใช้ (`/api/auth/me` - TTL 5min), และ System Settings (TTL 10min)
   - ปลอดภัยสูง: หาก Redis ปิดอยู่ ระบบจะ fallback กลับไปคิวรีฐานข้อมูลโดยตรงทันที ไม่บล็อกการทำงาน
   - เคลียร์แคชอัตโนมัติ (Write-through Cache Invalidation) เมื่อเกิดการอัปเดตห้องเรียน, ผังที่นั่ง, แชต, หรือการระงับบัญชีผู้ใช้
2. **MinIO / S3 Object Storage (`Server/config/storage.js`, `Server/utils/storage.js`)**:
   - รองรับการอัปโหลดไฟล์/รูปภาพไปยัง MinIO S3 โดยอัตโนมัติ (และ fallback ไปยังโฟลเดอร์ `/uploads` ในเครื่องหาก MinIO ออฟไลน์)
   - ปรับแต่งรูปภาพอัตโนมัติด้วย `sharp` แปลงเป็น WebP เพื่อประหยัด Bandwidth และเพิ่มความเร็วในการโหลด
   - ป้องกันสิทธิ์การอัปโหลดด้วย `authMiddleware` และ `uploadLimiter`
3. **BullMQ Background Workers (`Server/jobs/`)**:
   - แยกงานส่งอีเมล OTP และการเคลียร์ Session ที่หมดอายุไปประมวลผลเบื้องหลัง
4. **Zod Validation (`Server/validators/`, `Server/middleware/validate.js`)**:
   - ตรวจสอบความถูกต้องของ Input ก่อนเข้าถึง Controller ป้องกันช่องโหว่ด้านข้อมูลผิดรูปแบบ
5. **Vite Migration (`Client/vite.config.mjs`, `Client/index.html`)**:
   - ย้ายจาก Create React App สู่ Vite 8 สำเร็จ 100%
   - ความเร็วในการ Start Dev Server < 300ms และ Production Build เสร็จใน 1.6 วินาที

---

## 👑 3. Admin Portal System (`/admin`)

ระบบผู้ดูแลระบบถูกออกแบบให้อยู่ในเส้นทางซ่อน (Hidden Route) `/admin` ซึ่งเข้าถึงได้เฉพาะบัญชีที่มีสิทธิ์ `role: 'admin'` เท่านั้น โดยคง Navbar และ Sidebar เดียวกันกับหน้าปกติเพื่อให้ผู้ใช้คุ้นเคยและใช้งานได้อย่างราบรื่น

### ฟังก์ชันหลักในหน้า Admin:

#### 1. ภาพรวมระบบ (System Overview)
- **การ์ดสถิติ (Metrics Grid):** ผู้ใช้งานทั้งหมด, ห้องเรียนทั้งหมด, การเข้าใช้งานวันนี้, สถานะระบบ (Backend & DB Health)
- **ข้อมูลเซิร์ฟเวอร์ & สิ่งแวดล้อม (Environment Grid):** แสดงข้อมูลเส้นทาง URL, แอดมินปัจจุบัน, WAU, สถาปัตยกรรม UI, และสถานะของ MongoDB Atlas, Redis Cache, BullMQ Workers, และ MinIO S3

#### 2. จัดการผู้ใช้ (User Management)
- **ระบบระงับบัญชีผู้ใช้ (Account Suspension):**
  - ฟิลด์ `isSuspended: Boolean` (index: true) ใน Schema ผู้ใช้
  - เมื่อระงับบัญชี จะเพิกถอน Active Sessions ทั้งหมดทันที (`ActiveSession.deleteMany`) และลบ Redis Cache ทันทีเพื่อ Force Logout
  - ปิดกั้นการล็อกอินและการส่งคำขอผ่าน `authMiddleware`, `login`, และ `googleLoginVerify` ด้วย HTTP 403
  - สลับสถานะ ระงับ/ปกติ ได้ทั้งจากปุ่มด่วนบนตาราง และจากภายใน Modal
- **แก้ไขข้อมูลผู้ใช้ (User Edit Modal):**
  - แก้ไข Display Name
  - แก้ไข Email (มีระบบป้องกันและเช็กอีเมลซ้ำ)
  - กำหนดรหัสผ่านใหม่ (เข้ารหัสด้วย `bcryptjs` ขั้นต่ำ 6 ตัวอักษร) พร้อมปุ่ม **"🎲 สุ่มรหัส" (Random Password Generator)** ความยาว 12 ตัวอักษรที่มีความปลอดภัยสูง
  - สลับสิทธิ์ผู้ใช้งาน (`user` / `admin`)
- **แสดงผล 50 รายชื่อต่อหน้า (Pagination):**
  - รองรับ Pagination บน Server-side แสดง 50 บัญชีต่อหน้า พร้อมปุ่มเปลี่ยนหน้าและสรุปจำนวนรายการ
- **ตัวกรอง 2 มิติ (Multi-Filters) & Search:**
  - กรองตามบทบาท: ทั้งหมด / Admin / User
  - กรองตามสถานะ: ทั้งหมด / ใช้งานปกติ / ถูกระงับ
  - ค้นหาแบบ Real-time ตามชื่อหรืออีเมล
- **ข้อมูลห้องเรียนที่สร้างและเข้าร่วม (Classroom Badges & Modal):**
  - แสดงป้าย `สร้าง X ห้อง` (สีคราม) และ `เข้าร่วม Y ห้อง` (สีเขียวหัวเป็ด) ในตาราง
  - คลิกที่ป้ายเพื่อเปิด Modal แสดงรายชื่อห้องเรียน, Class Code, สีห้องเรียน และสถานะสาธารณะ/ส่วนตัว

#### 3. จัดการห้องเรียน (Classroom Management)
- แสดงรายการห้องเรียนทั้งหมด 50 ห้องต่อหน้า พร้อม Pagination Bar
- ช่องค้นหาห้องเรียนและรหัสห้อง (Class Code)
- ตัวกรองประเภทห้องเรียน: ทั้งหมด / เฉพาะห้องสาธารณะ / เฉพาะห้องส่วนตัว
- แสดงข้อมูลรหัสชั้นเรียน, เจ้าของห้อง (Owner), จำนวนนักเรียน, และวันที่สร้าง

#### 4. ตั้งค่าระบบ (System Settings)
- **หมวดความปลอดภัยและการเข้าถึง (Access & Security Control):**
  - โหมดปิดปรับปรุงระบบ (Maintenance Mode): อนุญาตเฉพาะ Admin เข้าใช้งาน
  - เปิด/ปิดการรับสมัครสมาชิกใหม่ (Allow Registration)
- **หมวดเซสชันและบริการเชื่อมต่อ (Session & Services):**
  - กำหนดระยะเวลาหมดอายุเซสชัน (Session Timeout ในหน่วยนาที)
  - ตรวจสอบสถานะการเชื่อมต่อบริการส่งอีเมลแจ้งเตือน (Nodemailer / SMTP)

#### 5. การจัด Container ให้เท่ากันและสมดุล (Container Harmonization)
- ปรับโครงสร้าง Container ให้เป็น `width: 100%; max-width: 1400px; margin: 0 auto; box-sizing: border-box;` ครบทุกแท็บ
- แก้ไขปัญหาขนาดคอนเทนเนอร์หดตัวเมื่อสลับแท็บ และยกเลิกการจำกัดความกว้าง `max-width: 800px` ในหน้าการตั้งค่า ทำให้ทุกหน้าย่อยมีความกว้างและหน้าตาเท่าเทียมกันทุกประการ

---

## ⚙️ 4. Configuration & Environment Variables

### 4.1 Server (`Server/.env`)
```env
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret_key
CLIENT_URL=http://localhost:3000

# Redis & Cache (Optional - fallback to memory/direct DB if omitted)
REDIS_URL=redis://localhost:6379

# Object Storage (MinIO / S3) (Optional - fallback to /uploads if omitted)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=echair-uploads
MINIO_USE_SSL=false

# Email SMTP (For OTP and Verification)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Sentry Monitoring (Optional)
SENTRY_DSN=
```

### 4.2 Client (`Client/.env`)
```env
VITE_SERVER_URL=http://localhost:5000
# or for legacy compatibility:
REACT_APP_SERVER_URL=http://localhost:5000
```

---

## 🛠️ 5. Development & Build Commands

### รันเซิร์ฟเวอร์ในสภาพแวดล้อม Local:

> ⚠️ **หมายเหตุสำหรับ Windows PowerShell:** แนะนำให้รันคำสั่ง npm/node ผ่าน `cmd.exe /c "..."` เพื่อหลีกเลี่ยง ExecutionPolicy

1. **Backend Server:**
   ```bash
   cd Server
   npm run dev
   # หรือ nodemon server.js บนพอร์ต 5000
   ```

2. **Frontend Client (Vite):**
   ```bash
   cd Client
   npm run dev
   # รันบน http://localhost:3000 พร้อม Proxy ไปยัง http://localhost:5000 อัตโนมัติ
   ```

3. **Production Build Client:**
   ```bash
   cd Client
   npm run build
   # ผลลัพธ์จะถูกสร้างไว้ที่ Client/dist
   ```

4. **ตรวจสอบ Syntax ฝั่งเซิร์ฟเวอร์:**
   ```bash
   node --check Server/server.js
   node --check Server/controllers/adminController.js
   ```

---

## 📂 6. Key File Structure

```
Echair/
├── Client/
│   ├── index.html                      # Root HTML entry template
│   ├── vite.config.mjs                 # Vite 8 config with React & Proxy
│   ├── package.json                    # Dependencies & Vite build scripts
│   └── src/
│       ├── App.js                      # Root router with /admin route
│       ├── CSS/
│       │   ├── AdminPage.css           # Full styling for admin portal & containers
│       │   └── Main.css                # Base application layout & theme
│       ├── pages/
│       │   ├── AdminPage.jsx           # Unified Admin dashboard with 4 tabs
│       │   ├── DashboardPage.jsx       # Student/Teacher main dashboard
│       │   └── ClassroomPage.jsx       # Interactive classroom & seating chart
│       └── components/                 # Reusable UI & modal components
│
├── Server/
│   ├── server.js                       # Express entrypoint & server setup
│   ├── config/
│   │   ├── db.js                       # MongoDB Mongoose connection
│   │   ├── redis.js                    # Resilient ioredis client
│   │   └── storage.js                  # MinIO S3 SDK client
│   ├── controllers/
│   │   ├── adminController.js          # User, classroom, stats, settings APIs
│   │   └── authController.js           # Auth & suspension check logic
│   ├── middleware/
│   │   ├── authMiddleware.js           # JWT verification & suspension blocker
│   │   └── roleMiddleware.js           # Admin role enforcement
│   ├── models/
│   │   ├── User.js                     # User schema (includes isSuspended)
│   │   ├── Class.js                    # Classroom schema & seating data
│   │   └── SystemSettings.js           # Central system configurations
│   ├── utils/
│   │   ├── cache.js                    # Redis cache helpers (get/set/del)
│   │   └── storage.js                  # S3 upload with Sharp WebP compression
│   └── jobs/
│       ├── queue.js                    # BullMQ job queues
│       └── emailWorker.js              # Background email worker
│
├── HANDOFF.md                          # Current handoff documentation
└── production-build/                   # Dockerfile & Docker Compose configurations
```

---

## 📋 7. Important Security & Business Rules

1. **สิทธิ์ Admin:**
   - ตรวจสอบผ่าน `req.user.role === 'admin'` ใน `roleMiddleware.js`
   - แอดมินหลักที่ได้รับสิทธิ์ปัจจุบัน: `Newskung43@gmail.com`
   - แอดมินไม่สามารถลบบัญชีของตัวเองได้ (`req.user._id !== id`)
2. **การระงับบัญชี (Suspension):**
   - เมื่อถูกระงับ `isSuspended: true`:
     - บล็อกการล็อกอินปกติ (Local Login)
     - บล็อกการล็อกอินผ่าน Google / Firebase
     - บล็อกการยิง API ด้วย Token เดิมทันที (403 Forbidden)
     - ลบ Active Sessions ทั้งหมด และ Invalidate Redis User Cache
3. **การเข้าถึง `/admin`:**
   - ซ่อนไม่ให้แสดงในเมนูปกติสำหรับผู้ใช้ทั่วไป
   - เข้าผ่านการพิมพ์ URL `/admin` โดยตรง
   - หากผู้ใช้ไม่มีสิทธิ์ Admin ระบบจะแสดงป้ายเตือนและบล็อกข้อมูลสำคัญ

---

## 🔮 8. Suggested Next Steps / Future Enhancements

1. **Audit Logs:** เพิ่มหน้าบันทึกประวัติการกระทำของ Admin (เช่น ใครเป็นคนแก้รหัสผ่าน, ใครเป็นคนระงับบัญชี และเมื่อไหร่)
2. **Batch Actions:** เพิ่ม Checkbox ในตารางจัดการผู้ใช้เพื่อเลือกระงับหรือเปลี่ยนบทบาททีละหลายคนพร้อมกัน (Bulk Action)
3. **Export Reports:** เพิ่มปุ่มดาวน์โหลดรายงานข้อมูลผู้ใช้งานและห้องเรียนออกมาเป็นไฟล์ Excel / CSV
4. **Enhanced Analytics:** เพิ่มกราฟสถิติแสดงผลแบบชาร์ต (เช่น Chart.js / Recharts) ในหน้าภาพรวมระบบ (Overview)
