-- Esquema de base de datos para VitoBadi (MySQL 8)
-- Ejecutar con un usuario con permisos de creación sobre la BD seleccionada.

CREATE DATABASE IF NOT EXISTS vitobadi06
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE vitobadi06;

-- =========================
-- TABLA USUARIO
-- =========================
CREATE TABLE usuario (
  email VARCHAR(255) NOT NULL,
  contrasena VARCHAR(255) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  imagenUsuario VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (email)
) ENGINE=InnoDB;

-- =========================
-- TABLA HABITACION
-- =========================
CREATE TABLE habitacion (
  codHabi INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ciudad VARCHAR(120) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  emailPropietario VARCHAR(255) NOT NULL,
  imagenHabitacion VARCHAR(255) DEFAULT NULL,
  latitudH DECIMAL(9,4) NOT NULL,
  longitudH DECIMAL(9,4) NOT NULL,
  precioMes INT UNSIGNED NOT NULL,
  PRIMARY KEY (codHabi),
  KEY idx_habitacion_ciudad (ciudad),
  KEY fk_habitacion_propietario (emailPropietario),
  CONSTRAINT fk_habitacion_propietario
    FOREIGN KEY (emailPropietario)
    REFERENCES usuario(email)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_precio_habitacion
    CHECK (precioMes > 0)
) ENGINE=InnoDB;

-- =========================
-- TABLA SOLICITUD
-- =========================
CREATE TABLE solicitud (
  codHabi INT UNSIGNED NOT NULL,
  emailInquilino VARCHAR(255) NOT NULL,
  estado VARCHAR(10) NOT NULL,
  fechaInicioPosibleAlquiler DATE DEFAULT NULL,
  fechaFinPosibleAlquiler DATE DEFAULT NULL,
  PRIMARY KEY (codHabi, emailInquilino),
  KEY idx_solicitud_estado (estado),
  KEY fk_solicitud_inquilino (emailInquilino),
  CONSTRAINT fk_solicitud_habitacion
    FOREIGN KEY (codHabi)
    REFERENCES habitacion(codHabi)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_solicitud_inquilino
    FOREIGN KEY (emailInquilino)
    REFERENCES usuario(email)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_estado_solicitud
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  CONSTRAINT chk_rango_posible
    CHECK (
      (fechaInicioPosibleAlquiler IS NULL AND fechaFinPosibleAlquiler IS NULL)
      OR
      (fechaInicioPosibleAlquiler IS NOT NULL
       AND fechaFinPosibleAlquiler IS NOT NULL
       AND fechaFinPosibleAlquiler >= fechaInicioPosibleAlquiler)
    )
) ENGINE=InnoDB;

-- =========================
-- TABLA ALQUILER
-- =========================
CREATE TABLE alquiler (
  idAlquiler INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codHabi INT UNSIGNED NOT NULL,
  emailInquilino VARCHAR(255) NOT NULL,
  fechaInicioAlqui DATE NOT NULL,
  fechaFinAlqui DATE NOT NULL,
  PRIMARY KEY (idAlquiler),
  KEY idx_alquiler_habitacion_fecha (codHabi, fechaInicioAlqui, fechaFinAlqui),
  KEY fk_alquiler_inquilino (emailInquilino),
  CONSTRAINT fk_alquiler_habitacion
    FOREIGN KEY (codHabi)
    REFERENCES habitacion(codHabi)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_alquiler_inquilino
    FOREIGN KEY (emailInquilino)
    REFERENCES usuario(email)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_rango_alquiler
    CHECK (fechaFinAlqui > fechaInicioAlqui)
) ENGINE=InnoDB;

-- =========================
-- TABLA PUNTUACION
-- =========================
CREATE TABLE puntuacion (
  codHabi INT UNSIGNED NOT NULL,
  emailInquilino VARCHAR(255) NOT NULL,
  puntos INT NOT NULL,
  PRIMARY KEY (codHabi, emailInquilino),
  KEY fk_puntuacion_inquilino (emailInquilino),
  CONSTRAINT fk_puntuacion_habitacion
    FOREIGN KEY (codHabi)
    REFERENCES habitacion(codHabi)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_puntuacion_inquilino
    FOREIGN KEY (emailInquilino)
    REFERENCES usuario(email)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_puntuacion_rango
    CHECK (puntos BETWEEN 0 AND 5)
) ENGINE=InnoDB;

-- =========================
-- VISTA MEDIA DE PUNTUACION
-- =========================
CREATE VIEW vw_media_puntuacion AS
SELECT
  h.codHabi,
  AVG(p.puntos) AS mediaPuntuacion,
  COUNT(p.puntos) AS totalPuntuaciones
FROM habitacion h
LEFT JOIN puntuacion p
  ON p.codHabi = h.codHabi
GROUP BY h.codHabi;
