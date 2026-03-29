# Base de Conocimiento: Contabilidad y Restaurantes en Colombia

> **Fecha de investigacion**: Marzo 2026
> **Proposito**: Referencia para crear modulos y soluciones en BuisinessHub orientados al sector gastronomico colombiano.

---

## Tabla de Contenidos

1. [Marco Contable Colombiano (NIF/NIIF)](#1-marco-contable-colombiano)
2. [Obligaciones Tributarias](#2-obligaciones-tributarias)
3. [Facturacion Electronica](#3-facturacion-electronica)
4. [Requisitos POS](#4-requisitos-pos)
5. [Nomina y Laboral](#5-nomina-y-laboral)
6. [Plan Unico de Cuentas (PUC)](#6-plan-unico-de-cuentas)
7. [Reportes y Obligaciones de Informacion](#7-reportes-y-obligaciones)
8. [Registro y Constitucion de Restaurantes](#8-registro-y-constitucion)
9. [Tipos de Establecimientos Gastronomicos](#9-tipos-de-establecimientos)
10. [Regulacion Sanitaria](#10-regulacion-sanitaria)
11. [Permisos y Licencias](#11-permisos-y-licencias)
12. [Gestion de Inventarios](#12-gestion-de-inventarios)
13. [Ingenieria de Menu](#13-ingenieria-de-menu)
14. [Plataformas de Delivery](#14-plataformas-de-delivery)
15. [KPIs Financieros Clave](#15-kpis-financieros)
16. [Gestion de Caja y Medios de Pago](#16-gestion-de-caja)
17. [Estructura de Costos](#17-estructura-de-costos)
18. [Planeacion Financiera y Estacionalidad](#18-planeacion-financiera)
19. [Software Contable en Colombia](#19-software-contable)
20. [Desafios del Sector](#20-desafios-del-sector)
21. [Modulos Sugeridos para BuisinessHub](#21-modulos-sugeridos)

---

## 1. Marco Contable Colombiano

Colombia adopto las NIIF (Normas Internacionales de Informacion Financiera) mediante la Ley 1314 de 2009 y el DUR 2420 de 2015.

### Grupos de Clasificacion

| Grupo | Norma Aplicable | Criterios | Restaurantes Tipicos |
|-------|----------------|-----------|---------------------|
| **Grupo 1** | NIIF Plenas (IFRS Full) | >200 empleados O activos >30,000 SMMLV | Grandes cadenas |
| **Grupo 2** | NIIF para PYMES | >10 empleados Y activos >500 SMMLV (~COP $711M) | Restaurantes medianos, pequenas cadenas |
| **Grupo 3** | Contabilidad Simplificada | ≤10 empleados Y activos ≤500 SMMLV | **Mayoria de restaurantes individuales** |

### Estados Financieros Requeridos

**Grupo 2:**
- Estado de Situacion Financiera (Balance)
- Estado de Resultados Integral
- Estado de Cambios en el Patrimonio
- Estado de Flujos de Efectivo
- Notas

**Grupo 3 (Simplificado):**
- Estado de Situacion Financiera
- Estado de Resultados
- Notas

---

## 2. Obligaciones Tributarias

### Valores de Referencia 2025

| Parametro | Valor |
|-----------|-------|
| SMMLV | COP $1,423,500/mes |
| Auxilio de Transporte | COP $200,000/mes |
| UVT | COP $47,065 |

### 2.1 Impoconsumo (Impuesto al Consumo) — CLAVE PARA RESTAURANTES

- **Tasa: 8%** (Art. 512-1 E.T., Ley 1819 de 2016)
- Aplica a: restaurantes, cafeterias, autoservicios, bares
- **NO es deducible** como credito fiscal (a diferencia del IVA)
- Declaracion: Bimestral — Formulario 310
- Periodos: Ene-Feb, Mar-Abr, May-Jun, Jul-Ago, Sep-Oct, Nov-Dic
- **Exentos**: Ingresos brutos < 3,500 UVT (~COP $166.4M) en el ano anterior

### 2.2 IVA (Impuesto al Valor Agregado)

- **Tasa general: 19%**
- La mayoria de restaurantes optan por Impoconsumo (8%) en lugar de IVA (19%)
- Declaracion: Bimestral o cuatrimestral segun ingresos

### 2.3 Retencion en la Fuente

| Concepto | Tasa |
|----------|------|
| Compras (bienes) | 2.5% |
| Servicios generales | 4% |
| Servicios especializados | 6% - 11% |
| Arrendamientos | 3.5% |
| Honorarios | 10% - 11% |
| Salarios | Segun tabla Art. 383 E.T. |

- Declaracion: Mensual — Formulario 350
- Autorretencion de renta: 0.40%, 0.80%, o 1.60% segun actividad

### 2.4 ICA (Impuesto de Industria y Comercio)

| Ciudad | Tarifa Restaurantes |
|--------|-------------------|
| Bogota | ~13.8 por mil (1.38%) |
| Medellin | ~10 por mil (1.0%) |
| Cali | ~10 por mil (1.0%) |
| Barranquilla | ~7 por mil (0.7%) |

- Incluye sobretasas: Avisos y Tableros (15% sobre ICA) y Sobretasa Bomberil
- 50% del ICA pagado es descuento tributario contra Renta (Art. 115 E.T.)

### 2.5 Impuesto de Renta

| Tipo | Tasa |
|------|------|
| Personas juridicas | **35%** |
| Personas naturales | Progresiva: 0% a 39% |

- Declaracion anual: Abr-May (juridicas), Ago-Oct (naturales)

### 2.6 Otros Impuestos

| Impuesto | Tasa/Valor |
|----------|-----------|
| GMF (4x1000) | 0.4% sobre movimientos financieros (50% deducible) |
| Impuesto al Patrimonio | 1.5% si patrimonio > 72,000 UVT (~COP $3,389M) |
| Bolsas plasticas | ~COP $90 por bolsa |

---

## 3. Facturacion Electronica

### Marco Legal
- Decreto 358 de 2020, Resolucion 000042 de 2020

### Tipos de Documentos

| Documento | Codigo | Descripcion |
|-----------|--------|-------------|
| Factura Electronica de Venta | 01 | Factura estandar |
| Nota Credito | 91 | Anulaciones, devoluciones, descuentos |
| Nota Debito | 92 | Ajustes de precio, intereses |
| Documento Soporte | 05 | Compras a no facturadores |

### Requisitos Tecnicos
- **Formato**: XML firmado digitalmente, estandar UBL 2.1
- **Validacion**: Envio a DIAN antes de entrega al cliente
- **CUFE**: Codigo Unico de Factura Electronica (hash unico)
- **Numeracion**: Rangos autorizados por DIAN
- **Firma digital**: Certificado X.509
- **Representacion grafica**: PDF/impreso con codigo QR obligatorio
- **Proveedores tecnologicos**: Pueden usar proveedor autorizado por DIAN o desarrollo propio

---

## 4. Requisitos POS (Documento Equivalente Electronico)

### Resolucion 000165 de Noviembre 2023

**Calendario de implementacion obligatoria:**

| Fecha | Aplica a |
|-------|----------|
| Feb 1, 2025 | >5 establecimientos e ingresos >80,000 UVT |
| Abr 1, 2025 | 3-5 establecimientos |
| May 1, 2025 | 1-2 establecimientos |

### Requisitos Tecnicos POS
- Transmitir XML (UBL 2.1) a DIAN
- Incluir **CUDE** (Codigo Unico de Documento Equivalente)
- Transacciones ≤5 UVT (~COP $235,325): Informacion simplificada
- Transacciones >5 UVT: Requiere identificacion del comprador (NIT/CC)
- Validacion DIAN dentro de 48 horas
- **Propinas NO son parte de la base gravable** pero deben documentarse

### Impacto para Restaurantes
- Todas las transacciones POS deben reportarse electronicamente a DIAN
- Requiere actualizacion o reemplazo de software POS
- Inversion tecnologica significativa para muchos restaurantes

---

## 5. Nomina y Laboral

### 5.1 Nomina Electronica
- **Obligatoria desde 2022** (Resolucion 000013 de 2021)
- Transmision mensual a DIAN en formato XML
- Incluye: documento soporte por empleado, notas de ajuste

### 5.2 Prestaciones Sociales

| Concepto | Valor | Periodo de Pago |
|----------|-------|-----------------|
| Prima de Servicios | 1 mes salario/ano | Jun 30 y Dic 20 (dos pagos) |
| Cesantias | 1 mes salario/ano | Deposito en fondo antes del 14 Feb |
| Intereses sobre Cesantias | 12% anual sobre cesantias | Pago al empleado antes del 31 Ene |
| Vacaciones | 15 dias habiles/ano (medio mes salario) | A solicitud o acumulacion |
| Dotacion | 3 veces/ano (zapatos + ropa) | Abr 30, Ago 31, Dic 20 — empleados ≤2 SMMLV |

### 5.3 Seguridad Social

| Concepto | Empleador | Empleado | Total |
|----------|-----------|----------|-------|
| Salud (EPS) | 8.5% | 4% | 12.5% |
| Pension (AFP) | 12% | 4% | 16% |
| ARL (Riesgos Laborales) | 0.522% (Nivel I) a 1.044% (Nivel II) | — | Variable |

- Restaurantes tipicamente clasificados como **Riesgo I o II**

### 5.4 Aportes Parafiscales

| Concepto | Tasa |
|----------|------|
| SENA | 2% — **EXENTO** para empleados <10 SMMLV |
| ICBF | 3% — **EXENTO** para empleados <10 SMMLV |
| Caja de Compensacion | 4% (siempre obligatorio) |

### 5.5 Jornada Laboral

- Jornada estandar: **42 horas semanales** (Ley 2101 de 2021, aplicable desde Jul 2026)
- Maximo diario: 8 horas (extensible a 10 con acuerdo)
- Turnos partidos comunes en restaurantes (10am-3pm, 6pm-11pm)

### 5.6 Recargos

| Tipo | Recargo |
|------|---------|
| Nocturno (9PM - 6AM) | +35% |
| Dominical / Festivo | +75% |
| Hora extra diurna | +25% |
| Hora extra nocturna | +75% |
| HE dominical/festivo diurna | +100% |
| HE dominical/festivo nocturna | +150% |

### 5.7 Propinas (Ley 1935 de 2018)

- Propina voluntaria sugerida: **maximo 10%** del servicio
- **NO es salario** — no afecta prestaciones sociales
- Pertenece exclusivamente al personal de servicio
- Propietarios/administradores **prohibidos** de tomar porcion alguna
- Distribucion: maximo 1 mes desde la recoleccion
- La factura debe indicar "propina voluntaria" y el cliente puede rechazarla

### 5.8 Tipos de Contrato Comunes

| Tipo | Uso Tipico |
|------|-----------|
| Termino indefinido | Posiciones permanentes (preferido por ley) |
| Termino fijo | Contrataciones estacionales (1-3 anos, renovable) |
| Obra o labor | Catering, eventos |
| Prestacion de servicios | **RIESGOSO** — MinTrabajo puede reclasificar como relacion laboral |

---

## 6. Plan Unico de Cuentas (PUC)

### Estructura General (Decreto 2650 de 1993)

| Clase | Codigo | Descripcion |
|-------|--------|-------------|
| 1 | 1XXX | Activos |
| 2 | 2XXX | Pasivos |
| 3 | 3XXX | Patrimonio |
| 4 | 4XXX | Ingresos |
| 5 | 5XXX | Gastos |
| 6 | 6XXX | Costos de Venta |
| 7 | 7XXX | Costos de Produccion |
| 8 | 8XXX | Cuentas de Orden Deudoras |
| 9 | 9XXX | Cuentas de Orden Acreedoras |

### Cuentas Clave para Restaurantes

**Activos (1XXX)**
| Cuenta | Descripcion |
|--------|-------------|
| 1105 | Caja |
| 1110 | Bancos |
| 1305 | Clientes (CxC) |
| 1355 | Anticipos y Avances |
| 1435 | Inventario de mercancias (alimentos/bebidas) |
| 1524 | Equipo de oficina |
| 1528 | Equipo de computo |
| 1540 | Equipo de restaurante / Maquinaria cocina |
| 1592 | Depreciacion acumulada |

**Pasivos (2XXX)**
| Cuenta | Descripcion |
|--------|-------------|
| 2105 | Obligaciones financieras |
| 2205 | Proveedores nacionales |
| 2335 | Costos y gastos por pagar |
| 2365 | Retencion en la fuente por pagar |
| 2367 | IVA retenido |
| 2368 | ICA retenido |
| 2370 | Retenciones y aportes de nomina |
| 2404 | Impuesto de renta por pagar |
| 2408 | IVA/Impoconsumo por pagar |
| 2505 | Salarios por pagar |
| 2510 | Cesantias consolidadas |
| 2515 | Intereses sobre cesantias |
| 2520 | Prima de servicios |
| 2525 | Vacaciones consolidadas |

**Ingresos (4XXX)**
| Cuenta | Descripcion |
|--------|-------------|
| 4175 | Actividades de servicios de comida |

**Gastos (5XXX)**
| Cuenta | Descripcion |
|--------|-------------|
| 5105 | Gastos de personal |
| 5115 | Impuestos (ICA, etc.) |
| 5120 | Arrendamientos |
| 5135 | Servicios publicos |
| 5145 | Mantenimiento |
| 5195 | Diversos |

**Costos de Venta (6XXX)**
| Cuenta | Descripcion |
|--------|-------------|
| 6170 | Costo de servicios de comida |

---

## 7. Reportes y Obligaciones

### Declaraciones Periodicas

| Impuesto | Formulario | Frecuencia |
|----------|-----------|------------|
| Retencion en la fuente | 350 | Mensual |
| IVA | 300 | Bimestral o Cuatrimestral |
| Impoconsumo | 310 | Bimestral |
| ICA | Varia por municipio | Bimestral/Trimestral/Anual |
| Nomina electronica | XML a DIAN | Mensual |
| Informacion exogena | XML | Anual |

### Declaraciones Anuales

| Obligacion | Formulario | Plazo |
|------------|-----------|-------|
| Renta (juridicas) | 110 | Abr-May (segun NIT) |
| Renta (naturales) | 210 | Ago-Oct (segun NIT) |
| Informacion exogena | Multiples XML | Abr-Jun |
| Renovacion Matricula Mercantil | Camara de Comercio | 31 de Marzo |

### Informacion Exogena (Medios Magneticos)
- Obligatoria si ingresos brutos > COP $100,000,000
- Reportar: clientes, proveedores, empleados, retenciones, ingresos, costos, saldos

---

## 8. Registro y Constitucion

### Estructura Legal Recomendada
- **SAS (Sociedad por Acciones Simplificada)**: Mas comun. Responsabilidad limitada, socio unico permitido (Ley 1258 de 2008)
- Persona Natural Comerciante: Mas simple pero responsabilidad personal
- SRL/Ltda: Menos comun, reemplazada por SAS en la practica

### Codigos CIIU para Restaurantes

| Codigo | Actividad |
|--------|-----------|
| 5611 | Expendio a la mesa de comidas preparadas |
| 5612 | Expendio por autoservicio de comidas preparadas |
| 5613 | Expendio en cafeterias |
| 5619 | Otros expendios de comidas preparadas |
| 5621 | Catering para eventos |
| 5630 | Expendio de bebidas alcoholicas para consumo en el establecimiento |

### Responsabilidades en RUT

| Codigo | Responsabilidad |
|--------|----------------|
| 05 | IVA |
| 23 | Agente de retencion en la fuente |
| 33 | Impoconsumo |
| 48 | Facturacion electronica |
| 49 | No responsable de IVA |
| 52 | Nomina electronica |

### Pasos de Registro

1. Verificar nombre en Camara de Comercio
2. Obtener RUT en DIAN
3. Matricula Mercantil (renovacion anual antes del 31 Mar)
4. Registro ICA en Secretaria de Hacienda municipal
5. Concepto Sanitario
6. Concepto de Uso del Suelo
7. Certificado Sayco y Acinpro
8. Certificado de Bomberos
9. Habilitacion de facturacion electronica
10. Habilitacion de nomina electronica

---

## 9. Tipos de Establecimientos Gastronomicos

| Tipo | Descripcion | Regulacion Especifica |
|------|-------------|----------------------|
| Restaurante | Servicio a la mesa, comidas preparadas | Resolucion 2674/2013 |
| Bar/Bar-Restaurante | Bebidas alcoholicas + posible comida | Licencia de alcohol adicional |
| Cafeteria | Comidas ligeras, cafe, pasteleria | Requisitos de infraestructura menores |
| Comidas Rapidas | Servicio rapido, menu simplificado | Alto volumen, alta rotacion |
| Catering | Preparacion y servicio fuera del local | Regulacion de transporte y cadena de frio |
| Cocina Oculta / Cloud Kitchen | Solo delivery, sin comedor | Debe cumplir todos los requisitos sanitarios |
| Panaderia/Pasteleria | Productos de panaderia | NTC especificas |

---

## 10. Regulacion Sanitaria

### Marco Normativo
- **Ley 9 de 1979**: Codigo Sanitario Nacional
- **Resolucion 2674 de 2013** (MinSalud): Regulacion principal para establecimientos de alimentos
- **Decreto 780 de 2016**: Decreto regulatorio unificado sector salud

### Concepto Sanitario

| Resultado | Puntaje | Accion |
|-----------|---------|--------|
| Favorable | 80-100% | Cumple |
| Favorable con requerimientos | 60-79% | Debe corregir en plazo |
| Desfavorable | <60% | Puede enfrentar cierre |

- Inspecciones **sin previo aviso**
- Evalua: temperaturas de almacenamiento, prevencion de contaminacion cruzada, higiene personal, control de plagas, calidad del agua, manejo de residuos

### Manipulacion de Alimentos
- **Todo** el personal que manipula alimentos debe tener certificado
- Capacitacion minima: 10 horas (entidad autorizada por Secretaria de Salud)
- Certificado valido por **1 ano** — renovacion anual

### BPM (Buenas Practicas de Manufactura)
- Pisos, paredes, techos: lisos, lavables, no porosos
- Ventilacion e iluminacion adecuadas
- Areas separadas para alimentos crudos y cocidos
- Suministro de agua potable documentado
- Plan de control de plagas con proveedor contratado
- Plan de limpieza y desinfeccion (L&D)
- Plan de manejo de residuos solidos
- Calibracion de termometros y balanzas

### Temperaturas Requeridas

| Tipo | Temperatura |
|------|------------|
| Refrigerado | 0°C a 4°C |
| Congelado | -18°C o menos |
| Mantenimiento en caliente | >60°C |
| **Zona de peligro** | **4°C a 60°C** — maximo 2 horas |

### Manejo de Residuos
- **Resolucion 2184 de 2019**: Separacion por colores (blanco=reciclable, negro=no reciclable, verde=organico)
- Aceites usados: recoleccion por empresas autorizadas (Resolucion 316 de 2018)

---

## 11. Permisos y Licencias

| Permiso | Entidad | Costo Aproximado | Frecuencia |
|---------|---------|-----------------|------------|
| Registro Mercantil | Camara de Comercio | Variable | Anual (antes 31 Mar) |
| RUT | DIAN | Gratuito | Una vez |
| Concepto Sanitario | Secretaria de Salud | Gratuito (inspeccion) | Permanente |
| Uso de Suelo | Planeacion Municipal | Variable | Una vez |
| Bomberos | Cuerpo de Bomberos | COP $50,000 - $500,000 | Anual |
| Sayco y Acinpro | OSA | COP $200,000 - millones | Anual (si usa musica) |
| RNT (Turismo) | MinCIT / Camara Comercio | Variable | Si aplica |
| Licencia de Alcohol | Alcaldia | Variable | Si vende alcohol |
| Publicidad Exterior | Alcaldia / Autoridad ambiental | Variable | Si tiene avisos |
| Concepto Tecnico de Gas | Empresa de gas | Variable | Si usa gas natural |

---

## 12. Gestion de Inventarios

### Metricas Clave

| Metrica | Rango Objetivo |
|---------|---------------|
| Food cost (% de ingresos) | 28% - 35% |
| Beverage cost (no alcoholicas) | 18% - 25% |
| Beverage cost (alcoholicas) | 20% - 30% |
| Merma aceptable | 2% - 5% del total de compras |

### Food Cost por Segmento

| Segmento | Food Cost Objetivo |
|----------|-------------------|
| Fine dining | 30% - 35% |
| Casual dining | 28% - 32% |
| Comidas rapidas | 25% - 30% |
| Corrientazo / Menu ejecutivo | 30% - 38% |

### Practicas Recomendadas
- **Niveles par**: Stock minimo y maximo por ingrediente
- **FIFO**: Primero en entrar, primero en salir
- **Inventario fisico**: Semanal para items de alto costo (proteinas, lacteos), mensual para todo
- **Kardex**: Registro de movimientos (entradas, salidas, saldo)
- **Comparacion semanal**: Consumo teorico vs. real
- **Multiples proveedores**: 2-3 por categoria para competencia de precios
- **Compras de plaza**: Mercados mayoristas (Corabastos en Bogota, Santa Elena en Medellin)

---

## 13. Ingenieria de Menu

### Escandallo / Costeo de Receta

Componentes:
1. Lista de ingredientes con cantidades exactas (gramos, mililitros)
2. Costo unitario de compra por ingrediente
3. **Factor de rendimiento**: Proteinas 75-85%, Vegetales 80-90%, Frutas 70-85%
4. Costo por porcion
5. Precio de venta sugerido

### Formula de Precio
```
Precio de venta = Costo del plato / Food cost objetivo
Ejemplo: COP $8,000 / 0.30 = COP $26,667 → COP $27,000
```

### Matriz de Ingenieria de Menu

| Categoria | Popularidad | Margen | Accion |
|-----------|------------|--------|--------|
| Estrellas | Alta | Alto | Promover agresivamente |
| Caballos de batalla | Alta | Bajo | Optimizar costos o subir precio |
| Rompecabezas | Baja | Alto | Reposicionar en menu, mejorar marketing |
| Perros | Baja | Bajo | Considerar eliminar |

### Contexto de Precios en Colombia (2024-2026)

| Segmento | Rango de Precios |
|----------|-----------------|
| Corrientazo / Menu ejecutivo | COP $12,000 - $20,000 |
| Casual dining (plato principal) | COP $25,000 - $55,000 |
| Fine dining (plato principal) | COP $55,000 - $120,000+ |
| Combo comidas rapidas | COP $15,000 - $35,000 |

> **Nota**: Los precios son altamente sensibles al **estrato socioeconomico** (sistema 1-6 de Colombia).

---

## 14. Plataformas de Delivery

| Plataforma | Comision | Notas |
|-----------|---------|-------|
| **Rappi** | 15% - 30% | Dominante en Colombia (fundada en Bogota, 2015) |
| **iFood** | 12% - 27% | Empresa brasilena, fuerte competidor |
| **Didi Food** | 15% - 25% | Creciendo en Bogota, Medellin, Cali |
| **PedidosYa** | 15% - 28% | Fuerte en ciudades secundarias |
| **Uber Eats** | — | **Salio de Colombia en 2022** |

### Ejemplo Real de Impacto
- Pedido de COP $62,000 en Rappi → restaurante retiene ~COP $42,817 (69%) despues de comision 26% + tarifa plataforma

### Requisitos de Integracion
- Tablet/dispositivo para recibir pedidos
- Menu con fotos, descripciones, precios
- Tiempos de preparacion acordados (15-30 min)
- Estandares de empaque para delivery
- Las comisiones son gasto deducible de impuestos

### Desafios
- Comisiones altas erosionan margenes ya delgados
- Dependencia de algoritmos para visibilidad
- Pagos de plataformas: semanal o quincenal (crea brechas de capital de trabajo)
- Necesidad de menu especifico para delivery

---

## 15. KPIs Financieros Clave

### Metricas Principales

| KPI | Rango Objetivo | Formula |
|-----|---------------|---------|
| Food Cost % | 28% - 35% | Costo alimentos / Ventas alimentos |
| Labor Cost % | 15% - 25% | Costo nomina total / Ventas netas |
| **Prime Cost** | **55% - 65%** | Food + Labor / Ventas totales |
| Beverage Cost % | 18% - 24% | Costo bebidas / Ventas bebidas |
| EBITDA | 8% - 15% | Utilidad operativa + Depreciacion + Amortizacion |
| Utilidad Neta | 10% - 15% | (Colombia, mayor que EEUU por menor costo laboral) |

### Beverage Cost por Tipo

| Tipo | Costo Objetivo |
|------|---------------|
| Licores/destilados | 14% - 20% |
| Cerveza de barril | 15% - 18% |
| Cerveza embotellada | 24% - 28% |
| Vino | 35% - 45% |
| Bebidas no alcoholicas | <15% |

### Metricas de Operacion

| Metrica | Descripcion |
|---------|-------------|
| Ticket promedio | Venta promedio por transaccion |
| Rotacion de mesas | Comensales totales / Numero de sillas por periodo |
| RevPASH | Ingreso total / (Sillas x Horas abierto) |
| Punto de equilibrio | Costos fijos / (Ingreso por cliente - Costo variable por cliente) |

### Punto de Equilibrio
```
Break-Even = Costos Fijos Totales / (Ingreso Promedio por Cliente - Costo Variable por Cliente)

1. Calcular costos fijos (arriendo, seguros, salarios base, cuotas creditos)
2. Calcular costo variable por cliente (food cost + labor por cubierto)
3. Determinar ingreso promedio por cliente
4. Dividir costos fijos entre margen de contribucion por cliente
5. Resultado = numero de clientes necesarios para punto de equilibrio
```

---

## 16. Gestion de Caja y Medios de Pago

### Medios de Pago en Colombia

| Metodo | Comision | Tiempo Liquidacion |
|--------|---------|-------------------|
| Efectivo | 0% | Inmediato |
| Datafono (tarjeta) | 2.09% - 2.99% | 1-3 dias habiles |
| Nequi (Bancolombia) | Variable | Casi inmediato |
| Daviplata (Davivienda) | Variable | Casi inmediato |
| Tarjeta debito | 1.5% - 2.5% | 1-2 dias |
| Tarjeta credito | 2.5% - 3.5% | 2-5 dias |

**Proveedores datafono**: Redeban (desde 2.99%), Bold (2.09%-2.89% + COP $300), Credibanco (negociable)

### Cuadre de Caja Diario
- Conteo de efectivo al abrir Y cerrar cada turno
- Segregacion de funciones (cajero no reconcilia su propia caja)
- Verificacion por dos personas
- Reconciliar reportes POS contra efectivo real, transacciones de tarjeta y billeteras digitales
- Documentar todas las discrepancias
- Fondo de caja base (float): COP $200,000 - $500,000

### Propinas — Manejo Financiero
- NO son ingreso del restaurante
- Distribucion exclusiva al personal de servicio
- No afectan base gravable
- Deben documentarse pero no facturarse como venta

---

## 17. Estructura de Costos

### Distribucion Tipica (% sobre Ventas Netas)

| Categoria | % de Ventas Netas |
|-----------|------------------|
| **Costo de Ventas (alimentos/bebidas)** | 30% - 35% |
| **Nomina Total** | 15% - 25% |
| Arriendo | 5% - 8% |
| Servicios publicos | 4% - 6% |
| Marketing | 1% - 3% |
| Operaciones directas | 2% - 5% |
| Mantenimiento | 1% - 4% |
| Administrativos | 2% - 5% |
| Entretenimiento/musica | 1% - 2% |
| Empaque (delivery) | 8% - 12% del gasto en consumibles |
| **Utilidad Neta** | **10% - 15%** |

### Costos Fijos vs Variables
- Costos fijos (con arriendo): 14% - 18% de costos totales
- Costos variables/semi-variables: 55% - 65% de costos totales

---

## 18. Planeacion Financiera y Estacionalidad

### Estacionalidad en Colombia

**Temporada Alta:**
| Periodo | Evento |
|---------|--------|
| Diciembre | Navidad, Ano Nuevo, Novenas |
| Marzo/Abril | Semana Santa |
| Mayo | Dia de la Madre |
| Junio/Julio | Vacaciones de mitad de ano |
| **Septiembre** | **Amor y Amistad** (no febrero como en otros paises) |

**Temporada Baja:**
| Periodo | Razon |
|---------|-------|
| Enero | Gasto post-navidad |
| Febrero (inicio) | Recuperacion financiera |
| Agosto | Regreso a clases |

**Eventos Regionales:**
- Feria de Cali (Diciembre)
- Feria de las Flores - Medellin (Agosto)
- Carnaval de Barranquilla (Febrero/Marzo)

### Presupuesto
- Construir de abajo hacia arriba: cubiertos/dia historicos x ticket promedio
- Usar porcentajes de estructura de costos de Acodres como guia
- Presupuestar costos fijos primero
- Incluir **reserva de contingencia** de 2% - 5% de ingresos

### Pronostico
- **Indice de estacionalidad**: Calcular indices mensuales de 2+ anos historicos
- **Rolling 13 semanas**: Actualizar semanalmente con desempeno real
- **Por cubiertos**: Proyectar cubiertos por turno, multiplicar por ticket promedio
- **Analisis de mix de menu**: Pronosticar por item para predecir food cost con mayor precision

### Datos del Sector
- Crecimiento promedio sector gastronomico: **22%** (Acodres)
- Contribucion al PIB (via turismo): ~3.6%
- CAGR proyectado 2024-2032: **5.2%**
- Cadenas lideres 2024: Frisby COP $1.21 billones (+12% YoY), Crepes & Waffles COP $1.11 billones (+11.1%)

---

## 19. Software Contable en Colombia

### Comparativa

| Software | Tipo | Precio Desde (COP/mes) | Modulo Restaurante | Fortaleza Principal |
|----------|------|----------------------|-------------------|-------------------|
| **Alegra** | Cloud | $50,000 | No | SMEs, facil de usar |
| **Siigo** | Cloud | $146,000 (contable) + $87,500 (POS Gastrobar) | **Si (Gastrobar)** | POS especializado restaurantes |
| **Loggro** | Cloud | $100,000 (Restobar) | **Si (Restobar)** | Gestion de mesas, menu digital, integracion delivery |
| **Helisa** | Cloud/Desktop | $193,000 | No | Nomina electronica avanzada |
| **World Office** | Cloud/Desktop | $108,000/ano (promo) | No | 20+ anos en Colombia, licencia perpetua |

### Recomendacion por Tamano

| Tamano | Software Recomendado | Razon |
|--------|---------------------|-------|
| Pequeno (1-5 empleados) | Alegra Pyme o Loggro Restobar | Economico, funciones de restaurante (Loggro) |
| Mediano (5-20 empleados) | Siigo + POS Gastrobar o Loggro Restobar + Standard | POS especializado, buena nomina |
| Grande / Cadena | Siigo Premium + Gastrobar o Helisa Cloud Plus | Nomina avanzada, multi-sede, APIs |
| Multi-sede | World Office Cloud Enterprise | Multi-sucursal, POS offline |

### Otras Tecnologias en Uso
- **Menus QR**: Generalizados desde la pandemia
- **Nequi/Daviplata**: Adopcion rapida de billeteras digitales
- **WhatsApp Business**: Pedidos informales, muy comun
- **Mesa 24/7**: Reservaciones (principalmente fine dining)

---

## 20. Desafios del Sector

### Principales Retos

| Desafio | Detalle |
|---------|---------|
| **Margenes delgados** | Utilidad neta 5-15%, alta sensibilidad a variaciones de costo |
| **Informalidad** | 40-60% de restaurantes operan parcial o totalmente informal |
| **Rotacion de personal** | 50-80% anual en el sector |
| **Flujo de caja** | Altos costos iniciales + pagos diferidos de plataformas |
| **Inflacion alimentaria** | >15% en algunos anos recientes |
| **Competencia** | Bajas barreras de entrada = competidores constantes |
| **Cadena de suministro** | Proveedores poco confiables, calidad inconsistente |
| **Servicios publicos** | Altos costos de electricidad y gas |
| **Seguridad** | Hurto interno/externo, extorsion en algunas zonas |

---

## 21. Modulos Sugeridos para BuisinessHub

Basado en toda la investigacion, estos son los modulos prioritarios para una solucion integral de gestion de restaurantes en Colombia:

### Prioridad Alta

| Modulo | Funcionalidades Clave |
|--------|----------------------|
| **Facturacion Electronica DIAN** | Factura, nota credito/debito, documento soporte, documento equivalente POS, CUFE/CUDE, validacion DIAN |
| **Contabilidad (PUC/NIIF)** | Plan de cuentas configurable, estados financieros por grupo (2/3), libro diario, mayor, balance de prueba |
| **Nomina Electronica** | Liquidacion automatica de prestaciones, seguridad social, parafiscales, recargos nocturnos/dominicales, transmision DIAN |
| **Inventario para Restaurantes** | Kardex, niveles par, FIFO, costeo de recetas (escandallo), factor de rendimiento, control de merma |
| **POS Restaurante** | Gestion de mesas, division de cuentas, propinas voluntarias, integracion medios de pago (datafono, Nequi, Daviplata) |

### Prioridad Media

| Modulo | Funcionalidades Clave |
|--------|----------------------|
| **Gestion Tributaria** | Calculo automatico IVA/Impoconsumo, retenciones, ICA por ciudad, calendario de declaraciones, formularios DIAN |
| **Ingenieria de Menu** | Costeo de recetas, food cost por plato, matriz de rentabilidad, simulador de precios |
| **Dashboard de KPIs** | Food cost %, labor cost %, prime cost, ticket promedio, rotacion de mesas, RevPASH, punto de equilibrio |
| **Reconciliacion Delivery** | Seguimiento de comisiones Rappi/iFood/Didi, conciliacion de pagos, P&L por canal |
| **Gestion de Personal** | Turnos partidos, control de horas, recargos automaticos, dotacion, certificados de manipulacion de alimentos |

### Prioridad Futura

| Modulo | Funcionalidades Clave |
|--------|----------------------|
| **Compliance Tracker** | Vencimiento de permisos (bomberos, Sayco, concepto sanitario, certificados), alertas automaticas |
| **Planeacion Financiera** | Presupuesto, forecast con estacionalidad colombiana, analisis de tendencias |
| **Multi-sede** | Consolidacion contable, inventario centralizado, comparativo entre sedes |
| **Integracion Plataformas** | API con Rappi, iFood, PedidosYa para recepcion automatica de pedidos |
| **Control Sanitario** | Registro de temperaturas, checklists BPM, plan L&D, trazabilidad de proveedores |

---

## Fuentes y Referencias

- Estatuto Tributario de Colombia
- DIAN — Resoluciones de facturacion electronica
- Ley 1314 de 2009, DUR 2420 de 2015 (NIIF)
- Ley 1819 de 2016 (Impoconsumo)
- Ley 2277 de 2022 (Reforma Tributaria)
- Ley 1935 de 2018 (Propinas)
- Ley 2101 de 2021 (Jornada laboral)
- Ley 1258 de 2008 (SAS)
- Resolucion 2674 de 2013 (MinSalud — BPM)
- Resolucion 000165 de 2023 (Documento Equivalente Electronico POS)
- Acodres (Asociacion Colombiana de la Industria Gastronomica)
- Pallomaro — Costos en restaurantes
- Siigo, Alegra, Loggro, Helisa, World Office — Paginas oficiales
- La Republica, Revista La Barra — Datos sectoriales

---

> **Nota**: Las regulaciones tributarias en Colombia cambian frecuentemente. Los valores de SMMLV, UVT y calendarios de declaracion deben verificarse contra las resoluciones mas recientes de la DIAN.
