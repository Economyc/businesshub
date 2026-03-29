# Gestión de Proveedores, Compras e Inventarios para Restaurantes en Colombia

## Guía Completa para Sistemas de Gestión Empresarial

---

## PARTE 1: GESTIÓN DE PROVEEDORES

### 1.1 Selección y Evaluación de Proveedores

#### Proceso de Selección
1. **Identificación de necesidades**: Definir insumos, cantidades, frecuencia y calidad requerida.
2. **Búsqueda de proveedores**: Ferias gastronómicas (Alimentec), cámaras de comercio, plataformas de abastecimiento.
3. **Solicitud de cotizaciones**: Mínimo 3 cotizaciones por categoría.
4. **Evaluación inicial**: Matriz de criterios ponderada.
5. **Prueba piloto**: 30-60 días con pedidos pequeños.
6. **Formalización**: Contrato o acuerdo con condiciones claras.

#### Criterios de Evaluación (Matriz Ponderada)

| Criterio | Peso | Descripción |
|---|---|---|
| Precio | 25% | Competitividad vs mercado |
| Calidad | 25% | Consistencia, frescura, especificaciones |
| Puntualidad | 20% | % entregas a tiempo |
| Condiciones de pago | 10% | Plazos, descuentos, crédito |
| Capacidad de respuesta | 10% | Pedidos urgentes, comunicación |
| Documentación | 5% | Facturación electrónica, RUT, INVIMA |
| Logística | 5% | Cercanía, cadena de frío |

**Fórmula:** `Puntaje Total = Σ (Calificación_i × Peso_i)` — Cada criterio se califica 1-5.

#### Clasificación de Proveedores
- **A (Estratégicos)**: Insumos críticos (proteínas, frescos). Evaluación mensual.
- **B (Importantes)**: Insumos regulares (abarrotes, bebidas). Evaluación trimestral.
- **C (Ocasionales)**: Insumos esporádicos. Evaluación anual.

### 1.2 Negociación

- **Volumen por descuento**: Consolidar pedidos semanales/quincenales.
- **Contratos a plazo fijo**: Precios fijos 3-6 meses a cambio de volumen garantizado.
- **Descuento pronto pago**: 2-5% si paga en 7-10 días vs 30.
- **Compras cooperativas**: Aliarse con otros restaurantes (ACODRES).

#### Condiciones de Pago en Colombia
| Tipo | Plazo | Uso |
|---|---|---|
| Contado | 0 días | Plazas de mercado, pequeños |
| Crédito corto | 8-15 días | Medianos |
| Crédito estándar | 30 días | Distribuidores grandes |
| Crédito largo | 45-60 días | Grandes volúmenes |

### 1.3 KPIs de Proveedores

| KPI | Fórmula | Meta |
|---|---|---|
| Cumplimiento de entregas | (Entregas a tiempo / Total) × 100 | ≥ 95% |
| Tasa de calidad | (Sin rechazo / Total) × 100 | ≥ 98% |
| Cumplimiento de cantidad | (Cantidad correcta / Total) × 100 | ≥ 97% |
| Lead time promedio | Promedio(Entrega - Pedido) en días | Según acuerdo |
| Variación de precio | ((Actual - Anterior) / Anterior) × 100 | ≤ IPC alimentos |
| Tasa de devoluciones | (Devueltas / Recibidas) × 100 | ≤ 2% |
| Índice de dependencia | (Compras a X / Total categoría) × 100 | ≤ 70% |

---

## PARTE 2: GESTIÓN DE INVENTARIOS

### 2.1 Métodos de Valoración

#### FIFO (Recomendado para restaurantes)
Primeras entradas, primeras salidas. Aceptado por DIAN bajo NIIF (NIC 2).
```
Compra 1: 10 kg a $12.000/kg → Compra 2: 15 kg a $13.000/kg → Se usan 12 kg
Costo FIFO: (10 × $12.000) + (2 × $13.000) = $146.000
```

#### Promedio Ponderado (Más práctico para software)
```
Costo Promedio = (Costo existente + Costo nueva compra) / (Unidades existentes + Compradas)
```

**LIFO no está permitido bajo NIIF en Colombia.**

### 2.2 Punto de Reorden y Stock de Seguridad

```
Punto de Reorden = (Consumo diario × Lead time) + Stock de seguridad
Stock de seguridad = (Consumo máx diario - Consumo prom diario) × Lead time máximo
EOQ = √((2 × Demanda anual × Costo por pedido) / Costo almacenamiento unitario)
```

### 2.3 Mermas y Desperdicios

| Categoría | Merma aceptable | Preocupante |
|---|---|---|
| Carnes rojas | 15-22% | > 25% |
| Pollo | 8-15% | > 18% |
| Pescados/mariscos | 30-50% | > 55% |
| Frutas | 10-20% | > 25% |
| Verduras | 10-25% | > 30% |
| Abarrotes secos | 0.5-2% | > 3% |
| Lácteos | 1-3% | > 5% |

```
Tasa merma = (Cantidad perdida / Cantidad inicial) × 100
Factor rendimiento = Peso utilizable / Peso bruto
Costo real/kg = Costo total / Peso utilizable
```

### 2.4 Rotación de Inventario

```
Rotación = Costo consumido / Inventario promedio
Días de inventario = Periodo / Rotación
```

| Tipo | Rotación ideal (veces/mes) | Días |
|---|---|---|
| Perecederos frescos | 10-15 | 2-3 |
| Carnes congeladas | 4-6 | 5-8 |
| Lácteos | 8-12 | 3-4 |
| Abarrotes secos | 2-4 | 8-15 |
| Bebidas | 2-4 | 8-15 |
| Licores | 1-2 | 15-30 |

