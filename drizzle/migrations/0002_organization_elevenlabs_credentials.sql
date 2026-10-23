CREATE TABLE public.org_voice_credentials (
 org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
 encrypted_key text NOT NULL,
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 tested_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.org_voice_credentials TO service_role;
REVOKE ALL ON public.org_voice_credentials FROM anon, authenticated;
ALTER TABLE public.org_voice_credentials ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.org_voice_credentials IS 'Server-only AES-GCM credentials. No browser access; server functions authorize membership/owner before privileged access.';