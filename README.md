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

## Rutas (ruteador, Mi ruta y reporte Shipday)

- **Ruteador:** `https://computenga.github.io/portal-packatelas/ruteador.html` (o Portal → Más → Rutas y reporte → Ruteador). Usa la sesión del portal: hay que entrar antes como patrón.
- **Claves:** las keys de TomTom (Routing API) y Shipday se guardan desde el ruteador → *Claves del servidor*. Se prueban y quedan en las *propiedades del script* de Apps Script; nunca llegan al navegador. TomTom se consulta a través del portal (acción `tomtomRutas`).
- **Publicar:** en el ruteador eliges el repartidor de cada ruta y tocas *Publicar en la super app*. Se guarda en la pestaña *Rutas* (una fila por ruta, con paradas y la línea del recorrido en `datos_json`) y al repartidor le llega una notificación. Volver a publicar el mismo día reemplaza lo anterior.
- **Mi ruta (repartidor):** tarjeta en Inicio y en Más → Mi ruta: mapa con círculos numerados y la línea del recorrido, y la lista de paradas con botones para navegar con Google Maps o Waze.
- **Reporte Shipday:** busca cada envío como `ML-<shipment>` (prefijo en *ConfigPortal → SHIPDAY_PREFIJO*) y compara el orden y la hora de entrega contra lo planeado. Se genera solo después de `RUTA_REPORTE_HORA` (23 h, después del límite de entrega) y llega por correo y push a los admins; también se puede generar en Más → Rutas y reporte. Se guarda en *ReporteRutas*. Tolerancia: `RUTA_TOLERANCIA_MIN`. Si las horas de Shipday salen corridas 6 h, cambia `SHIPDAY_HORA_UTC`.
- Calificación: **Bien** = ≥85 % en orden, ≤10 % tarde y todo entregado; **Regular** = ≥65 % en orden, ≤30 % tarde y casi todo entregado; si no, **Mal**.

## Roles

- **Patrón (super admin)** — rol `patron`: todo el modo patrón (nómina, pagos, personal, avisos…), las claves del servidor y Rutas y reporte. Solo un patrón puede dar el rol de patrón y nadie puede quitárselo a sí mismo.
- **Admin** — rol `admin`: su portal de empleado más **Rutas y reporte** y el ruteador (publicar rutas, ver y generar el reporte). No ve nómina ni expedientes.
- **Empleado** — rol `empleado`.
- Instalaciones anteriores: si nadie tiene `patron`, el No. 1 pasa a patrón automáticamente.

## Seguimiento en vivo

- Cada 10 min (de `SEGUIMIENTO_DESDE` a `SEGUIMIENTO_HASTA`) se consultan en Shipday solo los envíos aún pendientes de las rutas activas del día.
- Cuando uno cambia a entregado o fallido, a patrón y admins les llega **un push por ruta** con el resumen y cuántos quedan.
- Recálculo: desde la última parada visitada y la hora actual, TomTom (tráfico real) hasta las paradas que faltan + espera de cada una → fin estimado contra el límite de la ruta (el del ruteador, o `RUTA_LIMITE`). Si deja de alcanzar llega una alerta ⚠️ (y otra si vuelve a ir a tiempo).
- Panel: Más → Rutas y reporte → *En vivo* (se actualiza solo; botón *Revisar ahora*). Toca una ruta para ver cada parada y envío.
