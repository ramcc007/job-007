/**
 * The classification vocabulary, as data.
 *
 * Every rule is a row here rather than a branch in code, so widening
 * coverage — a new function, a new industry, a title variant we keep
 * missing — is an edit to this file and nothing else. Weights are
 * relative: a distinctive term ("kubernetes") outscores a generic one
 * ("technology") so a single strong signal beats several vague ones.
 */
export interface Rule {
  re: RegExp;
  weight: number;
}

export interface Category {
  id: string;
  label: string;
  rules: Rule[];
}

const r = (pattern: string, weight = 1): Rule => ({ re: new RegExp(pattern, "i"), weight });

/** What the person actually does. */
export const FUNCTIONS: Category[] = [
  { id: "software_engineering", label: "Software Engineering", rules: [
    r("\\b(software|backend|back-end|frontend|front-end|full[-\\s]?stack|mobile|ios|android|web)\\s+(engineer|developer|dev)\\b", 4),
    r("\\bsoftware\\s+(engineer|development|architect)\\b", 4),
    r("\\b(programmer|sde|swe)\\b", 3),
    r("\\b(react|angular|vue|node\\.?js|typescript|javascript|python|java|golang|rust|ruby on rails|\\.net|c\\+\\+|kotlin|swift)\\b", 2),
    r("\\bengineering manager\\b", 3),
    r("\\bapi\\b|\\bmicroservices\\b", 1),
  ]},
  { id: "data_ai", label: "Data & AI", rules: [
    r("\\b(data scientist|data science|machine learning|ml engineer|ai engineer|deep learning)\\b", 5),
    r("\\b(data engineer|analytics engineer|data analyst|business intelligence|bi analyst)\\b", 4),
    r("\\b(nlp|computer vision|llm|mlops|generative ai)\\b", 3),
    r("\\b(pytorch|tensorflow|spark|databricks|snowflake|dbt|airflow)\\b", 2),
    r("\\bstatistic(s|ian)\\b|\\bquantitative analyst\\b|\\bquant\\b", 2),
  ]},
  { id: "infrastructure", label: "Infrastructure & DevOps", rules: [
    r("\\b(devops|sre|site reliability|platform engineer|infrastructure engineer)\\b", 5),
    r("\\b(cloud engineer|cloud architect|systems engineer|sysadmin|system administrator)\\b", 4),
    r("\\b(kubernetes|terraform|docker|aws|azure|gcp|ansible)\\b", 2),
    r("\\bnetwork (engineer|administrator)\\b", 3),
    r("\\bdatabase administrator\\b|\\bdba\\b", 3),
  ]},
  { id: "security", label: "Security", rules: [
    r("\\b(security engineer|cybersecurity|infosec|information security|appsec|application security)\\b", 5),
    r("\\b(penetration test|pen test|red team|blue team|soc analyst|threat)\\b", 3),
    r("\\b(ciso|security architect|security analyst|grc)\\b", 4),
    r("\\b(iso 27001|soc 2|vulnerability)\\b", 2),
  ]},
  { id: "qa", label: "QA & Testing", rules: [
    r("\\b(qa engineer|quality assurance|test engineer|sdet|automation tester|manual tester)\\b", 5),
    r("\\bqa\\b", 4),
    r("\\b(selenium|cypress|playwright|test automation)\\b", 2),
    r("\\bquality (analyst|engineer)\\b", 3),
  ]},
  { id: "product", label: "Product", rules: [
    r("\\bproduct manager\\b|\\bproduct owner\\b|\\bproduct lead\\b", 5),
    r("\\b(head of product|chief product officer|cpo|vp product)\\b", 5),
    r("\\bproduct (analyst|strategy|operations)\\b", 3),
    r("\\bscrum master\\b|\\bagile coach\\b|\\bbusiness analyst\\b", 3),
    r("\\bprogram manager\\b|\\btechnical program manager\\b|\\btpm\\b", 3),
  ]},
  { id: "design", label: "Design", rules: [
    r("\\b(ux|ui|product|visual|interaction|graphic|motion)\\s*designer\\b", 5),
    r("\\b(ux researcher|user research|design system|design lead|creative director)\\b", 4),
    r("\\b(figma|sketch|adobe|illustrator|photoshop)\\b", 2),
    r("\\bart director\\b|\\bindustrial designer\\b", 3),
  ]},
  { id: "hardware_engineering", label: "Hardware & Electrical Engineering", rules: [
    r("\\b(electrical|electronics|hardware|firmware|embedded|rf|asic|fpga|pcb|vlsi)\\s*(design\\s*)?engineer\\b", 5),
    r("\\b(semiconductor|circuit design|signal integrity|power electronics)\\b", 3),
    r("\\bcontrols engineer\\b|\\binstrumentation engineer\\b", 3),
  ]},
  { id: "mechanical_engineering", label: "Mechanical & Manufacturing Engineering", rules: [
    r("\\b(mechanical|manufacturing|production|process|industrial|automotive|aerospace|maintenance|reliability)\\s+(?:design|systems?|test|project|development)?\\s*engineer\\b", 5),
    r("\\b(cad|solidworks|autocad|catia|ansys|gd&t)\\b", 2),
    r("\\b(tool(ing)? engineer|quality engineer|welding engineer|hvac engineer)\\b", 3),
    r("\\bplant (manager|engineer)\\b|\\bproduction supervisor\\b", 3),
  ]},
  { id: "civil_engineering", label: "Civil & Construction", rules: [
    r("\\b(civil|structural|geotechnical|environmental|transportation)\\s+(?:design|site|project)?\\s*engineer\\b", 5),
    r("\\b(site engineer|construction manager|quantity surveyor|project engineer|surveyor)\\b", 4),
    r("\\b(architect|architectural)\\b(?!.*\\b(software|solution|data|cloud|enterprise|system|security)\\b)", 3),
    r("\\b(bim|revit|estimator|foreman)\\b", 2),
  ]},
  { id: "sales", label: "Sales & Business Development", rules: [
    r("\\b(account executive|sales manager|sales representative|sales director|sales engineer)\\b", 5),
    r("\\b(business development|bdr|sdr|inside sales|field sales|territory manager)\\b", 4),
    r("\\b(account manager|key account|client partner|partnerships manager)\\b", 4),
    r("\\b(quota|pipeline|crm|salesforce)\\b", 1),
    r("\\b(chief revenue officer|cro|vp sales|head of sales)\\b", 5),
  ]},
  { id: "marketing", label: "Marketing & Communications", rules: [
    r("\\b(marketing|brand|content|growth|demand generation|seo|sem|ppc|social media)\\s*(manager|specialist|director|lead|executive|associate)\\b", 5),
    r("\\b(digital marketing|performance marketing|product marketing|field marketing|email marketing)\\b", 5),
    r("\\b(cmo|head of marketing|communications manager|public relations|pr manager)\\b", 4),
    r("\\b(copywriter|content writer|community manager|marketing analyst)\\b", 4),
  ]},
  { id: "customer_support", label: "Customer Support & Success", rules: [
    r("\\b(customer (support|success|service|experience|care))\\b", 5),
    r("\\b(support (engineer|specialist|agent|representative)|technical support|help ?desk|service desk)\\b", 4),
    r("\\b(csm|client success|account support|call ?cent(er|re))\\b", 3),
    r("\\bimplementation (specialist|consultant)\\b|\\bonboarding specialist\\b", 3),
  ]},
  { id: "finance", label: "Finance & Accounting", rules: [
    r("\\b(accountant|accounting|bookkeeper|controller|comptroller)\\b", 5),
    r("\\b(financial analyst|fp&a|finance manager|treasury|auditor|audit)\\b", 5),
    r("\\b(cfo|vp finance|head of finance|financial controller)\\b", 5),
    r("\\b(accounts payable|accounts receivable|payroll|tax (analyst|manager|associate))\\b", 4),
    r("\\b(investment|portfolio manager|equity research|underwrit(er|ing)|actuar(y|ial))\\b", 4),
  ]},
  { id: "hr", label: "HR & Recruiting", rules: [
    r("\\b(recruit(er|ing|ment)|talent acquisition|sourcer|technical recruiter)\\b", 5),
    r("\\b(human resources|hr (manager|business partner|generalist|coordinator)|hrbp|people operations|people partner)\\b", 5),
    r("\\b(chro|head of people|vp people|compensation and benefits|comp & ben)\\b", 4),
    r("\\b(learning and development|l&d|training manager|employee relations)\\b", 3),
  ]},
  { id: "legal", label: "Legal & Compliance", rules: [
    r("\\b(lawyer|attorney|solicitor|barrister|counsel|paralegal|legal counsel)\\b", 5),
    r("\\b(compliance (officer|manager|analyst)|regulatory affairs|aml|kyc)\\b", 4),
    r("\\b(contract(s)? manager|legal operations|general counsel|company secretary)\\b", 4),
    r("\\b(intellectual property|patent (attorney|agent))\\b", 4),
  ]},
  { id: "operations", label: "Operations & Strategy", rules: [
    r("\\b(operations (manager|analyst|associate|director|specialist)|business operations|bizops)\\b", 5),
    r("\\b(chief of staff|strategy (manager|analyst)|management consultant|corporate development)\\b", 4),
    r("\\b(coo|head of operations|vp operations|general manager)\\b", 4),
    r("\\bprocess improvement\\b|\\blean six sigma\\b", 2),
  ]},
  { id: "supply_chain", label: "Supply Chain & Logistics", rules: [
    r("\\b(supply chain|logistics|procurement|purchasing|sourcing (manager|specialist))\\b", 5),
    r("\\b(warehouse (manager|supervisor|associate)|inventory (manager|analyst)|fulfil?lment)\\b", 4),
    r("\\b(demand plann(er|ing)|supply plann(er|ing)|transportation manager|freight|customs)\\b", 4),
    r("\\b(buyer|category manager|vendor manager)\\b", 3),
  ]},
  { id: "healthcare", label: "Healthcare & Clinical", rules: [
    r("\\b(nurse|nursing|rn\\b|physician|doctor|surgeon|clinician|clinical)\\b", 5),
    r("\\b(pharmacist|pharmacy|radiolog(y|ist)|therapist|physiotherap(y|ist)|dentist|dental)\\b", 5),
    r("\\b(medical (assistant|officer|director|writer)|healthcare (assistant|administrator))\\b", 4),
    r("\\b(clinical research|clinical trial|regulatory affairs|pharmacovigilance|cra\\b)\\b", 4),
    r("\\b(caregiver|care assistant|paramedic|veterinar(y|ian)|psycholog(y|ist)|counsel(l)?or)\\b", 4),
  ]},
  { id: "education", label: "Education & Training", rules: [
    r("\\b(teacher|lecturer|professor|tutor|instructor|faculty)\\b", 5),
    r("\\b(curriculum (developer|designer)|instructional design|academic (advisor|coordinator))\\b", 4),
    r("\\b(principal|headteacher|dean|school administrator|admissions)\\b", 3),
    r("\\b(teaching assistant|research assistant|postdoc(toral)?)\\b", 4),
  ]},
  { id: "skilled_trades", label: "Skilled Trades & Field Services", rules: [
    r("\\b(electrician|plumber|carpenter|welder|machinist|mechanic|technician|fitter)\\b", 5),
    r("\\b(hvac|forklift|cnc|millwright|rigger|lineman)\\b", 4),
    r("\\b(field service (engineer|technician)|installer|maintenance technician)\\b", 4),
    r("\\b(driver|cdl|operator|crane operator)\\b", 3),
  ]},
  { id: "hospitality", label: "Hospitality, Retail & Food", rules: [
    r("\\b(chef|cook|barista|bartender|server|waiter|waitress|kitchen)\\b", 5),
    r("\\b(hotel|hospitality|front desk|concierge|housekeep(er|ing)|restaurant manager)\\b", 4),
    r("\\b(retail (associate|manager)|store manager|cashier|sales assistant|merchandis(er|ing))\\b", 4),
    r("\\b(travel|tourism|event (manager|coordinator)|catering)\\b", 3),
  ]},
  { id: "admin", label: "Administration & Office", rules: [
    r("\\b(executive assistant|administrative assistant|office manager|receptionist|secretary)\\b", 5),
    r("\\b(data entry|office administrator|clerk|coordinator)\\b", 3),
    r("\\b(facilities (manager|coordinator)|workplace (manager|experience))\\b", 3),
  ]},
  { id: "research", label: "Research & Science", rules: [
    r("\\b(research scientist|scientist|researcher|r&d)\\b", 4),
    r("\\b(chemist|biologist|physicist|biotech|laboratory|lab technician|microbiolog(y|ist))\\b", 4),
    r("\\b(bioinformatics|genomics|materials scientist)\\b", 4),
  ]},
];

