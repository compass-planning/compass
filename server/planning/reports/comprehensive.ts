// server/planning/reports/comprehensive.ts
import type { ComprehensiveReportInputs, RetirementProjection, TaxProjection, RrspAnalysis, TfsaAnalysis, CapitalGainsAnalysis, IncomeSplittingAnalysis, InsuranceAnalysis, EducationAnalysis, EstateAnalysis, DebtAnalysis } from "../types.js";
import { REPORT_CSS } from "./styles.js";
import { coverPage, pageHeader, pageFooter, sectionHeader, metricGrid, dataTable, recommendationList, callout, progressBar, twoCol, divider, badge, barChart, lineChart, donutChart, fmt } from "./components.js";
import { PROVINCE_NAMES } from "../data/taxData2024.js";

// ── Bilingual labels ──────────────────────────────────────────────────────────
function getL(locale?: string) {
  const fr = locale === "fr";
  return {
    // Section headers
    s1Title:   fr ? "Planification retraite" : "Retirement Planning",
    s1Sub:     (age: number, prov: string) => fr ? `Projection à l'âge ${age} — ${prov}` : `Projection to age ${age} — ${prov}`,
    s2Title:   fr ? "Planification fiscale" : "Tax Planning",
    s2Sub:     (yr: number, prov: string) => fr ? `Année fiscale ${yr} — ${prov}` : `${yr} Tax Year — ${prov}`,
    s2Recs:    fr ? "Recommandations fiscales" : "Tax Planning Recommendations",
    s3Title:   fr ? "Analyse REER" : "RRSP Analysis",
    s3Sub:     (yr: number) => fr ? `Année fiscale ${yr}` : `Tax Year ${yr}`,
    s4Title:   fr ? "Analyse CELI" : "TFSA Analysis",
    s4Sub:     fr ? "Droits à vie depuis 2009" : "Lifetime room since 2009",
    s5Title:   fr ? "Gains en capital" : "Capital Gains",
    s5Sub:     (yr: number) => fr ? `Année fiscale ${yr}` : `Tax Year ${yr}`,
    s6Title:   fr ? "Fractionnement du revenu" : "Income Splitting",
    s6Sub:     fr ? "Pension T1032 et REER de conjoint" : "T1032 Pension Splitting & Spousal RRSP",
    s7Title:   fr ? "Besoins d'assurance" : "Insurance Needs",
    s7Sub:     fr ? "Vie, invalidité et maladies graves" : "Life, Disability & Critical Illness",
    s8Title:   fr ? "Planification études" : "Education Planning",
    s8Sub:     fr ? "SCEE, BEC et projection" : "CESG, CLB & Projection",
    s9Title:   fr ? "Planification successorale" : "Estate Planning",
    s9Sub:     (prov: string) => fr ? `Province : ${prov}` : `Province: ${prov}`,
    s10Title:  fr ? "Dettes et flux de trésorerie" : "Debt & Cash Flow",
    s10Sub:    fr ? "Stratégie de remboursement et budget" : "Debt Payoff Strategy & Monthly Budget",
    snwTitle:  fr ? "Valeur nette" : "Net Worth",
    snwSub:    fr ? "Valeur nette et répartition des actifs" : "Net Worth & Asset Allocation",
    scfTitle:  fr ? "Flux de trésorerie" : "Cash Flow",
    scfSub:    fr ? "Flux de trésorerie mensuel et budget" : "Monthly Cash Flow & Budget",
    sgoTitle:  fr ? "Objectifs financiers" : "Financial Goals",
    sgoSub:    (n: number, date: string) => fr ? `${n} objectifs — au ${date}` : `${n} goals — as of ${date}`,
    // Page headers
    ph1: fr ? "Planification retraite" : "Retirement Planning",
    ph2: fr ? "Planification fiscale" : "Tax Planning",
    ph3: fr ? "Analyse REER" : "RRSP Analysis",
    ph4: fr ? "Analyse CELI" : "TFSA Analysis",
    ph5: fr ? "Gains en capital" : "Capital Gains",
    ph6: fr ? "Fractionnement du revenu" : "Income Splitting",
    ph7: fr ? "Besoins d'assurance" : "Insurance Needs",
    ph8: fr ? "Planification études" : "Education Planning",
    ph9: fr ? "Planification successorale" : "Estate Planning",
    ph10:fr ? "Dettes et flux de trésorerie" : "Debt & Cash Flow",
    phNW:fr ? "Bilan" : "Net Worth Statement",
    phCF:fr ? "Flux de trésorerie" : "Cash Flow",
    phGO:fr ? "Objectifs financiers" : "Financial Goals",
    // Metric labels — Retirement
    retAge:       fr ? "Âge de retraite" : "Retirement Age",
    retAway:      (y: number) => fr ? `dans ${y} ans` : `${y} years away`,
    retSavings:   fr ? "Épargne à la retraite" : "Savings at Retirement",
    retIncome:    fr ? "Revenu désiré" : "Income Goal",
    retToday:     fr ? "Dollars d'aujourd'hui" : "Today's dollars",
    retSuccess:   fr ? "Probabilité de succès" : "Success Probability",
    retDepletes:  (a: number) => fr ? `<span class="text-red">Épuisé à ${a} ans</span>` : `<span class="text-red">Depletes at age ${a}</span>`,
    retSurvives:  (a: number) => fr ? `<span class="text-green">Subsiste jusqu'à ${a} ans</span>` : `<span class="text-green">Survives to age ${a}</span>`,
    rrspRet:      fr ? "REER à la retraite" : "RRSP at Retirement",
    tfsaRet:      fr ? "CELI à la retraite" : "TFSA at Retirement",
    nonRegRet:    fr ? "Non imm. à la retraite" : "Non-Reg at Retirement",
    cppBen:       fr ? "Prestation RPC" : "CPP Benefit",
    oasBen:       fr ? "Prestation SV" : "OAS Benefit",
    dbPension:    fr ? "Pension PD" : "DB Pension",
    defBen:       fr ? "Prestations déterminées" : "Defined benefit",
    cppStart:     (a: number) => fr ? `Début à ${a} ans` : `Starting age ${a}`,
    retSrcChart:  fr ? "Sources de revenu retraite" : "Retirement Income Sources",
    portChart:    fr ? "Évolution du portefeuille" : "Portfolio Balance Over Time",
    cppCallout:   (a: number, amt: string, be: number) => fr
      ? `<strong>Timing RPC :</strong> Commencer le RPC à ${a} ans donne ${amt}/mois. Le seuil de rentabilité vs. commencer à 65 ans est environ ${be} ans.`
      : `<strong>CPP Timing:</strong> Starting CPP at age ${a} gives ${amt}/month. Break-even vs. starting at 65 is approximately age ${be}.`,
    oasCallout:   (be: number) => fr
      ? `&nbsp;<strong>Timing SV :</strong> Seuil de rentabilité vs. commencer à 65 ans est environ ${be} ans.`
      : `&nbsp;<strong>OAS Timing:</strong> Break-even vs. starting at 65 is approximately age ${be}.`,
    rrspTfsa:     (rat: string) => fr
      ? `<strong>Stratégie REER/CELI :</strong> ${rat}`
      : `<strong>RRSP vs. TFSA Strategy:</strong> ${rat}`,
    retTable:     fr ? "Projection annuelle (toutes les 5 ans)" : "Year-by-Year Projection (Every 5 Years)",
    colAge:       fr ? "Âge" : "Age",
    colYear:      fr ? "Année" : "Year",
    colRrsp:      fr ? "REER/FERR" : "RRSP/RRIF",
    colTfsa:      fr ? "CELI" : "TFSA",
    colNonReg:    fr ? "Non imm." : "Non-Reg",
    colTotal:     fr ? "Portefeuille total" : "Total Portfolio",
    colWithdraw:  fr ? "Retrait" : "Withdrawal",
    colIncome:    fr ? "Revenu brut" : "Gross Income",
    retShortfall: (amt: string) => fr
      ? `<strong>Action requise :</strong> Déficit de revenu projeté de ${amt}/an à la retraite. Augmentez l'épargne ou ajustez l'âge de retraite.`
      : `<strong>Action Required:</strong> Projected annual retirement income shortfall of ${amt}. Consider increasing annual savings or adjusting the retirement age.`,
    retSurplus:   (amt: string) => fr
      ? `<strong>En bonne voie :</strong> Le portefeuille projette un surplus de ${amt}/an à la retraite.`
      : `<strong>On Track:</strong> Current savings trajectory projects a surplus of ${amt} annually in retirement.`,
    // Tax
    grossIncome:  fr ? "Revenu brut" : "Gross Income",
    taxableInc:   fr ? "Revenu imposable" : "Taxable Income",
    totalTax:     fr ? "Impôt total" : "Total Tax",
    afterTax:     fr ? "Revenu après impôt" : "After-Tax Income",
    effRate:      fr ? "Taux effectif" : "Effective Rate",
    effSub:       fr ? "Impôt total / revenu brut" : "Total tax / gross income",
    margRate:     fr ? "Taux marginal" : "Marginal Rate",
    margSub:      fr ? "Fédéral + provincial" : "Federal + provincial",
    fedTax:       fr ? "Impôt fédéral" : "Federal Tax",
    provTax:      fr ? "Impôt provincial" : "Provincial Tax",
    taxBreakdown: fr ? "Ventilation de l'impôt" : "Tax Breakdown",
    cpp:          fr ? "RPC" : "CPP",
    ei:           fr ? "AE" : "EI",
    bracketTable: fr ? "Tranches d'imposition fédérales" : "Federal Tax Bracket Breakdown",
    colBracket:   fr ? "Tranche" : "Bracket",
    colRate:      fr ? "Taux" : "Rate",
    colInBracket: fr ? "Revenu dans la tranche" : "Income in Bracket",
    colTaxInBrk:  fr ? "Impôt dans la tranche" : "Tax in Bracket",
    colCumul:     fr ? "Impôt cumulatif" : "Cumulative Tax",
    fiveYearProj: fr ? "Projection fiscale 5 ans (croissance 2 %/an)" : "5-Year Tax Projection (2% Annual Income Growth)",
    colProjInc:   fr ? "Revenu projeté" : "Projected Income",
    colProjTax:   fr ? "Impôt projeté" : "Projected Tax",
    // RRSP
    availRoom:    fr ? "Droits disponibles" : "Available Room",
    newRoom:      fr ? "Nouveaux droits cette année" : "New Room This Year",
    taxRefund:    fr ? "Remb. d'impôt au taux marginal" : "Tax Refund @ Marginal",
    effCost:      fr ? "Coût effectif" : "Effective Cost",
    afterRefund:  fr ? "Après remboursement d'impôt" : "After tax refund",
    projRet:      fr ? "Projection à la retraite" : "Projected at Retirement",
    annWithdraw:  fr ? "Retrait annuel (4 %)" : "Annual Withdrawal (4%)",
    yearsGrowth:  fr ? "Années de croissance" : "Years of Growth",
    maxBy:        fr ? "Maximiser les droits avant" : "Maximize Room by",
    rrspChart:    fr ? "Projection REER" : "RRSP Balance Projection",
    cumContrib:   fr ? "Cotisations cumulatives" : "Cumulative Contributions",
    rrspTable:    fr ? "Projection de croissance REER" : "RRSP Growth Projection",
    colOpen:      fr ? "Solde ouverture" : "Opening Balance",
    colContrib:   fr ? "Cotisation" : "Contribution",
    colGrowth:    fr ? "Croissance" : "Growth",
    colClose:     fr ? "Solde clôture" : "Closing Balance",
    colRefund:    fr ? "Remb. impôt" : "Tax Refund",
    hbpLlp:       (hbp: string, llp: string) => fr
      ? `<strong>RAP :</strong> Les acheteurs d'une première maison peuvent retirer jusqu'à ${hbp} du REER en franchise d'impôt, remboursable sur 15 ans. &nbsp;<strong>REEP :</strong> Jusqu'à ${llp} pour les études à temps plein, remboursable sur 10 ans.`
      : `<strong>Home Buyers Plan (HBP):</strong> First-time homebuyers may withdraw up to ${hbp} from their RRSP tax-free, repayable over 15 years. &nbsp;<strong>Lifelong Learning Plan (LLP):</strong> Up to ${llp} for full-time education, repayable over 10 years.`,
    // TFSA
    lifetimeRoom: fr ? "Droits à vie à ce jour" : "Lifetime Room to Date",
    availNow:     fr ? "Droits disponibles" : "Available Room Now",
    annLimit:     fr ? "Plafond annuel 2024" : "2024 Annual Limit",
    withdRoom:    fr ? "Droits récupérés" : "Withdrawal Room Recovered",
    bal10:        fr ? "Solde dans 10 ans" : "Balance in 10 Years",
    bal20:        fr ? "Solde dans 20 ans" : "Balance in 20 Years",
    balRet:       fr ? "Solde à la retraite" : "Balance at Retirement",
    optWithd:     fr ? "Âge retrait optimal" : "Optimal Withdrawal Age",
    tfsaChart:    fr ? "CELI vs. compte taxable — avantage non imposable" : "TFSA vs. Taxable Account — Tax-Free Advantage",
    taxable:      fr ? "Compte taxable" : "Taxable Account",
    tfsaAdv:      fr ? "Avantage CELI" : "TFSA Advantage",
    tfsaTable:    fr ? "Projection de croissance CELI" : "TFSA Growth Projection",
    colAnnLim:    fr ? "Plafond annuel" : "Annual Limit",
    colCumRoom:   fr ? "Droits cumulatifs" : "Cumulative Room",
    // Capital Gains
    totalGain:    fr ? "Gain total" : "Total Gain",
    taxableGain:  fr ? "Gain imposable" : "Taxable Gain",
    taxOnGains:   fr ? "Impôt sur les gains" : "Total Tax on Gains",
    effOnGains:   fr ? "Taux effectif sur les gains" : "Effective Rate on Gains",
    inclUnder:    fr ? "Taux d'inclusion (< 250 k$)" : "Inclusion Rate (under $250k)",
    inclOver:     fr ? "Taux d'inclusion (> 250 k$)" : "Inclusion Rate (over $250k)",
    lcgeRem:      fr ? "EXSATG restant" : "LCGE Remaining",
    lossesAppl:   fr ? "Pertes appliquées" : "Losses Applied",
    disposalTbl:  fr ? "Détail des dispositions" : "Disposal Breakdown",
    colAsset:     fr ? "Actif" : "Asset",
    colProceeds:  fr ? "Produit" : "Proceeds",
    colAcb:       fr ? "PBR" : "ACB",
    colGain:      fr ? "Gain" : "Gain",
    colTaxCol:    fr ? "Impôt" : "Tax",
    timingStrat:  fr ? "Stratégies de synchronisation" : "Timing Strategies",
    harvestOpp:   fr ? "Opportunités de récolte des pertes" : "Harvesting Opportunities",
    // Income Splitting
    currCombTax:  fr ? "Impôt combiné actuel" : "Current Combined Tax",
    afterSplit:   fr ? "Impôt après fractionnement" : "After Splitting Tax",
    annSaving:    fr ? "Économie annuelle d'impôt" : "Annual Tax Saving",
    lifeSaving:   fr ? "Économie à vie" : "Lifetime Tax Saving",
    splitTable:   fr ? "Avant et après fractionnement" : "Before vs. After Income Splitting",
    colTaxpayer:  fr ? "Contribuable" : "Taxpayer",
    colBefTax:    fr ? "Avant : Impôt" : "Before: Tax",
    colBefEff:    fr ? "Avant : Taux eff." : "Before: Eff. Rate",
    colAftTax:    fr ? "Après : Impôt" : "After: Tax",
    colAftEff:    fr ? "Après : Taux eff." : "After: Eff. Rate",
    colSaving:    fr ? "Économie" : "Saving",
    primary:      fr ? "(Principal)" : "(Primary)",
    spouse:       fr ? "Conjoint(e)" : "Spouse",
    combined:     fr ? "Combiné" : "Combined",
    availStrat:   fr ? "Stratégies disponibles" : "Available Strategies",
    eligible:     fr ? "ADMISSIBLE" : "ELIGIBLE",
    notElig:      fr ? "NON ADMISSIBLE" : "NOT ELIGIBLE",
    annSavingTxt: (amt: string, act: string) => fr ? `Économie annuelle : ${amt} — ${act}` : `Annual saving: ${amt} — ${act}`,
    spousalRrsp:  (pct: string, rat: string) => fr
      ? `Cotiser à un REER de conjoint économise ${pct} sur les retraits. ${rat}`
      : `Contributing to a spousal RRSP saves ${pct} on withdrawals. ${rat}`,
    // Insurance
    lifeGap:      fr ? "Écart assurance vie" : "Life Insurance Gap",
    recCoverage:  fr ? "Couverture recommandée" : "Recommended Coverage",
    diGap:        fr ? "Écart invalidité (mensuel)" : "Disability Gap (Monthly)",
    ciGap:        fr ? "Écart maladies graves" : "Critical Illness Gap",
    dimeTable:    fr ? "Besoins en assurance vie — méthode DIME" : "Life Insurance Needs — DIME Method",
    colComponent: fr ? "Composante" : "Component",
    colAmtCol:    fr ? "Montant" : "Amount",
    colNotes:     fr ? "Notes" : "Notes",
    dimeDebt:     fr ? "Dettes (D)" : "Debt (D)",
    dimeDebtN:    fr ? "Total passif + frais funéraires" : "Total liabilities + final expenses",
    dimeIncome:   fr ? "Remplacement revenu (I)" : "Income Replacement (I)",
    dimeIncomeN:  (y: number) => fr ? `${y} années de revenu` : `${y} years income replacement`,
    dimeMortgage: fr ? "Hypothèque (M)" : "Mortgage (M)",
    dimeMortN:    fr ? "Solde hypothécaire" : "Outstanding mortgage balance",
    dimeEduc:     fr ? "Éducation (E)" : "Education (E)",
    dimeEducN:    fr ? "Frais d'études des enfants" : "Children's education costs",
    dimeTotalN:   fr ? "Besoin DIME total" : "Total DIME Need",
    dimeExist:    fr ? "Moins : couverture existante" : "Less: Existing Coverage",
    dimeExistN:   fr ? "Assurance vie + actifs liquides" : "Life insurance + liquid assets",
    coverageGap:  fr ? "Écart de couverture" : "Coverage Gap",
    hlvValue:     fr ? "Valeur capital humain" : "Human Life Value",
    hlvGap:       fr ? "Écart VCH" : "HLV Gap",
    needsBased:   fr ? "Besoin selon les besoins" : "Needs-Based Requirement",
    needsGap:     fr ? "Écart selon les besoins" : "Needs-Based Gap",
    diCiTable:    fr ? "Invalidité et maladies graves" : "Disability & Critical Illness",
    colCovType:   fr ? "Type de couverture" : "Coverage Type",
    colMonthNeed: fr ? "Besoin mensuel" : "Monthly Need",
    colExisting:  fr ? "Existant" : "Existing",
    colGapCol:    fr ? "Écart" : "Gap",
    colEstPrem:   fr ? "Prime estimée" : "Est. Premium",
    ltdLabel:     fr ? "Invalidité longue durée" : "Long-term Disability",
    ciLabel:      fr ? "Maladies graves (capital fixe)" : "Critical Illness (Lump Sum)",
    // Education
    totalCesg:    fr ? "Total SCEE reçu" : "Total CESG Received",
    projResp:     fr ? "Valeur REEE projetée" : "Projected RESP Value",
    estEdCost:    fr ? "Coût études estimé" : "Estimated Education Cost",
    surpShort:    fr ? "Surplus / Déficit" : "Surplus / Shortfall",
    respAge:      (name: string, age: number) => fr ? `${name} (${age} ans)` : `${name} (Age ${age})`,
    projRespC:    fr ? "REEE projeté" : "Projected RESP",
    educCost:     fr ? "Coût études" : "Education Cost",
    totalCesgC:   fr ? "SCEE total" : "Total CESG",
    respTable:    (name: string) => fr ? `${name} — Croissance REEE` : `${name} — RESP Growth`,
    colCesg:      fr ? "SCEE" : "CESG",
    // Estate
    grossEstate:  fr ? "Actif successoral brut" : "Gross Estate",
    netEstate:    fr ? "Actif successoral net" : "Net Estate",
    taxOnDeath:   fr ? "Impôt estimé au décès" : "Estimated Tax on Death",
    estateAfter:  fr ? "Succession après impôt" : "Estate After Tax & Probate",
    probateFees:  fr ? "Frais d'homologation" : "Probate Fees",
    bypassProb:   fr ? "Actifs hors homologation" : "Assets Bypassing Probate",
    rrspTax:      fr ? "Impôt REER/FERR au décès" : "RRSP/RRIF Tax on Death",
    cgTaxDeath:   fr ? "Impôt gains cap. au décès" : "Capital Gains Tax on Death",
    estateDist:   fr ? "Répartition de la succession" : "Estate Distribution Overview",
    toSpouse:     fr ? "Au conjoint" : "To Spouse",
    estateNet:    fr ? "Succession (nette)" : "Estate (Net)",
    docChecklist: fr ? "Liste de contrôle des documents" : "Document Status Checklist",
    inPlace:      fr ? "EN PLACE" : "IN PLACE",
    missing:      fr ? "MANQUANT" : "MISSING",
    liquidityCall:(amt: string, ins: string) => fr
      ? `<strong>Liquidités successorales requises :</strong> ${amt} nécessaires pour couvrir les impôts et frais. ${ins}`
      : `<strong>Estate Liquidity Needed:</strong> ${amt} required to cover taxes and probate fees on death. ${ins}`,
    insRecommend: (amt: string) => fr
      ? `Une assurance vie de ${amt} est recommandée pour fournir des liquidités non imposables.`
      : `A life insurance policy of ${amt} is recommended to provide tax-free liquidity.`,
    sufficientLiq:fr ? "Les actifs actuels fournissent des liquidités suffisantes." : "Current assets provide sufficient liquidity.",
    // Debt
    totalDebt:    fr ? "Dettes totales" : "Total Debt",
    monthlySurp:  fr ? "Surplus/Déficit mensuel" : "Monthly Surplus/Deficit",
    savingsRate:  fr ? "Taux d'épargne" : "Savings Rate",
    debtFreeDate: fr ? "Date sans dettes" : "Debt-Free Date",
    dsr:          fr ? "Ratios d'endettement" : "Debt Service Ratios",
    gdsr:         fr ? "ABD (max 32 %)" : "GDSR (max 32%)",
    tdsr:         fr ? "ATD (max 44 %)" : "TDSR (max 44%)",
    gdsr2:        fr ? "ABD" : "GDSR",
    gdsrSub:      fr ? "Max 32 % recommandé" : "Max 32% recommended",
    tdsr2:        fr ? "ATD" : "TDSR",
    tdsrSub:      fr ? "Max 44 % (limite prêteur)" : "Max 44% (lender limit)",
    emergFund:    fr ? "Fonds d'urgence" : "Emergency Fund",
    emergStatus:  fr ? "Statut" : "Status",
    adequate:     fr ? "adéquat" : "adequate",
    threeSix:     fr ? "Couverture 3-6 mois" : "3-6 months covered",
    belowTarget:  fr ? "Sous l'objectif de 3 mois" : "Below 3-month target",
    budgetTable:  fr ? "Budget mensuel" : "Monthly Cash Flow Budget",
    colCategory:  fr ? "Catégorie" : "Category",
    colMonthly:   fr ? "Mensuel" : "Monthly Amount",
    colAnnual:    fr ? "Annuel" : "Annual",
    colPctInc:    fr ? "% du revenu net" : "% of Net Income",
    grossIncRow:  fr ? "Revenu brut" : "Gross Income",
    lessTax:      fr ? "Moins : Impôts" : "Less: Taxes",
    netIncRow:    fr ? "Revenu net" : "Net Income",
    housing:      fr ? "Logement" : "Housing",
    transport:    fr ? "Transport" : "Transportation",
    food:         fr ? "Alimentation" : "Food",
    debtPay:      fr ? "Remboursement dettes" : "Debt Payments",
    savings:      fr ? "Épargne" : "Savings",
    discret:      fr ? "Discrétionnaire" : "Discretionary",
    monthSurp:    fr ? "Surplus mensuel" : "Monthly Surplus",
    avalancheTable:(saved: string) => fr
      ? `Remboursement dettes — méthode avalanche (économise ${saved} vs. boule de neige)`
      : `Debt Payoff — Avalanche Method (Saves ${saved} vs Snowball)`,
    colPriority:  fr ? "Priorité" : "Priority",
    colDebt:      fr ? "Dette" : "Debt",
    colBalance:   fr ? "Solde" : "Balance",
    colMinPay:    fr ? "Paiement min." : "Min Payment",
    colPayoffDt:  fr ? "Date remb." : "Payoff Date",
    colTotalInt:  fr ? "Intérêts totaux" : "Total Interest",
    // Net Worth
    totalAssets:  fr ? "Total actifs" : "Total Assets",
    totalLiabs:   fr ? "Total passifs" : "Total Liabilities",
    netWorthLbl:  fr ? "Valeur nette" : "Net Worth",
    assetCount:   (n: number) => fr ? `${n} actifs` : `${n} assets`,
    assetsTable:  fr ? "Actifs" : "Assets",
    liabsTable:   fr ? "Passifs" : "Liabilities",
    colDesc:      fr ? "Description" : "Description",
    colOwner:     fr ? "Titulaire" : "Owner",
    colValue:     fr ? "Valeur" : "Value",
    ownerPrimary: fr ? "Principal" : "Primary",
    ownerSpouse:  fr ? "Conjoint(e)" : "Spouse",
    ownerJoint:   fr ? "Conjoint" : "Joint",
    allocationChart: fr ? "Répartition des actifs par catégorie" : "Asset Allocation by Category",
    // Cash Flow
    monthlyInc:   fr ? "Revenu mensuel" : "Monthly Income",
    monthlyExp:   fr ? "Dépenses mensuelles" : "Monthly Expenses",
    annualExp:    fr ? "Dépenses annuelles" : "Annual Expenses",
    monthlySurp2: fr ? "Surplus mensuel" : "Monthly Surplus",
    expTable:     fr ? "Dépenses mensuelles" : "Monthly Expenses",
    colExpCat:    fr ? "Catégorie" : "Category",
    colExpDesc:   fr ? "Description" : "Description",
    colExpMo:     fr ? "Mensuel" : "Monthly",
    colExpAnn:    fr ? "Annuel" : "Annual",
    noExpenses:   fr ? "Aucune dépense. Ajoutez des dépenses dans l'onglet Flux de trésorerie." : "No expense entries found. Add expenses in the Cash Flow tab.",
    spendChart:   fr ? "Dépenses par catégorie" : "Spending by Category",
    // Goals
    totalGoals:   fr ? "Total objectifs" : "Total Goals",
    activeGoals:  fr ? "Actifs" : "Active",
    completedGoals:fr? "Complétés" : "Completed",
    totalTarget:  fr ? "Cible totale" : "Total Target",
    goalsSummary: fr ? "Résumé des objectifs" : "Goals Summary",
    colGoal:      fr ? "Objectif" : "Goal",
    colType:      fr ? "Type" : "Type",
    colTargetAmt: fr ? "Montant cible" : "Target Amount",
    colTargetYr:  fr ? "Année cible" : "Target Year",
    colPriorityG: fr ? "Priorité" : "Priority",
    colStatusG:   fr ? "Statut" : "Status",
    noGoals:      fr ? "Aucun objectif. Ajoutez des objectifs dans l'onglet Objectifs." : "No financial goals found. Add goals in the Goals tab.",
    // TOC
    toc1:   fr ? "Planification retraite (REER/FERR/RPC/SV)" : "Retirement Planning (RRSP/RRIF/CPP/OAS)",
    toc2:   fr ? "Projection et planification fiscale" : "Tax Projection & Planning",
    toc3:   fr ? "Droits et optimisation REER" : "RRSP Room & Optimization",
    toc4:   fr ? "Droits et stratégie CELI" : "TFSA Room & Strategy",
    toc5:   fr ? "Analyse des gains en capital" : "Capital Gains Analysis",
    toc6:   fr ? "Fractionnement du revenu (T1032)" : "Income Splitting (T1032)",
    toc7:   fr ? "Analyse des besoins en assurance" : "Insurance Needs Analysis",
    toc8:   fr ? "Planification études (REEE)" : "Education Planning (RESP)",
    toc9:   fr ? "Planification successorale" : "Estate Planning",
    toc10:  fr ? "Dettes et flux de trésorerie" : "Debt & Cash Flow",
    tocNW:  fr ? "Valeur nette et répartition des actifs" : "Net Worth & Asset Allocation",
    tocCF:  fr ? "Flux de trésorerie et budget" : "Cash Flow & Budget",
    tocGO:  fr ? "Objectifs financiers" : "Financial Goals",
  };
}