---

## PARTE 3: GESTIÓN DE COMPRAS

### 3.1 Proceso de Compras
1. Identificación de necesidad → 2. Requisición interna → 3. Verificación inventario → 4. Aprobación → 5. Selección proveedor → 6. Orden de compra → 7. Envío OC → 8. Recepción → 9. Registro en sistema → 10. Factura → 11. Conciliación → 12. Aprobación pago → 13. Pago

### 3.2 Food Cost

```
Food Cost Teórico (plato) = Σ(cantidad_ingrediente × costo_unitario)
% Food Cost (plato) = (Costo plato / Precio venta) × 100
Food Cost Real = (Inv.Inicial + Compras - Inv.Final) / Ventas × 100
Variación = Food Cost Real - Food Cost Teórico (meta: ≤ 2 puntos)
```

| Tipo restaurante | Food Cost objetivo |
|---|---|
| Casual | 28-35% |
| Fine dining | 30-38% |
| Comida rápida | 25-32% |
| Pizzería | 25-30% |
| Mariscos | 32-40% |
| Panadería | 25-35% |
| Bar (bebidas) | 18-24% |

---

## PARTE 4: INDICADORES Y MÉTRICAS

### KPIs de Costos
| KPI | Fórmula | Meta |
|---|---|---|
| Food Cost % | (Costo alimentos / Ventas alimentos) × 100 | 28-35% |
| Beverage Cost % | (Costo bebidas / Ventas bebidas) × 100 | 18-25% |
| Prime Cost % | (Food + Labor) / Ventas × 100 | 55-65% |

### KPIs de Inventario
| KPI | Fórmula | Meta |
|---|---|---|
| Días de inventario | Inventario actual / Consumo promedio diario | 3-7 (perecederos) |
| Exactitud inventario | (Items correctos / Total contados) × 100 | ≥ 97% |
| Tasa de merma | (Valor merma / Valor compras) × 100 | ≤ 5% |

### KPIs de Compras
| KPI | Fórmula | Meta |
|---|---|---|
| Ahorro en compras | ((Precio base - Negociado) / Base) × 100 | ≥ 3-5% |
| Cumplimiento presupuesto | (Compras reales / Presupuesto) × 100 | 95-105% |
| Concentración compras | (Compras top proveedor / Total) × 100 | ≤ 40% |

### Alertas Automáticas
- Precio insumo sube > **5%** en una compra
- Precio insumo sube > **10%** en un mes
- Consumo varía > **20%** sin justificación en ventas
- Food cost real supera teórico en > **3 puntos**

---

## PARTE 5: NORMATIVA COLOMBIANA

### Facturación Electrónica
- Obligatoria para la mayoría de contribuyentes (Resolución 000042 de 2020, DIAN).
- Compras a no obligados a facturar: generar **documento soporte de adquisiciones** (Resolución 000167 de 2021).

### Retención en la Fuente

| Concepto | Base mínima (2025) | Tarifa |
|---|---|---|
| Compra bienes general | 27 UVT (~$1.350.000) | 2.5% |
| Productos agrícolas sin proceso | 92 UVT | 1.5% |
| Servicios general | 4 UVT (~$200.000) | 4% o 6% |
| Transporte carga | 4 UVT | 1% |

### IVA en Alimentos
- **Excluidos (0%)**: Carnes frescas, pescados frescos, leche, huevos, frutas/verduras frescas, pan, sal, agua.
- **Gravados 5%**: Embutidos, harina, chocolate, azúcar.
- **Gravados 19%**: Gaseosas, licores, snacks, ultraprocesados.
- **INC 8%**: Restaurantes cobran impuesto al consumo; IVA de compras NO es descontable (se vuelve mayor costo).

### BPM (Resolución 2674 de 2013)
- Refrigeración: 0-4°C. Congelación: ≤ -18°C.
- Alimentos: 15cm del piso, 60cm del techo, 5cm de paredes.
- Rotación FIFO obligatoria. Registro de temperaturas 2 veces/día.

---

## PARTE 6: CATEGORÍAS SUGERIDAS PARA INSUMOS

1. Proteínas — Res, cerdo, pollo, pescado, mariscos
2. Lácteos y huevos
3. Frutas y verduras
4. Abarrotes secos — Granos, cereales, harinas, pastas
5. Aceites y grasas
6. Condimentos y especias
7. Salsas y aderezos
8. Panadería y repostería
9. Bebidas no alcohólicas
10. Bebidas alcohólicas
11. Desechables y empaques
12. Productos de aseo
13. Otros insumos

---

## APÉNDICE: FÓRMULAS RESUMEN

```
FOOD COST
Food Cost Teórico (plato) = Σ(cantidad_ingrediente × costo_unitario)
% Food Cost (plato) = (Costo plato / Precio venta) × 100
Food Cost Real = (Inv.Inicial + Compras - Inv.Final) / Ventas × 100

INVENTARIO
Rotación = Costo consumido / Inventario promedio
Días de inventario = Periodo / Rotación
Punto de reorden = (Consumo diario × Lead time) + Stock seguridad

MERMA
Tasa merma = (Cantidad perdida / Cantidad inicial) × 100
Factor rendimiento = Peso utilizable / Peso bruto

PROVEEDORES
Cumplimiento = (Entregas a tiempo / Total) × 100
Calidad = (Sin rechazo / Total) × 100
Competitividad = (Precio más bajo / Precio proveedor) × 100

PRECIOS
Variación = ((Actual - Anterior) / Anterior) × 100
Impacto = (Precio nuevo - Anterior) × Cantidad consumida
```
