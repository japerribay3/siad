-- Esquema de base de datos para VitoBadi (MySQL 8)
-- Ejecutar con un usuario con permisos de creación sobre la BD seleccionada.

CREATE TABLE IF NOT EXISTS Usuario (
    email              VARCHAR(255)  NOT NULL,
    contrasena         VARCHAR(255)  NOT NULL,
    nombre             VARCHAR(120)  NOT NULL,
    imagenUsuario      VARCHAR(255)  NULL,
    PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Habitacion (
    codHabi            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ciudad             VARCHAR(120) NOT NULL,
    direccion          VARCHAR(255) NOT NULL,
    emailPropietario   VARCHAR(255) NOT NULL,
    imagenHabitacion   VARCHAR(255) NULL,
    latitudH           DECIMAL(9,4) NOT NULL,
    longitudH          DECIMAL(9,4) NOT NULL,
    precioMes          INT UNSIGNED NOT NULL,
    PRIMARY KEY (codHabi),
    CONSTRAINT fk_habitacion_propietario FOREIGN KEY (emailPropietario) REFERENCES Usuario(email)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_precio_habitacion CHECK (precioMes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Solicitud (
    codHabi                      INT UNSIGNED NOT NULL,
    emailInquilino               VARCHAR(255) NOT NULL,
    estado                       VARCHAR(10) NOT NULL,
    fechaInicioPosibleAlquiler   DATE NULL,
    fechaFinPosibleAlquiler      DATE NULL,
    PRIMARY KEY (codHabi, emailInquilino),
    CONSTRAINT fk_solicitud_habitacion FOREIGN KEY (codHabi) REFERENCES Habitacion(codHabi)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_solicitud_inquilino FOREIGN KEY (emailInquilino) REFERENCES Usuario(email)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_estado_solicitud CHECK (estado IN ('pendiente','aceptada','rechazada')),
    CONSTRAINT chk_rango_posible CHECK (
        (fechaInicioPosibleAlquiler IS NULL AND fechaFinPosibleAlquiler IS NULL)
        OR (fechaInicioPosibleAlquiler IS NOT NULL AND fechaFinPosibleAlquiler IS NOT NULL AND fechaFinPosibleAlquiler >= fechaInicioPosibleAlquiler)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Alquiler (
    idAlquiler        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    codHabi           INT UNSIGNED NOT NULL,
    emailInquilino    VARCHAR(255) NOT NULL,
    fechaInicioAlqui  DATE NOT NULL,
    fechaFinAlqui     DATE NOT NULL,
    PRIMARY KEY (idAlquiler),
    CONSTRAINT fk_alquiler_habitacion FOREIGN KEY (codHabi) REFERENCES Habitacion(codHabi)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alquiler_inquilino FOREIGN KEY (emailInquilino) REFERENCES Usuario(email)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_rango_alquiler CHECK (fechaFinAlqui > fechaInicioAlqui)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Puntuacion (
    codHabi         INT UNSIGNED NOT NULL,
    emailInquilino  VARCHAR(255) NOT NULL,
    puntos          INT NOT NULL,
    PRIMARY KEY (codHabi, emailInquilino),
    CONSTRAINT fk_puntuacion_habitacion FOREIGN KEY (codHabi) REFERENCES Habitacion(codHabi)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_puntuacion_inquilino FOREIGN KEY (emailInquilino) REFERENCES Usuario(email)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_puntuacion_rango CHECK (puntos BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vista para mostrar la media de puntuaciones (o NULL si no hay)
CREATE OR REPLACE VIEW vw_media_puntuacion AS
SELECT h.codHabi,
       AVG(p.puntos) AS mediaPuntuacion,
       COUNT(p.puntos) AS totalPuntuaciones
FROM Habitacion h
LEFT JOIN Puntuacion p ON p.codHabi = h.codHabi
GROUP BY h.codHabi;

-- Índices recomendados para búsquedas por fechas y ciudad
CREATE INDEX idx_habitacion_ciudad ON Habitacion (ciudad);
CREATE INDEX idx_alquiler_habitacion_fecha ON Alquiler (codHabi, fechaInicioAlqui, fechaFinAlqui);
CREATE INDEX idx_solicitud_estado ON Solicitud (estado);
