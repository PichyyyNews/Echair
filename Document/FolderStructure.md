# โครงสร้างโฟลเดอร์และการออกแบบระบบ (Folder Structure & System Design)

โปรเจกต์นี้เป็นระบบจัดการห้องเรียน (Classroom Management System) ที่เน้นการจัดการที่นั่งและกิจกรรมในห้องเรียนแบบ real-time

## โครงสร้างโฟลเดอร์หลัก (Main Folder Structure)

- `Client/`: ส่วนจัดเก็บโค้ดฝั่งหน้าบ้าน (Frontend) พัฒนาด้วย React.js
  - `src/components/`: คอมโพเนนต์ที่ใช้ซ้ำในหน้าต่างๆ เช่น Navbar, Sidebar, Chair, Modal ต่างๆ
  - `src/pages/`: หน้าหลักของระบบ เช่น Dashboard, Classroom, Login, Settings
  - `src/context/`: การจัดการสถานะ (State Management) ส่วนกลาง
  - `src/hooks/`: Custom Hooks สำหรับจัดการ Logic เฉพาะทาง
  - `src/utils/`: ฟังก์ชันตัวช่วยต่างๆ (Helper Functions)
- `Server/`: ส่วนจัดเก็บโค้ดฝั่งหลังบ้าน (Backend) พัฒนาด้วย Node.js และ Express
  - `controllers/`: ส่วนจัดการ Logic ของ API แต่ละส่วน
  - `routes/`: ตัวกำหนดเส้นทาง (Endpoint) ของ API
  - `models/`: นิยามโครงสร้างฐานข้อมูล (Database Schema) โดยใช้ Mongoose (MongoDB)
  - `middleware/`: ฟังก์ชันตรวจสอบสิทธิ์และจัดการ Request (Auth, Logger)
  - `socket/`: จัดการการสื่อสารแบบ Real-time ผ่าน Socket.io
  - `utils/`: ฟังก์ชันตัวช่วยฝั่ง Server (Logger, Email, Upload)
- `Document/`: โฟลเดอร์สำหรับจัดเก็บเอกสารประกอบโครงการ (โฟลเดอร์ปัจจุบัน)

## การออกแบบระบบ (System Design)

### 1. สถาปัตยกรรม (Architecture)

ระบบใช้สถาปัตยกรรมแบบ **MERN Stack** (MongoDB, Express, React, Node.js) ร่วมกับ **Socket.io** เพื่อให้รองรับการอัปเดตข้อมูลแบบ Real-time (เช่น การเปลี่ยนสถานะที่นั่ง, การยกมือ)

### 2. การพิสูจน์ตัวตน (Authentication)

ใช้ **Firebase Authentication** ร่วมกับระบบหลังบ้านของตัวเอง โดยมีการจัดเก็บข้อมูลเพิ่มเติมใน MongoDB และใช้ **JWT (JSON Web Token)** ในการรักษาความปลอดภัยของ API

### 3. การจัดการข้อมูล (Data Management)

- **MongoDB**: เก็บข้อมูลผู้ใช้, ห้องเรียน, การเข้าเรียน, คะแนน และประวัติกิจกรรม
- **Socket.io**: ใช้สำหรับการส่งสัญญาณโต้ตอบกันในห้องเรียนแบบทันที

### 4. ฟีเจอร์หลัก (Core Features)

- **Seating Map**: การจัดการแผนผังที่นั่งในห้องเรียน (Interactive UI)
- **Attendance Tracking**: ระบบเช็คชื่อเข้าเรียน
- **Classwork & Submission**: การสั่งงานและส่งงานผ่านระบบ
- **Real-time Interaction**: การส่ง Emoji, การยกมือ, และการสุ่มจัดกลุ่มนักเรียน
- **Class Chat**: ห้องสนทนาภายในแต่ละวิชา
