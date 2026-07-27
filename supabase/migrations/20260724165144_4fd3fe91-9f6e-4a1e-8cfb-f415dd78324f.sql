
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  "order" int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  heading text,
  content text NOT NULL,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chunks_chapter_idx ON public.chunks(chapter_id);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'chapter',
  score int NOT NULL,
  total int NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_chapter_idx ON public.quiz_attempts(chapter_id);

CREATE TABLE public.question_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question text NOT NULL,
  correct boolean NOT NULL,
  user_answer int,
  correct_answer int NOT NULL,
  explanation text
);

CREATE TABLE public.revision_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  stage text NOT NULL,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revision_due_idx ON public.revision_schedule(due_at) WHERE done_at IS NULL;

CREATE TABLE public.mains_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  rubric_json jsonb NOT NULL,
  overall int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chunks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_results TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revision_schedule TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mains_evaluations TO anon, authenticated;
GRANT ALL ON public.chapters, public.chunks, public.quiz_attempts, public.question_results, public.revision_schedule, public.mains_evaluations TO service_role;

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mains_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all chapters" ON public.chapters FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all chunks" ON public.chunks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all quiz_attempts" ON public.quiz_attempts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all question_results" ON public.question_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all revision_schedule" ON public.revision_schedule FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all mains_evaluations" ON public.mains_evaluations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed chapters and study chunks (public-domain summaries)
INSERT INTO public.chapters (slug, title, "order") VALUES
  ('preamble', 'Preamble of the Constitution', 1),
  ('fundamental-rights', 'Fundamental Rights', 2),
  ('fundamental-duties', 'Fundamental Duties', 3),
  ('dpsp', 'Directive Principles of State Policy', 4),
  ('parliament', 'Parliament', 5),
  ('president', 'The President', 6);

