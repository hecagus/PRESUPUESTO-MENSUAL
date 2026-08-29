# 📈 PRESUPUESTO-MENSUAL — V10.3

Aplicación financiera personal **offline-first** para administrar trabajo fijo + reparto, gastos, deudas, ahorro, gasolina y kilometraje.

## Modelo híbrido

- **Trabajo fijo:** se configura como fuente de ingreso independiente y cada cobro se registra en caja.
- **Reparto:** conserva turnos, horas, ganancia, kilometraje y gasolina.
- Ambas fuentes terminan en el mismo historial de movimientos, pero conservan su origen para no mezclar salario con rendimiento operativo de reparto.

## Arquitectura

```text
PRESUPUESTO-MENSUAL/
├── js/
│   ├── 01_consts_utils.js   # constantes y helpers
│   ├── 02_data.js           # estado, localStorage y dominio financiero
│   ├── 03_render.js         # presentación / Semantic UX
│   ├── 04_charts.js         # métricas y analítica
│   ├── 05_init.js           # inicialización, eventos y manejo de errores
│   └── 06_income_ui.js      # UI de ingresos fijos
├── index.html
├── admin.html
├── wallet.html
├── stats.html
├── historial.html
└── style.css
```

### Reglas de arquitectura

1. `02_data.js` es la única fuente de verdad financiera y no accede al DOM.
2. `03_render.js` interpreta el estado, pero no modifica dinero ni persistencia.
3. `05_init.js` conecta eventos de UI con acciones del dominio.
4. `06_income_ui.js` encapsula la interfaz de configuración y cobro de trabajo fijo.
5. Los ingresos fijos no alteran la fórmula de obligaciones ni las métricas de reparto.
6. Gasolina es consumo/reserva operativa, no deuda.
7. Rojo se reserva para mora real; los compromisos del día son ámbar y las proyecciones futuras son neutrales.

## Robustez V10.3

- Impide finalizar un turno inexistente o iniciar dos turnos simultáneos.
- Valida kilometraje, litros, montos, deudas, cuotas y descripciones antes de modificar el estado.
- Rechaza respaldos JSON inválidos o ajenos a la estructura de la aplicación.
- La restauración requiere confirmación explícita antes de reemplazar datos.
- El respaldo intenta copiar JSON formateado al portapapeles y, si no es posible, descarga un archivo `.json`.

## Persistencia

La aplicación usa `localStorage` con la clave histórica `moto_finanzas_vFinal`, por lo que las migraciones conservan los datos existentes. El estado se sanea antes de persistirse y mantiene compatibilidad con estructuras anteriores de ingresos fijos.

> Importante: los datos viven en el navegador/dispositivo. Conviene generar respaldos periódicos desde **Admin → Sistema**.

## Tecnología

HTML5 · CSS3 · JavaScript ES Modules · localStorage · Chart.js · GitHub Pages