function retirementSection(inputs: ComprehensiveReportInputs, r: RetirementProjection): string {
  const L = getL(inputs.meta.locale);
  const ri = inputs.retirement!;
  const income = [{label:"CPP",value:r.incomeFromCpp},{label:"OAS",value:r.incomeFromOas},{label:L.dbPension,value:r.incomeFromPension},{label:"RRSP/RRIF",value:r.incomeFromRrsp},{label:"TFSA",value:r.incomeFromTfsa}].filter(d=>d.value>0);
  const sc = r.successProbability>=90?"green":r.successProbability>=75?"blue":r.successProbability>=60?"amber":"red";
  const rows = r.yearByYear.filter((_,i)=>i%5===0).slice(0,14).map(row=>[fmt.age(row.age),fmt.year(row.year),fmt.dollar(row.rrspBalance),fmt.dollar(row.tfsaBalance),fmt.dollar(row.nonRegBalance),fmt.dollar(row.totalBalance),row.withdrawalAmount>0?fmt.dollar(row.withdrawalAmount):"—",fmt.dollar(row.totalIncome)]);
  const ld = r.yearByYear.filter((_,i)=>i%2===0);
  return `<div class="page">${pageHeader(inputs.meta,L.ph1)}${sectionHeader("Section 1",L.s1Title,L.s1Sub(ri.planToAge,PROVINCE_NAMES[ri.province]))}
  ${metricGrid([{label:L.retAge,value:`Age ${ri.retirementAge}`,sub:L.retAway(r.yearsToRetirement)},{label:L.retSavings,value:fmt.dollar(r.retirementSavingsAtRetirement),variant:"navy"},{label:L.retIncome,value:fmt.dollar(ri.desiredRetirementIncome)+"/yr",sub:L.retToday},{label:L.retSuccess,value:`${r.successProbability}%`,variant:sc,sub:r.portfolioDepletionAge?L.retDepletes(r.portfolioDepletionAge):L.retSurvives(ri.planToAge)}])}
  <div class="two-col mb-20"><div>
  ${metricGrid([{label:L.rrspRet,value:fmt.dollar(r.rrspAtRetirement),variant:"blue"},{label:L.tfsaRet,value:fmt.dollar(r.tfsaAtRetirement),variant:"blue"},{label:L.nonRegRet,value:fmt.dollar(r.nonRegAtRetirement),variant:"blue"}],3)}
  ${metricGrid([{label:L.cppBen,value:fmt.dollar(r.cppMonthlyBenefit)+"/mo",sub:L.cppStart(ri.cppStartAge)},{label:L.oasBen,value:fmt.dollar(r.oasMonthlyBenefit)+"/mo",sub:L.cppStart(ri.oasStartAge)},{label:L.dbPension,value:fmt.dollar(ri.pensionMonthly)+"/mo",sub:L.defBen}],3)}
  </div><div>${donutChart(L.retSrcChart,income)}</div></div>
  ${lineChart(L.portChart,[{label:"RRSP/RRIF",data:ld.map(row=>({x:row.age,y:row.rrspBalance})),color:"#1E5FA8"},{label:"TFSA",data:ld.map(row=>({x:row.age,y:row.tfsaBalance})),color:"#C9A84C"},{label:L.nonRegRet,data:ld.map(row=>({x:row.age,y:row.nonRegBalance})),color:"#1A7A4A"}])}
  ${callout(L.cppCallout(ri.cppStartAge,fmt.dollar(r.cppMonthlyBenefit),r.cppBreakevenAge)+L.oasCallout(r.oasBreakevenAge),"info")}
  ${callout(L.rrspTfsa(r.rrspVsTfsaRationale),r.rrspVsTfsaRecommendation==="rrsp"?"info":r.rrspVsTfsaRecommendation==="tfsa"?"success":"info")}
  ${dataTable(L.retTable,[{label:L.colAge},{label:L.colYear},{label:L.colRrsp,right:true},{label:L.colTfsa,right:true},{label:L.colNonReg,right:true},{label:L.colTotal,right:true},{label:L.colWithdraw,right:true},{label:L.colIncome,right:true}],rows)}
  ${r.shortfallOrSurplus<0?callout(L.retShortfall(fmt.dollar(Math.abs(r.shortfallOrSurplus))),"warning"):callout(L.retSurplus(fmt.dollar(r.shortfallOrSurplus)),"success")}
  ${pageFooter(1,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function taxSection(inputs: ComprehensiveReportInputs, r: TaxProjection): string {
  const L = getL(inputs.meta.locale);
  return `<div class="page">${pageHeader(inputs.meta,L.ph2)}${sectionHeader("Section 2",L.s2Title,L.s2Sub(inputs.tax?.taxYear??new Date().getFullYear(),PROVINCE_NAMES[inputs.tax?.province??inputs.meta.client.province]))}
  ${metricGrid([{label:L.grossIncome,value:fmt.dollar(r.grossIncome)},{label:L.taxableInc,value:fmt.dollar(r.taxableIncome)},{label:L.totalTax,value:fmt.dollar(r.totalTax),variant:"red"},{label:L.afterTax,value:fmt.dollar(r.afterTaxIncome),variant:"green"}])}
  ${metricGrid([{label:L.effRate,value:fmt.pct(r.effectiveRate),sub:L.effSub},{label:L.margRate,value:fmt.pct(r.marginalRate),variant:"amber",sub:L.margSub},{label:L.fedTax,value:fmt.dollar(r.federalTax)},{label:L.provTax,value:fmt.dollar(r.provincialTax)}])}
  ${barChart(L.taxBreakdown,[{label:L.fedTax,value:r.federalTax},{label:L.provTax,value:r.provincialTax},{label:L.cpp,value:r.cpp},{label:L.ei,value:r.ei}])}
  ${dataTable(L.bracketTable,[{label:L.colBracket},{label:L.colRate,right:true},{label:L.colInBracket,right:true},{label:L.colTaxInBrk,right:true},{label:L.colCumul,right:true}],r.bracketBreakdown.map(b=>[b.bracket,fmt.pct(b.rate),fmt.dollar(b.incomeInBracket),fmt.dollar(b.taxInBracket),fmt.dollar(b.cumulative)]))}
  ${dataTable(L.fiveYearProj,[{label:L.colYear},{label:L.colProjInc,right:true},{label:L.colProjTax,right:true},{label:L.effRate,right:true},{label:L.margRate,right:true}],r.fiveYearProjection.map(row=>[row.year.toString(),fmt.dollar(row.projectedIncome),fmt.dollar(row.projectedTax),fmt.pct(row.effectiveRate),fmt.pct(row.marginalRate)]))}
  ${r.recommendations.length>0?sectionHeader("",L.s2Recs)+recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.category,text:rec.recommendation,saving:rec.estimatedSaving}))):""}
  ${pageFooter(2,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function rrspSection(inputs: ComprehensiveReportInputs, r: RrspAnalysis): string {
  const L = getL(inputs.meta.locale);
  const rows = r.yearByYear.filter((_,i)=>i%3===0).slice(0,12).map(row=>[fmt.age(row.age),row.year.toString(),fmt.dollar(row.openingBalance),fmt.dollar(row.contribution),fmt.dollar(row.growth),fmt.dollar(row.closingBalance),fmt.dollar(row.taxRefund)]);
  return `<div class="page">${pageHeader(inputs.meta,L.ph3)}${sectionHeader("Section 3",L.s3Title,L.s3Sub(new Date().getFullYear()))}
  ${metricGrid([{label:L.availRoom,value:fmt.dollar(r.totalAvailableRoom),variant:"navy"},{label:L.newRoom,value:fmt.dollar(r.newRoomThisYear)},{label:L.taxRefund,value:fmt.dollar(r.taxRefundAtMarginalRate),variant:"green"},{label:L.effCost,value:fmt.dollar(r.effectiveCostAfterRefund),sub:L.afterRefund}])}
  ${metricGrid([{label:L.projRet,value:fmt.dollar(r.projectedBalanceAtRetirement),variant:"blue"},{label:L.annWithdraw,value:fmt.dollar(r.projectedAnnualWithdrawal)},{label:L.yearsGrowth,value:r.yearsOfGrowth.toString()},{label:L.maxBy,value:`Age ${r.maximizeByAge}`}])}
  ${callout(r.catchUpStrategy,r.currentRoom>r.projectedAnnualWithdrawal?"warning":"success")}
  ${lineChart(L.rrspChart,[{label:"RRSP",data:r.yearByYear.map(row=>({x:row.age,y:row.closingBalance})),color:"#1E5FA8"},{label:L.cumContrib,data:r.yearByYear.map(row=>({x:row.age,y:row.cumulativeContributions})),color:"#C9A84C"}])}
  ${dataTable(L.rrspTable,[{label:L.colAge},{label:L.colYear},{label:L.colOpen,right:true},{label:L.colContrib,right:true},{label:L.colGrowth,right:true},{label:L.colClose,right:true},{label:L.colRefund,right:true}],rows)}
  ${callout(L.hbpLlp(fmt.dollar(r.homeByersAmount),fmt.dollar(r.lifelongLearningAmount)),"info")}
  ${pageFooter(3,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function tfsaSection(inputs: ComprehensiveReportInputs, r: TfsaAnalysis): string {
  const L = getL(inputs.meta.locale);
  const rows = r.yearByYear.filter((_,i)=>i%3===0).slice(0,12).map(row=>[fmt.age(row.age),row.year.toString(),fmt.dollar(row.annualLimit),fmt.dollar(row.cumulativeRoom),fmt.dollar(row.openingBalance),fmt.dollar(row.contribution),fmt.dollar(row.growth),fmt.dollar(row.closingBalance)]);
  return `<div class="page">${pageHeader(inputs.meta,L.ph4)}${sectionHeader("Section 4",L.s4Title,L.s4Sub)}
  ${metricGrid([{label:L.lifetimeRoom,value:fmt.dollar(r.lifetimeRoomToDate),variant:"navy"},{label:L.availNow,value:fmt.dollar(r.currentAvailableRoom),variant:r.currentAvailableRoom>0?"green":"amber"},{label:L.annLimit,value:fmt.dollar(r.new2024Room)},{label:L.withdRoom,value:fmt.dollar(r.withdrawalRoomRecovered)}])}
  ${metricGrid([{label:L.bal10,value:fmt.dollar(r.projectedBalance10Years),variant:"blue"},{label:L.bal20,value:fmt.dollar(r.projectedBalance20Years),variant:"blue"},{label:L.balRet,value:fmt.dollar(r.projectedBalanceAtRetirement),variant:"blue"},{label:L.optWithd,value:`Age ${r.optimalWithdrawalAge}`}])}
  ${lineChart(L.tfsaChart,[{label:"TFSA",data:r.taxFreeSavingsVsTaxable.map(row=>({x:row.year,y:row.tfsaBalance})),color:"#1E5FA8"},{label:L.taxable,data:r.taxFreeSavingsVsTaxable.map(row=>({x:row.year,y:row.taxableBalance})),color:"#C9A84C"},{label:L.tfsaAdv,data:r.taxFreeSavingsVsTaxable.map(row=>({x:row.year,y:row.tfsaAdvantage})),color:"#1A7A4A"}])}
  ${callout(r.withdrawalStrategy,"info")}
  ${dataTable(L.tfsaTable,[{label:L.colAge},{label:L.colYear},{label:L.colAnnLim,right:true},{label:L.colCumRoom,right:true},{label:L.colOpen,right:true},{label:L.colContrib,right:true},{label:L.colGrowth,right:true},{label:L.colClose,right:true}],rows)}
  ${pageFooter(4,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function capitalGainsSection(inputs: ComprehensiveReportInputs, r: CapitalGainsAnalysis): string {
  const L = getL(inputs.meta.locale);
  return `<div class="page">${pageHeader(inputs.meta,L.ph5)}${sectionHeader("Section 5",L.s5Title,L.s5Sub(inputs.capitalGains?.taxYear??new Date().getFullYear()))}
  ${metricGrid([{label:L.totalGain,value:fmt.dollar(r.totalGain),variant:r.totalGain>0?"amber":""},{label:L.taxableGain,value:fmt.dollar(r.netTaxableGain),variant:"red"},{label:L.taxOnGains,value:fmt.dollar(r.totalTaxOnGains),variant:"red"},{label:L.effOnGains,value:fmt.pct(r.effectiveRateOnGains)}])}
  ${metricGrid([{label:L.inclUnder,value:fmt.pct(r.inclusionRateUnder250k)},{label:L.inclOver,value:fmt.pct(r.inclusionRateOver250k)},{label:L.lcgeRem,value:fmt.dollar(r.lcgeRemaining),variant:"green"},{label:L.lossesAppl,value:fmt.dollar(r.lossesApplied)}])}
  ${r.disposalBreakdown.length>0?dataTable(L.disposalTbl,[{label:L.colAsset},{label:L.colProceeds,right:true},{label:L.colAcb,right:true},{label:L.colGain,right:true},{label:L.colTaxCol,right:true}],r.disposalBreakdown.map(d=>[d.description,d.proceeds,d.acb,d.gain,d.estimatedTax])):""}
  ${r.timingRecommendations.length>0?callout(`<strong>${L.timingStrat}:</strong> ${r.timingRecommendations.join(" &nbsp;|&nbsp; ")}` ,"info"):""}
  ${r.harvestingOpportunities.length>0?callout(`<strong>${L.harvestOpp}:</strong> ${r.harvestingOpportunities.join(" &nbsp;|&nbsp; ")}` ,"success"):""}
  ${pageFooter(5,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function incomeSplittingSection(inputs: ComprehensiveReportInputs, r: IncomeSplittingAnalysis): string {
  const L = getL(inputs.meta.locale);
  const strats = r.strategies ?? [];
  return `<div class="page">${pageHeader(inputs.meta,L.ph6)}${sectionHeader("Section 6",L.s6Title,L.s6Sub)}
  ${metricGrid([{label:L.currCombTax,value:fmt.dollar(r.currentCombinedTax),variant:"red"},{label:L.afterSplit,value:fmt.dollar(r.combinedAfterSplitTax),variant:"green"},{label:L.annSaving,value:fmt.dollar(r.totalAnnualSaving),variant:"navy"},{label:L.lifeSaving,value:fmt.dollar(r.totalLifetimeSaving),variant:"navy"}])}
  ${dataTable(L.splitTable,[{label:L.colTaxpayer},{label:L.colBefTax,right:true},{label:L.colBefEff,right:true},{label:L.colAftTax,right:true},{label:L.colAftEff,right:true},{label:L.colSaving,right:true}],[
    [inputs.meta.client.fullName+" "+L.primary,fmt.dollar(r.primaryCurrentTax),fmt.pct(r.comparison?.beforeSplitting?.effectivePrimary??0),fmt.dollar(r.primaryAfterSplitTax),fmt.pct(r.comparison?.afterSplitting?.effectivePrimary??0),fmt.dollar(r.primaryCurrentTax-r.primaryAfterSplitTax)],
    [(inputs.meta.client.spouseFirstName??L.spouse),fmt.dollar(r.spouseCurrentTax),fmt.pct(r.comparison?.beforeSplitting?.effectiveSpouse??0),fmt.dollar(r.spouseAfterSplitTax),fmt.pct(r.comparison?.afterSplitting?.effectiveSpouse??0),fmt.dollar(r.spouseCurrentTax-r.spouseAfterSplitTax)],
  ],[L.combined,fmt.dollar(r.currentCombinedTax),"—",fmt.dollar(r.combinedAfterSplitTax),"—",fmt.dollar(r.totalAnnualSaving)])}
  ${strats.length>0?`<div class="section-title mb-12">${L.availStrat}</div><div class="rec-list">${strats.map(s=>`<div class="rec-item ${s.eligible?"medium":"low"}"><div class="rec-icon">${s.eligible?"&#9873;":"&#8212;"}</div><div class="rec-body"><div class="rec-category">${s.name.toUpperCase()} ${s.eligible?badge(L.eligible,"green"):badge(L.notElig,"red")}</div><div class="rec-text">${s.description}</div>${s.eligible&&s.annualSaving>0?`<div class="rec-saving">${L.annSavingTxt(fmt.dollar(s.annualSaving),s.actionRequired)}</div>`:s.actionRequired?`<div class="rec-text" style="color:var(--gray-400);font-size:11px">${s.actionRequired}</div>`:""}</div></div>`).join("")}</div>`:""}
  ${r.spousalRrspRecommended?callout(L.spousalRrsp(fmt.pct(r.comparison?.beforeSplitting?.effectivePrimary??0 - (r.comparison?.afterSplitting?.effectivePrimary??0)),r.spousalRrspRationale),"success"):""}
  ${pageFooter(6,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function insuranceSection(inputs: ComprehensiveReportInputs, r: InsuranceAnalysis): string {
  const L = getL(inputs.meta.locale);
  return `<div class="page">${pageHeader(inputs.meta,L.ph7)}${sectionHeader("Section 7",L.s7Title,L.s7Sub)}
  ${metricGrid([{label:L.lifeGap,value:fmt.dollar(r.dimeGap),variant:r.dimeGap>0?"red":"green"},{label:L.recCoverage,value:fmt.dollar(r.recommendedLifeCoverage),variant:"navy"},{label:L.diGap,value:fmt.dollar(r.disabilityGap)+"/mo",variant:r.disabilityGap>0?"amber":"green"},{label:L.ciGap,value:fmt.dollar(r.ciGap),variant:r.ciGap>0?"amber":"green"}])}
  ${dataTable(L.dimeTable,[{label:L.colComponent},{label:L.colAmtCol,right:true},{label:L.colNotes}],[[L.dimeDebt,fmt.dollar(r.dimeDebt),L.dimeDebtN],[L.dimeIncome,fmt.dollar(r.dimeIncome),L.dimeIncomeN(Math.round(r.dimeIncome/(inputs.insurance?.annualIncome||1)))],[L.dimeMortgage,fmt.dollar(r.dimeMortgage),L.dimeMortN],[L.dimeEduc,fmt.dollar(r.dimeEducation),L.dimeEducN],[L.dimeTotalN,fmt.dollar(r.dimeTotalNeed),""],[L.dimeExist,`(${fmt.dollar(r.dimeExistingCoverage)})`,L.dimeExistN]],[L.coverageGap,fmt.dollar(r.dimeGap),`${r.recommendedCoverageType.replace(/_/g," ")}`])}
  ${metricGrid([{label:L.hlvValue,value:fmt.dollar(r.hlvValue)},{label:L.hlvGap,value:fmt.dollar(r.hlvGap),variant:r.hlvGap>0?"amber":""},{label:L.needsBased,value:fmt.dollar(r.needsBasedCapitalNeeded)},{label:L.needsGap,value:fmt.dollar(r.needsBasedGap),variant:r.needsBasedGap>0?"amber":"green"}])}
  ${dataTable(L.diCiTable,[{label:L.colCovType},{label:L.colMonthNeed,right:true},{label:L.colExisting,right:true},{label:L.colGapCol,right:true},{label:L.colEstPrem,right:true}],[[L.ltdLabel,fmt.dollar(r.monthlyDisabilityNeed)+"/mo",fmt.dollar(r.existingDisabilityCoverage)+"/mo",fmt.dollar(r.disabilityGap)+"/mo",fmt.dollar(r.estimatedDisabilityPremium)+"/mo"],[L.ciLabel,fmt.dollar(r.recommendedCICoverage),fmt.dollar(inputs.insurance?.existingCriticalIllness??0),fmt.dollar(r.ciGap),fmt.dollar(r.estimatedCIPremium)+"/mo"]])}
  ${r.recommendations.length>0?recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.type,text:rec.rationale,saving:rec.coverageAmount}))):""}
  ${pageFooter(7,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function educationSection(inputs: ComprehensiveReportInputs, r: EducationAnalysis): string {
  const L = getL(inputs.meta.locale);
  const childBlocks = r.children.map((child: any) => {
    const childRows = child.yearByYear.filter((_: any, i: number) => i % 2 === 0).slice(0, 10)
      .map((row: any) => [row.year.toString(), row.childAge.toString(),
        fmt.dollar(row.contribution), fmt.dollar(row.cesg + row.additionalCesg),
        fmt.dollar(row.growth), fmt.dollar(row.closingBalance)]);
    return '<div class="section-title mb-8">' + L.respAge(child.name, child.age) + '</div>'
      + metricGrid([
          { label: L.projRespC, value: fmt.dollar(child.projectedRespBalance), variant: "blue" },
          { label: L.educCost,  value: fmt.dollar(child.estimatedEducationCost) },
          { label: L.totalCesgC,value: fmt.dollar(child.totalCesgForChild), variant: "green" },
          { label: L.surpShort, value: fmt.dollar(child.shortfallOrSurplus), variant: child.shortfallOrSurplus >= 0 ? "green" : "red" },
        ], 4)
      + dataTable(L.respTable(child.name),
          [{ label: L.colYear }, { label: L.colAge }, { label: L.colContrib, right: true },
           { label: L.colCesg, right: true }, { label: L.colGrowth, right: true }, { label: L.colBalance, right: true }],
          childRows);
  }).join("");
  return `<div class="page">${pageHeader(inputs.meta,L.ph8)}${sectionHeader("Section 8",L.s8Title,L.s8Sub)}
  ${metricGrid([{label:L.totalCesg,value:fmt.dollar(r.totalCesgReceived),variant:"green"},{label:L.projResp,value:fmt.dollar(r.totalProjectedRespValue),variant:"navy"},{label:L.estEdCost,value:fmt.dollar(r.totalEstimatedEducationCost)},{label:L.surpShort,value:fmt.dollar(r.shortfallOrSurplus),variant:r.shortfallOrSurplus>=0?"green":"red"}])}
  ${childBlocks}
  ${pageFooter(8,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function estateSection(inputs: ComprehensiveReportInputs, r: EstateAnalysis): string {
  const L = getL(inputs.meta.locale);
  const ds = r.documentStatus;
  const docItems = [
    { name:"Will/Testament",    has: ds.will.hasDocument,                rec: ds.will.recommendation },
    { name:"POA",               has: ds.poa.hasDocument,                 rec: ds.poa.recommendation },
    { name:"HC Directive",      has: ds.hcDirective.hasDocument,         rec: ds.hcDirective.recommendation },
    { name:"RRSP Beneficiary",  has: ds.rrspBeneficiary.hasDocument,     rec: ds.rrspBeneficiary.recommendation },
    { name:"TFSA Beneficiary",  has: ds.tfsaBeneficiary.hasDocument,     rec: ds.tfsaBeneficiary.recommendation },
    { name:"Insurance Benef.",  has:ds.insuranceBeneficiary.hasDocument, rec: ds.insuranceBeneficiary.recommendation },
  ];
  return `<div class="page">${pageHeader(inputs.meta,L.ph9)}${sectionHeader("Section 9",L.s9Title,L.s9Sub(PROVINCE_NAMES[inputs.estate?.province??inputs.meta.client.province]))}
  ${metricGrid([{label:L.grossEstate,value:fmt.dollar(r.grossEstate)},{label:L.netEstate,value:fmt.dollar(r.netEstate),variant:"navy"},{label:L.taxOnDeath,value:fmt.dollar(r.totalTaxOnDeath),variant:"red"},{label:L.estateAfter,value:fmt.dollar(r.estateAfterTaxAndProbate),variant:"green"}])}
  ${metricGrid([{label:L.probateFees,value:fmt.dollar(r.probateFees),variant:r.probateFees>10000?"amber":""},{label:L.bypassProb,value:fmt.dollar(r.assetsBypassingProbate),variant:"green"},{label:L.rrspTax,value:fmt.dollar(r.taxOnRrsp),variant:r.taxOnRrsp>0?"red":""},{label:L.cgTaxDeath,value:fmt.dollar(r.taxOnCapitalGains),variant:r.taxOnCapitalGains>0?"amber":""}])}
  ${barChart(L.estateDist,[{label:L.toSpouse,value:r.toSpouse,color:"#1A7A4A"},{label:L.estateNet,value:r.estateAfterTaxAndProbate,color:"#1E5FA8"},{label:L.taxOnDeath,value:r.totalTaxOnDeath,color:"#C0392B"},{label:L.probateFees,value:r.probateFees,color:"#D4860A"}])}
  <div class="table-title mb-12">${L.docChecklist}</div>
  <div class="rec-list">${docItems.map(d=>`<div class="rec-item ${d.has?"low":"immediate"}"><div class="rec-icon">${d.has?"&#9745;":"&#9888;"}</div><div class="rec-body"><div class="rec-category">${d.name} ${d.has?badge(L.inPlace,"green"):badge(L.missing,"red")}</div><div class="rec-text">${d.rec}</div></div></div>`).join("")}</div>
  ${r.recommendations.length>0?recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.category,text:rec.recommendation,saving:rec.estimatedSaving}))):""}
  ${callout(L.liquidityCall(fmt.dollar(r.estimatedLiquidityNeeded),r.lifeInsuranceSuggested>0?L.insRecommend(fmt.dollar(r.lifeInsuranceSuggested)):L.sufficientLiq),r.lifeInsuranceSuggested>0?"warning":"success")}
  ${pageFooter(9,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function debtSection(inputs: ComprehensiveReportInputs, r: DebtAnalysis): string {
  const L = getL(inputs.meta.locale);
  return `<div class="page">${pageHeader(inputs.meta,L.ph10)}${sectionHeader("Section 10",L.s10Title,L.s10Sub)}
  ${metricGrid([{label:L.totalDebt,value:fmt.dollar(r.totalDebt),variant:r.totalDebt>0?"amber":"green"},{label:L.monthlySurp,value:fmt.dollar(r.monthlySurplusOrDeficit),variant:r.monthlySurplusOrDeficit>=0?"green":"red"},{label:L.savingsRate,value:fmt.pct(r.savingsRate),variant:r.savingsRate>=0.15?"green":"amber"},{label:L.debtFreeDate,value:r.debtFreeDate,variant:"navy"}])}
  <div class="two-col mb-20"><div>
  <div class="table-title mb-8">${L.dsr}</div>
  ${progressBar(L.gdsr,r.grossDebtServiceRatio,0.44,r.grossDebtServiceRatio>0.32?"red":"green")}
  ${progressBar(L.tdsr,r.totalDebtServiceRatio,0.44,r.totalDebtServiceRatio>0.44?"red":r.totalDebtServiceRatio>0.36?"amber":"green")}
  ${metricGrid([{label:L.gdsr2,value:fmt.pct(r.grossDebtServiceRatio),variant:r.grossDebtServiceRatio>0.32?"red":"green",sub:L.gdsrSub},{label:L.tdsr2,value:fmt.pct(r.totalDebtServiceRatio),variant:r.totalDebtServiceRatio>0.44?"red":r.totalDebtServiceRatio>0.36?"amber":"green",sub:L.tdsrSub}],2)}
  </div><div>${metricGrid([{label:L.emergFund,value:`${r.emergencyFundMonthsCovered.toFixed(1)} months`,variant:r.emergencyFundStatus==="adequate"?"green":r.emergencyFundStatus==="building"?"amber":"red"},{label:L.emergStatus,value:r.emergencyFundStatus.toUpperCase(),sub:r.emergencyFundStatus===L.adequate?L.threeSix:L.belowTarget}],2)}</div></div>
  ${dataTable(L.budgetTable,[{label:L.colCategory},{label:L.colMonthly,right:true},{label:L.colAnnual,right:true},{label:L.colPctInc,right:true}],[[L.grossIncRow,fmt.dollar(r.monthlyBudget.grossIncome),fmt.dollar(r.monthlyBudget.grossIncome*12),"100%"],[L.lessTax,`(${fmt.dollar(r.monthlyBudget.taxes)})`,`(${fmt.dollar(r.monthlyBudget.taxes*12)})`,""],[L.netIncRow,fmt.dollar(r.monthlyBudget.netIncome),fmt.dollar(r.monthlyBudget.netIncome*12),"100%"],[L.housing,fmt.dollar(r.monthlyBudget.housing),fmt.dollar(r.monthlyBudget.housing*12),fmt.pct(r.monthlyBudget.housing/Math.max(r.monthlyBudget.netIncome,1))],[L.transport,fmt.dollar(r.monthlyBudget.transportation),fmt.dollar(r.monthlyBudget.transportation*12),fmt.pct(r.monthlyBudget.transportation/Math.max(r.monthlyBudget.netIncome,1))],[L.food,fmt.dollar(r.monthlyBudget.food),fmt.dollar(r.monthlyBudget.food*12),fmt.pct(r.monthlyBudget.food/Math.max(r.monthlyBudget.netIncome,1))],[L.debtPay,fmt.dollar(r.monthlyBudget.debtPayments),fmt.dollar(r.monthlyBudget.debtPayments*12),fmt.pct(r.monthlyBudget.debtPayments/Math.max(r.monthlyBudget.netIncome,1))],[L.savings,fmt.dollar(r.monthlyBudget.savings),fmt.dollar(r.monthlyBudget.savings*12),fmt.pct(r.monthlyBudget.savings/Math.max(r.monthlyBudget.netIncome,1))],[L.discret,fmt.dollar(r.monthlyBudget.discretionary),fmt.dollar(r.monthlyBudget.discretionary*12),fmt.pct(r.monthlyBudget.discretionary/Math.max(r.monthlyBudget.netIncome,1))]],[L.monthSurp,fmt.dollar(r.monthlyBudget.surplus),fmt.dollar(r.monthlyBudget.surplus*12),fmt.pct(r.monthlyBudget.surplus/Math.max(r.monthlyBudget.netIncome,1))])}
  ${r.avalancheOrder.length>0?dataTable(L.avalancheTable(fmt.dollar(r.avalancheInterestSaved)),[{label:L.colPriority},{label:L.colDebt},{label:L.colBalance,right:true},{label:L.colRate,right:true},{label:L.colMinPay,right:true},{label:L.colPayoffDt},{label:L.colTotalInt,right:true}],r.avalancheOrder.map(d=>[`#${d.payoffOrder}`,d.name,fmt.dollar(d.balance),fmt.pct(d.interestRate),fmt.dollar(d.minimumPayment),d.payoffDate,fmt.dollar(d.totalInterestPaid)])):""}
  ${r.recommendations.length>0?recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.category,text:rec.recommendation,saving:rec.monthlyImpact*12}))):""}
  ${pageFooter(10,10,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function networthSection(inputs: ComprehensiveReportInputs): string {
  const L = getL(inputs.meta.locale);
  const rows = inputs.rawNetWorth ?? [];
  const assets = rows.filter(e => e.type === "asset");
  const liabs  = rows.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + Number(e.value), 0);
  const totalL = liabs.reduce((s, e) => s + Number(e.value), 0);
  const netWorth = totalA - totalL;
  const catGroups: Record<string, number> = {};
  assets.forEach(e => { catGroups[e.category] = (catGroups[e.category] ?? 0) + Number(e.value); });
  const allocationData = Object.entries(catGroups).map(([label, value]) => ({ label, value }));
  return `<div class="page">${pageHeader(inputs.meta,L.phNW)}${sectionHeader(L.snwTitle,L.snwSub,`${inputs.meta.locale==="fr"?"Au":"As of"} ${inputs.meta.reportDate}`)}
  ${metricGrid([{label:L.totalAssets,value:fmt.dollar(totalA),variant:"green"},{label:L.totalLiabs,value:fmt.dollar(totalL),variant:"red"},{label:L.netWorthLbl,value:fmt.dollar(netWorth),variant:netWorth>=0?"navy":"red"},{label:L.assetCount(assets.length),value:`${assets.length}`}])}
  ${assets.length>0?dataTable(L.assetsTable,[{label:L.colCategory},{label:L.colDesc},{label:L.colOwner},{label:L.colValue,right:true}],assets.map(e=>[e.category,e.name||e.category,e.owner==="spouse"?L.ownerSpouse:e.owner==="joint"?L.ownerJoint:L.ownerPrimary,Number(e.value)])):""}
  ${liabs.length>0?dataTable(L.liabsTable,[{label:L.colCategory},{label:L.colDesc},{label:L.colBalance,right:true}],liabs.map(e=>[e.category,e.name||e.category,Number(e.value)])):""}
  ${allocationData.length>0?barChart(L.allocationChart,allocationData):""}
  ${pageFooter(0,0,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function cashflowSection(inputs: ComprehensiveReportInputs): string {
  const L = getL(inputs.meta.locale);
  const rows = inputs.rawExpenses ?? [];
  const totalMonthly = rows.reduce((s, e) => s + Number(e.monthlyAmount ?? 0), 0);
  const annualIncome = inputs.annualIncome ?? 0;
  const monthlySurplus = annualIncome / 12 - totalMonthly;
  const catGroups: Record<string, number> = {};
  rows.forEach(e => { catGroups[e.category] = (catGroups[e.category] ?? 0) + Number(e.monthlyAmount ?? 0); });
  return `<div class="page">${pageHeader(inputs.meta,L.phCF)}${sectionHeader(L.scfTitle,L.scfSub,`${inputs.meta.locale==="fr"?"Au":"As of"} ${inputs.meta.reportDate}`)}
  ${metricGrid([{label:L.monthlyInc,value:fmt.dollar(annualIncome/12)+"/mo",variant:"green"},{label:L.monthlyExp,value:fmt.dollar(totalMonthly)+"/mo"},{label:L.annualExp,value:fmt.dollar(totalMonthly*12)+"/yr"},{label:L.monthlySurp2,value:fmt.dollar(monthlySurplus)+"/mo",variant:monthlySurplus>=0?"green":"red"}])}
  ${rows.length>0?dataTable(L.expTable,[{label:L.colExpCat},{label:L.colExpDesc},{label:L.colExpMo,right:true},{label:L.colExpAnn,right:true}],rows.map(e=>[e.category,e.description||e.category,Number(e.monthlyAmount??0),Number(e.monthlyAmount??0)*12])):callout(L.noExpenses,"info")}
  ${Object.keys(catGroups).length>0?barChart(L.spendChart,Object.entries(catGroups).map(([label,value])=>({label,value}))):""}
  ${pageFooter(0,0,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

function goalsSection(inputs: ComprehensiveReportInputs): string {
  const L = getL(inputs.meta.locale);
  const goals = inputs.rawGoals ?? [];
  const active    = goals.filter(g => g.status !== "completed");
  const completed = goals.filter(g => g.status === "completed");
  const totalTarget = goals.reduce((s, g) => s + Math.abs(Number(g.targetAmount ?? 0)), 0);
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...goals].sort((a, b) => (priorityOrder[a.priority ?? "low"] ?? 2) - (priorityOrder[b.priority ?? "low"] ?? 2));
  return `<div class="page">${pageHeader(inputs.meta,L.phGO)}${sectionHeader(L.sgoTitle,L.sgoTitle,L.sgoSub(goals.length,inputs.meta.reportDate))}
  ${metricGrid([{label:L.totalGoals,value:goals.length.toString()},{label:L.activeGoals,value:active.length.toString(),variant:"navy"},{label:L.completedGoals,value:completed.length.toString(),variant:"green"},{label:L.totalTarget,value:fmt.dollar(totalTarget)}])}
  ${goals.length>0?dataTable(L.goalsSummary,[{label:L.colGoal},{label:L.colType},{label:L.colTargetAmt,right:true},{label:L.colTargetYr},{label:L.colPriorityG},{label:L.colStatusG}],sorted.map(g=>[g.title,String(g.goalType??"—").replace(/_/g," "),Math.abs(Number(g.targetAmount??0)),g.targetYear?g.targetYear.toString():"—",String(g.priority??"medium").toUpperCase(),(g.status??"active").replace(/_/g," ").toUpperCase()])):callout(L.noGoals,"info")}
  ${pageFooter(0,0,inputs.meta.advisor.companyName,inputs.meta.locale)}</div>`;
}

export function generateComprehensiveReport(
  inputs: ComprehensiveReportInputs,
  results: { retirement?: RetirementProjection; tax?: TaxProjection; rrsp?: RrspAnalysis; tfsa?: TfsaAnalysis; capitalGains?: CapitalGainsAnalysis; incomeSplitting?: IncomeSplittingAnalysis; insurance?: InsuranceAnalysis; education?: EducationAnalysis; estate?: EstateAnalysis; debt?: DebtAnalysis; }
): string {
  const L = getL(inputs.meta.locale);
  const tocItems: string[] = [], sections: string[] = [];

  if (results.retirement)     { tocItems.push(L.toc1);  sections.push(retirementSection(inputs, results.retirement)); }
  if (results.tax)            { tocItems.push(L.toc2);  sections.push(taxSection(inputs, results.tax)); }
  if (results.rrsp)           { tocItems.push(L.toc3);  sections.push(rrspSection(inputs, results.rrsp)); }
  if (results.tfsa)           { tocItems.push(L.toc4);  sections.push(tfsaSection(inputs, results.tfsa)); }
  if (results.capitalGains)   { tocItems.push(L.toc5);  sections.push(capitalGainsSection(inputs, results.capitalGains)); }
  if (results.incomeSplitting){ tocItems.push(L.toc6);  sections.push(incomeSplittingSection(inputs, results.incomeSplitting)); }
  if (results.insurance)      { tocItems.push(L.toc7);  sections.push(insuranceSection(inputs, results.insurance)); }
  if (results.education)      { tocItems.push(L.toc8);  sections.push(educationSection(inputs, results.education)); }
  if (results.estate)         { tocItems.push(L.toc9);  sections.push(estateSection(inputs, results.estate)); }
  if (results.debt)           { tocItems.push(L.toc10); sections.push(debtSection(inputs, results.debt)); }
  if (inputs.rawNetWorth && inputs.rawNetWorth.length > 0) { tocItems.push(L.tocNW); sections.push(networthSection(inputs)); }
  if (inputs.rawExpenses && inputs.rawExpenses.length > 0) { tocItems.push(L.tocCF); sections.push(cashflowSection(inputs)); }
  if (inputs.rawGoals    && inputs.rawGoals.length    > 0) { tocItems.push(L.tocGO); sections.push(goalsSection(inputs)); }

  const lang = inputs.meta.locale === "fr" ? "fr" : "en";
  const printLabel = inputs.meta.locale === "fr" ? "Imprimer / Enregistrer PDF" : "Print / Save as PDF";
  const printBtn = `<div id="printBtn" role="button" tabindex="0"
    onclick="window.print()"
    onkeydown="if(event.key==='Enter'||event.key===' ')window.print()"
    style="position:fixed;top:16px;right:16px;z-index:9999;display:flex;align-items:center;gap:8px;background:#0F2B4C;color:white;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 16px rgba(0,0,0,.25);font-family:Inter,system-ui,sans-serif;user-select:none;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
    ${printLabel}
  </div>
  <script>document.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key==="p"){e.preventDefault();window.print();}});</script>`;
  return `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n<meta charset="UTF-8">\n<title>${inputs.meta.reportTitle} \u2014 ${inputs.meta.client.fullName}</title>\n<style>${REPORT_CSS}</style>\n</head>\n<body>\n${printBtn}\n${coverPage(inputs.meta, tocItems)}\n${sections.join("\n")}\n</body>\n</html>`;
}
