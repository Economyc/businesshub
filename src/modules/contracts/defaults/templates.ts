import type { ClauseDefinition } from '../types'
import type { ContractType } from '@/core/types'

interface DefaultTemplate {
  name: string
  contractType: ContractType
  position: string
  description: string
  clauses: ClauseDefinition[]
  isDefault: boolean
}

// ── Cláusulas obligatorias comunes (Art. 39 CST) ────────────────────

function mandatoryClauses(extras?: Partial<Record<string, string>>): ClauseDefinition[] {
  return [
    {
      id: 'clause_parties',
      title: 'PRIMERA — Identificación de las partes',
      content: `Entre {{companyName}}, identificada con NIT {{companyNit}}, con domicilio en {{companyAddress}}, representada legalmente por {{companyLegalRep}}, quien en adelante se denominará EL EMPLEADOR, y {{employeeName}}, identificado(a) con cédula de ciudadanía No. {{employeeIdentification}}, domiciliado(a) en {{employeeAddress}}, quien en adelante se denominará EL TRABAJADOR, se celebra el presente contrato de trabajo, regido por las siguientes cláusulas:`,
      isRequired: true,
      isEditable: true,
      order: 1,
      category: 'mandatory',
    },
    {
      id: 'clause_object',
      title: 'SEGUNDA — Objeto y funciones',
      content: extras?.object ?? `EL EMPLEADOR contrata los servicios personales de EL TRABAJADOR para desempeñar el cargo de {{position}}, ejecutando las funciones propias del cargo y las que le sean asignadas por su superior inmediato, de conformidad con el reglamento interno de trabajo.`,
      isRequired: true,
      isEditable: true,
      order: 2,
      category: 'mandatory',
    },
    {
      id: 'clause_workplace',
      title: 'TERCERA — Lugar de trabajo',
      content: `EL TRABAJADOR prestará sus servicios en las instalaciones ubicadas en {{companyAddress}}, en la ciudad de {{city}}. EL EMPLEADOR podrá trasladar al trabajador a otro lugar de trabajo dentro de la misma ciudad, siempre que no se cause perjuicio al trabajador.`,
      isRequired: true,
      isEditable: true,
      order: 3,
      category: 'mandatory',
    },
    {
      id: 'clause_salary',
      title: 'CUARTA — Remuneración',
      content: extras?.salary ?? `EL EMPLEADOR pagará a EL TRABAJADOR un salario mensual de {{salary}} ({{salaryWords}}), pagadero en períodos {{paymentFrequency}}. Este pago se realizará mediante transferencia bancaria a la cuenta designada por EL TRABAJADOR. EL EMPLEADOR deducirá del salario los aportes de ley correspondientes a salud (4%) y pensión (4%) a cargo del trabajador.`,
      isRequired: true,
      isEditable: true,
      order: 4,
      category: 'mandatory',
    },
    {
      id: 'clause_schedule',
      title: 'QUINTA — Jornada de trabajo',
      content: extras?.schedule ?? `La jornada de trabajo será de {{workSchedule}}, sin exceder la jornada máxima legal vigente de conformidad con la Ley 2101 de 2021 y la Ley 2466 de 2025. El trabajo suplementario o de horas extras deberá ser autorizado previamente por EL EMPLEADOR y se remunerará conforme a la ley.`,
      isRequired: true,
      isEditable: true,
      order: 5,
      category: 'mandatory',
    },
    {
      id: 'clause_duration',
      title: 'SEXTA — Duración del contrato',
      content: extras?.duration ?? `El presente contrato es a TÉRMINO INDEFINIDO y tendrá vigencia a partir del {{startDate}}. Su duración será mientras subsistan las causas que le dieron origen y la materia del trabajo, de conformidad con el artículo 47 del CST modificado por el artículo 5 de la Ley 2466 de 2025.`,
      isRequired: true,
      isEditable: true,
      order: 6,
      category: 'mandatory',
    },
    {
      id: 'clause_termination',
      title: 'SÉPTIMA — Terminación',
      content: `El presente contrato podrá darse por terminado por las causales establecidas en los artículos 61, 62 y 64 del Código Sustantivo del Trabajo. En caso de terminación unilateral sin justa causa por parte de EL EMPLEADOR, este deberá pagar las indemnizaciones establecidas en el artículo 64 del CST.`,
      isRequired: true,
      isEditable: true,
      order: 7,
      category: 'mandatory',
    },
    {
      id: 'clause_benefits',
      title: 'OCTAVA — Prestaciones sociales',
      content: `EL EMPLEADOR reconocerá y pagará a EL TRABAJADOR todas las prestaciones sociales de ley: prima de servicios, auxilio de cesantías, intereses sobre cesantías y vacaciones, en los términos y condiciones establecidos por la legislación laboral colombiana vigente.`,
      isRequired: true,
      isEditable: true,
      order: 8,
      category: 'mandatory',
    },
    {
      id: 'clause_obligations',
      title: 'NOVENA — Obligaciones del trabajador',
      content: `EL TRABAJADOR se obliga a: 1) Cumplir con las funciones asignadas con diligencia y responsabilidad. 2) Observar el reglamento interno de trabajo. 3) Guardar lealtad y reserva sobre los asuntos del empleador. 4) Conservar en buen estado los implementos de trabajo. 5) Cumplir las normas de seguridad y salud en el trabajo.`,
      isRequired: true,
      isEditable: true,
      order: 9,
      category: 'mandatory',
    },
  ]
}

