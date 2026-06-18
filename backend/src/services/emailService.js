const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email credentials not configured. Email service will be disabled.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true' || false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      this.transporter.verify((error, success) => {
        if (error) {
          console.error('Email transporter verification failed:', error.message);
          console.error('   Please check:');
          console.error('   - EMAIL_USER:', process.env.EMAIL_USER);
          console.error('   - EMAIL_PASS: [hidden]');
          console.error('   - Make sure you are using App Password, not regular password');
          console.error('   - If using Gmail, enable 2FA and create App Password');
          this.isInitialized = false;
        } else {
          console.log('Email transporter ready to send messages');
          console.log('Email Account: ' + process.env.EMAIL_USER);
          this.isInitialized = true;
        }
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error.message);
      this.isInitialized = false;
    }
  }

  isServiceReady() {
    return this.transporter && this.isInitialized;
  }

  async sendAccessCode(email, code) {
    try {
      if (!this.isServiceReady()) {
        console.warn('Email service not ready, skipping email');
        if (process.env.NODE_ENV === 'development') {
          console.log('Would send code ' + code + ' to ' + email);
          return { 
            success: true, 
            message: 'Email skipped (development mode)',
            email,
            code 
          };
        }
        throw new Error('Email service not initialized');
      }

      console.log('Sending access code to ' + email + '...');

      const mailOptions = {
        from: '"Task Management System" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'Your Access Code',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .code { font-size: 32px; font-weight: bold; color: #667eea; background: #f0f0ff; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; letter-spacing: 5px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Access Code</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Hello,</p>
                  <p>You requested an access code to login to the <strong>Task Management System</strong>.</p>
                  <p>Your access code is:</p>
                  <div class="code">${code}</div>
                  <p>This code will expire in <strong>10 minutes</strong>.</p>
                  <div class="warning">
                    <strong>Security Notice:</strong> If you didn't request this code, please ignore this email.
                  </div>
                  <p>Enter this code on the validation page to complete your login.</p>
                  <p>Best regards,<br>Task Management Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message, please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Task Management System</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
          Access Code: ${code}
          
          Your access code for Task Management System is: ${code}
          
          This code will expire in 10 minutes.
          
          If you didn't request this code, please ignore this email.
          
          Best regards,
          Task Management Team
        `
      };

      const sendPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout after 10s')), 10000);
      });

      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log('Access code email sent:', info.messageId);
      console.log('Sent to: ' + email);
      
      return { 
        success: true, 
        messageId: info.messageId,
        email 
      };
    } catch (error) {
      console.error('Send access code email error:', error.message);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Code ' + code + ' would be sent to ' + email);
        console.log('Continuing despite email error (development mode)');
        return { 
          success: true, 
          message: 'Email skipped (development mode)',
          email,
          code 
        };
      }
      
      throw new Error('Failed to send access code email: ' + error.message);
    }
  }

  async sendCredentials(email, username, password) {
    try {
      if (!this.isServiceReady()) {
        console.warn('Email service not ready, skipping email');
        if (process.env.NODE_ENV === 'development') {
          return { success: true, message: 'Email skipped (development mode)' };
        }
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: '"Task Management System" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'Welcome to Task Management System - Your Account Credentials',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .credentials { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .credential-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                .credential-item:last-child { border-bottom: none; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; font-family: monospace; }
                .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome!</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Hello,</p>
                  <p>Your account has been created in the <strong>Task Management System</strong>.</p>
                  
                  <div class="credentials">
                    <h3>Your Login Credentials:</h3>
                    <div class="credential-item">
                      <span class="label">Username:</span>
                      <span class="value">${username}</span>
                    </div>
                    <div class="credential-item">
                      <span class="label">Password:</span>
                      <span class="value">${password}</span>
                    </div>
                  </div>
                  
                  <div class="warning">
                    <strong>Important:</strong> Please change your password after your first login.
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/login" class="btn">Login Now</a>
                  </div>
                  
                  <p>Best regards,<br>Task Management Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message, please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Task Management System</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
          Welcome to Task Management System!
          
          Your account has been created.
          
          Login Credentials:
          Username: ${username}
          Password: ${password}
          
          Please change your password after your first login.
          
          Login here: ${process.env.FRONTEND_URL}/login
          
          Best regards,
          Task Management Team
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Credentials email sent:', info.messageId);
      console.log('Sent to: ' + email);
      
      return { 
        success: true, 
        messageId: info.messageId,
        email 
      };
    } catch (error) {
      console.error('Send credentials email error:', error.message);
      if (process.env.NODE_ENV === 'development') {
        return { success: true, message: 'Email skipped (development mode)' };
      }
      throw new Error('Failed to send credentials email: ' + error.message);
    }
  }

  async sendVerificationLink(email, link) {
    try {
      if (!this.isServiceReady()) {
        console.warn('Email service not ready, skipping email');
        if (process.env.NODE_ENV === 'development') {
          return { success: true, message: 'Email skipped (development mode)' };
        }
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: '"Task Management System" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'Set Up Your Account - Task Management System',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
                .link-box { background: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; margin: 15px 0; font-family: monospace; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Account Setup</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Hello,</p>
                  <p>You have been invited to join the <strong>Task Management System</strong>.</p>
                  <p>Please click the button below to set up your account:</p>
                  
                  <div style="text-align: center;">
                    <a href="${link}" class="btn">Set Up Account</a>
                  </div>
                  
                  <p>Or copy and paste this link into your browser:</p>
                  <div class="link-box">${link}</div>
                  
                  <div class="warning">
                    <strong>Security Notice:</strong> This link will expire in <strong>24 hours</strong>.
                    If you didn't request this, please ignore this email.
                  </div>
                  
                  <p>Best regards,<br>Task Management Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message, please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Task Management System</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
          Account Setup - Task Management System
          
          You have been invited to join the Task Management System.
          
          Please click the link below to set up your account:
          ${link}
          
          This link will expire in 24 hours.
          
          If you didn't request this, please ignore this email.
          
          Best regards,
          Task Management Team
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification link email sent:', info.messageId);
      console.log('Sent to: ' + email);
      
      return { 
        success: true, 
        messageId: info.messageId,
        email 
      };
    } catch (error) {
      console.error('Send verification link email error:', error.message);
      if (process.env.NODE_ENV === 'development') {
        return { success: true, message: 'Email skipped (development mode)' };
      }
      throw new Error('Failed to send verification link email: ' + error.message);
    }
  }

  async sendTaskAssignment(email, taskTitle, taskId, assignedBy) {
    try {
      if (!this.isServiceReady()) {
        console.warn('Email service not ready, skipping email');
        if (process.env.NODE_ENV === 'development') {
          return { success: true, message: 'Email skipped (development mode)' };
        }
        throw new Error('Email service not initialized');
      }

      const taskLink = process.env.FRONTEND_URL + '/tasks/' + taskId;

      const mailOptions = {
        from: '"Task Management System" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'New Task Assigned',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>New Task Assigned</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Hello,</p>
                  <p>You have been assigned a new task by <strong>${assignedBy || 'Manager'}</strong>.</p>
                  
                  <h3>Task: ${taskTitle}</h3>
                  
                  <div style="text-align: center;">
                    <a href="${taskLink}" class="btn">View Task</a>
                  </div>
                  
                  <p>Best regards,<br>Task Management Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message, please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Task Management System</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
          New Task Assigned
          
          You have been assigned a new task: ${taskTitle}
          
          View Task: ${taskLink}
          
          Best regards,
          Task Management Team
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Task assignment email sent:', info.messageId);
      console.log('Sent to: ' + email);
      
      return { 
        success: true, 
        messageId: info.messageId,
        email 
      };
    } catch (error) {
      console.error('Send task assignment email error:', error.message);
      if (process.env.NODE_ENV === 'development') {
        return { success: true, message: 'Email skipped (development mode)' };
      }
      throw new Error('Failed to send task assignment email: ' + error.message);
    }
  }

  async sendPasswordReset(email, resetLink) {
    try {
      if (!this.isServiceReady()) {
        console.warn('Email service not ready, skipping email');
        if (process.env.NODE_ENV === 'development') {
          return { success: true, message: 'Email skipped (development mode)' };
        }
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: '"Task Management System" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'Password Reset Request',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Password Reset</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Hello,</p>
                  <p>We received a request to reset your password for the <strong>Task Management System</strong>.</p>
                  
                  <div style="text-align: center;">
                    <a href="${resetLink}" class="btn">Reset Password</a>
                  </div>
                  
                  <div class="warning">
                    <strong>Security Notice:</strong> This link will expire in <strong>1 hour</strong>.
                    If you didn't request this, please ignore this email and your password will remain unchanged.
                  </div>
                  
                  <p>Best regards,<br>Task Management Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated message, please do not reply.</p>
                  <p>&copy; ${new Date().getFullYear()} Task Management System</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
          Password Reset Request
          
          Click the link below to reset your password:
          ${resetLink}
          
          This link will expire in 1 hour.
          
          If you didn't request this, please ignore this email.
          
          Best regards,
          Task Management Team
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', info.messageId);
      console.log('Sent to: ' + email);
      
      return { 
        success: true, 
        messageId: info.messageId,
        email 
      };
    } catch (error) {
      console.error('Send password reset email error:', error.message);
      if (process.env.NODE_ENV === 'development') {
        return { success: true, message: 'Email skipped (development mode)' };
      }
      throw new Error('Failed to send password reset email: ' + error.message);
    }
  }
}

module.exports = new EmailService();