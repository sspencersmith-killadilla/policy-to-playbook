CREATE TABLE public.org_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_by_email text,
  name text NOT NULL,
  provider_voice_id text NOT NULL,
  consent_text text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  sample_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.org_voices TO authenticated;
GRANT ALL ON public.org_voices TO service_role;
ALTER TABLE public.org_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read voices" ON public.org_voices FOR SELECT TO authenticated USING (is_org_member(org_id, auth.uid()));
CREATE POLICY "editors add own voice" ON public.org_voices FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND has_org_role(org_id, auth.uid(), ARRAY['owner'::org_role,'editor'::org_role]));
CREATE POLICY "creator or owner deletes voice" ON public.org_voices FOR DELETE TO authenticated USING (created_by = auth.uid() OR has_org_role(org_id, auth.uid(), ARRAY['owner'::org_role]));