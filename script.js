/* ===== Utilidades Firebase ===== */
let currentUser = null;

// Verificar estado de autenticación
auth.onAuthStateChanged((user) => {
  currentUser = user;
  const path = window.location.pathname.split('/').pop();
  
  if (user) {
    // Usuario logueado
    if (path === 'login.html' || path === 'register.html' || path === '') {
      window.location.href = 'tasks.html';
    }
  } else {
    // Usuario no logueado
    if (path === 'tasks.html') {
      window.location.href = 'login.html';
    }
  }
});

// Funciones para manejar errores de Firebase
function handleFirebaseError(error) {
  console.error('Firebase error:', error);
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Este correo ya está registrado';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres';
    case 'auth/user-not-found':
      return 'Usuario no encontrado';
    case 'auth/wrong-password':
      return 'Contraseña incorrecta';
    case 'auth/invalid-email':
      return 'Correo electrónico inválido';
    default:
      return 'Error: ' + error.message;
  }
}

// Funciones para trabajar con Firestore
async function getUserSedes(userId) {
  try {
    const sedesRef = db.collection('users').doc(userId).collection('sedes');
    const snapshot = await sedesRef.orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo sedes:', error);
    return [];
  }
}

async function getUserTasks(userId) {
  try {
    const tasksRef = db.collection('users').doc(userId).collection('tasks');
    const snapshot = await tasksRef.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo tareas:', error);
    return [];
  }
}

