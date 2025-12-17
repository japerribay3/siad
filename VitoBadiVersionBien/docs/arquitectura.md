# Arquitectura propuesta para VitoBadi (Java 24, Tomcat 11, MySQL)

Esta guía describe cómo implementar la aplicación VitoBadi con MVC (Servlets + JSP), patrón Singleton para el acceso a datos y MySQL en local. El objetivo es cubrir los requisitos funcionales del buscador de habitaciones, gestión de solicitudes/alquileres y puntuaciones.

## Pila tecnológica
- **Java 24**, **Tomcat 11**, **MySQL 8**.
- Servlets Jakarta EE 10 (`jakarta.servlet-api:6.x`), JSP + JSTL.
- Cliente JS mínimo: solo fetch y el script de Google Maps (API key propia en `/public_html/js/maps.js`).
- Compilación como WAR estándar; compatible con NetBeans 26.

## Estructura de proyecto (sugerida)
```
/nbproject               # Proyecto NetBeans (ya existente)
/src/main/java
  /com/vitobadi/controller   # Servlets (controladores)
  /com/vitobadi/model        # POJOs de dominio (Usuario, Habitacion, Solicitud, Alquiler, Puntuacion)
  /com/vitobadi/dao          # DAO por entidad
  /com/vitobadi/service      # Lógica de negocio y reglas (validaciones, filtros de fechas, puntuaciones)
  /com/vitobadi/utils        # Singleton ConnectionManager, utilidades de fechas/geo
/src/main/webapp
  /WEB-INF/web.xml           # Descriptor con mapeo parcial de servlets
  /WEB-INF/jsp               # Vistas JSP (solo JSTL y HTML; sin JS extra)
  /css, /js, /img            # Estáticos (Google Maps en /js)
```

## Acceso a datos (Singleton obligatorio)
- Clase `ConnectionManager` en `com.vitobadi.utils` con `private static ConnectionManager instance` y `public static ConnectionManager getInstance()`; gestiona `DataSource` (pool) y entrega conexiones (`getConnection()`), lectura de credenciales desde `context.xml` (JNDI `jdbc/vitobadi`).
- Todos los DAO reciben `Connection` del singleton o reciben el `DataSource` en constructor desde el singleton.
- Cada DAO implementa CRUD mínimo y métodos de consulta específicos (búsqueda por ciudad/fechas, radio, media de puntuaciones, etc.).

## Controladores (Servlets)
Rutas sugeridas (prefijo `/app/*`):
- **AuthServlet** (`/login`, `/logout`): login por email+password, set de sesión con `UsuarioDTO`; logout invalida sesión y redirige a `index.jsp`.
- **SearchServlet** (`/search/city`, `/search/geo`):
  - Búsqueda por ciudad + fechas -> JSON (para fetch). Excluye habitaciones alquiladas en el rango y habitaciones del propietario logueado.
  - Búsqueda por radio -> JSON con habitaciones + fechas disponibles calculadas (máxima `fechaFinAlqui` + 1 día o hoy si libre); se devuelven coordenadas para markers.
- **RoomServlet** (`/rooms/new`, `/rooms/mine`): alta de habitación (valida campos, precio > 0, coords obligatorias); listado de mis habitaciones con media de puntuación.
- **SolicitudServlet** (`/requests/my`, `/requests/create`, `/requests/by-room`): crea solicitudes arrastrando fechas desde la búsqueda; muestra solicitudes del inquilino; lista solicitudes por habitación del propietario.
- **AlquilerServlet** (`/rentals/my`, `/rentals/by-room`, `/rentals/accept`): alquila tras comprobar solapes; ordena por código + fecha inicio; al aceptar, rechaza automáticamente el resto de solicitudes de la habitación.
- **PuntuacionServlet** (`/ratings/create`, `/ratings/avg`): controla que el inquilino no haya puntuado la habitación antes; guarda puntos 0-5; devuelve medias.

Los servlets devuelven JSON para las peticiones asincrónicas (`application/json`) y delegan a JSP para vistas servidor (por ejemplo `/rooms/mine` puede forwards a `mis-habitaciones.jsp`).

## Vistas JSP
Ubicar en `/WEB-INF/jsp` para evitar acceso directo. Ejemplos:
- `index.jsp`: búsqueda ciudad/fechas para anónimo y logueado (controla mínimos de fecha con `min=today`).
- `login.jsp`: formulario login; valida email con patrón y campos obligatorios.
- `mis-habitaciones.jsp`: tabla con todas las habitaciones del propietario (incluye imagen y media de puntuación). Orden por `codHabi`.
- `solicitudes-mias.jsp`: solicitudes del inquilino con estado.
- `alquileres-mios.jsp`: alquileres del inquilino (histórico completo).
- `prop-solicitudes.jsp`: solicitudes agrupadas por habitación (botones Aceptar/Rechazar). Si se usa la “Forma 2”, un modal con fechas de alquiler al aceptar.
- `prop-alquileres.jsp`: alquileres por mis habitaciones.

## Validaciones clave
- Fechas de búsqueda: `inicio >= hoy` y `fin > inicio`.
- Alta de habitación: campos obligatorios; `precioMes > 0`; lat/long obligatorias (obtenidas del mapa o manuales).
- Solicitudes: no permitir crear si la habitación es del mismo usuario; arrastrar fechas desde la búsqueda (Forma 1) o pedirlas al propietario en la aceptación (Forma 2).
- Alquileres: comprobar solapamiento en DB (`EXISTS` contra `Alquiler` por `codHabi` con rangos solapados) antes de insertar.
- Puntuación: una por (habitacion, inquilino); solo disponible cuando el alquiler ha terminado.

## Integración con Google Maps
- Script `js/maps.js` inicializa mapa, marcador azul para la dirección buscada y círculo de radio `x` km.
- Endpoint `/search/geo` devuelve JSON con: `latitudH`, `longitudH`, `direccion`, `precioMes`, `disponibleDesde`, `codHabi`.
- JS crea markers y ventanas con dirección, precio, fecha disponible y botón “Solicitar”.

## Seguridad y sesiones
- Filtro `AuthFilter` protege rutas `/app/*` excepto `/login` y `/search/*` anónimas.
- Cabecera en layout JSP muestra saludo con nombre + imagen y botón Logout cuando hay sesión.
- Sanitizar entradas y usar `PreparedStatement` en DAO para prevenir inyección SQL.

## Despliegue y configuración
- `context.xml` en `META-INF` con el recurso JNDI `jdbc/vitobadi` (host `localhost`, user/pass de MySQL local, `useSSL=false`, `serverTimezone=UTC`).
- `web.xml` mapea los servlets principales y define bienvenidas (`index.jsp`).
- Para desarrollo, mantener los HTML actuales en `/public_html` como mockups; las JSP reutilizarán el CSS y assets.

## Flujo de alto nivel
1. Anónimo busca por ciudad/fechas → ve habitaciones libres sin email/imagen/puntuación; al intentar “ver más” se redirige a login.
2. Logueado busca por ciudad/fechas → ve detalles completos + botón Solicitar (excluyendo sus propias habitaciones).
3. Logueado busca por radio → mapa con markers y botón Solicitar.
4. Propietario da de alta habitación → aparece en “Mis habitaciones”.
5. Inquilino revisa “Mis solicitudes” y “Mis alquileres”.
6. Propietario gestiona solicitudes y crea alquileres; al aceptar una solicitud se rechazan las demás.
7. Inquilino puntúa al terminar el alquiler; se muestra media de la habitación (o “--” si no hay puntuaciones).
