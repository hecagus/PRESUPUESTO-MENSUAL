# 📈 PRESUPUESTO-MENSUAL — V10

Aplicación financiera personal offline para administrar **trabajo fijo + reparto**, gastos, deudas, ahorro, gasolina y kilometraje.

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
│   └── 05_init.js           # inicialización y eventos
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
4. Los ingresos fijos no alteran la fórmula de obligaciones ni las métricas de reparto.
5. Gasolina es consumo/reserva operativa, no deuda.
6. Rojo se reserva para mora real; los compromisos del día son ámbar y las proyecciones futuras son neutrales.

## Persistencia

La app continúa siendo **100% offline** y usa `localStorage` con la clave histórica `moto_finanzas_vFinal`, por lo que la migración V9.9 → V10 conserva los datos existentes. V10 añade `ingresosFijos` de forma compatible.

## Tecnología

HTML5 · CSS3 · JavaScript ES Modules · localStorage · GitHub Pages
