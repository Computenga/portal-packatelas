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
| Flotilla | Sigue en su hoja. Cada empleado es `U-[número]` en la flotilla: el portal lee sus cargos (Reparaciones con `monto_empleado`) sin llenar `flotilla_id`, muestra "Mi moto hoy" en Inicio y abre la flotilla dentro del portal (Más → Flotilla) con la misma sesión |
| Recibos PDF, evidencias, expedientes | Drive, carpeta "Portal Packatelas" (se crea sola) |
| Pagos | Correos "Transferencia exitosa" de Fondeadora en Gmail, revisados cada 5 min |
| Push | Firebase, el mismo proyecto `flotilla-packatelas` |

**Base única de empleados:** todo se captura en el expediente del portal (pestaña *Personal*): datos, nómina, horario, días, minutos de comida y checadas. La pestaña *Empleados* del checador se llena sola: al guardar en el portal se copia al momento. Las checadas llegan del **checador de huella ZKTeco** (ADMS → Cloudflare Worker → Apps Script del checador → pestaña *Checadas*): en el ZKTeco solo se registra la huella con el **mismo número de empleado** que en Personal. El paso "Registra tu huella" de la bienvenida se marca solo con su primera checada del ZKTeco. (El kiosco web con QR se dio de baja en octubre de 2026.)

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

## Recolecciones automáticas (modo aprobación)

- Cada 5 min, de `RECOLECCION_DESDE` a `RECOLECCION_HASTA` (12:00), se leen las órdenes activas de Shipday creadas hoy, sin repartidor, que digan `RECOLECCION_TEXTO` en el número o en el nombre de origen.
- Disponibles = repartidores con entrada en el checador, sin salida, y con cuenta de Shipday vinculada.
- Volumen por cliente en la pestaña *ClientesRecoleccion* (bajo 1 · medio 2 · alto 3 puntos; sin clasificar cuenta como medio). Tope por repartidor: `RECOLECCION_CAPACIDAD`.
- Cada recolección va al repartidor con menor desvío (recorrido abierto desde Lassaga) que aún tenga capacidad. Lo ya asignado no se mueve.
- `RECOLECCION_MODO`: `aprobacion` (se proponen y se aprueban en Más → Recolecciones; al aprobar se asigna en Shipday) · `automatico` · `apagado`.
- Si Shipday no trae coordenadas del origen se geocodifica la dirección (Google Maps de Apps Script) y se guarda por cliente.

## GPS y alertas (producción)

- `GPS_MODO = produccion` (por defecto): cada 5 min se guarda en *GpsLog* la ubicación de Shipday (`/carriers`) y se compara con la ruta activa de cada repartidor. Si queda `GPS_DESVIO_MUESTRAS` (2) muestras seguidas a más de `GPS_DESVIO_M` (800 m) del recorrido planeado (y lejos de sus paradas pendientes), push a admins y patrón con la liga al mapa. Un aviso por salida; se rearma al volver a la ruta. No cuenta si está en la base o si su última checada es *salir a comer*.
- **Sin entregar:** en el seguimiento de cada 10 min, si pasan `RUTA_INACTIVIDAD_MIN` (60) sin entregar ni marcar fallido (desde la última entrega, o desde la hora estimada de su 1ª parada), push con lo que dice el GPS (detenido / en movimiento). Se repite cada hora y se reinicia con cada entrega.
- `prueba` = solo guarda ubicaciones · `apagado` = nada. Más → GPS y alertas muestra el estado de cada ruta del día.

## Domicilio y contactos de emergencia

- Mis datos → Domicilio: calle, colonia, CP, alcaldía/municipio y estado; se busca en el mapa (OpenStreetMap/Nominatim) o con “Estoy en mi casa” y el empleado arrastra el pin a su puerta. Se valida número exterior, CP de 5 dígitos que corresponda al estado (CDMX 01000–16999, Edo. Méx. 50000–57999), pin dentro de la zona y se avisa si el pin queda a más de 1.5 km de la dirección escrita o en otro CP.
- 2 contactos de emergencia (nombre y apellido, teléfono de 10 dígitos distinto al suyo y entre ellos, parentesco). Se guardan en *Personal* (`domicilio`, `dom_lat`, `dom_lng`, `emer1_*`, `emer2_*`). Paso nuevo en la bienvenida y aviso en Inicio mientras falten. Admins y patrón: Más → Emergencias (llamar / WhatsApp) y el expediente.

## Historial de entregas y jerarquía

- *HistorialEntregas*: por repartidor y día, entregados / fallidos / incompletos según Shipday (`POST /orders/query`, sin recolecciones; se cuenta el día en que se entregó o falló). Se guarda solo a las 23:00 y se vuelve a cerrar el día anterior en la mañana. Para llenar los últimos 30 días: ejecutar `historialInicial` en el editor.
- Jerarquía (últimos `JERARQUIA_DIAS`=30 días): puntos = `JERARQUIA_PESO_EXITO` (0.6) × % de éxito (suavizado para quien tiene pocos envíos) + 0.4 × volumen relativo al que más entregó.
- El repartidor ve *Mis entregas* (día, semana, mes, su lugar); admins y patrón *Desempeño de repartidores*.

## Asistencia y preasignación en el ruteador

- El ruteador lee del checador quién checó entrada hoy (o quién tiene turno si es otra fecha), el pin de su casa, su tipo de moto (expediente → *Moto que usa*) y su lugar en la jerarquía.
- Si hay más motos cargadas que repartidores con asistencia, pide confirmación antes de generar (Cancelar / Ajustar / Generar igual).
- Al terminar sugiere quién lleva cada ruta: en orden de jerarquía cada repartidor toma la ruta que termina más cerca de su casa; moto chica solo rutas de moto chica. Se puede cambiar y hay que tocar *Aprobar asignación* para publicar (se guarda quién estaba sugerido y quién aprobó).

## Flota y zonas (ruteador)

- *Motos grandes* + *Motos chicas* = repartidores disponibles.
- *Motos chicas pueden ir a*: solo CDMX (las del Edo. Méx. quedan para motos grandes) o CDMX y Edo. Méx. El estado sale de la columna Estado del Excel o, si no viene, del nombre de la alcaldía.
- Opcionales para chicas: evitar cerros y evitar autopistas / carriles centrales (TomTom `avoid=motorways`, guardado 30 días en *AlcanceMoto*).
- **Cerros (automático):** para cada parada se mide la altitud en dos anillos alrededor (~400 m y ~1.2 km, 6 puntos cada uno). Es cerro si la parada queda muy arriba de su entorno (*relieve*), si la pendiente cercana es alta, o si está muy arriba del valle (la base). Sensibilidad alta/media/baja = relieve 45/60/85 m · pendiente 7/9/12 % · valle 130/170/230 m. Altitudes: Open-Meteo desde el navegador (con caché local); si falla, el portal consulta Open-Meteo u OpenTopoData.
- *Agrupar rutas por* estado o alcaldía/municipio: cada cambio de zona dentro de una ruta le cuesta al optimizador los minutos de *fuerza de agrupación* (no se suman al horario real), así salen rutas de pura CDMX, puro Edo. Méx. o por alcaldía.
- Si faltan repartidores, los que se agregan son de moto grande. Tabla, ticket, WhatsApp y Excel muestran moto y zona de cada ruta.
