require('dotenv').config();

const { db, admin, FieldValue } = require('./src/config/firebase');

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    console.log('Project:', process.env.FIREBASE_PROJECT_ID);

    const managerData = {
      phoneNumber: "0328851734",
      accessCode: "",
      codeExpiresAt: null,
      role: "manager",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
      validatedAt: null
    };
    await db.collection('users').doc('0328851734').set(managerData);
    console.log('Manager created');

    const employees = [
      {
        name: "Nguyen Hoang Vu",
        email: "nguyenhoangvu.dev@gmail.com",
        phone: "0328851734",
        role: "developer",
        department: "Engineering",
        position: "Senior Developer",
        isActive: true,
        passwordSet: false,
        tasks: [],
        schedule: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          hours: "9:00 AM - 5:00 PM"
        },
        profile: {
          address: "",
          emergencyContact: "",
          notes: "",
          avatar: "",
          birthday: "",
          gender: ""
        },
        hireDate: new Date().toISOString(),
        salary: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
        accessCode: "",
        codeExpiresAt: null
      },
      {
        name: "Tran Van A",
        email: "tranvana@gmail.com",
        phone: "0987654321",
        role: "designer",
        department: "Design",
        position: "UI/UX Designer",
        isActive: true,
        passwordSet: false,
        tasks: [],
        schedule: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          hours: "9:00 AM - 5:00 PM"
        },
        profile: {
          address: "",
          emergencyContact: "",
          notes: "",
          avatar: "",
          birthday: "",
          gender: ""
        },
        hireDate: new Date().toISOString(),
        salary: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
        accessCode: "",
        codeExpiresAt: null
      },
      {
        name: "Le Thi B",
        email: "lethib@gmail.com",
        phone: "0912345678",
        role: "tester",
        department: "QA",
        position: "QA Engineer",
        isActive: true,
        passwordSet: false,
        tasks: [],
        schedule: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          hours: "9:00 AM - 5:00 PM"
        },
        profile: {
          address: "",
          emergencyContact: "",
          notes: "",
          avatar: "",
          birthday: "",
          gender: ""
        },
        hireDate: new Date().toISOString(),
        salary: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
        accessCode: "",
        codeExpiresAt: null
      }
    ];

    const employeeIds = [];
    for (const emp of employees) {
      const docRef = await db.collection('employees').add(emp);
      employeeIds.push(docRef.id);
      console.log('Employee created: ' + emp.name + ' (' + docRef.id + ')');
    }

    const tasks = [
      {
        title: "Xay dung he thong chat",
        description: "Xay dung real-time chat voi Socket.IO",
        assignedTo: employeeIds[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high",
        status: "in-progress",
        progress: 60,
        createdBy: "system",
        createdByName: "Manager",
        completedAt: null,
        comments: [],
        subtasks: [
          {
            id: Date.now().toString(36) + "sub1",
            title: "Thiet ke UI chat",
            isCompleted: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: Date.now().toString(36) + "sub2",
            title: "Xay dung Socket.IO server",
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        attachments: [],
        tags: ["chat", "realtime", "socket"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Hoan thien UI Dashboard",
        description: "Hoan thien giao dien Admin va Employee Dashboard",
        assignedTo: employeeIds[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "medium",
        status: "pending",
        progress: 0,
        createdBy: "system",
        createdByName: "Manager",
        completedAt: null,
        comments: [],
        subtasks: [],
        attachments: [],
        tags: ["ui", "dashboard", "frontend"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Thiet ke UI cho Employee",
        description: "Thiet ke giao dien cho Employee Dashboard",
        assignedTo: employeeIds[1],
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high",
        status: "pending",
        progress: 0,
        createdBy: "system",
        createdByName: "Manager",
        completedAt: null,
        comments: [],
        subtasks: [],
        attachments: [],
        tags: ["design", "ui", "employee"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Kiem thu he thong chat",
        description: "Kiem thu toan bo chuc nang chat real-time",
        assignedTo: employeeIds[2],
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "urgent",
        status: "pending",
        progress: 0,
        createdBy: "system",
        createdByName: "Manager",
        completedAt: null,
        comments: [],
        subtasks: [],
        attachments: [],
        tags: ["testing", "chat", "qa"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const task of tasks) {
      const docRef = await db.collection('tasks').add(task);
      console.log('Task created: ' + task.title + ' (' + docRef.id + ')');

      const empRef = db.collection('employees').doc(task.assignedTo);
      await empRef.update({
        tasks: FieldValue.arrayUnion(docRef.id)
      });
    }

    const chatMessages = [
      {
        from: employeeIds[0],
        to: "manager",
        message: "Chao sep, em co the hoi ve task chat duoc khong a?",
        type: "text",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        read: false,
        readAt: null,
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        delivered: false,
        offline: false
      },
      {
        from: "0328851734",
        to: employeeIds[0],
        message: "Chao em, co gi em cu hoi nhe!",
        type: "text",
        timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        read: false,
        readAt: null,
        createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        delivered: false,
        offline: false
      },
      {
        from: employeeIds[0],
        to: "manager",
        message: "Em dang gap kho khan voi Socket.IO, anh co the huong dan giup em khong?",
        type: "text",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        read: false,
        readAt: null,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        delivered: false,
        offline: false
      },
      {
        from: "0328851734",
        to: employeeIds[0],
        message: "De anh xem giup em nhe!",
        type: "text",
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        read: false,
        readAt: null,
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        delivered: false,
        offline: false
      }
    ];

    for (const msg of chatMessages) {
      await db.collection('chatMessages').add(msg);
      console.log('Chat message created');
    }

    console.log('Database seeding completed successfully!');
    console.log('Summary:');
    console.log('   - 1 Manager');
    console.log('   - ' + employees.length + ' Employees');
    console.log('   - ' + tasks.length + ' Tasks');
    console.log('   - ' + chatMessages.length + ' Chat Messages');

  } catch (error) {
    console.error('Seeding error:', error);
    console.error('Error details:', error.message);
  }
}

seedDatabase();