// ── Cláusulas opcionales comunes ────────────────────────────────────

const clauseProbation: ClauseDefinition = {
  id: 'clause_probation',
  title: 'DÉCIMA — Periodo de prueba',
  content: `Las partes acuerdan un periodo de prueba de {{probationDays}} días, de conformidad con los artículos 76, 77 y 78 del CST. Durante este periodo, cualquiera de las partes podrá dar por terminado el contrato sin previo aviso y sin indemnización. El periodo de prueba debe constar por escrito; en caso contrario, se entiende que no existe.`,
  isRequired: false,
  isEditable: true,
  order: 10,
  category: 'optional',
}

const clauseConfidentiality: ClauseDefinition = {
  id: 'clause_confidentiality',
  title: 'DÉCIMA PRIMERA — Confidencialidad',
  content: `EL TRABAJADOR se compromete a guardar absoluta reserva sobre toda la información confidencial, secretos comerciales, procesos, recetas, listas de clientes, estrategias de negocio y demás información privilegiada a la que tenga acceso durante la vigencia del contrato. Esta obligación se extiende por un periodo de dos (2) años después de la terminación del contrato.`,
  isRequired: false,
  isEditable: true,
  order: 11,
  category: 'optional',
}

const clauseDataProtection: ClauseDefinition = {
  id: 'clause_data_protection',
  title: 'DÉCIMA SEGUNDA — Protección de datos personales',
  content: `EL TRABAJADOR autoriza a EL EMPLEADOR para el tratamiento de sus datos personales conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, para los fines propios de la relación laboral, incluyendo: nómina, seguridad social, reportes a entidades gubernamentales y procesos internos de la empresa.`,
  isRequired: false,
  isEditable: true,
  order: 12,
  category: 'optional',
}

const clauseSignature: ClauseDefinition = {
  id: 'clause_signature',
  title: 'FIRMAS',
  content: `Para constancia se firma el presente contrato en la ciudad de {{city}}, el día {{startDate}}, en dos (2) ejemplares de igual tenor, uno para cada parte.\n\n\n________________________                    ________________________\nEL EMPLEADOR                                 EL TRABAJADOR\n{{companyLegalRep}}                          {{employeeName}}\nNIT: {{companyNit}}                          C.C.: {{employeeIdentification}}`,
  isRequired: true,
  isEditable: true,
  order: 99,
  category: 'mandatory',
}

// ── Cláusulas específicas por cargo ─────────────────────────────────

const clauseFoodHandling: ClauseDefinition = {
  id: 'clause_food_handling',
  title: 'Manipulación de alimentos',
  content: `EL TRABAJADOR se compromete a mantener vigente su certificado de manipulación de alimentos conforme a la Resolución 2674 de 2013. Deberá cumplir estrictamente las Buenas Prácticas de Manufactura (BPM) y las normas de higiene del establecimiento, incluyendo el uso obligatorio de gorro, guantes y tapabocas cuando aplique.`,
  isRequired: false,
  isEditable: true,
  order: 13,
  category: 'position_specific',
}

