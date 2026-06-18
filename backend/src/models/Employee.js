const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class Employee {
  constructor(data = {}) {
    this.id = data.id || db.collection('employees').doc().id;
    this.name = (data.name || '').trim();
    this.email = (data.email || '').toLowerCase().trim();
    this.phone = (data.phone || '').trim();
    this.role = data.role || 'employee';
    this.department = (data.department || 'General').trim();
    this.position = (data.position || this.role).trim();
    
    this.schedule = data.schedule || { days: [], shift: '' };
    this.hireDate = data.hireDate ? 
      (data.hireDate instanceof admin.firestore.Timestamp ? data.hireDate : admin.firestore.Timestamp.fromDate(new Date(data.hireDate))) 
      : admin.firestore.Timestamp.now();
    
    this.salary = Number(data.salary) || 0;
    this.hashedPassword = data.hashedPassword || null;
    this.passwordSet = !!data.passwordSet;
    this.isActive = data.isActive !== undefined ? !!data.isActive : true;
    
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.accessCode = data.accessCode || '';
    this.codeExpiresAt = data.codeExpiresAt || null;
    
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
    this.lastLoginAt = data.lastLoginAt || null;
    this.deletedAt = data.deletedAt || null;

    this.profile = {
      address: '',
      emergencyContact: '',
      notes: '',
      avatar: '',
      birthday: '',
      gender: '',
      skills: [],
      ...data.profile
    };

    this.notifications = Array.isArray(data.notifications) ? data.notifications : [];
    this.attendance = Array.isArray(data.attendance) ? data.attendance : [];
  }

  static async findById(employeeId) {
    try {
      if (!employeeId) return null;
      const doc = await db.collection('employees').doc(employeeId).get();
      if (!doc.exists) return null;
      return new Employee({ id: doc.id, ...doc.data() });
    } catch (error) {
      console.error('FindById error:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      if (!email) return null;
      const snapshot = await db.collection('employees')
        .where('email', '==', email.toLowerCase().trim())
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return new Employee({ id: doc.id, ...doc.data() });
    } catch (error) {
      console.error('FindByEmail error:', error);
      throw error;
    }
  }

  static async findAll(filter = {}, limit = 100) {
    try {
      let query = db.collection('employees');

      if (filter.isActive !== undefined) {
        query = query.where('isActive', '==', filter.isActive);
      }
      if (filter.department) {
        query = query.where('department', '==', filter.department);
      }
      if (filter.role) {
        query = query.where('role', '==', filter.role);
      }

      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => new Employee({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('FindAll error:', error);
      throw error;
    }
  }

  async save() {
    try {
      this.updatedAt = admin.firestore.Timestamp.now();

      const data = this.toJSON();
      delete data.id;

      await db.collection('employees').doc(this.id).set(data, { merge: true });
      return this;
    } catch (error) {
      console.error('Save employee error:', error);
      throw error;
    }
  }

  async update(updateData) {
    try {
      delete updateData.hashedPassword;
      delete updateData.accessCode;
      delete updateData.codeExpiresAt;
      delete updateData.createdAt;

      Object.assign(this, updateData);
      await this.save();
      return this;
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  }

  async softDelete() {
    this.isActive = false;
    this.deletedAt = admin.firestore.Timestamp.now();
    await this.save();
    return true;
  }

  async hardDelete() {
    await db.collection('employees').doc(this.id).delete();
    return true;
  }

  async setPassword(password) {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    this.hashedPassword = await bcrypt.hash(password, 12);
    this.passwordSet = true;
    await this.save();
    return true;
  }

  async verifyPassword(password) {
    if (!this.hashedPassword) return false;
    return bcrypt.compare(password, this.hashedPassword);
  }

  async generateAccessCode(expiresInMinutes = 10) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + expiresInMinutes * 60000)
    );

    this.accessCode = code;
    this.codeExpiresAt = expiresAt;
    await this.save();
    return code;
  }

  validateAccessCode(code) {
    if (!this.accessCode || this.accessCode !== code) return false;
    if (!this.codeExpiresAt) return false;

    return this.codeExpiresAt.toDate() > new Date();
  }

  async clearAccessCode() {
    this.accessCode = '';
    this.codeExpiresAt = null;
    await this.save();
    return true;
  }

  async addTask(taskId) {
    if (!this.tasks.includes(taskId)) {
      this.tasks.push(taskId);
      await this.save();
    }
    return this;
  }

  async removeTask(taskId) {
    this.tasks = this.tasks.filter(id => id !== taskId);
    await this.save();
    return this;
  }

  async updateLastLogin() {
    this.lastLoginAt = admin.firestore.Timestamp.now();
    await this.save();
    return this;
  }

  async getStatistics() {
    try {
      const snapshot = await db.collection('tasks')
        .where('assignedTo', '==', this.id)
        .get();

      let total = 0, completed = 0, pending = 0, inProgress = 0, overdue = 0;
      const now = admin.firestore.Timestamp.now();

      snapshot.forEach(doc => {
        total++;
        const t = doc.data();
        if (t.status === 'completed') completed++;
        else if (t.status === 'pending') pending++;
        else if (t.status === 'in-progress') inProgress++;

        if (t.status !== 'completed' && t.dueDate && t.dueDate < now) {
          overdue++;
        }
      });

      return {
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        overdueTasks: overdue,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('GetStatistics error:', error);
      throw error;
    }
  }

  toJSON() {
    const data = { ...this };
    delete data.hashedPassword;
    delete data.accessCode;
    delete data.codeExpiresAt;
    return data;
  }

  toFullJSON() {
    return { ...this };
  }
}

module.exports = Employee;