const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

class Task {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.title = data.title || '';
    this.description = data.description || '';
    this.assignedTo = data.assignedTo || null;
    this.dueDate = data.dueDate || null;
    this.priority = data.priority || 'medium';
    this.status = data.status || 'pending';
    this.category = data.category || 'general';
    this.estimatedHours = data.estimatedHours || 0;
    this.actualHours = data.actualHours || 0;
    this.attachments = data.attachments || [];
    this.comments = data.comments || [];
    this.subtasks = data.subtasks || [];
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy || null;
    this.createdByName = data.createdByName || 'System';
    this.completedAt = data.completedAt || null;
    this.isDeleted = data.isDeleted || false;
    this.deletedAt = data.deletedAt || null;
    this.progress = data.progress || 0;
    this.reminders = data.reminders || [];
    this.dependencies = data.dependencies || [];
  }

  static async findById(taskId) {
    try {
      const doc = await db.collection('tasks').doc(taskId).get();
      if (!doc.exists) return null;
      return new Task({ id: doc.id, ...doc.data() });
    } catch (error) {
      console.error('Find task by ID error:', error);
      throw error;
    }
  }

  static async findAll(filter = {}) {
    try {
      let query = db.collection('tasks');
      
      if (filter.status) {
        query = query.where('status', '==', filter.status);
      }
      if (filter.priority) {
        query = query.where('priority', '==', filter.priority);
      }
      if (filter.assignedTo) {
        query = query.where('assignedTo', '==', filter.assignedTo);
      }
      if (filter.category) {
        query = query.where('category', '==', filter.category);
      }
      if (filter.isDeleted !== undefined) {
        query = query.where('isDeleted', '==', filter.isDeleted);
      }

      const orderBy = filter.orderBy || 'createdAt';
      const orderDirection = filter.orderDirection || 'desc';
      query = query.orderBy(orderBy, orderDirection);

      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      const snapshot = await query.get();
      const tasks = [];
      
      snapshot.forEach(doc => {
        tasks.push(new Task({ id: doc.id, ...doc.data() }));
      });
      
      return tasks;
    } catch (error) {
      console.error('Find all tasks error:', error);
      throw error;
    }
  }

  static async findByEmployee(employeeId, status = null) {
    try {
      let query = db.collection('tasks')
        .where('assignedTo', '==', employeeId)
        .where('isDeleted', '==', false);
      
      if (status) {
        query = query.where('status', '==', status);
      }
      
      const snapshot = await query
        .orderBy('dueDate', 'asc')
        .get();
      
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push(new Task({ id: doc.id, ...doc.data() }));
      });
      
      return tasks;
    } catch (error) {
      console.error('Find tasks by employee error:', error);
      throw error;
    }
  }

  static async findOverdue() {
    try {
      const now = new Date().toISOString();
      const snapshot = await db.collection('tasks')
        .where('dueDate', '<', now)
        .where('status', '!=', 'completed')
        .where('isDeleted', '==', false)
        .get();
      
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push(new Task({ id: doc.id, ...doc.data() }));
      });
      
      return tasks;
    } catch (error) {
      console.error('Find overdue tasks error:', error);
      throw error;
    }
  }

  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      const data = { ...this };
      delete data.id;
      
      await db.collection('tasks').doc(this.id).set(data, { merge: true });
      return this;
    } catch (error) {
      console.error('Save task error:', error);
      throw error;
    }
  }

  async update(updateData) {
    try {
      if (updateData.status === 'completed' && this.status !== 'completed') {
        this.completedAt = new Date().toISOString();
        this.progress = 100;
      }
      
      Object.assign(this, updateData);
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return this;
    } catch (error) {
      console.error('Update task error:', error);
      throw error;
    }
  }

  async delete() {
    try {
      this.isDeleted = true;
      this.deletedAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return true;
    } catch (error) {
      console.error('Delete task error:', error);
      throw error;
    }
  }

  async hardDelete() {
    try {
      await db.collection('tasks').doc(this.id).delete();
      return true;
    } catch (error) {
      console.error('Hard delete task error:', error);
      throw error;
    }
  }

  async updateStatus(newStatus) {
    try {
      const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Invalid status');
      }
      
      this.status = newStatus;
      
      if (newStatus === 'completed') {
        this.completedAt = new Date().toISOString();
        this.progress = 100;
      } else if (newStatus === 'cancelled') {
        this.completedAt = new Date().toISOString();
      }
      
      this.updatedAt = new Date().toISOString();
      await this.save();
      return this;
    } catch (error) {
      console.error('Update task status error:', error);
      throw error;
    }
  }

  async addComment(userId, userName, text) {
    try {
      const comment = {
        id: uuidv4(),
        userId,
        userName,
        text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false
      };
      
      this.comments.push(comment);
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return comment;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  async deleteComment(commentId) {
    try {
      const commentIndex = this.comments.findIndex(c => c.id === commentId);
      if (commentIndex === -1) {
        throw new Error('Comment not found');
      }
      
      this.comments[commentIndex].isDeleted = true;
      this.comments[commentIndex].deletedAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return true;
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  }

  async addSubtask(title) {
    try {
      const subtask = {
        id: uuidv4(),
        title,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.subtasks.push(subtask);
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return subtask;
    } catch (error) {
      console.error('Add subtask error:', error);
      throw error;
    }
  }

  async updateSubtask(subtaskId, updateData) {
    try {
      const subtaskIndex = this.subtasks.findIndex(s => s.id === subtaskId);
      if (subtaskIndex === -1) {
        throw new Error('Subtask not found');
      }
      
      Object.assign(this.subtasks[subtaskIndex], updateData);
      this.subtasks[subtaskIndex].updatedAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return this.subtasks[subtaskIndex];
    } catch (error) {
      console.error('Update subtask error:', error);
      throw error;
    }
  }

  async deleteSubtask(subtaskId) {
    try {
      this.subtasks = this.subtasks.filter(s => s.id !== subtaskId);
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return true;
    } catch (error) {
      console.error('Delete subtask error:', error);
      throw error;
    }
  }

  async updateProgress(progress) {
    try {
      if (progress < 0 || progress > 100) {
        throw new Error('Progress must be between 0 and 100');
      }
      
      this.progress = progress;
      
      if (progress === 100) {
        this.status = 'completed';
        this.completedAt = new Date().toISOString();
      } else if (this.status === 'completed' && progress < 100) {
        this.status = 'in-progress';
        this.completedAt = null;
      }
      
      this.updatedAt = new Date().toISOString();
      await this.save();
      return this;
    } catch (error) {
      console.error('Update progress error:', error);
      throw error;
    }
  }

  async assignTo(employeeId) {
    try {
      this.assignedTo = employeeId;
      this.updatedAt = new Date().toISOString();
      
      await this.save();
      return this;
    } catch (error) {
      console.error('Assign task error:', error);
      throw error;
    }
  }

  isOverdue() {
    if (this.status === 'completed' || this.status === 'cancelled') {
      return false;
    }
    if (!this.dueDate) {
      return false;
    }
    return new Date(this.dueDate) < new Date();
  }

  getTimeRemaining() {
    if (!this.dueDate) {
      return null;
    }
    if (this.isOverdue()) {
      return 'Overdue';
    }
    
    const now = new Date();
    const due = new Date(this.dueDate);
    const diff = due - now;
    
    if (diff < 0) return 'Overdue';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  toJSON() {
    const data = { ...this };
    return data;
  }
}

module.exports = Task;