const clauseUniform: ClauseDefinition = {
  id: 'clause_uniform',
  title: 'Dotación y uniforme',
  content: `EL EMPLEADOR proporcionará a EL TRABAJADOR la dotación de ley tres (3) veces al año (30 de abril, 31 de agosto y 20 de diciembre), consistente en un par de zapatos y un vestido de labor, de conformidad con el artículo 230 del CST. EL TRABAJADOR se obliga a usar el uniforme durante su jornada laboral.`,
  isRequired: false,
  isEditable: true,
  order: 14,
  category: 'position_specific',
}

const clauseTips: ClauseDefinition = {
  id: 'clause_tips',
  title: 'Propinas',
  content: `De conformidad con el artículo 131 del CST, las propinas recibidas por EL TRABAJADOR no constituyen salario. EL EMPLEADOR no podrá descontar las propinas del salario del trabajador ni apropiarse de las mismas. El manejo de propinas se regirá por la política interna del establecimiento.`,
  isRequired: false,
  isEditable: true,
  order: 15,
  category: 'position_specific',
}

const clauseShiftWork: ClauseDefinition = {
  id: 'clause_shift_work',
  title: 'Turnos rotativos',
  content: `EL TRABAJADOR acepta que su jornada podrá incluir turnos rotativos, trabajo en domingos y festivos, conforme a las necesidades del servicio y de acuerdo con la normativa vigente (Ley 2466 de 2025). Los recargos nocturnos, dominicales y festivos se liquidarán conforme a la ley. EL TRABAJADOR tendrá derecho al descanso compensatorio establecido en el artículo 175 del CST.`,
  isRequired: false,
  isEditable: true,
  order: 16,
  category: 'position_specific',
}

const clauseRecipes: ClauseDefinition = {
  id: 'clause_recipes',
  title: 'Propiedad intelectual — Recetas',
  content: `Todas las recetas, formulaciones, técnicas culinarias y procedimientos operativos desarrollados por EL TRABAJADOR durante la vigencia del contrato serán propiedad exclusiva de EL EMPLEADOR. EL TRABAJADOR se compromete a no reproducir, divulgar ni utilizar dichas creaciones fuera del ámbito laboral, tanto durante la vigencia del contrato como después de su terminación.`,
  isRequired: false,
  isEditable: true,
  order: 17,
  category: 'position_specific',
}

const clauseNonCompete: ClauseDefinition = {
  id: 'clause_non_compete',
  title: 'No competencia',
  content: `EL TRABAJADOR se compromete a no prestar servicios, directa o indirectamente, a empresas competidoras del mismo sector durante la vigencia del contrato y por un periodo de seis (6) meses después de su terminación. EL EMPLEADOR compensará esta restricción conforme a lo establecido por la jurisprudencia laboral colombiana.`,
  isRequired: false,
  isEditable: true,
  order: 18,
  category: 'position_specific',
}

const clauseCashHandling: ClauseDefinition = {
  id: 'clause_cash_handling',
  title: 'Manejo de caja e inventarios',
  content: `EL TRABAJADOR será responsable del manejo de caja y/o inventarios asignados. Los faltantes se manejarán conforme al procedimiento interno establecido, respetando lo dispuesto en el artículo 149 del CST que prohíbe descuentos del salario sin autorización escrita del trabajador o sin orden judicial.`,
  isRequired: false,
  isEditable: true,
  order: 19,
  category: 'position_specific',
}

// Available for future templates (e.g., Domiciliario/Repartidor)
// const clauseVehicle: ClauseDefinition = {
//   id: 'clause_vehicle', title: 'Uso de vehículo propio',
//   content: `EL TRABAJADOR utilizará su vehículo propio...`, isRequired: false, isEditable: true, order: 20, category: 'position_specific',
// }

// ── Plantillas predeterminadas ──────────────────────────────────────

