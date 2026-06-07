import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

const schemaColumns = {
  net_worth_entries: ['id','client_id','plan_id','type','category','name','value','owner','notes','metadata','created_at','updated_at','description'],
  retirement_projections: ['id','client_id','plan_id','current_age','retirement_age','life_expectancy','current_savings','rrsp_balance','tfsa_balance','non_reg_balance','annual_contribution','annual_tfsa_contribution','annual_non_reg_contribution','expected_return','inflation_rate','desired_retirement_income','projected_balance','shortfall_surplus','success_rate','monte_carlo_results','cpp_start_age','oas_start_age','cpp_monthly','oas_monthly','rrif_conversion_age','pension_income','spouse_income','province','equity_allocation','bond_allocation','years_in_canada','yearly_breakdown','notes','label','created_at','updated_at','description'],
  insurance_analyses: ['id','client_id','plan_id','method','primary_name','primary_age','spouse_name','spouse_age','annual_income','spouse_annual_income','years_to_replace','existing_life_coverage','existing_disability','existing_critical_illness','recommended_life','recommended_disability','recommended_critical_illness','recommended_disability_coverage','critical_illness_lump_sum','life_gap','disability_gap','critical_illness_gap','worksheet_data','notes','created_at','updated_at','description'],
  education_savings: ['id','client_id','plan_id','child_name','child_dob','current_resp_balance','annual_contribution','target_amount','projected_balance','cesp_grant','notes','created_at','updated_at','description'],
  debt_entries: ['id','client_id','plan_id','name','category','balance','interest_rate','minimum_payment','term','payoff_strategy','priority','notes','created_at','updated_at','description'],
  tax_planning_notes: ['id','client_id','plan_id','category','title','content','tax_year','action_required','created_at','updated_at','description'],
  estate_planning_notes: ['id','client_id','plan_id','category','title','content','document_reference','created_at','updated_at','description'],
  ai_recommendations: ['id','client_id','plan_id','category','priority','title','content','description','status','created_at','updated_at'],
  client_policies: ['id','client_id','type','policy_number','provider','insured','coverage_amount','premium','premium_frequency','inforce_date','renewal_date','review_date','beneficiary','notes','created_at','updated_at','description'],
  household_expenses: ['id','client_id','category','description','monthly_amount','annual_amount','frequency','is_essential','include_in_retirement','retirement_adjustment_pct','notes','created_at','updated_at'],
};

for (const [table, cols] of Object.entries(schemaColumns)) {
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = '" + table + "'");
  const dbCols = r.rows.map(c => c.column_name);
  const missing = cols.filter(c => !dbCols.includes(c));
  if (missing.length) console.log('MISSING in ' + table + ': ' + missing.join(', '));
  else console.log('OK: ' + table);
}
await pool.end();
