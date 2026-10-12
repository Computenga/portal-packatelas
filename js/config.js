// Configuración pública. Nada aquí es secreto: Apps Script valida la sesión en cada llamada.
export const CONFIG = {
  // URL del Web App del Portal (termina en /exec). Se llena al desplegar apps-script/Code.gs.
  API_URL: 'PENDIENTE',

  // Mismo proyecto de Firebase que la flotilla
  firebase: {
    apiKey: 'AIzaSyAsfJqMplaZtDDEX_rBIwNsU6eTfd2cks4',
    authDomain: 'flotilla-packatelas.firebaseapp.com',
    projectId: 'flotilla-packatelas',
    storageBucket: 'flotilla-packatelas.firebasestorage.app',
    messagingSenderId: '361944784904',
    appId: '1:361944784904:web:f7edcf16bec97f0dd8f1bd',
  },
  vapidKey: 'BPVwlscU-k9y2rQmjnhiu_p1xeGSTHfP5n-C8SREKdjAWvn4tiYMKL5CSx0-dbIlkDMVRDDfoGJxXJxoH8fjZyM',
};