export function getDefaultTemplates(): DefaultTemplate[] {
  return [
    // 1. Operativo de restaurante (mesero, auxiliar cocina, cajero)
    {
      name: 'Término Indefinido — Operativo Restaurante',
      contractType: 'indefinido',
      position: 'Mesero / Auxiliar de Cocina / Cajero',
      description: 'Contrato a término indefinido para personal operativo de restaurante. Incluye cláusulas de manipulación de alimentos, turnos rotativos, propinas y dotación.',
      isDefault: true,
      clauses: [
        ...mandatoryClauses({
          schedule: 'La jornada de trabajo será por turnos rotativos de {{workSchedule}}, que podrán incluir domingos y festivos conforme a las necesidades del servicio, sin exceder la jornada máxima legal vigente. Los recargos nocturnos (desde las 7:00 PM), dominicales y festivos se liquidarán conforme a la Ley 2466 de 2025.',
        }),
        clauseProbation,
        clauseFoodHandling,
        clauseUniform,
        clauseTips,
        clauseShiftWork,
        clauseDataProtection,
        clauseSignature,
      ],
    },

    // 2. Chef / Jefe de Cocina
    {
      name: 'Término Indefinido — Chef / Jefe de Cocina',
      contractType: 'indefinido',
      position: 'Chef / Jefe de Cocina',
      description: 'Contrato a término indefinido para chef o jefe de cocina. Incluye cláusulas de confidencialidad de recetas, propiedad intelectual y manipulación de alimentos.',
      isDefault: true,
      clauses: [
        ...mandatoryClauses({
          object: 'EL EMPLEADOR contrata los servicios personales de EL TRABAJADOR para desempeñar el cargo de {{position}}, cuyas funciones incluyen: planificación y elaboración de menús, supervisión del equipo de cocina, control de calidad de los platos, gestión de inventarios de cocina, cumplimiento de normas de higiene y BPM, y las demás funciones inherentes al cargo.',
        }),
        clauseProbation,
        clauseConfidentiality,
        clauseRecipes,
        clauseFoodHandling,
        clauseUniform,
        clauseShiftWork,
        clauseDataProtection,
        clauseSignature,
      ],
    },

    // 3. Administrador / Gerente
    {
      name: 'Término Indefinido — Administrador / Gerente',
      contractType: 'indefinido',
      position: 'Administrador / Gerente',
      description: 'Contrato a término indefinido para administrador o gerente de restaurante. Incluye cláusulas de manejo de caja, confidencialidad, no competencia y exclusividad.',
      isDefault: true,
      clauses: [
        ...mandatoryClauses({
          object: 'EL EMPLEADOR contrata los servicios personales de EL TRABAJADOR para desempeñar el cargo de {{position}}, cuyas funciones incluyen: administración general del establecimiento, gestión del personal, manejo de caja y finanzas operativas, relación con proveedores, atención al cliente, cumplimiento de normativas vigentes, y las demás funciones de dirección y confianza inherentes al cargo.',
          salary: 'EL EMPLEADOR pagará a EL TRABAJADOR un salario mensual de {{salary}} ({{salaryWords}}), pagadero en períodos {{paymentFrequency}}. Este pago se realizará mediante transferencia bancaria. Dado que el cargo es de dirección y confianza, no habrá lugar al reconocimiento de horas extras, conforme al artículo 162 del CST. EL EMPLEADOR deducirá los aportes de ley a cargo del trabajador.',
        }),
        clauseProbation,
        clauseConfidentiality,
        clauseNonCompete,
        clauseCashHandling,
        clauseDataProtection,
        clauseSignature,
      ],
    },

    // 4. Personal Administrativo
    {
      name: 'Término Indefinido — Personal Administrativo',
      contractType: 'indefinido',
      position: 'Asistente Administrativo / Auxiliar Contable',
      description: 'Contrato a término indefinido para personal administrativo. Incluye cláusulas de confidencialidad y protección de datos.',
      isDefault: true,
      clauses: [
        ...mandatoryClauses({
          schedule: 'La jornada de trabajo será de {{workSchedule}}, de lunes a viernes en horario de oficina, sin exceder la jornada máxima legal vigente. El trabajo suplementario requerirá autorización previa de EL EMPLEADOR.',
        }),
        clauseProbation,
        clauseConfidentiality,
        clauseDataProtection,
        clauseSignature,
      ],
    },

    // 5. Término Fijo — Temporal
    {
      name: 'Término Fijo — Temporal',
      contractType: 'fijo',
      position: 'General',
      description: 'Contrato a término fijo para actividades temporales, ocasionales o transitorias. Incluye fecha de terminación y condiciones de renovación conforme a la Ley 2466 de 2025.',
      isDefault: true,
      clauses: [
        ...mandatoryClauses({
          duration: 'El presente contrato es a TÉRMINO FIJO y tendrá vigencia desde el {{startDate}} hasta el {{endDate}}. De conformidad con el artículo 46 del CST modificado por la Ley 2466 de 2025, el contrato a término fijo solo procede para actividades de naturaleza ocasional, accidental o transitoria. Si ninguna de las partes da aviso por escrito con no menos de treinta (30) días de anticipación al vencimiento, el contrato se renovará automáticamente por un periodo igual. La acumulación de renovaciones no podrá exceder cuatro (4) años; superado este término, el contrato se entenderá a término indefinido.',
        }),
        clauseProbation,
        clauseDataProtection,
        clauseSignature,
      ],
    },

    // 6. Aprendizaje — SENA
    {
      name: 'Contrato de Aprendizaje — SENA',
      contractType: 'aprendizaje',
      position: 'Aprendiz SENA',
      description: 'Contrato de aprendizaje para aprendices del SENA conforme a la Ley 789 de 2002 y la Ley 2466 de 2025. Incluye apoyo de sostenimiento y seguridad social completa.',
      isDefault: true,
      clauses: [
        {
          id: 'clause_parties_apprentice',
          title: 'PRIMERA — Identificación de las partes',
          content: `Entre {{companyName}}, identificada con NIT {{companyNit}}, con domicilio en {{companyAddress}}, representada legalmente por {{companyLegalRep}}, quien en adelante se denominará LA EMPRESA PATROCINADORA, y {{employeeName}}, identificado(a) con cédula de ciudadanía No. {{employeeIdentification}}, domiciliado(a) en {{employeeAddress}}, quien en adelante se denominará EL APRENDIZ, se celebra el presente contrato de aprendizaje, de conformidad con la Ley 789 de 2002, modificada por la Ley 2466 de 2025.`,
          isRequired: true,
          isEditable: true,
          order: 1,
          category: 'mandatory',
        },
        {
          id: 'clause_object_apprentice',
          title: 'SEGUNDA — Objeto',
          content: `LA EMPRESA PATROCINADORA facilita la formación práctica de EL APRENDIZ en el cargo de {{position}}, complementando la formación teórica impartida por el Servicio Nacional de Aprendizaje (SENA) o entidad de formación autorizada.`,
          isRequired: true,
          isEditable: true,
          order: 2,
          category: 'mandatory',
        },
        {
          id: 'clause_duration_apprentice',
          title: 'TERCERA — Duración',
          content: `El presente contrato tendrá una duración acorde con el programa de formación del SENA, iniciando el {{startDate}} y con una duración máxima de dos (2) años, conforme a lo establecido en la ley.`,
          isRequired: true,
          isEditable: true,
          order: 3,
          category: 'mandatory',
        },
        {
          id: 'clause_support_apprentice',
          title: 'CUARTA — Apoyo de sostenimiento',
          content: `De conformidad con la Ley 2466 de 2025, LA EMPRESA PATROCINADORA pagará a EL APRENDIZ un apoyo de sostenimiento equivalente al 100% del Salario Mínimo Mensual Legal Vigente (SMMLV) durante la fase práctica. Durante la fase lectiva, el apoyo será conforme a lo establecido por la ley vigente.`,
          isRequired: true,
          isEditable: true,
          order: 4,
          category: 'mandatory',
        },
        {
          id: 'clause_social_security_apprentice',
          title: 'QUINTA — Seguridad social',
          content: `Conforme a la Ley 2466 de 2025, LA EMPRESA PATROCINADORA afiliará a EL APRENDIZ al Sistema de Seguridad Social Integral: salud, pensión y riesgos laborales (ARL), asumiendo la totalidad de los aportes correspondientes durante la fase práctica.`,
          isRequired: true,
          isEditable: true,
          order: 5,
          category: 'mandatory',
        },
        {
          id: 'clause_obligations_apprentice',
          title: 'SEXTA — Obligaciones del aprendiz',
          content: `EL APRENDIZ se obliga a: 1) Cumplir con el programa de formación del SENA. 2) Asistir puntualmente a las actividades formativas y prácticas. 3) Cumplir el reglamento interno de la empresa. 4) Guardar reserva sobre información confidencial. 5) Presentar las evaluaciones requeridas por la entidad de formación.`,
          isRequired: true,
          isEditable: true,
          order: 6,
          category: 'mandatory',
        },
        clauseFoodHandling,
        clauseDataProtection,
        clauseSignature,
      ],
    },
  ]
}
