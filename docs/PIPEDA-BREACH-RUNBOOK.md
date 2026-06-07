# PIPEDA Breach Response Runbook
**Compass Planning / Westoak Financial Planning Suite**  
Version 1.0 — May 2026  
Owner: Scott Weston (scott@compassplanning.app)

---

## 1. What Constitutes a Reportable Breach

Under PIPEDA (S.C. 2000, c. 5) and the Breach of Security Safeguards Regulations (SOR/2018-64), a breach of security safeguards must be reported when it involves personal information and creates a **real risk of significant harm (RROSH)** to an individual.

**Factors determining RROSH:**
- Sensitivity of the personal information (SIN, financial data, income, DOB = high sensitivity)
- Probability the information has been/will be misused
- Number of individuals affected
- Whether the information could enable identity theft, financial fraud, or professional harm

**Types of incidents that likely trigger reporting:**
- Unauthorized access to the database (CA or US)
- Exposure of API keys allowing third-party access to client data
- Accidental disclosure of client financial records to wrong advisor
- Meeting transcript data accessed by unauthorized party
- Ransomware or malware affecting the server
- JWT secret compromise enabling token forgery

---

## 2. Immediate Response (0–4 Hours)

### Step 1 — Confirm and contain
- [ ] Verify the breach is real (not a false alarm)
- [ ] Identify which system(s) are affected (CA DB, US DB, API keys, transcripts)
- [ ] Revoke compromised credentials immediately:
  ```powershell
  # Rotate JWT secret — forces all sessions to expire
  flyctl secrets set JWT_SECRET=$(openssl rand -hex 32) --app compass-planning

  # Rotate DB password if DB is compromised
  flyctl postgres connect --app compass-planning-db
  # ALTER USER postgres WITH PASSWORD 'new-strong-password';

  # Revoke compromised API keys
  flyctl secrets set OPENAI_API_KEY=<new-key> --app compass-planning
  flyctl secrets set ANTHROPIC_API_KEY=<new-key> --app compass-planning
  ```
- [ ] Take the affected system offline if breach is active:
  ```powershell
  flyctl scale count 0 --app compass-planning
  ```
- [ ] Preserve logs — do NOT delete or overwrite anything

### Step 2 — Assess scope
- [ ] Identify which client records were exposed
- [ ] Identify which advisors' data was affected
- [ ] Determine time window of the breach (when did it start?)
- [ ] Document: how many individuals, what data types, what jurisdictions (CA / US)

### Step 3 — Document everything
Create a breach record (use template in Section 6) with:
- Date/time discovered
- Date/time breach likely started
- Description of the incident
- Data types involved
- Number of individuals affected
- Steps taken to contain

---

## 3. Reporting Obligations

### 3a. Report to the Office of the Privacy Commissioner (OPC) — Canada

**When:** As soon as feasible after determining RROSH exists. PIPEDA has no hard deadline but "as soon as feasible" is interpreted as days, not weeks.

**How:** Submit via the OPC's online breach report portal:  
https://www.priv.gc.ca/en/report-a-concern/report-a-privacy-breach-as-an-organization/

**What to include:**
- Description of the breach
- Date/period of the breach
- Description of personal information involved
- Number of individuals affected (estimate if unknown)
- Steps taken to contain and mitigate
- Steps taken to notify affected individuals

### 3b. Notify Affected Individuals

**When:** As soon as feasible after determining RROSH — concurrently with OPC report, not after.

**How:** Direct notification preferred (email to advisor, then advisor notifies client).

**What to include (plain language):**
- What happened
- What personal information was involved
- What we are doing about it
- What they can do to protect themselves
- Contact information for questions

**Template:**
```
Subject: Important Notice Regarding Your Personal Information

Dear [Name],

We are writing to inform you of a security incident that may have affected 
your personal information stored in the Compass Planning financial planning platform.

What happened: [Brief factual description]

What information was involved: [List specific data types — e.g., name, email, 
income information, insurance details]

What we are doing: We have [contained the breach / rotated credentials / 
notified authorities] and have taken the following steps to prevent recurrence: 
[steps].

What you can do: We recommend you [monitor your financial accounts / 
contact your financial institution / place a fraud alert with Equifax/TransUnion].

If you have questions, please contact Scott Weston at scott@compassplanning.app 
or [phone].

We sincerely apologize for this incident.
```

