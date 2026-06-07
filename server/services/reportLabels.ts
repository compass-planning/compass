/**
 * server/services/reportLabels.ts
 * EN/FR label maps for all report sections.
 * Pass locale ("en" | "fr") to getLabels() and destructure what you need.
 */

export type ReportLocale = "en" | "fr";

const labels = {
  en: {
    // Cover / meta
    confidential:       "Confidential",
    preparedFor:        "Prepared for",
    preparedBy:         "Prepared by",
    financialAdvisor:   "Financial Advisor",
    generatedOn:        "Generated on",
    pageOf:             "Page",
    of:                 "of",

    // Report titles
    comprehensivePlan:  "Comprehensive Financial Plan",
    retirementReport:   "Retirement Projection Report",
    netWorthStatement:  "Net Worth Statement",
    insuranceReport:    "Insurance Needs Analysis",
    cashFlowReport:     "Cash Flow Analysis",
    taxReport:          "Tax Strategy Report",
    estateReport:       "Estate Planning Summary",
    goalReport:         "Goal Status Report",
    onePage:            "One-Page Financial Plan",

    // Section headings
    executiveSummary:   "Executive Summary",
    netWorth:           "Net Worth",
    assets:             "Assets",
    liabilities:        "Liabilities",
    retirement:         "Retirement Planning",
    insurance:          "Insurance & Protection",
    taxPlanning:        "Tax Planning",
    estatePlanning:     "Estate Planning",
    education:          "Education Planning",
    goals:              "Goals",
    cashFlow:           "Cash Flow",
    debt:               "Debt Management",
    recommendations:    "Recommendations",
    priorityActions:    "Priority Actions",
    actionItems:        "Action Items",
    disclaimer:         "Disclaimer",

    // Net worth labels
    totalAssets:        "Total Assets",
    totalLiabilities:   "Total Liabilities",
    totalNetWorth:      "Total Net Worth",
    realEstate:         "Real Estate",
    investments:        "Investments",
    rrsp:               "RRSP",
    tfsa:               "TFSA",
    pension:            "Pension",
    bankAccounts:       "Bank Accounts",
    mortgage:           "Mortgage",
    carLoans:           "Car Loans",
    creditCards:        "Credit Cards",
    otherDebt:          "Other Debt",

    // Retirement labels
    currentAge:         "Current Age",
    retirementAge:      "Retirement Age",
    lifeExpectancy:     "Life Expectancy",
    desiredIncome:      "Desired Retirement Income",
    projectedIncome:    "Projected Retirement Income",
    successRate:        "Monte Carlo Success Rate",
    rrspBalance:        "RRSP Balance",
    tfsaBalance:        "TFSA Balance",
    cpp:                "CPP Benefit",
    oas:                "OAS Benefit",
    pensionIncome:      "Pension Income",
    annualContribution: "Annual Contribution",
    yearsToRetirement:  "Years to Retirement",
    inflationRate:      "Inflation Rate",

    // Insurance labels
    lifeInsurance:      "Life Insurance",
    disability:         "Disability Insurance",
    criticalIllness:    "Critical Illness",
    totalNeed:          "Total Insurance Need",
    existingCoverage:   "Existing Coverage",
    coverageGap:        "Coverage Gap",
    incomeReplacement:  "Income Replacement",
    finalExpenses:      "Final Expenses",
    emergencyFund:      "Emergency Fund",
    mortgageBalance:    "Mortgage Balance",

    // Goals
    goal:               "Goal",
    targetAmount:       "Target Amount",
    currentSavings:     "Current Savings",
    targetDate:         "Target Date",
    monthlyContrib:     "Monthly Contribution",
    onTrack:            "On Track",
    atRisk:             "At Risk",
    behind:             "Behind",
    completed:          "Completed",

    // Common
    primary:            "Primary",
    spouse:             "Spouse",
    joint:              "Joint",
    annual:             "Annual",
    monthly:            "Monthly",
    total:              "Total",
    balance:            "Balance",
    rate:               "Rate",
    years:              "years",
    yes:                "Yes",
    no:                 "No",
    na:                 "N/A",
    high:               "High",
    medium:             "Medium",
    low:                "Low",
  },

  fr: {
    // Cover / meta
    confidential:       "Confidentiel",
    preparedFor:        "Préparé pour",
    preparedBy:         "Préparé par",
    financialAdvisor:   "Conseiller financier",
    generatedOn:        "Généré le",
    pageOf:             "Page",
    of:                 "de",

    // Report titles
    comprehensivePlan:  "Plan financier complet",
    retirementReport:   "Rapport de projection de retraite",
    netWorthStatement:  "État de la valeur nette",
    insuranceReport:    "Analyse des besoins en assurance",
    cashFlowReport:     "Analyse des flux de trésorerie",
    taxReport:          "Rapport de stratégie fiscale",
    estateReport:       "Résumé de planification successorale",
    goalReport:         "Rapport sur l'état des objectifs",
    onePage:            "Plan financier en une page",

    // Section headings
    executiveSummary:   "Résumé exécutif",
    netWorth:           "Valeur nette",
    assets:             "Actifs",
    liabilities:        "Passifs",
    retirement:         "Planification de la retraite",
    insurance:          "Assurance et protection",
    taxPlanning:        "Planification fiscale",
    estatePlanning:     "Planification successorale",
    education:          "Planification de l'éducation",
    goals:              "Objectifs",
    cashFlow:           "Flux de trésorerie",
    debt:               "Gestion des dettes",
    recommendations:    "Recommandations",
    priorityActions:    "Actions prioritaires",
    actionItems:        "Éléments d'action",
    disclaimer:         "Avis de non-responsabilité",

    // Net worth labels
    totalAssets:        "Total des actifs",
    totalLiabilities:   "Total des passifs",
    totalNetWorth:      "Valeur nette totale",
    realEstate:         "Immobilier",
    investments:        "Placements",
    rrsp:               "REER",
    tfsa:               "CELI",
    pension:            "Régime de retraite",
    bankAccounts:       "Comptes bancaires",
    mortgage:           "Hypothèque",
    carLoans:           "Prêts automobiles",
    creditCards:        "Cartes de crédit",
    otherDebt:          "Autres dettes",

    // Retirement labels
    currentAge:         "Âge actuel",
    retirementAge:      "Âge de la retraite",
    lifeExpectancy:     "Espérance de vie",
    desiredIncome:      "Revenu de retraite souhaité",
    projectedIncome:    "Revenu de retraite projeté",
    successRate:        "Taux de réussite Monte-Carlo",
    rrspBalance:        "Solde REER",
    tfsaBalance:        "Solde CELI",
    cpp:                "Prestation RPC",
    oas:                "Prestation SV",
    pensionIncome:      "Revenu de retraite",
    annualContribution: "Cotisation annuelle",
    yearsToRetirement:  "Années avant la retraite",
    inflationRate:      "Taux d'inflation",

    // Insurance labels
    lifeInsurance:      "Assurance vie",
    disability:         "Assurance invalidité",
    criticalIllness:    "Maladie grave",
    totalNeed:          "Besoin total en assurance",
    existingCoverage:   "Couverture existante",
    coverageGap:        "Écart de couverture",
    incomeReplacement:  "Remplacement du revenu",
    finalExpenses:      "Frais finaux",
    emergencyFund:      "Fonds d'urgence",
    mortgageBalance:    "Solde hypothécaire",

    // Goals
    goal:               "Objectif",
    targetAmount:       "Montant cible",
    currentSavings:     "Épargne actuelle",
    targetDate:         "Date cible",
    monthlyContrib:     "Cotisation mensuelle",
    onTrack:            "Sur la bonne voie",
    atRisk:             "À risque",
    behind:             "En retard",
    completed:          "Complété",

    // Common
    primary:            "Principal",
    spouse:             "Conjoint(e)",
    joint:              "Conjoint",
    annual:             "Annuel",
    monthly:            "Mensuel",
    total:              "Total",
    balance:            "Solde",
    rate:               "Taux",
    years:              "ans",
    yes:                "Oui",
    no:                 "Non",
    na:                 "S/O",
    high:               "Élevé",
    medium:             "Moyen",
    low:                "Faible",
  },
} as const;

export type ReportLabels = Record<string, string>;

export function getLabels(locale: ReportLocale = "en"): ReportLabels {
  return labels[locale] ?? labels.en;
}
