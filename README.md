
# AgenciaViajeHub - Brianessa Travel Hub

Este repositorio contiene el sistema de gestión de operaciones y cotizaciones para **Una agencia de viaje**. El proyecto está dividido en módulos para facilitar la gestión de clientes, viajes y presupuestos.

## Estructura del Proyecto

El proyecto consta de los siguientes componentes principales:

### 1. Operations Hub (`/Hub`)
El núcleo central de operaciones para la agencia.
- **Funcionalidades:**
  - Dashboard general.
  - Gestión de Clientes y Viajes/Grupos.
  - Planes de pago e Itinerarios.
  - Campañas de Email/SMS.
  - Generación de documentos en PDF.
- **Acceso:** Abrir `Hub/index.html` en tu navegador web.

### 2. Módulo de Cotizaciones (`/Cotizaciones`)
Herramienta especializada para generar y administrar cotizaciones de viajes.
- **Mejoras Incluidas:**
  - Cálculo automático de precios por adulto y niño.
  - Generación de Inversión Total y por Persona.
  - Gestión de depósitos (monto fijo o porcentaje).
  - Almacenamiento local de cotizaciones ("Mis Cotizaciones").
  - Exportación a PDF y copia rápida para WhatsApp.
- **Acceso:** Abrir `Cotizaciones/indexc.html` en tu navegador web.

## Tecnologías Utilizadas
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
- **Librerías:**
  - `jspdf` & `html2pdf`: Para la generación de reportes y documentos PDF.
  - `xlsx`: Para manejo de hojas de cálculo.

## Instrucciones de Uso
Este es un proyecto estático que no requiere un servidor backend complejo para funcionar localmente.
1. Clona el repositorio:
   ```bash
   git clone https://github.com/Darlyn2425/AgenciaViajeHub.git
   ```
2. Navega a la carpeta del módulo que deseas utilizar (`Hub` o `Cotizaciones`).
3. Abre el archivo `index.html` (o `indexc.html`) directamente en tu navegador (Chrome recomendado para mejor compatibilidad de impresión).

## Créditos
Desarrollado por **Darlyn Brito**.

## API Backend (Vercel Functions)

Se agregó base de backend dentro del mismo proyecto para usar con `vercel dev` y despliegue en Vercel.

### Variables de entorno requeridas

- `BLOB_READ_WRITE_TOKEN`: token para subir archivos a Vercel Blob.
- `MONGODB_URI`: cadena de conexión de MongoDB (para fases siguientes).
- `MONGODB_DB`: nombre de base de datos (opcional, default: `brianessa_travel_hub`).
- `MAX_IMAGE_UPLOAD_BYTES`: límite de tamaño por imagen (opcional, default: `5242880`).
- `JWT_SECRET`: secreto para firmar/verificar JWT (requerido para API multi-tenant segura).
- `REQUIRE_AUTH_TENANT`: activa validación JWT obligatoria en APIs tenant (`true` recomendado/por defecto).
- `AUTH_TOKEN_TTL`: tiempo de vida del token emitido por `/api/auth/token` (opcional, default: `8h`).
- `AUTH_TOKEN_ISSUER`: issuer de JWT (opcional, default: `brianessa-travel-hub`).

### Endpoint de subida de imágenes

- `POST /api/uploads/image`
- Content-Type: `multipart/form-data`
- Campo de archivo: `file`
- Tipos soportados: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

Respuesta exitosa:

```json
{
  "ok": true,
  "file": {
    "url": "https://...",
    "pathname": "uploads/2026/02/....png",
    "contentType": "image/png",
    "size": 12345,
    "uploadedAt": "2026-02-12T00:00:00.000Z"
  }
}
```

### Endpoints de cotizaciones (MongoDB)

- `GET /api/quotations`
- `POST /api/quotations` (crea/actualiza por `id`)
- `GET /api/quotations/:id`
- `PUT /api/quotations/:id`
- `DELETE /api/quotations/:id`

### Endpoints de planes de pago (MongoDB)

- `GET /api/payment-plans?page=1&limit=20&search=texto`
- `POST /api/payment-plans` (crea/actualiza por `id`)
- `DELETE /api/payment-plans?id=...`

### Endpoints de clientes (MongoDB)

- `GET /api/clients?page=1&limit=100&search=texto`
- `POST /api/clients` (crea/actualiza por `id`)
- `DELETE /api/clients?id=...`

### Endpoints de viajes (MongoDB)

- `GET /api/trips?page=1&limit=100&search=texto`
- `POST /api/trips` (crea/actualiza por `id`)
- `DELETE /api/trips?id=...`

### Endpoints de itinerarios (MongoDB)

- `GET /api/itineraries?page=1&limit=100&search=texto`
- `POST /api/itineraries` (crea/actualiza por `id`)
- `DELETE /api/itineraries?id=...`

### Endpoints de configuración (tenant)

- `GET /api/settings?tenantId=default`
- `PUT /api/settings?tenantId=default`

### Multi-tenant (fase inicial)

- El frontend envía `tenantId` por query y header `x-tenant-id`.
- Puedes cambiar el tenant desde **Configuración > Tenant ID**.
- Variables de colección recomendadas:
  - `MONGODB_COLLECTION_QUOTATIONS`
  - `MONGODB_COLLECTION_PAYMENT_PLANS`
  - `MONGODB_COLLECTION_SETTINGS`
  - `MONGODB_COLLECTION_CLIENTS`
  - `MONGODB_COLLECTION_TRIPS`
  - `MONGODB_COLLECTION_ITINERARIES`
