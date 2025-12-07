# 📈 PRESUPUESTO-MENSUAL (Rastreador de Gastos y Operación)

Sistema 100% offline para controlar **ingresos, gastos, deudas y kilometraje**, hecho con **HTML, CSS y JavaScript puro**, sin backend. Guarda toda la información en `localStorage` y funciona perfecto en **GitHub Pages**.

---

## 🚀 Funciones avanzadas

- **Gestión de Turnos y KM:** El sistema lleva el control estricto del odómetro. El KM final del turno de hoy es el KM inicial del turno de mañana.
- **Asistente de Gasolina (3 Pasos):** Registro preciso del KM actual para calcular tu métrica de **Costo Real por KM**.
- **💸 Gastos Inteligentes:** Clasificación de gastos en **Operativos (Moto)** o **Personales (Hogar)** con categorías predefinidas y opción "Otra".
- **Sistema de Obligaciones (Gastos Fijos y Deudas):**
    - **Frecuencia Flexible:** Permite definir gastos recurrentes (Netflix, Renta) con frecuencia **Diaria, Semanal, Quincenal, Mensual o Bimestral**.
    - **Asistente de Deudas (3 Pasos):** Captura el monto total, el monto de la cuota recurrente, la frecuencia de pago y la fecha del próximo pago.
- **🎯 Meta Diaria Calculada:** Calcula automáticamente tu monto mínimo a ganar/apartar por día sumando:
    $$\text{Meta Diaria} = \frac{\text{Gastos Fijos}}{\text{Días}} + \frac{\text{Cuotas de Deuda}}{\text{Días de Frecuencia}}$$
- **Control de Deudas:** Registro de abonos y saldo pendiente en tiempo real.
- **Respaldo de Datos:** Exportar / Importar toda la información en formato **JSON**.

---

## 📂 Estructura

PRESUPUESTO-MENSUAL/
├── index.html (Panel de Resultados)
├── admin.html (Administración y Registro)
├── historial.html (Vista de movimientos históricos)
├── tutorial.html (Guía rápida inicial)
├── style.css
└── app.js

---

## 🔧 Tecnologías

- HTML5
- CSS3
- JavaScript (Puro)
- `localStorage` (Almacenamiento offline)
- Chart.js (Gráficas)

---

## 📌 Notas Finales

El proyecto ha evolucionado a una herramienta completa de **gestión financiera y operativa**, ideal para rastrear el rendimiento del trabajo de reparto de manera profesional, incluyendo la normalización de todos los gastos y deudas a una **Meta Diaria** simple y accionable.
