# PRESUPUESTO-MENSUAL

Sistema completo de **control de presupuesto mensual**, funcionando **sin backend**, usando únicamente **HTML, CSS y JavaScript puro**, con almacenamiento local mediante **localStorage**.  
Ideal para uso personal y diseñado para funcionar y desplegarse fácilmente en **GitHub Pages**.

---

## 🚀 Características Principales

### ✅ Página principal — `index.html`
Muestra un resumen completo del mes:

- Total de **ingresos**
- Total de **gastos**
- **Deuda total acumulada**
- **Kilómetros recorridos**
- **Gasto total de gasolina**
- Balance general
- Gráficas dinámicas con **Chart.js**:
  - Ingresos vs Gastos
  - Deudas vs Abonos
  - Kilómetros vs Gasto combustible
  - Gastos por Categoría
- Movimientos recientes

---

### 🔧 Panel Administrador — `admin.html`
Incluye toda la gestión del sistema:

#### ➕ Movimientos
- Registrar **ingresos y gastos**
- Categorías editables y personalizadas
- Descripción y monto
- Fecha del movimiento

#### 💳 Gestión de Deudas
- Crear nuevas deudas
- Registrar abonos
- Historial de abonos
- Cálculo automático del monto restante

#### 🚗 Kilometraje y gasolina
- Registrar:
  - Kilometraje inicial
  - Kilometraje final
  - Litros repostados
  - Costo por litro
- Cálculos automáticos:
  - Km recorridos
  - Costo total
  - Precio por kilómetro
- Guardado automático y limpio del formulario

#### 🔄 Exportar / Importar JSON
- Exportar toda la información del sistema
- Importar nuevamente para restaurar datos
- Compatible con cualquier navegador

---

## 📂 Estructura del Proyecto
PRESUPUESTO-MENSUAL/ │ ├── index.html ├── admin.html │ ├── assets/ │   ├── css/ │   │   └── style.css │   └── js/ │       └── app.js │ └── README.md
---

## 💾 Tecnologías Utilizadas

- **HTML5**
- **CSS3**
- **JavaScript puro**
- **localStorage**
- **Chart.js**

---

## 📊 Modelos de Datos

### Movimientos
```json
{
  "id": 1,
  "fecha": "2025-01-12",
  "tipo": "Gasto",
  "categoria": "Gasolina",
  "descripcion": "Repostaje",
  "monto": 300
}
deudas
{
  "nombre": "Crédito Moto",
  "monto": 28000,
  "historial": [
    { "fecha": "2025-01-02", "abono": 500 }
  ]
}
Kilometraje y gasolina
{
  "kmInicial": 25000,
  "kmFinal": 25250,
  "kmRecorridos": 250,
  "litros": 8,
  "costoLitro": 24,
  "total": 192,
  "precioKm": 0.76
}
