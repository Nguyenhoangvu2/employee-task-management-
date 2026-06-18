# Employee Task Management System

A real-time employee task management tool built with React, Node.js, Express, Firebase, and Socket.IO.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Deployment](#deployment)

## Features

### Manager Features
- Secure Authentication: Login with phone number + 6-digit access code via SMS
- Employee Management: Add, edit, delete employees with detailed profiles
- Task Management: Create, assign, track, and update tasks
- Real-time Chat: Instant messaging with employees using Socket.IO
- Dashboard: Overview of employees and tasks with statistics
- Email Notifications: Auto-send credentials to new employees

### Employee Features
- Secure Login: Email + 6-digit access code authentication
- Task View: See all assigned tasks with priorities and deadlines
- Task Updates: Change task status (Pending -> In Progress -> Completed)
- Profile Management: Edit personal information
- Real-time Chat: Communicate with manager instantly

## Tech Stack

### Frontend
- React 18 - UI Library
- React Router v6 - Navigation
- Socket.IO Client - Real-time communication
- Axios - HTTP requests
- React Hot Toast - Notifications
- CSS3 - Custom styling with responsive design

### Backend
- Node.js - Runtime
- Express.js - Web framework
- Firebase Firestore - NoSQL database
- Socket.IO - WebSocket server
- JWT - Authentication
- Nodemailer - Email service
- Twilio - SMS service

## Installation

### Prerequisites
- Node.js v14+
- npm or yarn
- Firebase account
- Twilio account (for SMS)

### Step 1: Clone Repository
```bash
git clone https://github.com/Nguyenhoangvu2/employee-task-management-.git
cd employee-task-management-