-- Preamble
INSERT INTO public.chunks (chapter_id, heading, content) VALUES
  ((SELECT id FROM public.chapters WHERE slug='preamble'), 'Text of the Preamble',
   'The Preamble to the Constitution of India declares India to be a Sovereign, Socialist, Secular, Democratic, Republic and secures to all its citizens Justice (social, economic, political); Liberty (of thought, expression, belief, faith, worship); Equality (of status and opportunity); and Fraternity (assuring the dignity of the individual and the unity and integrity of the nation). It was adopted on 26 November 1949 and came into force on 26 January 1950.'),
  ((SELECT id FROM public.chapters WHERE slug='preamble'), 'Key words explained',
   'Sovereign means India is free to conduct its own affairs, external and internal, without foreign interference. Socialist (added by 42nd Amendment, 1976) implies democratic socialism where mixed economy pursues social and economic justice. Secular (added by 42nd Amendment) means the state has no religion of its own and treats all religions equally. Democratic denotes government elected by the people through universal adult franchise. Republic means the head of state (the President) is elected, not hereditary.'),
  ((SELECT id FROM public.chapters WHERE slug='preamble'), 'Status and Amendability',
   'In Berubari Union (1960) the Supreme Court held the Preamble is not part of the Constitution. This was overruled in Kesavananda Bharati (1973), which held it IS part of the Constitution and can be amended, subject to the basic structure doctrine. The 42nd Amendment (1976) added the words Socialist, Secular and Integrity. The Preamble is non-justiciable — its provisions are not enforceable in courts.'),

  ((SELECT id FROM public.chapters WHERE slug='fundamental-rights'), 'Overview',
   'Fundamental Rights are enshrined in Part III (Articles 12–35) of the Constitution and are guaranteed to all persons, with some rights limited to citizens. They are justiciable — any person can directly move the Supreme Court (Article 32) or High Court (Article 226) for enforcement. Originally seven, they are now six after the 44th Amendment (1978) removed the Right to Property from Part III and made it a legal right under Article 300A.'),
  ((SELECT id FROM public.chapters WHERE slug='fundamental-rights'), 'The Six Rights',
   'Right to Equality (Articles 14–18): equality before law, prohibition of discrimination, equality of opportunity, abolition of untouchability and titles. Right to Freedom (Articles 19–22): six freedoms including speech, assembly, association, movement, residence and profession; protection in respect of conviction; protection of life and personal liberty; protection against arrest and detention. Right against Exploitation (23–24): prohibits trafficking, forced labour and child labour under 14 in hazardous employment. Right to Freedom of Religion (25–28). Cultural and Educational Rights (29–30). Right to Constitutional Remedies (32) — called by Ambedkar the "heart and soul" of the Constitution.'),
  ((SELECT id FROM public.chapters WHERE slug='fundamental-rights'), 'Writs',
   'Article 32 empowers the Supreme Court, and Article 226 the High Courts, to issue five writs: Habeas Corpus (produce the body), Mandamus (we command), Prohibition (to a lower court), Certiorari (to be certified), and Quo Warranto (by what authority). Article 226 is wider — HCs can issue writs for enforcement of Fundamental Rights AND for any other purpose.'),

  ((SELECT id FROM public.chapters WHERE slug='fundamental-duties'), 'Origin and List',
   'Fundamental Duties are contained in Part IVA, Article 51A, and were added by the 42nd Amendment (1976) on the recommendation of the Swaran Singh Committee. Originally ten, an eleventh duty (parent/guardian to provide educational opportunity to child 6–14) was added by the 86th Amendment (2002). Duties include abiding by the Constitution, cherishing noble ideals of the freedom struggle, upholding sovereignty, defending the country, promoting harmony, protecting the environment, developing scientific temper, and striving towards excellence.'),
  ((SELECT id FROM public.chapters WHERE slug='fundamental-duties'), 'Nature',
   'Fundamental Duties are non-justiciable — no legal sanction attaches to their violation, but Parliament may provide for their enforcement through suitable legislation. They apply only to citizens, not to foreigners. The Verma Committee (1999) identified existing legal provisions that give effect to some duties (Prevention of Insults to National Honour Act, 1971 among them).'),

  ((SELECT id FROM public.chapters WHERE slug='dpsp'), 'Overview',
   'Directive Principles of State Policy are in Part IV (Articles 36–51). Borrowed from the Irish Constitution (which borrowed from Spain), they are non-justiciable directives to the state in framing laws and policy, aiming to establish a welfare state. Article 37 explicitly makes them non-enforceable in any court but declares them fundamental in the governance of the country.'),
  ((SELECT id FROM public.chapters WHERE slug='dpsp'), 'Classification',
   'DPSPs are commonly classified into three: Socialist (adequate means of livelihood, equal pay for equal work, right to work and education, living wage, participation of workers in management — Articles 38, 39, 39A, 41–43A, 47); Gandhian (village panchayats, cottage industries, welfare of SCs/STs, prohibition, cow protection — 40, 43, 46, 47, 48); Liberal-Intellectual (uniform civil code, free and compulsory education for children, separation of judiciary from executive, promotion of international peace — 44, 45, 50, 51).'),
  ((SELECT id FROM public.chapters WHERE slug='dpsp'), 'Conflict with Fundamental Rights',
   'In Champakam Dorairajan (1951) the SC held FRs prevail over DPSPs. The 25th Amendment inserted Article 31C giving primacy to DPSPs under 39(b) and 39(c). Kesavananda Bharati (1973) upheld this but subjected all amendments to the basic structure doctrine. Minerva Mills (1980) reaffirmed a harmonious balance — neither is superior in absolute terms.'),

  ((SELECT id FROM public.chapters WHERE slug='parliament'), 'Composition',
   'Parliament of India consists of the President, the Rajya Sabha (Council of States) and the Lok Sabha (House of the People) — Article 79. Lok Sabha maximum strength 552 (530 states + 20 UTs + 2 Anglo-Indian nominees, abolished by 104th Amendment 2019 with effect from 2020). Rajya Sabha maximum 250 (238 elected by state/UT legislatures via single transferable vote + 12 nominated by the President for expertise in art, literature, science, social service).'),
  ((SELECT id FROM public.chapters WHERE slug='parliament'), 'Terms and Sessions',
   'Lok Sabha term is 5 years but may be dissolved earlier. Rajya Sabha is a permanent body — one-third members retire every two years, term 6 years. Parliament must meet at least twice a year with a maximum gap of 6 months between sessions. Three sessions: Budget (Feb–May), Monsoon (July–September), Winter (November–December). Quorum is one-tenth of the total membership of the House.'),
  ((SELECT id FROM public.chapters WHERE slug='parliament'), 'Money Bills and Financial Bills',
   'A Money Bill (Article 110) can be introduced only in the Lok Sabha and only on the recommendation of the President. Rajya Sabha must return it within 14 days with or without recommendations, which the Lok Sabha may accept or reject. The Speaker of Lok Sabha decides whether a Bill is a Money Bill and the decision is final. Financial Bills of Category I (Article 117(1)) are like Money Bills in origination but not in Rajya Sabha powers; Category II (117(3)) can be introduced in either House.'),
  ((SELECT id FROM public.chapters WHERE slug='parliament'), 'Anti-Defection Law',
   'The Tenth Schedule, added by the 52nd Amendment (1985), disqualifies MPs and MLAs for defection: voluntarily giving up party membership, or voting/abstaining contrary to party direction (whip) without prior permission. The Kihoto Hollohan (1992) case upheld the law and ruled the Speaker''s decision is subject to judicial review. The 91st Amendment (2003) removed the earlier "one-third split" exception and now only a merger of two-thirds of a legislature party is protected.'),

  ((SELECT id FROM public.chapters WHERE slug='president'), 'Election and Term',
   'The President of India is elected by an electoral college consisting of elected members of both Houses of Parliament and elected members of the Legislative Assemblies of States and Union Territories of Delhi and Puducherry (Article 54). Election is by proportional representation with single transferable vote and secret ballot. Term of five years, eligible for re-election. Qualifications (Article 58): citizen of India, 35+ years, qualified for election to the Lok Sabha, must not hold any office of profit.'),
  ((SELECT id FROM public.chapters WHERE slug='president'), 'Powers',
   'Executive: appoints Prime Minister, other ministers, Governors, Attorney General, CAG, Chief Election Commissioner, judges of the SC and HCs. Legislative: summons and prorogues Parliament, dissolves Lok Sabha, addresses Parliament, gives assent to bills, promulgates ordinances (Article 123) when Parliament is not in session. Judicial: pardoning power (Article 72) — pardon, commutation, remission, respite, reprieve — including in cases of death sentence and court martial. Emergency: national (Article 352), state/president''s rule (356), financial (360).'),
  ((SELECT id FROM public.chapters WHERE slug='president'), 'Impeachment',
   'The President can be removed only through impeachment for violation of the Constitution (Article 61). The charge may be preferred by either House on 14 days'' notice signed by at least one-fourth of its members and passed by a two-thirds majority of the total membership. The other House then investigates and if it also passes the resolution by two-thirds of its total membership, the President stands removed. Nominated members of both Houses (who do not participate in Presidential election) do participate in impeachment.');