/** What industry the employer is in. */
export const VERTICALS: Category[] = [
  { id: "technology", label: "Technology & Software", rules: [
    r("\\b(saas|software company|tech company|technology company|platform|startup)\\b", 3),
    r("\\b(cloud|developer tools|open source|b2b software|enterprise software)\\b", 2),
    r("\\b(cyber ?security|fintech platform|edtech|adtech|martech|proptech)\\b", 2),
  ]},
  { id: "financial_services", label: "Financial Services", rules: [
    r("\\b(bank|banking|investment bank|asset management|hedge fund|private equity|venture capital)\\b", 4),
    r("\\b(insurance|insurer|reinsurance|underwriting|actuarial)\\b", 4),
    r("\\b(fintech|payments|lending|mortgage|wealth management|brokerage|trading)\\b", 3),
  ]},
  { id: "healthcare_life_sciences", label: "Healthcare & Life Sciences", rules: [
    r("\\b(hospital|clinic|health ?care|health system|patient care|medical cent(er|re))\\b", 4),
    r("\\b(pharmaceutical|pharma|biotech|biotechnology|medical device|life sciences|cro\\b)\\b", 4),
    r("\\b(digital health|telehealth|healthtech)\\b", 3),
  ]},
  { id: "manufacturing_industrial", label: "Manufacturing & Industrial", rules: [
    r("\\b(manufactur(er|ing)|factory|plant|production facility|assembly line|industrial)\\b", 4),
    r("\\b(automotive|aerospace|defen[cs]e|shipbuilding|heavy equipment|machinery)\\b", 3),
    r("\\b(chemicals|steel|textiles|packaging|fmcg|cpg\\b)\\b", 3),
  ]},
  { id: "retail_ecommerce", label: "Retail & E-commerce", rules: [
    r("\\b(retail(er)?|e-?commerce|online store|marketplace|d2c|direct to consumer)\\b", 4),
    r("\\b(fashion|apparel|grocery|supermarket|consumer goods|omnichannel)\\b", 3),
  ]},
  { id: "energy_utilities", label: "Energy & Utilities", rules: [
    r("\\b(energy|oil and gas|oil & gas|petroleum|renewable|solar|wind (farm|energy)|nuclear)\\b", 4),
    r("\\b(utility|utilities|power (generation|grid)|electricity|water treatment)\\b", 4),
    r("\\b(sustainability|carbon|climate tech|clean ?tech)\\b", 3),
  ]},
  { id: "construction_real_estate", label: "Construction & Real Estate", rules: [
    r("\\b(construction|contractor|infrastructure project|civil works|built environment)\\b", 4),
    r("\\b(real estate|property (management|developer)|facilities management|reit)\\b", 4),
    r("\\b(architecture (firm|practice)|engineering consultancy)\\b", 3),
  ]},
  { id: "transport_logistics", label: "Transport & Logistics", rules: [
    r("\\b(logistics|freight|shipping|courier|last mile|3pl|supply chain company)\\b", 4),
    r("\\b(airline|aviation|railway|rail|trucking|maritime|port)\\b", 4),
    r("\\b(mobility|ride ?hailing|delivery platform)\\b", 3),
  ]},
  { id: "media_entertainment", label: "Media & Entertainment", rules: [
    r("\\b(media|publishing|broadcast|television|film|studio|streaming)\\b", 4),
    r("\\b(gaming|video game|esports|music|advertising agency|creative agency)\\b", 4),
    r("\\b(journalism|newsroom|content studio)\\b", 3),
  ]},
  { id: "education_sector", label: "Education", rules: [
    r("\\b(university|college|school|academy|k-12|higher education|edtech)\\b", 4),
    r("\\b(training provider|bootcamp|e-?learning|academic institution)\\b", 3),
  ]},
  { id: "public_sector", label: "Government & Public Sector", rules: [
    r("\\b(government|public sector|civil service|municipal|federal|ministry|council)\\b", 4),
    r("\\b(defen[cs]e|police|military|regulator|public health)\\b", 3),
  ]},
  { id: "nonprofit", label: "Non-profit & NGO", rules: [
    r("\\b(non-?profit|not-?for-?profit|ngo|charity|charitable|foundation|social impact)\\b", 4),
    r("\\b(humanitarian|development sector|advocacy)\\b", 3),
  ]},
  { id: "professional_services", label: "Professional Services", rules: [
    r("\\b(consult(ing|ancy)|advisory|professional services|law firm|accounting firm)\\b", 4),
    r("\\b(audit firm|staffing|recruitment agency|outsourcing|bpo|it services)\\b", 3),
  ]},
  { id: "hospitality_travel", label: "Hospitality & Travel", rules: [
    r("\\b(hotel|resort|hospitality|restaurant|food service|catering)\\b", 4),
    r("\\b(travel|tourism|airline|cruise|booking platform)\\b", 3),
  ]},
  { id: "agriculture", label: "Agriculture & Food Production", rules: [
    r("\\b(agriculture|agri-?business|farming|farm|agronomy|horticulture)\\b", 4),
    r("\\b(food production|food processing|dairy|aquaculture|agritech)\\b", 3),
  ]},
];

