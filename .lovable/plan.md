# Connect ElevenLabs and make the setup steps clear

Right now the Brand kit page says an owner "can connect a voice-cloning account" but there is no button for it. The connection is made from this chat, not inside Relay. This plan fixes that.

## Steps
1. **Connect your ElevenLabs account now.** After you approve, a connect card shows up here in chat. Either pick an existing ElevenLabs connection or create one by pasting your ElevenLabs API key.
   - Getting the key: sign in at elevenlabs.io, open your profile, then **API Keys**, then **Create API key**. Turn on Text to Speech and Voices permissions, then copy the key.
   - Voice cloning needs a paid ElevenLabs plan (Starter or higher).
2. **Rewrite the "Not set up yet" box on the Brand kit page** as numbered steps:
   1. Get a paid ElevenLabs plan with voice cloning.
   2. Create an API key (with the path above).
   3. In the Lovable editor chat, ask "connect ElevenLabs" and paste the key into the card that opens.
   - Add a "Learn more" link to the User guide section on custom voices.
   - Show these steps to owners only. Editors and viewers see "Ask an owner to set this up."
3. **Add the same steps to the User guide's "Custom voices" section.**
4. **Check it works:** once the account is connected, the Brand kit page shows "Create my voice", and a preview sample plays.

## Technical details
- Use standard_connectors--connect with connector_id "elevenlabs". This syncs ELEVENLABS_API_KEY, which voiceCloningEnabled() already reads. No code change is needed to turn the feature on.
- The text edits go in src/components/CustomVoices.tsx (based on the user's role) and src/routes/_app/guide.tsx.
