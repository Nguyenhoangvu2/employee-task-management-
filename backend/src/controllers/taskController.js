const { db, admin } = require('../config/firebase');
const { FieldValue } = admin.firestore;

const generateTaskId = () => db.collection('tasks').doc().id;

const sanitizeTaskData = (data) => {
  const sanitized = { ...data };
  return sanitized;
};

exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority, status } = req.body;

    if (!title || !assignedTo) {
      return res.status(400).json({ success: false, error: 'Title and assignedTo are required' });
    }

    const employeeDoc = await db.collection('employees').doc(assignedTo).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const taskId = generateTaskId();
    const now = admin.firestore.Timestamp.now();

    const taskData = {
      title: title.trim(),
      description: description?.trim() || '',
      assignedTo,
      dueDate: dueDate ? admin.firestore.Timestamp.fromDate(new Date(dueDate)) : null,
      priority: priority || 'medium',
      status: status || 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.employeeId || req.user?.phoneNumber || 'system',
      createdByName: req.user?.name || 'Manager',
      completedAt: null,
      comments: [],
      subtasks: [],
      attachments: [],
      tags: []
    };

    await db.collection('tasks').doc(taskId).set(taskData);

    await db.collection('employees').doc(assignedTo).update({
      tasks: FieldValue.arrayUnion(taskId)
    });

    res.status(201).json({
      success: true,
      task: { id: taskId, ...sanitizeTaskData(taskData) },
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getAllTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, limit = 50 } = req.query;

    let query = db.collection('tasks');

    if (status) query = query.where('status', '==', status);
    if (priority) query = query.where('priority', '==', priority);
    if (assignedTo) query = query.where('assignedTo', '==', assignedTo);

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...sanitizeTaskData(doc.data())
    }));

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    res.json({
      success: true,
      task: {
        id: taskDoc.id,
        ...sanitizeTaskData(taskDoc.data())
      }
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updateData = { ...req.body };

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const oldData = taskDoc.data();

    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.createdBy;

    if (updateData.assignedTo && updateData.assignedTo !== oldData.assignedTo) {
      const newEmployeeDoc = await db.collection('employees').doc(updateData.assignedTo).get();
      if (!newEmployeeDoc.exists) {
        return res.status(404).json({ success: false, error: 'New employee not found' });
      }

      if (oldData.assignedTo) {
        await db.collection('employees').doc(oldData.assignedTo).update({
          tasks: FieldValue.arrayRemove(taskId)
        });
      }

      await db.collection('employees').doc(updateData.assignedTo).update({
        tasks: FieldValue.arrayUnion(taskId)
      });
    }

    const updatePayload = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await taskRef.update(updatePayload);

    const updatedDoc = await taskRef.get();

    res.json({
      success: true,
      task: { id: updatedDoc.id, ...sanitizeTaskData(updatedDoc.data()) },
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const { assignedTo } = taskDoc.data();

    if (assignedTo) {
      await db.collection('employees').doc(assignedTo).update({
        tasks: FieldValue.arrayRemove(taskId)
      });
    }

    await taskRef.delete();

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!taskId || !status) {
      return res.status(400).json({ success: false, error: 'Task ID and status are required' });
    }

    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status === 'completed') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.progress = 100;
    }

    await taskRef.update(updateData);

    res.json({
      success: true,
      message: `Task status updated to ${status}`
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateTaskProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    let { progress } = req.body;

    if (!taskId || progress === undefined) {
      return res.status(400).json({ success: false, error: 'Task ID and progress are required' });
    }

    progress = Number(progress);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      return res.status(400).json({ success: false, error: 'Progress must be between 0 and 100' });
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const updateData = {
      progress,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (progress === 100) {
      updateData.status = 'completed';
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (progress > 0 && taskDoc.data().status === 'pending') {
      updateData.status = 'in-progress';
    }

    await taskRef.update(updateData);

    res.json({
      success: true,
      progress,
      message: 'Task progress updated successfully'
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.assignTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { employeeId } = req.body;

    if (!taskId || !employeeId) {
      return res.status(400).json({ success: false, error: 'Task ID and employee ID are required' });
    }

    const [taskDoc, employeeDoc] = await Promise.all([
      db.collection('tasks').doc(taskId).get(),
      db.collection('employees').doc(employeeId).get()
    ]);

    if (!taskDoc.exists) return res.status(404).json({ success: false, error: 'Task not found' });
    if (!employeeDoc.exists) return res.status(404).json({ success: false, error: 'Employee not found' });

    const taskData = taskDoc.data();

    if (taskData.assignedTo && taskData.assignedTo !== employeeId) {
      await db.collection('employees').doc(taskData.assignedTo).update({
        tasks: FieldValue.arrayRemove(taskId)
      });
    }

    await Promise.all([
      db.collection('tasks').doc(taskId).update({
        assignedTo: employeeId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }),
      db.collection('employees').doc(employeeId).update({
        tasks: FieldValue.arrayUnion(taskId)
      })
    ]);

    res.json({ success: true, message: 'Task assigned successfully' });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    if (!taskId || !text?.trim()) {
      return res.status(400).json({ success: false, error: 'Task ID and comment text are required' });
    }

    const comment = {
      id: db.collection('tasks').doc().id,
      text: text.trim(),
      userId: req.user?.employeeId || req.user?.phoneNumber || 'anonymous',
      userName: req.user?.name || req.user?.email || 'User',
      createdAt: admin.firestore.Timestamp.now()
    };

    await db.collection('tasks').doc(taskId).update({
      comments: FieldValue.arrayUnion(comment),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      success: true,
      comment,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getEmployeeTasks = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status } = req.query;

    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Employee ID is required' });
    }

    const employeeDoc = await db.collection('employees').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    let query = db.collection('tasks').where('assignedTo', '==', employeeId);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...sanitizeTaskData(doc.data())
    }));

    tasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.toDate() - b.dueDate.toDate();
    });

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Get employee tasks error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getOverdueTasks = async (req, res) => {
  try {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db.collection('tasks')
      .where('dueDate', '<', now)
      .where('status', 'in', ['pending', 'in-progress'])
      .get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...sanitizeTaskData(doc.data())
    }));

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Get overdue tasks error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.addSubtask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title } = req.body;

    if (!taskId || !title?.trim()) {
      return res.status(400).json({ success: false, error: 'Task ID and subtask title are required' });
    }

    const subtask = {
      id: db.collection('tasks').doc().id,
      title: title.trim(),
      isCompleted: false,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('tasks').doc(taskId).update({
      subtasks: FieldValue.arrayUnion(subtask),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      success: true,
      subtask,
      message: 'Subtask added successfully'
    });
  } catch (error) {
    console.error('Add subtask error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { isCompleted } = req.body;

    if (!taskId || !subtaskId) {
      return res.status(400).json({ success: false, error: 'Task ID and subtask ID are required' });
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) return res.status(404).json({ success: false, error: 'Task not found' });

    const taskData = taskDoc.data();
    const subtaskIndex = taskData.subtasks?.findIndex(s => s.id === subtaskId);

    if (subtaskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Subtask not found' });
    }

    taskData.subtasks[subtaskIndex].isCompleted = !!isCompleted;
    taskData.subtasks[subtaskIndex].updatedAt = admin.firestore.Timestamp.now();

    await taskRef.update({
      subtasks: taskData.subtasks,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      subtask: taskData.subtasks[subtaskIndex],
      message: 'Subtask updated successfully'
    });
  } catch (error) {
    console.error('Update subtask error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.deleteSubtask = async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;

    if (!taskId || !subtaskId) {
      return res.status(400).json({ success: false, error: 'Task ID and subtask ID are required' });
    }

    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) return res.status(404).json({ success: false, error: 'Task not found' });

    const taskData = taskDoc.data();
    const subtaskToRemove = taskData.subtasks?.find(s => s.id === subtaskId);

    if (!subtaskToRemove) {
      return res.status(404).json({ success: false, error: 'Subtask not found' });
    }

    await taskRef.update({
      subtasks: FieldValue.arrayRemove(subtaskToRemove),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Subtask deleted successfully' });
  } catch (error) {
    console.error('Delete subtask error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};