/**
 * Seniority, most senior first — the first match wins, because titles like
 * "Senior Director" and "VP of Engineering, Senior" would otherwise score
 * for both levels.
 */
export const SENIORITY: Category[] = [
  { id: "c_level", label: "C-Level", rules: [
    r("\\b(chief [a-z]+ officer|ceo|cto|cfo|coo|cmo|cpo|ciso|cio|cro|chro)\\b", 5),
    r("\\b(founder|co-?founder|managing director|president|partner)\\b", 4),
  ]},
  { id: "vp", label: "VP", rules: [
    r("\\b(vice president|vp|svp|evp|avp)\\b", 5),
    r("\\bhead of\\b", 3),
  ]},
  { id: "director", label: "Director", rules: [
    r("\\bdirector\\b", 5),
  ]},
  { id: "manager", label: "Manager", rules: [
    r("\\b(manager|management)\\b", 4),
    r("\\b(supervisor|team lead(er)?|foreman)\\b", 3),
  ]},
  { id: "lead", label: "Lead / Principal", rules: [
    r("\\b(principal|staff|distinguished|architect|lead)\\b", 4),
  ]},
  { id: "senior", label: "Senior", rules: [
    r("\\b(senior|sr\\.?|snr)\\b", 5),
    r("\\b(iii|iv|v)\\b", 2),
    r("\\b(experienced|expert)\\b", 2),
  ]},
  { id: "mid", label: "Mid-level", rules: [
    r("\\b(mid[-\\s]?level|intermediate|ii\\b)\\b", 4),
    r("\\b\\d\\+?\\s*(?:-\\s*\\d+\\s*)?years?\\s+(?:of\\s+)?experience\\b", 1),
  ]},
  { id: "entry", label: "Entry-level", rules: [
    r("\\b(junior|jr\\.?|entry[-\\s]?level|graduate|associate|assistant|trainee|fresher)\\b", 4),
    r("\\b(i\\b|apprentice)\\b", 2),
  ]},
  { id: "intern", label: "Internship", rules: [
    r("\\b(intern|internship|co-?op|working student|placement|summer analyst)\\b", 5),
  ]},
];
