/* ===== Utilidades Firebase ===== */
let currentUser = null;

// Verificar estado de autenticación
auth.onAuthStateChanged((user) => {
  currentUser = user;
  const path = window.location.pathname.split('/').pop();
  
  if (user) {
    // Usuario logueado
    if (path === 'login.html' || path === 'register.html' || path === '' || path === 'index.html') {
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
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Intenta más tarde';
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

async function getTasksBySedeAndMonth(userId, sede, year, month) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    console.log('Filtrando tareas:');
    console.log('Año:', year, 'Mes:', month);
    console.log('Buscando tareas entre:', startDate, 'y', endDate);
    console.log('Sede:', sede);
    
    let tasksRef = db.collection('users').doc(userId).collection('tasks')
      .where('completed', '==', true);
    
    if (sede !== 'all') {
      tasksRef = tasksRef.where('sede', '==', sede);
    }
    
    const snapshot = await tasksRef.get();
    const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log('Tareas completadas encontradas:', allTasks.length);
    
    // Filtrar por fecha en el cliente para mayor flexibilidad
    const filteredTasks = allTasks.filter(task => {
      if (!task.completedAt) return false;
      
      let completedDate;
      if (task.completedAt.toDate) {
        completedDate = task.completedAt.toDate();
      } else if (task.completedAt.seconds) {
        completedDate = new Date(task.completedAt.seconds * 1000);
      } else {
        return false;
      }
      
      return completedDate >= startDate && completedDate <= endDate;
    });
    
    console.log('Tareas filtradas por fecha:', filteredTasks.length);
    return filteredTasks.sort((a, b) => {
      const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt?.seconds * 1000 || 0);
      const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt?.seconds * 1000 || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error obteniendo tareas para reporte:', error);
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
    // Si se está completando la tarea, añadir timestamp
    if (updates.completed === true) {
      updates.completedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    
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

// Función para generar PDF con jsPDF - VERSIÓN COMPLETAMENTE OPTIMIZADA
function generatePDF(tasks, sede, month, year) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  
  // Configuración de fuente
  pdf.setFont('helvetica');
  
  // Header con logo SIMA
  pdf.setFontSize(20);
  pdf.setTextColor(44, 90, 160);
  pdf.text('SIMA', 20, 25);
  
  pdf.setFontSize(12);
  pdf.setTextColor(108, 117, 125);
  pdf.text('Servicios Integrales de Mantenimiento', 20, 32);
  
  // Título del reporte
  pdf.setFontSize(16);
  pdf.setTextColor(44, 62, 80);
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const monthIndex = Math.max(0, Math.min(11, month - 1));
  const monthName = monthNames[monthIndex];
  
  const reportTitle = `Reporte de Mantenimiento - ${monthName} ${year}`;
  pdf.text(reportTitle, 20, 45);
  
  pdf.setFontSize(12);
  pdf.setTextColor(108, 117, 125);
  const sedeText = sede === 'all' ? 'Todas las sedes' : `Sede: ${sede}`;
  pdf.text(sedeText, 20, 52);
  
  // Línea separadora
  pdf.setDrawColor(233, 236, 239);
  pdf.line(20, 58, 190, 58);
  
  let y = 70;
  
  if (tasks.length === 0) {
    pdf.setFontSize(12);
    pdf.setTextColor(108, 117, 125);
    pdf.text('No hay tareas completadas en el período seleccionado.', 20, y);
  } else {
    pdf.setFontSize(12);
    pdf.setTextColor(44, 62, 80);
    pdf.text(`Total de tareas completadas: ${tasks.length}`, 20, y);
    y += 15;
    
    tasks.forEach((task, index) => {
      // Calcular altura necesaria para esta tarea
      const descriptionLines = pdf.splitTextToSize(task.description, 165);
      const materialsLines = task.materials ? pdf.splitTextToSize(task.materials, 165) : [];
      const sedeLines = pdf.splitTextToSize(task.sede, 165);
      
      // Calcular altura mínima necesaria
      const baseHeight = 25; // Altura base para número, fecha, etc.
      const descriptionHeight = Math.max(1, descriptionLines.length) * 4;
      const materialsHeight = materialsLines.length > 0 ? (materialsLines.length * 4) + 8 : 8; // +8 para el título "Materiales"
      const sedeHeight = Math.max(1, sedeLines.length) * 4;
      
      const totalHeight = baseHeight + descriptionHeight + materialsHeight + sedeHeight;
      
      // Verificar si necesitamos una nueva página
      if (y + totalHeight > 270) {
        pdf.addPage();
        y = 20;
      }
      
      // Rectángulo de fondo alternando colores
      const bgColor = index % 2 === 0 ? [248, 249, 250] : [255, 255, 255];
      pdf.setFillColor(...bgColor);
      pdf.rect(18, y - 3, 174, totalHeight, 'F');
      
      // Borde izquierdo azul
      pdf.setFillColor(44, 90, 160);
      pdf.rect(18, y - 3, 3, totalHeight, 'F');
      
      let currentY = y;
      
      // NUEVO LAYOUT VERTICAL OPTIMIZADO
      
      // Fecha de completado en la misma línea, alineada a la derecha
      let completedDateFormatted = 'Fecha no disponible';
      if (task.completedAt) {
        let completedDate;
        if (task.completedAt.toDate) {
          completedDate = task.completedAt.toDate();
        } else if (task.completedAt.seconds) {
          completedDate = new Date(task.completedAt.seconds * 1000);
        }
        
        if (completedDate) {
          completedDateFormatted = completedDate.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }
      
      pdf.setFontSize(9);
      pdf.setTextColor(108, 117, 125);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Completada: ${completedDateFormatted}`, 190, currentY, { align: 'right' });
      
      currentY += 8;
      
      // 2. Sede completa
      pdf.setFontSize(9);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SEDE:', 25, currentY);
      
      pdf.setTextColor(44, 62, 80);
      pdf.setFont('helvetica', 'normal');
      sedeLines.forEach((line, i) => {
        pdf.text(line, 45, currentY + (i * 4));
      });
      
      currentY += (sedeLines.length * 4) + 4;
      
      // 3. Descripción completa
      pdf.setFontSize(9);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DESCRIPCIÓN:', 25, currentY);
      
      pdf.setTextColor(44, 62, 80);
      pdf.setFont('helvetica', 'normal');
      descriptionLines.forEach((line, i) => {
        pdf.text(line, 25, currentY + 6 + (i * 4));
      });
      
      currentY += 6 + (descriptionLines.length * 4) + 4;
      
      // 4. Materiales completos
      pdf.setFontSize(9);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MATERIALES UTILIZADOS:', 25, currentY);
      
      if (materialsLines.length > 0) {
        pdf.setTextColor(44, 62, 80);
        pdf.setFont('helvetica', 'normal');
        materialsLines.forEach((line, i) => {
          pdf.text(line, 25, currentY + 6 + (i * 4));
        });
      } else {
        pdf.setTextColor(108, 117, 125);
        pdf.setFont('helvetica', 'italic');
        pdf.text('No especificado', 25, currentY + 6);
      }
      
      y += totalHeight + 8; // Espacio entre tareas
      
      // Línea separadora entre tareas
      if (index < tasks.length - 1) {
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.5);
        pdf.line(20, y - 4, 190, y - 4);
      }
    });
  }
  
  // Footer mejorado
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    
    // Línea superior del footer
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.5);
    pdf.line(20, 275, 190, 275);
    
    pdf.setFontSize(8);
    pdf.setTextColor(108, 117, 125);
    pdf.text(`Página ${i} de ${pageCount}`, 190, 282, { align: 'right' });
    pdf.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 20, 282);
    pdf.text('SIMA - Servicios Integrales de Mantenimiento', 20, 287);
  }
  
  // Descargar el PDF con nombre mejorado
  const fileName = `SIMA_Reporte_${sede === 'all' ? 'TodasSedes' : sede.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
  pdf.save(fileName);
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
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
        
        await auth.createUserWithEmailAndPassword(email, password);
        alert('Registro exitoso. Redirigiendo...');
      } catch (error) {
        alert(handleFirebaseError(error));
      } finally {
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrar';
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
          const submitBtn = loginForm.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
          
          await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
          alert(handleFirebaseError(error));
        } finally {
          const submitBtn = loginForm.querySelector('button[type="submit"]');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
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
      const reportBtn = document.getElementById('reportBtn');
      const toggleCompletedBtn = document.getElementById('toggleCompletedBtn');
      
      // Modal elements
      const completeModal = document.getElementById('completeModal');
      const reportModal = document.getElementById('reportModal');
      const completeForm = document.getElementById('completeForm');
      const reportForm = document.getElementById('reportForm');
      const materialsInput = document.getElementById('materialsInput');
      const modalTaskDesc = document.getElementById('modalTaskDesc');
      const reportSedeSelect = document.getElementById('reportSedeSelect');
      const reportMonth = document.getElementById('reportMonth');

      let sedes = [];
      let tasks = [];
      let currentTaskToComplete = null;
      let showCompleted = false;

      // CORRECCIÓN: Establecer mes actual en el selector de reporte
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // getMonth() retorna 0-11, necesitamos 1-12
      const currentYear = now.getFullYear();
      reportMonth.value = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      
      console.log('Mes actual establecido:', currentMonth, '(' + now.toLocaleDateString('es-ES', { month: 'long' }) + ')');
      console.log('Valor del selector:', reportMonth.value);

      // Cargar datos iniciales
      await loadAllData();

      // --- Funciones de carga de datos ---
      async function loadAllData() {
        taskList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando tareas...</div>';
        await Promise.all([loadSedes(), loadTasks()]);
      }

      async function loadSedes() {
        sedes = await getUserSedes(user.uid);
        renderSedeList();
        updateSedeSelect();
        updateReportSedeSelect();
      }

      async function loadTasks() {
        tasks = await getUserTasks(user.uid);
        renderTasks();
      }

      // --- Sedes UI ---
      function renderSedeList() {
        sedeList.innerHTML = '';
        if (!sedes.length) {
          sedeList.innerHTML = `<div class="no-tasks">No hay sedes aún. Añade una arriba.</div>`;
          return;
        }

        sedes.forEach((sede) => {
          const item = document.createElement('div');
          item.className = 'sede-item fade-in';
          item.innerHTML = `
            <div class="sede-name">
              <i class="fas fa-building"></i>
              ${sede.name}
            </div>
            <div class="sede-actions">
              <button class="delete-sede-btn" data-sede-id="${sede.id}" data-sede-name="${sede.name}">
                <i class="fas fa-trash"></i>
                Eliminar
              </button>
            </div>
          `;
          item.querySelector('.delete-sede-btn').addEventListener('click', (e) => {
            const sedeId = e.target.closest('button').getAttribute('data-sede-id');
            const sedeName = e.target.closest('button').getAttribute('data-sede-name');
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

      function updateReportSedeSelect() {
        reportSedeSelect.innerHTML = `
          <option value="">-- Selecciona una sede --</option>
          <option value="all">Todas las sedes</option>
        `;
        sedes.forEach(sede => {
          const opt = document.createElement('option');
          opt.value = sede.name;
          opt.textContent = sede.name;
          reportSedeSelect.appendChild(opt);
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
          taskList.innerHTML = `<div class="no-tasks">No hay sedes para agrupar tareas. Añade una sede primero.</div>`;
          return;
        }

        // Filtrar tareas según el modo de vista
        const filteredTasks = showCompleted ? tasks.filter(t => t.completed) : tasks.filter(t => !t.completed);

        if (showCompleted) {
          // Para tareas completadas, usar estructura jerárquica Mes > Sede > Tareas
          renderCompletedTasksHierarchy(filteredTasks);
        } else {
          // Para tareas pendientes, mantener el sistema actual
          renderPendingTasks(filteredTasks);
        }
      }

      function renderPendingTasks(pendingTasks) {
        sedes.forEach(sede => {
          const tasksForSede = pendingTasks.filter(t => t.sede === sede.name);
          
          if (tasksForSede.length === 0) return;
          
          const sedeDiv = document.createElement('div');
          sedeDiv.className = 'sede slide-up';
          sedeDiv.innerHTML = `
            <h3>
              <i class="fas fa-map-marker-alt"></i>
              ${sede.name} (${tasksForSede.length} pendiente${tasksForSede.length !== 1 ? 's' : ''})
            </h3>
          `;

          tasksForSede.forEach(t => sedeDiv.appendChild(createTaskElement(t)));

          taskList.appendChild(sedeDiv);
        });

        if (pendingTasks.length === 0) {
          taskList.innerHTML = `<div class="no-tasks">¡Excelente! No hay tareas pendientes.</div>`;
        }
      }

      // NUEVA FUNCIÓN: Estructura jerárquica Mes > Sede > Tareas - CORREGIDA
      function renderCompletedTasksHierarchy(completedTasks) {
        if (completedTasks.length === 0) {
          taskList.innerHTML = `<div class="no-tasks">No hay tareas completadas aún.</div>`;
          return;
        }

        // Agrupar tareas por mes
        const tasksByMonth = groupTasksByMonth(completedTasks);
        
        // Ordenar meses de más reciente a más antiguo
        const sortedMonths = Object.keys(tasksByMonth).sort((a, b) => new Date(b + '-01') - new Date(a + '-01'));
        
        sortedMonths.forEach(monthKey => {
          const monthTasks = tasksByMonth[monthKey];
          
          // CORRECCIÓN: Crear fecha directamente con año y mes separados para evitar problemas de zona horaria
          const [year, month] = monthKey.split('-').map(Number);
          const monthDate = new Date(year, month - 1, 1); // month - 1 porque Date usa índices 0-11
          
          const monthName = monthDate.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long' 
          });
          
          console.log('Renderizando mes:', monthKey, '-> Fecha creada:', monthDate, '-> Nombre:', monthName);
          
          // Contenedor del mes (nivel 1)
          const monthContainer = document.createElement('div');
          monthContainer.className = 'month-container';
          
          // Botón del mes
          const monthButton = document.createElement('button');
          monthButton.className = 'month-toggle-btn';
          monthButton.innerHTML = `
            <i class="fas fa-chevron-right month-arrow"></i>
            <i class="fas fa-calendar"></i>
            ${monthName}
            <span class="badge">${monthTasks.length}</span>
          `;
          
          // Contenido del mes
          const monthContent = document.createElement('div');
          monthContent.className = 'month-content collapsed';
          
          // Agrupar tareas del mes por sede
          const tasksBySede = {};
          monthTasks.forEach(task => {
            if (!tasksBySede[task.sede]) {
              tasksBySede[task.sede] = [];
            }
            tasksBySede[task.sede].push(task);
          });
          
          // Crear contenedores para cada sede dentro del mes
          Object.keys(tasksBySede).forEach(sedeName => {
            const sedeTasks = tasksBySede[sedeName];
            
            // Contenedor de la sede (nivel 2)
            const sedeContainer = document.createElement('div');
            sedeContainer.className = 'sede-container';
            
            // Botón de la sede
            const sedeButton = document.createElement('button');
            sedeButton.className = 'sede-toggle-btn';
            sedeButton.innerHTML = `
              <i class="fas fa-chevron-right sede-arrow"></i>
              <i class="fas fa-building"></i>
              ${sedeName}
              <span class="badge-small">${sedeTasks.length}</span>
            `;
            
            // Contenido de la sede
            const sedeContent = document.createElement('div');
            sedeContent.className = 'sede-content collapsed';
            
            // Agregar tareas a la sede
            sedeTasks.forEach(task => {
              sedeContent.appendChild(createTaskElement(task));
            });
            
            // Event listener para toggle de sede
            sedeButton.addEventListener('click', (e) => {
              e.stopPropagation();
              const isCollapsed = sedeContent.classList.contains('collapsed');
              const arrow = sedeButton.querySelector('.sede-arrow');
              
              if (isCollapsed) {
                sedeContent.classList.remove('collapsed');
                sedeContent.classList.add('expanded');
                arrow.classList.remove('fa-chevron-right');
                arrow.classList.add('fa-chevron-down');
              } else {
                sedeContent.classList.remove('expanded');
                sedeContent.classList.add('collapsed');
                arrow.classList.remove('fa-chevron-down');
                arrow.classList.add('fa-chevron-right');
              }
            });
            
            sedeContainer.appendChild(sedeButton);
            sedeContainer.appendChild(sedeContent);
            monthContent.appendChild(sedeContainer);
          });
          
          // Event listener para toggle de mes
          monthButton.addEventListener('click', () => {
            const isCollapsed = monthContent.classList.contains('collapsed');
            const arrow = monthButton.querySelector('.month-arrow');
            
            if (isCollapsed) {
              monthContent.classList.remove('collapsed');
              monthContent.classList.add('expanded');
              arrow.classList.remove('fa-chevron-right');
              arrow.classList.add('fa-chevron-down');
            } else {
              monthContent.classList.remove('expanded');
              monthContent.classList.add('collapsed');
              arrow.classList.remove('fa-chevron-down');
              arrow.classList.add('fa-chevron-right');
              
              // Colapsar todas las sedes cuando se colapsa el mes
              const sedeContents = monthContent.querySelectorAll('.sede-content');
              const sedeArrows = monthContent.querySelectorAll('.sede-arrow');
              sedeContents.forEach(content => {
                content.classList.remove('expanded');
                content.classList.add('collapsed');
              });
              sedeArrows.forEach(arrow => {
                arrow.classList.remove('fa-chevron-down');
                arrow.classList.add('fa-chevron-right');
              });
            }
          });
          
          monthContainer.appendChild(monthButton);
          monthContainer.appendChild(monthContent);
          taskList.appendChild(monthContainer);
        });
      }

      function groupTasksByMonth(tasks) {
        const grouped = {};
        tasks.forEach(task => {
          if (!task.completedAt) return;
          
          let completedDate;
          if (task.completedAt.toDate) {
            completedDate = task.completedAt.toDate();
          } else if (task.completedAt.seconds) {
            completedDate = new Date(task.completedAt.seconds * 1000);
          } else {
            return;
          }
          
          // CORRECCIÓN: Usar getFullYear() y getMonth() + 1 para evitar problemas de zona horaria
          const year = completedDate.getFullYear();
          const month = completedDate.getMonth() + 1; // getMonth() retorna 0-11, necesitamos 1-12
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
          
          console.log('Agrupando tarea:', task.description.substring(0, 30) + '...');
          console.log('Fecha completada:', completedDate);
          console.log('Año extraído:', year, 'Mes extraído:', month);
          console.log('Clave del mes:', monthKey);
          
          if (!grouped[monthKey]) {
            grouped[monthKey] = [];
          }
          grouped[monthKey].push(task);
        });
        
        return grouped;
      }

      function createTaskElement(task) {
        const el = document.createElement('div');
        el.className = 'task' + (task.completed ? ' completed' : '');
        
        const left = document.createElement('div');
        left.className = 'left';
        
        // Fecha de creación
        let createdAtStr = 'Fecha no disponible';
        if (task.createdAt) {
          if (task.createdAt.toDate) {
            createdAtStr = task.createdAt.toDate().toLocaleString('es-ES');
          } else if (typeof task.createdAt === 'string') {
            createdAtStr = task.createdAt;
          }
        }
        
        // Fecha de completado
        let completedAtStr = '';
        if (task.completed && task.completedAt) {
          if (task.completedAt.toDate) {
            completedAtStr = task.completedAt.toDate().toLocaleString('es-ES');
          } else if (task.completedAt.seconds) {
            completedAtStr = new Date(task.completedAt.seconds * 1000).toLocaleString('es-ES');
          } else if (typeof task.completedAt === 'string') {
            completedAtStr = task.completedAt;
          }
        }
        
        left.innerHTML = `
          <div class="task-description">${task.description}</div>
          <div class="meta">
            <i class="fas fa-calendar-plus"></i>
            Inscrita: ${createdAtStr}
          </div>
          ${task.completed && completedAtStr ? `
            <div class="meta">
              <i class="fas fa-calendar-check"></i>
              Completada: ${completedAtStr}
            </div>
          ` : ''}
          ${task.materials ? `
            <div class="meta">
              <i class="fas fa-tools"></i>
              Materiales: ${task.materials}
            </div>
          ` : ''}
        `;
        
        const actions = document.createElement('div');
        actions.className = 'task-actions';
        
        if (!task.completed) {
          const completeBtn = document.createElement('button');
          completeBtn.className = 'complete-btn';
          completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Completar';
          completeBtn.addEventListener('click', () => showCompleteModal(task));
          actions.appendChild(completeBtn);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
        actions.appendChild(deleteBtn);
        
        el.appendChild(left);
        el.appendChild(actions);
        
        return el;
      }

      // --- Toggle between pending and completed tasks ---
      function toggleTaskView() {
        showCompleted = !showCompleted;
        toggleCompletedBtn.innerHTML = showCompleted ? 
          '<i class="fas fa-clock"></i> Ver Pendientes' : 
          '<i class="fas fa-check-circle"></i> Ver Completadas';
        renderTasks();
      }

      // --- Modal functions ---
      function showCompleteModal(task) {
        if (task.completed) return;
        
        currentTaskToComplete = task;
        modalTaskDesc.textContent = task.description;
        materialsInput.value = '';
        completeModal.style.display = 'block';
        materialsInput.focus();
      }

      function hideCompleteModal() {
        completeModal.style.display = 'none';
        currentTaskToComplete = null;
      }

      function showReportModal() {
        reportModal.style.display = 'block';
      }

      function hideReportModal() {
        reportModal.style.display = 'none';
      }

      // CRUD tasks
      async function addTask(description, sede) {
        const newTask = {
          description,
          sede,
          completed: false,
          completedAt: null,
          materials: null
        };
        
        const success = await addTaskToFirestore(user.uid, newTask);
        if (success) {
          await loadTasks();
        } else {
          alert('Error al añadir la tarea');
        }
      }

      async function completeTask(taskId, materials) {
        const updates = {
          completed: true,
          materials: materials.trim()
        };
        
        const success = await updateTaskInFirestore(user.uid, taskId, updates);
        if (success) {
          await loadTasks();
          hideCompleteModal();
          
          if (!showCompleted) {
            alert('¡Tarea completada! Puedes verla en la sección de tareas completadas.');
          }
        } else {
          alert('Error al marcar la tarea como completada');
        }
      }

      async function deleteTask(taskId) {
        if (!confirm('¿Eliminar esta tarea de mantenimiento?')) return;
        
        const success = await deleteTaskFromFirestore(user.uid, taskId);
        if (success) {
          await loadTasks();
        } else {
          alert('Error al eliminar la tarea');
        }
      }

      // --- Generar reporte ---
      async function generateReport(sede, month) {
        const [year, monthNum] = month.split('-').map(Number);
        
        console.log('Generando reporte:');
        console.log('Sede:', sede);
        console.log('Mes seleccionado:', month);
        console.log('Año:', year);
        console.log('Mes número:', monthNum);
        
        try {
          const reportTasks = await getTasksBySedeAndMonth(user.uid, sede, year, monthNum);
          generatePDF(reportTasks, sede, monthNum, year);
          hideReportModal();
        } catch (error) {
          console.error('Error generando reporte:', error);
          alert('Error al generar el reporte. Intenta de nuevo.');
        }
      }

      // --- Events ---
      logoutBtn.addEventListener('click', async () => {
        if (!confirm('¿Cerrar sesión?')) return;
        
        try {
          await auth.signOut();
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
        if (!desc) return alert('Ingrese descripción de la tarea');
        if (!sede) return alert('Seleccione una sede');
        await addTask(desc, sede);
        taskInput.value = '';
        sedeSelect.value = '';
      });

      reportBtn.addEventListener('click', showReportModal);
      toggleCompletedBtn.addEventListener('click', toggleTaskView);

      // Complete modal events
      completeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const materials = materialsInput.value.trim();
        if (!materials) return alert('Ingrese los materiales utilizados');
        if (!currentTaskToComplete) return;
        
        const submitBtn = completeForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completando...';
        
        await completeTask(currentTaskToComplete.id, materials);
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Completar Tarea';
      });

      document.getElementById('cancelComplete').addEventListener('click', hideCompleteModal);

      // Report modal events
      reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sede = reportSedeSelect.value;
        const month = reportMonth.value;
        
        if (!sede) return alert('Seleccione una sede');
        if (!month) return alert('Seleccione un mes');
        
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        
        await generateReport(sede, month);
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-download"></i> Descargar Reporte PDF';
      });

      document.getElementById('cancelReport').addEventListener('click', hideReportModal);

      // Close modals when clicking outside
      window.addEventListener('click', (e) => {
        if (e.target === completeModal) {
          hideCompleteModal();
        }
        if (e.target === reportModal) {
          hideReportModal();
        }
      });

      // Close modals with X button
      document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
          const modal = e.target.closest('.modal');
          if (modal) {
            modal.style.display = 'none';
          }
        });
      });

      // Close modals with Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (completeModal.style.display === 'block') {
            hideCompleteModal();
          }
          if (reportModal.style.display === 'block') {
            hideReportModal();
          }
        }
      });

      // Desuscribirse del listener cuando ya no sea necesario
      unsubscribe();
    });
  }
});