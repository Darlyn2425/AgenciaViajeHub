
# AgenciaViajeHub - Brianessa Travel Hub

Este repositorio contiene el sistema de gestión de operaciones y cotizaciones para **Brianessa Travel**. El proyecto está dividido en módulos para facilitar la gestión de clientes, viajes y presupuestos.

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
Desarrollado para **Brianessa Travel**.
