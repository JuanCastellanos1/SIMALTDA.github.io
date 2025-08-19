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

// === FUNCIONES PARA CLIENTES ===
async function getUserClients(userId) {
  try {
    const clientsRef = db.collection('users').doc(userId).collection('clients');
    const snapshot = await clientsRef.orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    return [];
  }
}

async function addClientToFirestore(userId, clientName) {
  try {
    await db.collection('users').doc(userId).collection('clients').add({
      name: clientName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error añadiendo cliente:', error);
    return false;
  }
}

async function deleteClientFromFirestore(userId, clientId, clientName) {
  try {
    // Eliminar el cliente
    await db.collection('users').doc(userId).collection('clients').doc(clientId).delete();
    
    // Eliminar todas las sedes de este cliente
    const sedesQuery = db.collection('users').doc(userId).collection('sedes').where('client', '==', clientName);
    const sedesSnapshot = await sedesQuery.get();
    
    // Eliminar todas las tareas relacionadas con este cliente
    const tasksQuery = db.collection('users').doc(userId).collection('tasks').where('client', '==', clientName);
    const tasksSnapshot = await tasksQuery.get();
    
    const batch = db.batch();
    sedesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    tasksSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    return true;
  } catch (error) {
    console.error('Error eliminando cliente:', error);
    return false;
  }
}

// === FUNCIONES PARA SEDES ===
async function getUserSedes(userId) {
  try {
    const sedesRef = db.collection('users').doc(userId).collection('sedes');
    const snapshot = await sedesRef.orderBy('client').orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo sedes:', error);
    return [];
  }
}

async function getSedesByClient(userId, clientName) {
  try {
    const sedesRef = db.collection('users').doc(userId).collection('sedes');
    const snapshot = await sedesRef.where('client', '==', clientName).orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo sedes por cliente:', error);
    return [];
  }
}

async function addSedeToFirestore(userId, sedeName, clientName) {
  try {
    console.log('Intentando añadir sede:', sedeName, 'para cliente:', clientName);
    await db.collection('users').doc(userId).collection('sedes').add({
      name: sedeName,
      client: clientName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('Sede añadida exitosamente');
    return true;
  } catch (error) {
    console.error('Error añadiendo sede:', error);
    return false;
  }
}

async function deleteSedeFromFirestore(userId, sedeId, sedeName, clientName) {
  try {
    // Eliminar la sede
    await db.collection('users').doc(userId).collection('sedes').doc(sedeId).delete();
    
    // Eliminar todas las tareas de esa sede y cliente
    const tasksQuery = db.collection('users').doc(userId).collection('tasks')
      .where('sede', '==', sedeName)
      .where('client', '==', clientName);
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

// === FUNCIONES PARA TAREAS ===
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

async function getTasksByClientSedeAndMonth(userId, client, sede, year, month) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    console.log('Filtrando tareas:');
    console.log('Año:', year, 'Mes:', month);
    console.log('Buscando tareas entre:', startDate, 'y', endDate);
    console.log('Cliente:', client, 'Sede:', sede);
    
    let tasksRef = db.collection('users').doc(userId).collection('tasks')
      .where('completed', '==', true)
      .where('client', '==', client);
    
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

// === FUNCIONES PARA MANEJO DE IMÁGENES ===
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calcular nuevas dimensiones manteniendo la proporción
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Dibujar imagen redimensionada
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convertir a base64
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Función para generar reporte Excel
function generateExcelReport(tasks, client, sede, month, year) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const monthIndex = Math.max(0, Math.min(11, month - 1));
  const monthName = monthNames[monthIndex];
  
  // Crear workbook
  const wb = XLSX.utils.book_new();
  
  // Preparar datos
  const excelData = [];
  
  // Encabezados
  excelData.push([
    'SIMA - Servicios Integrales de Mantenimiento'
  ]);
  excelData.push([]);
  excelData.push([
    `Reporte de Mantenimiento - ${monthName} ${year}`
  ]);
  excelData.push([
    `Cliente: ${client}`
  ]);
  excelData.push([
    `Sede: ${sede === 'all' ? 'Todas las sedes' : sede}`
  ]);
  excelData.push([
    `Total de tareas completadas: ${tasks.length}`
  ]);
  excelData.push([]);
  
  // Encabezados de tabla
  excelData.push([
    'Fecha Completada',
    'Cliente', 
    'Sede',
    'Descripción',
    'Materiales',
    'Tiene Foto'
  ]);
  
  // Datos de tareas
  tasks.forEach(task => {
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
    
    excelData.push([
      completedDateFormatted,
      task.client,
      task.sede,
      task.description,
      task.materials || 'No especificado',
      task.photo ? 'Sí' : 'No'
    ]);
  });
  
  excelData.push([]);
  excelData.push([
    `Generado: ${new Date().toLocaleString('es-ES')}`
  ]);
  
  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  
  // Configurar anchos de columna
  ws['!cols'] = [
    { wch: 20 }, // Fecha Completada
    { wch: 25 }, // Cliente
    { wch: 25 }, // Sede
    { wch: 50 }, // Descripción
    { wch: 40 }, // Materiales
    { wch: 12 }  // Tiene Foto
  ];
  
  // Añadir worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, "Reporte Mantenimiento");
  
  // Generar archivo y descargar
  const sedeFileName = sede === 'all' ? 'TodasSedes' : sede.replace(/\s+/g, '_');
  const clientFileName = client.replace(/\s+/g, '_');
  const fileName = `SIMA_Reporte_${clientFileName}_${sedeFileName}_${monthName}_${year}.xlsx`;
  
  XLSX.writeFile(wb, fileName);
}

// Función para generar PDF con jsPDF - VERSIÓN CON CLIENTES Y FOTOS
function generatePDF(tasks, client, sede, month, year) {
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
  const clientText = `Cliente: ${client}`;
  const sedeText = sede === 'all' ? 'Todas las sedes' : `Sede: ${sede}`;
  pdf.text(clientText, 20, 52);
  pdf.text(sedeText, 20, 59);
  
  // Línea separadora
  pdf.setDrawColor(233, 236, 239);
  pdf.line(20, 65, 190, 65);
  
  let y = 77;
  
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
      
      // Calcular altura mínima necesaria (incluyendo espacio para foto)
      const baseHeight = 18;
      const descriptionHeight = Math.max(1, descriptionLines.length) * 3.2;
      const materialsHeight = materialsLines.length > 0 ? (materialsLines.length * 3.2) + 5 : 5;
      const sedeHeight = Math.max(1, sedeLines.length) * 3.2;
      const photoHeight = task.photo ? 45 : 0; // Espacio reservado para foto
      
      const totalHeight = baseHeight + descriptionHeight + materialsHeight + sedeHeight + photoHeight;

      // Verificar si necesitamos una nueva página
      if (y + totalHeight > 270) {
        pdf.addPage();
        y = 20;
      }

      // Rectángulo de fondo alternando colores
      const bgColor = index % 2 === 0 ? [248, 249, 250] : [255, 255, 255];
      pdf.setFillColor(...bgColor);
      pdf.rect(18, y - 2, 174, totalHeight, 'F');

      // Borde izquierdo azul
      pdf.setFillColor(44, 90, 160);
      pdf.rect(18, y - 2, 3, totalHeight, 'F');

      let currentY = y;

      // Fecha de completado
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
      
      pdf.setFontSize(8);
      pdf.setTextColor(108, 117, 125);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Completada: ${completedDateFormatted}`, 190, currentY, { align: 'right' });

      currentY += 5.5;

      // Cliente
      pdf.setFontSize(8);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CLIENTE:', 25, currentY);

      pdf.setTextColor(44, 62, 80);
      pdf.setFont('helvetica', 'normal');
      pdf.text(task.client, 45, currentY);

      currentY += 4.5;

      // Sede
      pdf.setFontSize(8);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SEDE:', 25, currentY);

      pdf.setTextColor(44, 62, 80);
      pdf.setFont('helvetica', 'normal');
      sedeLines.forEach((line, i) => {
        pdf.text(line, 45, currentY + (i * 3.2));
      });

      currentY += (sedeLines.length * 3.2) + 2.5;

      // Descripción completa
      pdf.setFontSize(8);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DESCRIPCIÓN:', 25, currentY);

      pdf.setTextColor(44, 62, 80);
      pdf.setFont('helvetica', 'normal');
      descriptionLines.forEach((line, i) => {
        pdf.text(line, 25, currentY + 4 + (i * 3.2));
      });

      currentY += 4 + (descriptionLines.length * 3.2) + 2.5;

      // Materiales completos
      pdf.setFontSize(8);
      pdf.setTextColor(44, 90, 160);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MATERIALES:', 25, currentY);

      if (materialsLines.length > 0) {
        pdf.setTextColor(44, 62, 80);
        pdf.setFont('helvetica', 'normal');
        materialsLines.forEach((line, i) => {
          pdf.text(line, 25, currentY + 4 + (i * 3.2));
        });
        currentY += 4 + (materialsLines.length * 3.2) + 2.5;
      } else {
        pdf.setTextColor(108, 117, 125);
        pdf.setFont('helvetica', 'italic');
        pdf.text('No especificado', 25, currentY + 4);
        currentY += 4 + 2.5;
      }

      // Foto (si existe)
      if (task.photo) {
        pdf.setFontSize(8);
        pdf.setTextColor(44, 90, 160);
        pdf.setFont('helvetica', 'bold');
        pdf.text('EVIDENCIA FOTOGRÁFICA:', 25, currentY);
        
        try {
          // Añadir imagen con tamaño limitado
          pdf.addImage(task.photo, 'JPEG', 25, currentY + 3, 40, 30);
          currentY += 35;
        } catch (error) {
          console.error('Error añadiendo imagen al PDF:', error);
          pdf.setTextColor(108, 117, 125);
          pdf.setFont('helvetica', 'italic');
          pdf.text('Error al cargar imagen', 25, currentY + 4);
          currentY += 8;
        }
      }

      y += totalHeight + 4;
      
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
  const sedeFileName = sede === 'all' ? 'TodasSedes' : sede.replace(/\s+/g, '_');
  const clientFileName = client.replace(/\s+/g, '_');
  const fileName = `SIMA_Reporte_${clientFileName}_${sedeFileName}_${monthName}_${year}.pdf`;
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
      
      // Client elements
      const clientForm = document.getElementById('clientForm');
      const clientInput = document.getElementById('clientInput');
      const clientList = document.getElementById('clientList');
      
      // Sede elements
      const sedeForm = document.getElementById('sedeForm');
      const sedeInput = document.getElementById('sedeInput');
      const sedeList = document.getElementById('sedeList');
      const sedeClientSelect = document.getElementById('sedeClientSelect');
      
      // Task elements
      const taskForm = document.getElementById('taskForm');
      const taskInput = document.getElementById('taskInput');
      const taskList = document.getElementById('taskList');
      const taskClientSelect = document.getElementById('taskClientSelect');
      const sedeSelect = document.getElementById('sedeSelect');
      
      const reportBtn = document.getElementById('reportBtn');
      const toggleCompletedBtn = document.getElementById('toggleCompletedBtn');
      
      // Modal elements
      const completeModal = document.getElementById('completeModal');
      const reportModal = document.getElementById('reportModal');
      const completeForm = document.getElementById('completeForm');
      const reportForm = document.getElementById('reportForm');
      const materialsInput = document.getElementById('materialsInput');
      const modalTaskDesc = document.getElementById('modalTaskDesc');
      const reportClientSelect = document.getElementById('reportClientSelect');
      const reportSedeSelect = document.getElementById('reportSedeSelect');
      const reportMonth = document.getElementById('reportMonth');
      
      // Photo elements
      const photoInput = document.getElementById('photoInput');
      const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
      const photoPreview = document.getElementById('photoPreview');
      const removePhotoBtn = document.getElementById('removePhotoBtn');

      let clients = [];
      let sedes = [];
      let tasks = [];
      let currentTaskToComplete = null;
      let showCompleted = false;
      let selectedPhoto = null;

      // Establecer mes actual en el selector de reporte
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      reportMonth.value = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      // Cargar datos iniciales
      await loadAllData();

      // --- Funciones de carga de datos ---
      async function loadAllData() {
        taskList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando tareas...</div>';
        await Promise.all([loadClients(), loadSedes(), loadTasks()]);
      }

      async function loadClients() {
        clients = await getUserClients(user.uid);
        renderClientList();
        updateClientSelects();
      }

      async function loadSedes() {
        sedes = await getUserSedes(user.uid);
        renderSedeList();
        // Actualizar selectores de sede después de cargar sedes
        await updateAllSedeSelectors();
      }

      async function loadTasks() {
        tasks = await getUserTasks(user.uid);
        renderTasks();
      }

      // --- Función para actualizar todos los selectores de sede ---
      async function updateAllSedeSelectors() {
        // Actualizar selector de tareas si hay cliente seleccionado
        const selectedTaskClient = taskClientSelect.value;
        if (selectedTaskClient) {
          await updateSedeSelectsByClient(selectedTaskClient, sedeSelect);
        }
        
        // Actualizar selector de reportes si hay cliente seleccionado
        const selectedReportClient = reportClientSelect.value;
        if (selectedReportClient) {
          await updateReportSedesByClient(selectedReportClient);
        }
      }

      // --- Funciones para manejo de fotos ---
      function handlePhotoUpload() {
        const file = photoInput.files[0];
        if (!file) return;

        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
          alert('Por favor selecciona una imagen válida');
          return;
        }

        // Validar tamaño (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('La imagen es demasiado grande. Máximo 5MB.');
          return;
        }

        // Mostrar preview y procesar imagen
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            // Redimensionar imagen
            const resizedBlob = await resizeImage(file, 800, 600, 0.8);
            const resizedBase64 = await convertFileToBase64(resizedBlob);
            
            selectedPhoto = resizedBase64;
            
            // Mostrar preview
            photoPreview.innerHTML = `<img src="${resizedBase64}" alt="Preview" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">`;
            removePhotoBtn.style.display = 'inline-block';
            
          } catch (error) {
            console.error('Error procesando imagen:', error);
            alert('Error al procesar la imagen');
          }
        };
        
        reader.readAsDataURL(file);
      }

      function removePhoto() {
        selectedPhoto = null;
        photoInput.value = '';
        photoPreview.innerHTML = '';
        removePhotoBtn.style.display = 'none';
      }

      // --- Clientes UI ---
      function renderClientList() {
        clientList.innerHTML = '';
        if (!clients.length) {
          clientList.innerHTML = `<div class="no-tasks">No hay clientes aún. Añade uno arriba.</div>`;
          return;
        }

        clients.forEach((client) => {
          const item = document.createElement('div');
          item.className = 'client-item fade-in';
          item.innerHTML = `
            <div class="client-name">
              <i class="fas fa-user"></i>
              ${client.name}
            </div>
            <div class="client-actions">
              <button class="delete-client-btn" data-client-id="${client.id}" data-client-name="${client.name}">
                <i class="fas fa-trash"></i>
                Eliminar
              </button>
            </div>
          `;
          item.querySelector('.delete-client-btn').addEventListener('click', (e) => {
            const clientId = e.target.closest('button').getAttribute('data-client-id');
            const clientName = e.target.closest('button').getAttribute('data-client-name');
            deleteClient(clientId, clientName);
          });
          clientList.appendChild(item);
        });
      }

      function updateClientSelects() {
        // Actualizar selector de clientes para sedes
        sedeClientSelect.innerHTML = `<option value="">-- Selecciona un cliente --</option>`;
        clients.forEach(client => {
          const opt = document.createElement('option');
          opt.value = client.name;
          opt.textContent = client.name;
          sedeClientSelect.appendChild(opt);
        });

        // Actualizar selector de clientes para tareas
        taskClientSelect.innerHTML = `<option value="">-- Selecciona un cliente --</option>`;
        clients.forEach(client => {
          const opt = document.createElement('option');
          opt.value = client.name;
          opt.textContent = client.name;
          taskClientSelect.appendChild(opt);
        });

        // Actualizar selector de clientes para reportes
        reportClientSelect.innerHTML = `<option value="">-- Selecciona un cliente --</option>`;
        clients.forEach(client => {
          const opt = document.createElement('option');
          opt.value = client.name;
          opt.textContent = client.name;
          reportClientSelect.appendChild(opt);
        });
      }

      async function addClient(name) {
        if (clients.some(c => c.name === name)) {
          alert('El cliente ya existe');
          return;
        }
        
        const success = await addClientToFirestore(user.uid, name);
        if (success) {
          await loadClients();
        } else {
          alert('Error al añadir el cliente');
        }
      }

      async function deleteClient(clientId, clientName) {
        if (!confirm(`Se eliminará el cliente "${clientName}", todas sus sedes y tareas relacionadas. ¿Continuar?`)) return;
        
        const success = await deleteClientFromFirestore(user.uid, clientId, clientName);
        if (success) {
          await loadAllData();
        } else {
          alert('Error al eliminar el cliente');
        }
      }

      // --- Sedes UI ---
      function renderSedeList() {
        sedeList.innerHTML = '';
        if (!sedes.length) {
          sedeList.innerHTML = `<div class="no-tasks">No hay sedes aún. Añade una arriba.</div>`;
          return;
        }

        // Agrupar sedes por cliente
        const sedesByClient = {};
        sedes.forEach(sede => {
          if (!sedesByClient[sede.client]) {
            sedesByClient[sede.client] = [];
          }
          sedesByClient[sede.client].push(sede);
        });

        Object.keys(sedesByClient).forEach(clientName => {
          // Contenedor del cliente (acordeón)
          const clientContainer = document.createElement('div');
          clientContainer.className = 'sede-container';

          // Botón del cliente
          const clientButton = document.createElement('button');
          clientButton.className = 'sede-toggle-btn';
          clientButton.innerHTML = `
            <i class="fas fa-chevron-right sede-arrow"></i>
            <i class="fas fa-user"></i>
            ${clientName}
            <span class="badge-small">${sedesByClient[clientName].length}</span>
          `;

          // Contenido de las sedes (colapsado por defecto)
          const sedeContent = document.createElement('div');
          sedeContent.className = 'sede-content collapsed';

          // Añadir cada sede como fila con botón eliminar
          sedesByClient[clientName].forEach(sede => {
            const sedeRow = document.createElement('div');
            sedeRow.className = 'sede-item';
            sedeRow.style.display = 'flex';
            sedeRow.style.alignItems = 'center';
            sedeRow.style.justifyContent = 'space-between';
            sedeRow.style.padding = '6px 0';
            sedeRow.innerHTML = `
              <span><i class="fas fa-building"></i> ${sede.name}</span>
              <button class="delete-sede-btn" data-sede-id="${sede.id}" data-sede-name="${sede.name}" data-client-name="${sede.client}" style="margin-left:10px;">
                <i class="fas fa-trash"></i>
              </button>
            `;
            sedeRow.querySelector('.delete-sede-btn').addEventListener('click', (e) => {
              const sedeId = e.target.closest('button').getAttribute('data-sede-id');
              const sedeName = e.target.closest('button').getAttribute('data-sede-name');
              const clientName = e.target.closest('button').getAttribute('data-client-name');
              deleteSede(sedeId, sedeName, clientName);
            });
            sedeContent.appendChild(sedeRow);
          });

          // Evento para expandir/colapsar
          clientButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = sedeContent.classList.contains('collapsed');
            const arrow = clientButton.querySelector('.sede-arrow');
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

          clientContainer.appendChild(clientButton);
          clientContainer.appendChild(sedeContent);
          sedeList.appendChild(clientContainer);
        });
      }

      async function updateSedeSelectsByClient(clientName, selectElement) {
        selectElement.innerHTML = `<option value="">-- Selecciona una sede --</option>`;
        selectElement.disabled = false;
        
        const clientSedes = await getSedesByClient(user.uid, clientName);
        clientSedes.forEach(sede => {
          const opt = document.createElement('option');
          opt.value = sede.name;
          opt.textContent = sede.name;
          selectElement.appendChild(opt);
        });
      }

      async function updateReportSedesByClient(clientName) {
        reportSedeSelect.innerHTML = `<option value="">-- Selecciona una sede --</option><option value="all">Todas las sedes</option>`;
        reportSedeSelect.disabled = false;
        
        const clientSedes = await getSedesByClient(user.uid, clientName);
        clientSedes.forEach(sede => {
          const opt = document.createElement('option');
          opt.value = sede.name;
          opt.textContent = sede.name;
          reportSedeSelect.appendChild(opt);
        });
      }

      async function addSede(name, clientName) {
        console.log('addSede llamada con:', name, clientName);
        if (sedes.some(s => s.name === name && s.client === clientName)) {
          alert('La sede ya existe para este cliente');
          return false;
        }
        
        const success = await addSedeToFirestore(user.uid, name, clientName);
        if (success) {
          console.log('Sede añadida, recargando datos...');
          // Recargar sedes y actualizar todos los selectores
          await loadSedes();
          return true;
        } else {
          alert('Error al añadir la sede');
          return false;
        }
      }

      async function deleteSede(sedeId, sedeName, clientName) {
        if (!confirm(`Se eliminará la sede "${sedeName}" del cliente "${clientName}" y todas las tareas relacionadas. ¿Continuar?`)) return;
        
        const success = await deleteSedeFromFirestore(user.uid, sedeId, sedeName, clientName);
        if (success) {
          await loadAllData();
        } else {
          alert('Error al eliminar la sede');
        }
      }

      // --- Tasks UI ---
      function renderTasks() {
        taskList.innerHTML = '';
        if (!clients.length) {
          taskList.innerHTML = `<div class="no-tasks">No hay clientes para agrupar tareas. Añade un cliente primero.</div>`;
          return;
        }

        // Filtrar tareas según el modo de vista
        const filteredTasks = showCompleted ? tasks.filter(t => t.completed) : tasks.filter(t => !t.completed);

        if (showCompleted) {
          // Para tareas completadas, usar estructura jerárquica Mes > Cliente > Sede > Tareas
          renderCompletedTasksHierarchy(filteredTasks);
        } else {
          // Para tareas pendientes, usar estructura Cliente > Sede > Tareas
          renderPendingTasks(filteredTasks);
        }
      }

      function renderPendingTasks(pendingTasks) {
        // Agrupar por cliente y luego por sede
        const tasksByClient = {};
        pendingTasks.forEach(task => {
          if (!tasksByClient[task.client]) {
            tasksByClient[task.client] = {};
          }
          if (!tasksByClient[task.client][task.sede]) {
            tasksByClient[task.client][task.sede] = [];
          }
          tasksByClient[task.client][task.sede].push(task);
        });

        Object.keys(tasksByClient).forEach(clientName => {
          const clientContainer = document.createElement('div');
          clientContainer.className = 'client-container';
          
          // Botón del cliente
          const clientButton = document.createElement('button');
          clientButton.className = 'client-toggle-btn';
          
          // Contar tareas totales del cliente
          const clientTaskCount = Object.values(tasksByClient[clientName]).reduce((total, sedes) => total + sedes.length, 0);
          
          clientButton.innerHTML = `
            <i class="fas fa-chevron-right client-arrow"></i>
            <i class="fas fa-user"></i>
            ${clientName}
            <span class="badge">${clientTaskCount}</span>
          `;
          
          // Contenido del cliente
          const clientContent = document.createElement('div');
          clientContent.className = 'client-content collapsed';
          
          Object.keys(tasksByClient[clientName]).forEach(sedeName => {
            const sedeDiv = document.createElement('div');
            sedeDiv.className = 'sede slide-up';
            sedeDiv.innerHTML = `
              <h3>
                <i class="fas fa-map-marker-alt"></i>
                ${sedeName} (${tasksByClient[clientName][sedeName].length} pendiente${tasksByClient[clientName][sedeName].length !== 1 ? 's' : ''})
              </h3>
            `;

            tasksByClient[clientName][sedeName].forEach(task => sedeDiv.appendChild(createTaskElement(task)));
            clientContent.appendChild(sedeDiv);
          });

          // Event listener para toggle de cliente
          clientButton.addEventListener('click', () => {
            const isCollapsed = clientContent.classList.contains('collapsed');
            const arrow = clientButton.querySelector('.client-arrow');
            
            if (isCollapsed) {
              clientContent.classList.remove('collapsed');
              clientContent.classList.add('expanded');
              arrow.classList.remove('fa-chevron-right');
              arrow.classList.add('fa-chevron-down');
            } else {
              clientContent.classList.remove('expanded');
              clientContent.classList.add('collapsed');
              arrow.classList.remove('fa-chevron-down');
              arrow.classList.add('fa-chevron-right');
            }
          });

          clientContainer.appendChild(clientButton);
          clientContainer.appendChild(clientContent);
          taskList.appendChild(clientContainer);
        });

        if (pendingTasks.length === 0) {
          taskList.innerHTML = `<div class="no-tasks">¡Excelente! No hay tareas pendientes.</div>`;
        }
      }

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
          
          const [year, month] = monthKey.split('-').map(Number);
          const monthDate = new Date(year, month - 1, 1);
          
          const monthName = monthDate.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long' 
          });
          
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
          `;
          
          // Contenido del mes
          const monthContent = document.createElement('div');
          monthContent.className = 'month-content collapsed';
          
          // Agrupar tareas del mes por cliente
          const tasksByClient = {};
          monthTasks.forEach(task => {
            if (!tasksByClient[task.client]) {
              tasksByClient[task.client] = {};
            }
            if (!tasksByClient[task.client][task.sede]) {
              tasksByClient[task.client][task.sede] = [];
            }
            tasksByClient[task.client][task.sede].push(task);
          });
          
          // Crear contenedores para cada cliente dentro del mes
          Object.keys(tasksByClient).forEach(clientName => {
            const clientTasks = Object.values(tasksByClient[clientName]).flat();
            
            // Contenedor del cliente (nivel 2)
            const clientContainer = document.createElement('div');
            clientContainer.className = 'client-container-nested';
            
            // Botón del cliente
            const clientButton = document.createElement('button');
            clientButton.className = 'client-toggle-btn-nested';
            clientButton.innerHTML = `
              <i class="fas fa-chevron-right client-arrow"></i>
              <i class="fas fa-user"></i>
              ${clientName}
              <span class="badge-small">${clientTasks.length}</span>
            `;
            
            // Contenido del cliente
            const clientContent = document.createElement('div');
            clientContent.className = 'client-content-nested collapsed';
            
            // Crear contenedores para cada sede dentro del cliente
            Object.keys(tasksByClient[clientName]).forEach(sedeName => {
              const sedeTasks = tasksByClient[clientName][sedeName];
              
              // Contenedor de la sede (nivel 3)
              const sedeContainer = document.createElement('div');
              sedeContainer.className = 'sede-container-nested';
              
              // Botón de la sede
              const sedeButton = document.createElement('button');
              sedeButton.className = 'sede-toggle-btn-nested';
              sedeButton.innerHTML = `
                <i class="fas fa-chevron-right sede-arrow"></i>
                <i class="fas fa-building"></i>
                ${sedeName}
                <span class="badge-small">${sedeTasks.length}</span>
              `;
              
              // Contenido de la sede
              const sedeContent = document.createElement('div');
              sedeContent.className = 'sede-content-nested collapsed';
              
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
              clientContent.appendChild(sedeContainer);
            });
            
            // Event listener para toggle de cliente
            clientButton.addEventListener('click', (e) => {
              e.stopPropagation();
              const isCollapsed = clientContent.classList.contains('collapsed');
              const arrow = clientButton.querySelector('.client-arrow');
              
              if (isCollapsed) {
                clientContent.classList.remove('collapsed');
                clientContent.classList.add('expanded');
                arrow.classList.remove('fa-chevron-right');
                arrow.classList.add('fa-chevron-down');
              } else {
                clientContent.classList.remove('expanded');
                clientContent.classList.add('collapsed');
                arrow.classList.remove('fa-chevron-down');
                arrow.classList.add('fa-chevron-right');
                
                // Colapsar todas las sedes cuando se colapsa el cliente
                const sedeContents = clientContent.querySelectorAll('.sede-content-nested');
                const sedeArrows = clientContent.querySelectorAll('.sede-arrow');
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
            
            clientContainer.appendChild(clientButton);
            clientContainer.appendChild(clientContent);
            monthContent.appendChild(clientContainer);
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
              
              // Colapsar todos los clientes y sedes cuando se colapsa el mes
              const clientContents = monthContent.querySelectorAll('.client-content-nested');
              const clientArrows = monthContent.querySelectorAll('.client-arrow');
              const sedeContents = monthContent.querySelectorAll('.sede-content-nested');
              const sedeArrows = monthContent.querySelectorAll('.sede-arrow');
              
              clientContents.forEach(content => {
                content.classList.remove('expanded');
                content.classList.add('collapsed');
              });
              clientArrows.forEach(arrow => {
                arrow.classList.remove('fa-chevron-down');
                arrow.classList.add('fa-chevron-right');
              });
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
          
          const year = completedDate.getFullYear();
          const month = completedDate.getMonth() + 1;
          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
          
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
            <i class="fas fa-user"></i>
            Cliente: ${task.client}
          </div>
          <div class="meta">
            <i class="fas fa-building"></i>
            Sede: ${task.sede}
          </div>
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
          ${task.photo ? `
            <div class="meta">
              <i class="fas fa-camera"></i>
              <span class="photo-indicator">Con evidencia fotográfica</span>
            </div>
            <div class="task-photo">
              <img src="${task.photo}" alt="Evidencia fotográfica" onclick="showPhotoModal('${task.photo}')">
            </div>
          ` : ''}
        `;
        
        if (!task.completed) {
          el.appendChild(left);
          // Acciones debajo del contenido, igual que completadas
          const actions = document.createElement('div');
          actions.className = 'task-actions pending-actions';
          const completeBtn = document.createElement('button');
          completeBtn.className = 'complete-btn';
          completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Completar';
          completeBtn.addEventListener('click', () => showCompleteModal(task));
          actions.appendChild(completeBtn);
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-btn';
          deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
          deleteBtn.addEventListener('click', () => deleteTask(task.id));
          actions.appendChild(deleteBtn);
          el.appendChild(actions);
        } else {
          el.appendChild(left);
          // Solo botón eliminar, debajo de la imagen si existe
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-btn completed-delete-btn';
          deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
          deleteBtn.addEventListener('click', () => deleteTask(task.id));
          // Si hay imagen, insertarlo después de la imagen
          const photoDiv = el.querySelector('.task-photo');
          if (photoDiv) {
            photoDiv.insertAdjacentElement('afterend', deleteBtn);
          } else {
            el.appendChild(deleteBtn);
          }
        }
        return el;
      }

      // --- Función para mostrar foto en modal ---
      function showPhotoModal(photoSrc) {
        // Crear modal para mostrar foto grande
        const modal = document.createElement('div');
        modal.className = 'photo-modal';
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = photoSrc;
        img.style.cssText = `
          max-width: 90%;
          max-height: 90%;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        modal.appendChild(img);
        document.body.appendChild(modal);
        
        // Cerrar al hacer clic
        modal.addEventListener('click', () => {
          document.body.removeChild(modal);
        });
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
        selectedPhoto = null;
        photoPreview.innerHTML = '';
        removePhotoBtn.style.display = 'none';
        photoInput.value = '';
        completeModal.style.display = 'block';
        materialsInput.focus();
      }

      function hideCompleteModal() {
        completeModal.style.display = 'none';
        currentTaskToComplete = null;
        selectedPhoto = null;
        photoPreview.innerHTML = '';
        removePhotoBtn.style.display = 'none';
        photoInput.value = '';
      }

      function showReportModal() {
        reportModal.style.display = 'block';
      }

      function hideReportModal() {
        reportModal.style.display = 'none';
      }

      // CRUD tasks
      async function addTask(description, client, sede) {
        const newTask = {
          description,
          client,
          sede,
          completed: false,
          completedAt: null,
          materials: null,
          photo: null
        };
        
        const success = await addTaskToFirestore(user.uid, newTask);
        if (success) {
          await loadTasks();
        } else {
          alert('Error al añadir la tarea');
        }
      }

      async function completeTask(taskId, materials, photo = null) {
        const updates = {
          completed: true,
          materials: materials.trim()
        };

        if (photo) {
          updates.photo = photo;
        }
        
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

      // --- Generar reportes ---
      async function generateReport(client, sede, month, format) {
        const [year, monthNum] = month.split('-').map(Number);
        
        console.log('Generando reporte:');
        console.log('Cliente:', client, 'Sede:', sede);
        console.log('Mes seleccionado:', month);
        console.log('Año:', year, 'Mes número:', monthNum);
        console.log('Formato:', format);
        
        try {
          const reportTasks = await getTasksByClientSedeAndMonth(user.uid, client, sede, year, monthNum);
          
          if (format === 'pdf') {
            generatePDF(reportTasks, client, sede, monthNum, year);
          } else if (format === 'excel') {
            generateExcelReport(reportTasks, client, sede, monthNum, year);
          }
          
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

      // Client form
      clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = clientInput.value.trim();
        if (!name) return;
        
        const submitBtn = clientForm.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Añadiendo...';
          
          await addClient(name);
          clientInput.value = '';
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHTML;
        }
      });

      // Sede form - COMPLETAMENTE CORREGIDO
      sedeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = sedeInput.value.trim();
        const client = sedeClientSelect.value;
        
        console.log('Submit sede form:', {name, client});
        
        if (!name) {
          alert('Ingrese nombre de la sede');
          return;
        }
        if (!client) {
          alert('Seleccione un cliente');
          return;
        }
        
        const submitBtn = sedeForm.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Añadiendo...';
          
          const success = await addSede(name, client);
          if (success) {
            sedeInput.value = '';
            sedeClientSelect.value = '';
            
            // Mostrar mensaje de éxito temporal
            const existingMessage = sedeForm.querySelector('.success-message');
            if (existingMessage) {
              existingMessage.remove();
            }
            
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.style.cssText = 'color: #28a745; font-weight: 500; margin-top: 10px; padding: 10px; background: #d4edda; border-radius: 5px; border: 1px solid #c3e6cb;';
            successMsg.innerHTML = '<i class="fas fa-check-circle"></i> Sede añadida correctamente';
            
            sedeForm.appendChild(successMsg);
            
            // Remover mensaje después de 3 segundos
            setTimeout(() => {
              if (successMsg && successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
              }
            }, 3000);
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHTML;
        }
      });

      // Task form
      taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const desc = taskInput.value.trim();
        const client = taskClientSelect.value;
        const sede = sedeSelect.value;
        
        if (!desc) return alert('Ingrese descripción de la tarea');
        if (!client) return alert('Seleccione un cliente');
        if (!sede) return alert('Seleccione una sede');
        
        const submitBtn = taskForm.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        
        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Añadiendo...';
          
          await addTask(desc, client, sede);
          taskInput.value = '';
          taskClientSelect.value = '';
          sedeSelect.value = '';
          sedeSelect.disabled = true;
          sedeSelect.innerHTML = '<option value="">-- Selecciona primero un cliente --</option>';
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHTML;
        }
      });

      // Client select change for tasks
      taskClientSelect.addEventListener('change', async (e) => {
        const selectedClient = e.target.value;
        if (selectedClient) {
          await updateSedeSelectsByClient(selectedClient, sedeSelect);
        } else {
          sedeSelect.disabled = true;
          sedeSelect.innerHTML = '<option value="">-- Selecciona primero un cliente --</option>';
        }
      });

      // Client select change for reports
      reportClientSelect.addEventListener('change', async (e) => {
        const selectedClient = e.target.value;
        if (selectedClient) {
          await updateReportSedesByClient(selectedClient);
        } else {
          reportSedeSelect.disabled = true;
          reportSedeSelect.innerHTML = '<option value="">-- Selecciona primero un cliente --</option>';
        }
      });

      // Photo upload events
      uploadPhotoBtn.addEventListener('click', () => {
        photoInput.click();
      });

      photoInput.addEventListener('change', handlePhotoUpload);
      removePhotoBtn.addEventListener('click', removePhoto);

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
        
        await completeTask(currentTaskToComplete.id, materials, selectedPhoto);
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Completar Tarea';
      });

      document.getElementById('cancelComplete').addEventListener('click', hideCompleteModal);

      // Report modal events - ACTUALIZADO PARA MÚLTIPLES FORMATOS
      reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = reportClientSelect.value;
        const sede = reportSedeSelect.value;
        const month = reportMonth.value;
        
        if (!client) return alert('Seleccione un cliente');
        if (!sede) return alert('Seleccione una sede');
        if (!month) return alert('Seleccione un mes');
        
        // Determinar qué botón fue presionado
        const clickedButton = e.submitter;
        const format = clickedButton.getAttribute('data-format');
        
        const originalHTML = clickedButton.innerHTML;
        clickedButton.disabled = true;
        clickedButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        
        await generateReport(client, sede, month, format);
        
        clickedButton.disabled = false;
        clickedButton.innerHTML = originalHTML;
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

  // Función global para mostrar fotos (necesaria para el onclick)
  window.showPhotoModal = function(photoSrc) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = photoSrc;
    img.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    modal.appendChild(img);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  };
});