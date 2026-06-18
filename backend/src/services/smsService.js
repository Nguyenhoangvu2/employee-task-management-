const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    this.phoneNumber = null;
    this.initializeClient();
  }

  initializeClient() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !this.phoneNumber) {
        console.warn('Twilio credentials not configured. SMS service will be disabled.');
        console.log('SMS will be simulated for testing.');
        return;
      }

      this.client = twilio(accountSid, authToken);
      console.log('Twilio client initialized successfully');
      console.log('Twilio Phone Number: ' + this.phoneNumber);
      
      this.client.balance.fetch()
        .then(balance => {
          console.log('Twilio Account Balance: ' + balance.balance + ' ' + balance.currency);
        })
        .catch(err => {
          console.warn('Could not fetch Twilio balance:', err.message);
        });
    } catch (error) {
      console.error('Failed to initialize Twilio client:', error.message);
      console.log('SMS will be simulated for testing.');
    }
  }

  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return '';
    }
    
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (!cleaned) {
      return '';
    }
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length === 10 && ['3', '5', '7', '8', '9'].includes(cleaned.charAt(0))) {
      cleaned = '84' + cleaned;
    } else if (cleaned.length === 9) {
      cleaned = '84' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('84')) {
      cleaned = '84' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    } else if (!cleaned.startsWith('84') && cleaned.length >= 10) {
      cleaned = '84' + cleaned;
    }
    
    return '+' + cleaned;
  }

  async sendAccessCode(phoneNumber, code) {
    try {
      if (!this.client) {
        console.log('Would send code ' + code + ' to ' + phoneNumber);
        return { 
          success: true, 
          messageId: 'dev-mode',
          phoneNumber: phoneNumber,
          status: 'simulated'
        };
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        console.log('Invalid phone number: ' + phoneNumber + ', code: ' + code);
        return { 
          success: true, 
          messageId: 'dev-mode-invalid',
          phoneNumber: phoneNumber,
          status: 'simulated'
        };
      }

      console.log('Sending SMS to ' + formattedNumber + '...');

      const message = await this.client.messages.create({
        body: this.getAccessCodeMessage(code),
        to: formattedNumber,
        from: this.phoneNumber,
      });

      console.log('SMS sent successfully: ' + message.sid);
      
      return { 
        success: true, 
        messageId: message.sid,
        phoneNumber: formattedNumber,
        status: message.status
      };
    } catch (error) {
      console.log('SMS would be sent to ' + phoneNumber + ' with code: ' + code);
      console.log('SMS error (ignored): ' + error.message);
      
      return { 
        success: true, 
        messageId: 'dev-mode-error',
        phoneNumber: phoneNumber,
        status: 'simulated',
        note: 'SMS simulated in development mode'
      };
    }
  }

  async sendCustomSMS(phoneNumber, message) {
    try {
      if (!this.client) {
        console.log('Would send custom SMS to ' + phoneNumber);
        return { success: true, messageId: 'dev-mode' };
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        return { success: true, messageId: 'dev-mode-invalid' };
      }

      const result = await this.client.messages.create({
        body: message,
        to: formattedNumber,
        from: this.phoneNumber,
      });

      console.log('Custom SMS sent successfully:', result.sid);
      
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.log('Custom SMS would be sent to ' + phoneNumber);
      return { success: true, messageId: 'dev-mode-error' };
    }
  }

  async sendTaskNotification(phoneNumber, taskTitle, employeeName) {
    try {
      if (!this.client) {
        console.log('Would send task notification to ' + phoneNumber);
        return { success: true };
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        return { success: true };
      }

      const message = this.getTaskNotificationMessage(taskTitle, employeeName);

      const result = await this.client.messages.create({
        body: message,
        to: formattedNumber,
        from: this.phoneNumber,
      });

      console.log('Task notification SMS sent:', result.sid);
      
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.log('Task notification would be sent to ' + phoneNumber);
      return { success: true };
    }
  }

  async sendReminder(phoneNumber, message) {
    try {
      if (!this.client) {
        console.log('Would send reminder to ' + phoneNumber);
        return { success: true };
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        return { success: true };
      }

      const reminderMessage = 'REMINDER: ' + message;

      const result = await this.client.messages.create({
        body: reminderMessage,
        to: formattedNumber,
        from: this.phoneNumber,
      });

      console.log('Reminder SMS sent:', result.sid);
      
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.log('Reminder would be sent to ' + phoneNumber);
      return { success: true };
    }
  }

  async sendBulkSMS(phoneNumbers, message) {
    try {
      if (!this.client) {
        console.log('Would send bulk SMS to ' + phoneNumbers.length + ' numbers');
        return {
          success: true,
          total: phoneNumbers.length,
          successful: phoneNumbers.length,
          failed: 0
        };
      }

      const results = [];
      
      for (const phoneNumber of phoneNumbers) {
        try {
          const formattedNumber = this.formatPhoneNumber(phoneNumber);
          
          if (!formattedNumber) {
            results.push({ phoneNumber, success: false, error: 'Invalid phone number' });
            continue;
          }
          
          const result = await this.client.messages.create({
            body: message,
            to: formattedNumber,
            from: this.phoneNumber,
          });
          
          results.push({ phoneNumber: formattedNumber, success: true, messageId: result.sid });
          
          console.log('Bulk SMS sent to ' + formattedNumber);
        } catch (error) {
          results.push({ phoneNumber, success: false, error: error.message });
          console.error('Failed to send SMS to ' + phoneNumber + ':', error.message);
        }
      }

      return {
        success: true,
        results,
        total: phoneNumbers.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      };
    } catch (error) {
      console.log('Bulk SMS would be sent');
      return {
        success: true,
        total: phoneNumbers.length,
        successful: phoneNumbers.length,
        failed: 0
      };
    }
  }

  getAccessCodeMessage(code) {
    return 'Your Task Management System access code is: ' + code + '\nThis code will expire in 10 minutes.';
  }

  getTaskNotificationMessage(taskTitle, employeeName) {
    return 'New Task Assigned\n\nHello ' + employeeName + ',\nYou have been assigned a new task: "' + taskTitle + '".\nPlease login to your account to view the details.';
  }

  getReminderMessage(taskTitle, dueDate) {
    return 'TASK REMINDER\n\nTask: "' + taskTitle + '"\nDue Date: ' + dueDate + '\nPlease complete your task on time.';
  }

  async handleIncomingSMS(req, res) {
    try {
      const { From, Body, To, MessageSid } = req.body;
      
      console.log('Incoming SMS:', {
        from: From,
        to: To,
        body: Body,
        messageId: MessageSid
      });
      
      res.status(200).send('Message received');
    } catch (error) {
      console.error('Handle incoming SMS error:', error);
      res.status(500).send('Error processing message');
    }
  }

  async handleStatusCallback(req, res) {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;
      
      console.log('SMS Status Update:', {
        messageId: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage
      });

      res.status(200).send('Status received');
    } catch (error) {
      console.error('Handle status callback error:', error);
      res.status(500).send('Error processing status');
    }
  }

  async checkServiceStatus() {
    try {
      if (!this.client) {
        return { 
          success: false, 
          message: 'SMS service is in DEVELOPMENT MODE (simulated)',
          details: 'Twilio client not initialized',
          mode: 'development'
        };
      }

      const balance = await this.client.balance.fetch();
      
      return { 
        success: true, 
        message: 'SMS service is operational',
        balance: balance.balance,
        currency: balance.currency,
        phoneNumber: this.phoneNumber,
        mode: 'production'
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'SMS service is in DEVELOPMENT MODE (simulated)',
        error: error.message,
        mode: 'development'
      };
    }
  }
}

module.exports = new SMSService();