async function addSedeToFirestore(userId, sedeName) {
  try {
    await db.collection('users').doc(userId).collection('sedes').add({
      name: sedeName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error añadiendo sede:', error);
    return false;
  }
}

async function deleteSedeFromFirestore(userId, sedeId, sedeName) {
  try {
    // Eliminar la sede
    await db.collection('users').doc(userId).collection('sedes').doc(sedeId).delete();
    
    // Eliminar todas las tareas de esa sede
    const tasksQuery = db.collection('users').doc(userId).collection('tasks').where('sede', '==', sedeName);
    const tasksSnapshot = await tasksQuery.get();
    
    const batch = db.batch();
    tasksSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    return true;
  } catch (error) {
    console.error('Error eliminando sede:', error);
    return false;
  }
}

async function addTaskToFirestore(userId, task) {
  try {
    await db.collection('users').doc(userId).collection('tasks').add({
      ...task,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error añadiendo tarea:', error);
    return false;
  }
}

async function updateTaskInFirestore(userId, taskId, updates) {
  try {
    await db.collection('users').doc(userId).collection('tasks').doc(taskId).update(updates);
    return true;
  } catch (error) {
    console.error('Error actualizando tarea:', error);
    return false;
  }
}

async function deleteTaskFromFirestore(userId, taskId) {
  try {
    await db.collection('users').doc(userId).collection('tasks').doc(taskId).delete();
    return true;
  } catch (error) {
    console.error('Error eliminando tarea:', error);
    return false;
  }
}

/* ===== DOM ready ===== */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.split('/').pop();

  /* -------- REGISTER PAGE -------- */
  if (path === 'register.html') {
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPass').value.trim();
      
      if (!email || !password) {
        return alert('Complete todos los campos');
      }

      try {
        await auth.createUserWithEmailAndPassword(email, password);
        alert('Registro exitoso. Redirigiendo...');
        // La redirección se maneja automáticamente por onAuthStateChanged
      } catch (error) {
        alert(handleFirebaseError(error));
      }
    });
  }

  /* -------- LOGIN PAGE -------- */
  if (path === 'login.html' || path === '') {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPass').value.trim();
        
        if (!email || !password) {
          return alert('Complete todos los campos');
        }

        try {
          await auth.signInWithEmailAndPassword(email, password);
          // La redirección se maneja automáticamente por onAuthStateChanged
        } catch (error) {
          alert(handleFirebaseError(error));
        }
      });
    }
  }

  /* -------- TASKS PAGE -------- */
  if (path === 'tasks.html') {
    // Esperar a que el usuario esté cargado
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      
      // DOM elements
      const logoutBtn = document.getElementById('logoutBtn');
      const sedeForm = document.getElementById('sedeForm');
      const sedeInput = document.getElementById('sedeInput');
      const sedeList = document.getElementById('sedeList');
      const sedeSelect = document.getElementById('sedeSelect');
      const taskForm = document.getElementById('taskForm');
      const taskInput = document.getElementById('taskInput');
      const taskList = document.getElementById('taskList');

      let sedes = [];
      let tasks = [];

      // Cargar datos iniciales
      await loadAllData();

      // --- Funciones de carga de datos ---
      async function loadAllData() {
        await Promise.all([loadSedes(), loadTasks()]);
      }

      async function loadSedes() {
        sedes = await getUserSedes(user.uid);
        renderSedeList();
        updateSedeSelect();
      }

      async function loadTasks() {
        tasks = await getUserTasks(user.uid);
        renderTasks();
      }

      // --- Sedes UI ---
      function renderSedeList() {
        sedeList.innerHTML = '';
        if (!sedes.length) {
          sedeList.innerHTML = `<div style="color:#666;margin-bottom:12px;">No hay sedes aún. Añade una arriba.</div>`;
          return;
        }

        sedes.forEach((sede) => {
          const item = document.createElement('div');
          item.className = 'sede-item';
          item.innerHTML = `
            <div class="sede-name">${sede.name}</div>
            <div class="sede-actions">
              <button class="delete-sede-btn" data-sede-id="${sede.id}" data-sede-name="${sede.name}">Eliminar sede</button>
            </div>
          `;
          item.querySelector('.delete-sede-btn').addEventListener('click', (e) => {
            const sedeId = e.target.getAttribute('data-sede-id');
            const sedeName = e.target.getAttribute('data-sede-name');
            deleteSede(sedeId, sedeName);
          });
          sedeList.appendChild(item);
        });
      }

      function updateSedeSelect() {
        sedeSelect.innerHTML = `<option value="">-- Selecciona una sede --</option>`;
        sedes.forEach(sede => {
          const opt = document.createElement('option');
          opt.value = sede.name;
          opt.textContent = sede.name;
          sedeSelect.appendChild(opt);
        });
      }

      async function addSede(name) {
        if (sedes.some(s => s.name === name)) {
          alert('La sede ya existe');
          return;
        }
        
        const success = await addSedeToFirestore(user.uid, name);
        if (success) {
          await loadSedes();
        } else {
          alert('Error al añadir la sede');
        }
      }

      async function deleteSede(sedeId, sedeName) {
        if (!confirm(`Se eliminará la sede "${sedeName}" y todas las tareas relacionadas. ¿Continuar?`)) return;
        
        const success = await deleteSedeFromFirestore(user.uid, sedeId, sedeName);
        if (success) {
          await loadAllData();
        } else {
          alert('Error al eliminar la sede');
        }
      }

      // --- Tasks UI ---
      function renderTasks() {
        taskList.innerHTML = '';
        if (!sedes.length) {
          taskList.innerHTML = `<div style="color:#666;">No hay sedes para agrupar tareas. Añade una sede primero.</div>`;
          return;
        }

        // Agrupar por sede
        sedes.forEach(sede => {
          const tasksForSede = tasks.filter(t => t.sede === sede.name);
          
          const sedeDiv = document.createElement('div');
          sedeDiv.className = 'sede';
          sedeDiv.innerHTML = `<h3>${sede.name}</h3>`;

          // Separar por estado
          const pendientes = tasksForSede.filter(t => !t.completed);
          const completadas = tasksForSede.filter(t => t.completed);

          if (pendientes.length) {
            const pTitle = document.createElement('div');
            pTitle.className = 'section-title';
            pTitle.textContent = 'Pendientes';
            sedeDiv.appendChild(pTitle);
            pendientes.forEach(t => sedeDiv.appendChild(createTaskElement(t)));
          }

          if (completadas.length) {
            const cTitle = document.createElement('div');
            cTitle.className = 'section-title';
            cTitle.textContent = 'Completadas';
            sedeDiv.appendChild(cTitle);
            completadas.forEach(t => sedeDiv.appendChild(createTaskElement(t)));
          }

          if (!pendientes.length && !completadas.length) {
            const noTasks = document.createElement('div');
            noTasks.style.color = '#666';
            noTasks.textContent = 'Sin tareas';
            sedeDiv.appendChild(noTasks);
          }

          taskList.appendChild(sedeDiv);
        });
      }

      function createTaskElement(task) {
        const el = document.createElement('div');
        el.className = 'task' + (task.completed ? ' completed' : '');
        
        const left = document.createElement('div');
        left.className = 'left';
        
        // Manejar fecha de creación (puede ser Timestamp de Firebase o string)
        let createdAtStr = 'Fecha no disponible';
        if (task.createdAt) {
          if (task.createdAt.toDate) {
            // Es un Timestamp de Firebase
            createdAtStr = task.createdAt.toDate().toLocaleString();
          } else if (typeof task.createdAt === 'string') {
            createdAtStr = task.createdAt;
          }
        }
        
        left.innerHTML = `
          <div><strong>${task.description}</strong></div>
          <div class="meta">Inscrita: ${createdAtStr}</div>
          ${task.completed && task.completedAt ? `<div class="meta">Completada: ${task.completedAt}</div>` : ''}
        `;
        
        const actions = document.createElement('div');
        actions.className = 'task-actions';
        
        const completeBtn = document.createElement('button');
        completeBtn.className = 'complete-btn';
        completeBtn.textContent = task.completed ? 'Completada' : 'Marcar';
        completeBtn.disabled = task.completed;
        completeBtn.addEventListener('click', () => toggleComplete(task.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
        
        actions.appendChild(completeBtn);
        actions.appendChild(deleteBtn);
        
        el.appendChild(left);
        el.appendChild(actions);
        
        return el;
      }

      // CRUD tasks
      async function addTask(description, sede) {
        const newTask = {
          description,
          sede,
          completed: false,
          completedAt: null
        };
        
        const success = await addTaskToFirestore(user.uid, newTask);
        if (success) {
          await loadTasks();
        } else {
          alert('Error al añadir la tarea');
        }
      }

      async function toggleComplete(taskId) {
        const updates = {
          completed: true,
          completedAt: new Date().toLocaleString()
        };
        
        const success = await updateTaskInFirestore(user.uid, taskId, updates);
        if (success) {
          await loadTasks();
        } else {
          alert('Error al marcar la tarea como completada');
        }
      }

      async function deleteTask(taskId) {
        if (!confirm('¿Eliminar esta tarea?')) return;
        
        const success = await deleteTaskFromFirestore(user.uid, taskId);
        if (success) {
          await loadTasks();
        } else {
          alert('Error al eliminar la tarea');
        }
      }

      // --- Events ---
      logoutBtn.addEventListener('click', async () => {
        try {
          await auth.signOut();
          // La redirección se maneja automáticamente por onAuthStateChanged
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        }
      });

      sedeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = sedeInput.value.trim();
        if (!name) return;
        await addSede(name);
        sedeInput.value = '';
      });

      taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const desc = taskInput.value.trim();
        const sede = sedeSelect.value;
        if (!desc) return alert('Ingrese descripción');
        if (!sede) return alert('Seleccione una sede');
        await addTask(desc, sede);
        taskInput.value = '';
      });

      // Desuscribirse del listener cuando ya no sea necesario
      unsubscribe();
    });
  }
});