### 3c. US Advisors — Additional Obligations

If the breach affects US advisor or client data:
- Review applicable state breach notification laws (e.g., California CCPA, New York SHIELD Act)
- Most US states require notification within 30–90 days
- Consult legal counsel for multi-state obligations

---

## 4. Breach Log (Mandatory Record-Keeping)

PIPEDA requires maintaining a record of ALL security breaches, regardless of whether RROSH is determined. Records must be kept for **24 months**.

**Location:** Maintain in `docs/breach-log.csv` (internal, never commit to public repo)

**Required fields per incident:**
```
date_discovered, date_occurred, description, data_types, individuals_affected, 
rrosh_determination, opc_reported, individuals_notified, containment_steps, 
resolution_date, notes
```

---

## 5. Post-Incident (Within 30 Days)

- [ ] Complete root cause analysis
- [ ] Document lessons learned
- [ ] Update security controls to prevent recurrence
- [ ] Update this runbook if process gaps were identified
- [ ] Review with legal counsel if significant breach
- [ ] Add test case to CI suite covering the vulnerability class

---

## 6. Breach Record Template

```
BREACH RECORD #[YYYY-MM-DD-001]
================================
Date Discovered:       
Date/Time of Breach:   
Discovered By:         
Description:           
Systems Affected:      
Data Types Involved:   
Individuals Affected:  
Jurisdictions:         [ ] CA  [ ] US

RROSH Assessment
----------------
Sensitivity of data:       [ ] High  [ ] Medium  [ ] Low
Probability of misuse:     [ ] High  [ ] Medium  [ ] Low
RROSH Determination:       [ ] Yes — reportable  [ ] No — record only
Rationale:                 

Containment
-----------
Immediate actions taken:   
Credentials rotated:       [ ] Yes  [ ] No
System taken offline:      [ ] Yes  [ ] No

Notifications
-------------
OPC notified:              [ ] Yes  [ ] N/A  Date: 
Individuals notified:      [ ] Yes  [ ] N/A  Date: 
Method of notification:    

Resolution
----------
Root cause:                
Permanent fix applied:     
Resolution date:           
Reviewed by:               
```

---

## 7. Key Contacts

| Role | Contact |
|---|---|
| Platform Owner | Scott Weston — scott@compassplanning.app |
| Office of the Privacy Commissioner | 1-800-282-1376 / priv.gc.ca |
| Equifax Canada (fraud alert) | 1-800-465-7166 |
| TransUnion Canada (fraud alert) | 1-877-525-3823 |

---

## 8. Data Inventory Reference

| Data Type | Sensitivity | Location | Sent to External AI |
|---|---|---|---|
| Client name, email, phone | Medium | CA/US Postgres DB | Yes — intake recorder |
| SIN (if stored) | High | DB — confirm not stored | No |
| Annual income, assets | High | CA/US Postgres DB | Yes — AI recommendations |
| Meeting transcripts (audio) | High | OpenAI Whisper API (transient) | Yes — deleted after transcription |
| Meeting transcript (text) | High | Claude API (transient) | Yes — not stored by Anthropic per DPA |
| JWT tokens | High | Client localStorage | No |
| Passwords (bcrypt hash) | Medium | CA/US Postgres DB | No |

**External processors:**
- **OpenAI** — Whisper transcription, receives audio of client meetings. DPA: https://openai.com/policies/data-processing-addendum
- **Anthropic** — Claude AI summaries and recommendations, receives client financial data. DPA: https://www.anthropic.com/legal/privacy

> **Action required:** Download and sign DPAs from both OpenAI and Anthropic. File signed copies.

---

*This runbook must be reviewed annually or after any security incident.*  
*Last reviewed: May 2026*
