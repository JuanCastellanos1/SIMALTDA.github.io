// REEMPLAZA ESTA CONFIGURACIÓN CON LA TUYA DE FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyATc_a3fVkNTkcK_Ruog0Ujy3qNGt1B0-s",
  authDomain: "sima-b199c.firebaseapp.com",
  projectId: "sima-b199c",
  storageBucket: "sima-b199c.firebasestorage.app",
  messagingSenderId: "572786868381",
  appId: "1:572786868381:web:17015818c7e7e3e46bd474"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener referencias a los servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar persistencia de autenticación
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log('Firebase inicializado correctamente');