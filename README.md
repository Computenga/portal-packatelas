# Portal Packatelas

App web instalable (PWA) para empleados y patrón: asistencia del checador, recibos virtuales de nómina con firma, aviso automático del depósito de Fondeadora, solicitudes, adeudos, documentos y avisos por notificación push.

**Vista previa con datos de ejemplo:** `https://computenga.github.io/portal-packatelas/?demo`
(patrón: RFC `GUPC900101AB1` · empleado: `LOAS950505H12` · PIN `482915`).

## Cómo encaja con lo demás

| Pieza | Dónde vive |
|---|---|
| App | GitHub Pages: `https://computenga.github.io/portal-packatelas/` |
| API | Apps Script (Web App) "Portal Packatelas API", código en `apps-script/` |
| **Base maestra** | La hoja **"checador packatelas"**. El checador sigue escribiendo en *Empleados*, *Checadas* y *Justificadas*; el portal agrega *Personal, Recibos, Pagos, Adeudos, Abonos, Solicitudes, Bandeja, Dispositivos, Bitacora, ConfigPortal* |
| Flotilla | Sigue en su hoja; el portal lee de ahí los cargos al empleado (Reparaciones con `monto_empleado`) |
| Recibos PDF, evidencias, expedientes | Drive, carpeta "Portal Packatelas" (se crea sola) |
| Pagos | Correos "Transferencia exitosa" de Fondeadora en Gmail, revisados cada 5 min |
| Push | Firebase, el mismo proyecto `flotilla-packatelas` |

"Personal" es el expediente de RH (RFC, CLABE, salario, PIN cifrado). Está separado de "Empleados" del checador a propósito: si borras a alguien en el kiosco, no se pierde su historial de nómina. Los empleados nuevos del checador se copian solos a Personal cada hora.

## Instalación (una sola vez)

1. Entra a <https://script.google.com> con **cguevara@computenga.com** → *Nuevo proyecto* → nómbralo "Portal Packatelas API".
2. *Configuración del proyecto* → activa **Mostrar el archivo de manifiesto "appsscript.json"**.
3. Copia `apps-script/Code.gs` y `apps-script/appsscript.json` en el editor (reemplaza el contenido).
4. *Configuración del proyecto* → *Proyecto de Google Cloud* → *Cambiar proyecto* → número **361944784904** (el mismo de la flotilla, para poder mandar push).
5. En el editor elige la función **`setup`** → ▶ Ejecutar → autoriza (Hojas, Drive, Gmail, correo). Crea las pestañas, las carpetas, llena *Personal* con los empleados del checador e instala las tareas automáticas.
6. En la hoja, pestaña **Personal**, escribe **tu RFC** en tu renglón (No. 1, ya tiene rol `admin`).
7. *Implementar* → *Nueva implementación* → **Aplicación web** → ejecutar como **Yo**, acceso **Cualquier usuario** → copia la URL `/exec`.
8. Pega esa URL en `js/config.js` (`API_URL`) en el repo.
9. Abre el portal, entra con tu RFC + número de empleado 1 y crea tu PIN. Ya en modo patrón, en **Personal** completa RFC, CLABE, salario diario e ID de flotilla de cada quien.
10. Opcional: ejecuta **`importarPagosHistoricos`** para traer los depósitos de los últimos 60 días sin mandar notificaciones.

Cada vez que cambie `Code.gs`: *Implementar* → *Administrar implementaciones* → editar → **Nueva versión** (la URL no cambia).

## Acceso de los empleados

- Primera vez: RFC + número de empleado (el del checador) → crean un PIN de 6 dígitos.
- Después: RFC + PIN. A los 5 intentos fallidos se bloquea; el patrón lo reinicia en Personal → *Reset PIN*.
- El PIN se guarda cifrado; nadie lo puede ver. Firmar un recibo pide el PIN otra vez.
- Cada empleado solo recibe sus propios datos: el filtro se hace en Apps Script, no en el teléfono.

## Bienvenida, apps y accesos

- **Bienvenida:** pasos: crear acceso, subir documentos, instalar apps (solo repartidores), registrar celular en el checador y activar notificaciones. Todo se marca solo; los documentos cuentan cuando están todos subidos (o si tú marcas "Recibí sus documentos" en el expediente).
- **Altas sin Google Form:** quien aún no está dado de alta toca "Soy nuevo" en el login, pone nombre, RFC, celular y puesto, y sube cada documento con la cámara (pestaña *Altas*, archivos en Drive → Portal Packatelas/Altas). Tú lo revisas en Personal → Altas: apruebas o rechazas cada documento y le asignas su número de empleado; sus archivos pasan a su expediente y en su celular ve su número y el botón "Crear mi acceso".
- **Documentos:** la lista sale de la pestaña *DocsTipos* (nombre, para qué puestos, requerido). Los archivos quedan en *DocsEmpleado* con estado subido / aprobado / rechazado. Si rechazas uno, al empleado le llega una notificación con el motivo.
- **Una sola app para todos:** a quien no es repartidor no le salen apps, accesos directos, cargos de flotilla ni licencia.
- Repartidor = puesto que dice "repartidor" o que tiene ID de flotilla. Si el puesto está vacío, el empleado lo elige.
- **Apps:** pestaña *Apps* de la hoja (o Más → Apps y accesos en modo patrón): nombre, ícono, tipo (playstore / apk / web), link para instalar, paquete Android para abrirla, para qué puestos, si es requerida y si sale en Accesos directos.
- **APK interno:** `apps/packatelas.apk` (paquete `app.packatelas.mx`). Para actualizarlo, reemplaza ese archivo en el repo; el link no cambia.
- **Accesos directos:** en Android abren la app instalada (o su instalación si no está). En iPhone abren el link web o la tienda.

## Reglas

- **Asistencia:** las mismas del dashboard del checador. Tolerancia 0; minutos de entrada tarde + minutos de comida por encima de lo permitido = retraso; día laboral sin entrada = falta de 8 h; lo que esté en *Justificadas* no cuenta. Se cuenta desde `ASISTENCIA_DESDE` (ConfigPortal) o la fecha de ingreso.
- **Prenómina:** salario diario × 15 − faltas × salario diario − horas de retraso × (salario diario / 8) − cargos de flotilla no cobrados − cuota de adeudos. Todo es editable antes de emitir.
- **Pagos:** si la CLABE destino del correo de Fondeadora es de un empleado, se registra el depósito y se le avisa por push. Si el monto coincide (±$1) con un recibo pendiente, el recibo queda *Pagado*. Si el concepto dice "nómina" y no coincide, te llega una alerta por push y correo. Las transferencias a terceros se ignoran.
- **Solicitudes:** al aprobar un justificante, permiso o vacaciones se escribe en *Justificadas* del checador. Al aprobar un anticipo se crea un adeudo.
- **Vacaciones:** según la LFT (12 días el primer año, +2 por año hasta 20, luego +2 cada 5 años).
- El recibo es un comprobante interno; no sustituye al CFDI de nómina timbrado.

## Tareas automáticas

| Tarea | Cuándo | Qué hace |
|---|---|---|
| `tareaFondeadora` | Cada 5 min | Lee depósitos de Fondeadora, liga con recibos y avisa |
| `sincronizarPersonal` | Cada hora | Copia a Personal los empleados nuevos del checador |

## Pruebas

```
node test/backend.test.js     # backend con hojas simuladas (17 escenarios)
node test/ui.test.js carpeta  # recorre la app en modo demo y toma capturas
```
