import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/guide")({
  head: () => ({
    meta: [
      { title: "User guide · Relay" },
      { name: "description", content: "Step-by-step guide to building, editing, approving and exporting policy training in Relay." },
      { property: "og:title", content: "User guide · Relay" },
      { property: "og:description", content: "Step-by-step guide to building, editing, approving and exporting policy training in Relay." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Guide,
});

const sections = [
  { id: "start", title: "1. Getting started" },
  { id: "brand", title: "2. Set up your brand kit" },
  { id: "team", title: "3. Invite your team" },
  { id: "create", title: "4. Create a course from a policy" },
  { id: "edit", title: "5. Edit slides and the quiz" },
  { id: "clips", title: "6. Add AI video clips" },
  { id: "approve", title: "7. Review and approve" },
  { id: "export", title: "8. Export and share" },
  { id: "versions", title: "9. Versions and activity" },
  { id: "limits", title: "10. Limits and troubleshooting" },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-6 border-t pt-8 font-display text-2xl font-semibold text-primary">{children}</h2>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border-l-4 border-accent bg-accent/10 p-3 text-sm">{children}</div>;
}

function Guide() {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-8 py-10">
      <nav className="sticky top-10 hidden h-fit w-56 shrink-0 space-y-1 text-sm lg:block">
        <p className="mb-2 font-semibold">On this page</p>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">{s.title}</a>
        ))}
      </nav>
      <article className="min-w-0 max-w-3xl space-y-5 leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-1">
        <header>
          <h1 className="font-display text-4xl font-bold text-gradient-brand">Relay user guide</h1>
          <p className="mt-2 text-lg text-muted-foreground">Turn a written policy or SOP into branded training: slides, a quiz, a narrated video and an LMS package.</p>
        </header>

        <H id="start">1. Getting started</H>
        <ol>
          <li>Sign up with your email (or Google) and confirm your email address.</li>
          <li>Name your organization. You become its <b>Owner</b>. Everything you create lives inside that organization and is private to its members.</li>
          <li>Belong to more than one organization? Switch between them with the menu at the top of the left sidebar.</li>
        </ol>
        <p><b>Roles:</b></p>
        <ul>
          <li><b>Owner</b> – everything, including inviting people and changing roles.</li>
          <li><b>Editor</b> – create, edit, approve and export courses; edit the brand kit.</li>
          <li><b>Viewer</b> – view and present courses only.</li>
        </ul>

        <H id="brand">2. Set up your brand kits</H>
        <p>Open <Link to="/brand" className="text-primary underline">Brand kit</Link> in the sidebar. Your organization has four kits: A, B, C and D. Give each a name, logo, colors, fonts and narrator voice. Kits B–D start as copies of Kit A.</p>
        <p>On a course, use <b>Course brand</b> at the top to choose its kit. Changing that choice affects only this course; it does not rebrand your other courses. Editing a kit later updates every course that uses that kit.</p>
        <ul>
          <li><b>Logo</b> – a PNG or JPG under 400 KB. It appears on every slide.</li>
          <li><b>Colors</b> – primary, accent and background colors for slides.</li>
          <li><b>Heading font / Body font</b> – fonts used on slides and exports.</li>
          <li><b>Narrator voice</b> – the AI voice used for voiceovers and the narrated video.</li>
          <li id="custom-voices"><b>Custom voices</b> – once an owner connects a voice-cloning account (ElevenLabs), any editor can press <b>Create my voice</b>, agree to the consent statement, record or upload 1–3 minutes of themselves reading, and name it. The voice then appears under <b>Your team's voices</b> in every voice menu. Up to 10 per organization; the creator or an owner can delete a voice any time, and slides using it go back to the brand kit voice.
            <ol className="mt-1 list-decimal pl-5"><b>Turning it on (one time, owner):</b>
              <li>Get a paid ElevenLabs plan with voice cloning (Starter or higher) at elevenlabs.io.</li>
              <li>In ElevenLabs, open <b>API Keys</b> → <b>Create API key</b>, allow <b>Voices: Read and Write</b> and <b>Text to Speech</b>, and copy the key.</li>
              <li>In Relay's <b>Brand kit</b>, under <b>Custom voices → ElevenLabs</b>, enter the key and click <b>Test &amp; save key</b>. The voice read permission is checked before saving; creating a voice also requires Write, and narration requires Text to Speech.</li>
              <li>Only owners can test, replace or remove the connection. Each organization has its own encrypted key; it is never displayed again. Removing it keeps existing team voices but pauses their use until the same ElevenLabs account is reconnected. Replace with a key from the same account to keep existing voices usable. ElevenLabs bills your account for usage.</li>
            </ol></li>
        </ul>
        <Tip>The slide preview updates as you change things. Click <b>Save kit</b> when done. Changing a course's brand choice moves it back to draft so it can be reviewed and approved again.</Tip>

        <H id="team">3. Invite your team</H>
        <ol>
          <li>Open <Link to="/team" className="text-primary underline">Team</Link>, enter a colleague's email, pick a role and click <b>Invite</b>.</li>
          <li>They get an invitation email. The invite link is also copied so you can send it yourself.</li>
          <li>Didn't arrive? Click <b>Resend</b> next to the pending invite, or paste the link into a message.</li>
        </ol>

        <H id="create">4. Create a course from a policy</H>
        <ol>
          <li>Click <Link to="/new" className="text-primary underline">New course</Link>.</li>
          <li>Upload a PDF, Word or text file (up to 20 MB), <b>or paste the policy text</b>.</li>
          <li>Optional: give a <b>Document title</b> and an <b>Audience</b> (for example "new warehouse staff" or "people managers"). The audience shapes tone and examples.</li>
          <li>Click generate. In about a minute you get 10–18 slides, learning objectives, scenario slides and a 5–8 question quiz.</li>
        </ol>
        <Tip>Relay only uses facts from your document. Every slide and quiz question shows the policy <b>section it came from</b>, so reviewers can check it quickly.</Tip>

        <H id="edit">5. Edit slides and the quiz</H>
        <p>Open a course from <Link to="/dashboard" className="text-primary underline">Courses</Link>. Slides are listed on the left; the selected slide's details are on the right.</p>
        <ul>
          <li><b>Edit text</b> – change the title, bullets, body and layout. Changes save automatically.</li>
          <li><b>Speaker notes</b> – this is the narration script. It becomes the voiceover in the narrated video.</li>
          <li><b>Voiceover</b> – choose <b>AI voice</b> (press <b>Hear AI voiceover</b> to listen) or <b>My own recording</b>. Press <b>Record</b>, read the narration script aloud, then <b>Stop recording</b>, or upload an audio file. Your recording replaces the AI voice for that slide in the narrated video and SCORM video.</li>
          <li><b>Rewrite with AI</b> – type an instruction such as "shorter and friendlier" and click <b>Rewrite slide</b>.</li>
          <li><b>Reorder, duplicate or delete</b> slides with the buttons on each slide.</li>
          <li><b>Quiz</b> – edit questions, the four answer options, which one is correct, the explanation and the pass score.</li>
        </ul>

        <H id="clips">6. Add AI video clips</H>
        <p>A scene clip is a short (6-second) AI-generated video of a realistic workplace moment. It plays <b>right before its slide in the narrated video</b>. Clips work best on scenario slides.</p>
        <ol>
          <li>In the course editor, click the slide you want, ideally a <b>Scenario</b> slide.</li>
          <li>Scroll down the right-hand panel to the box called <b>AI scene clip (video only)</b>.</li>
          <li>Click <b>Write prompt from narration</b>. Relay reads the slide's narration and text and writes a scene description built for a 6-second clip: one moment, one camera move, no speech or on-screen text. Edit it if you like, or write your own. This uses very few credits and doesn't make a video yet.</li>
          <li>Click <b>Generate clip</b> and confirm the credit warning.</li>
          <li>Wait 1–3 minutes, keeping the tab open. The button shows progress.</li>
          <li>When done, the clip appears in a player in the box. Watch it. Use <b>Replace clip</b> to try again or <b>Remove</b> to drop it.</li>
          <li>Approve the course, then choose <b>Export → Narrated video</b>. The clip plays before that slide.</li>
          <li>In explainer videos, a clip shorter than its voiceover plays once (never loops), then fades into a slide showing the same scene's key words for the rest of the narration.</li>
        </ol>
        <Tip>To do every scenario slide at once, click <b>Write prompts for all scenario slides</b> under the slide list. It fills in a prompt on each scenario slide that doesn't have one; then visit each slide, review, and click Generate clip.</Tip>
        <p><b>Writing a good scene description yourself:</b></p>
        <ul>
          <li>Say who, where and what happens: "A nurse at a hospital front desk politely declines a gift basket from a visitor."</li>
          <li>Describe one moment. A 6-second clip can't tell a long story.</li>
          <li>Don't ask for words, signs or speech. Clips have no dialogue or on-screen text. The narration explains the scene.</li>
          <li>Avoid real people, brand names, violence or injuries; safety filters may block these.</li>
        </ul>
        <Tip>Clips appear only in the narrated video, not in PDF, PowerPoint or SCORM exports. Each clip uses noticeably more AI credits than text, and each organization can make up to 20 clips every 30 days.</Tip>

        <H id="approve">7. Review and approve</H>
        <ol>
          <li>Click <b>Present</b> to view the course full screen to read it as a learner would.</li>
          <li>Check each slide against its cited policy section. Have HR or legal review it if needed.</li>
          <li>Click <b>Approve</b>. This unlocks exports and saves an "Approved" version.</li>
        </ol>
        <Tip>Any edit after approval moves the course back to <b>draft</b>, so you'll need to approve it again before exporting.</Tip>

        <H id="export">8. Export and share</H>
        <p>Click <b>Export</b> at the top of the course editor:</p>
        <ul>
          <li><b>PDF handout</b> – opens a print view; choose "Save as PDF".</li>
          <li><b>PowerPoint (.pptx)</b> – editable slides with speaker notes.</li>
          <li><b>Narrated video</b> – slides with voiceover and any scene clips. It builds faster than real time (a 10-minute course takes about 1–3 minutes) and downloads as an MP4. Tick <b>Full HD (1080p)</b> for a sharper, larger file. You can switch to other tabs while it builds, but don't close this one. Older browsers fall back to real-time recording; Relay tells you when that happens.</li>
          <li><b>SCORM 1.2 package</b> – a zip you upload to your LMS (Canvas, Moodle, Cornerstone, etc.). It includes the quiz and reports scores to the LMS. You choose:
            <ul>
              <li><b>Narrated video</b> – learners watch the narrated video, with scene clips, captions and a clickable slide list, then take the quiz. Leave <b>Require watching the whole video</b> on to block skipping ahead and keep the quiz locked until the end. Learners resume where they left off. It builds faster than real time, and the file is larger (about 2–4 MB per minute), so check your LMS upload limit.</li>
              <li><b>Slides</b> – learners click through the slides and narration text. Fast to build, small file.</li>
            </ul></li>
        </ul>

        <H id="explainer">Explainer video (not a slideshow)</H>
        <p>Click <b>Explainer video</b> at the top of the course editor. It makes a short video that teaches the policy like a documentary: a hook, why it matters, the key ideas, a real-life scenario and a recap. It uses moving diagrams, Do / Don't lists, step-by-step paths, quotes from the policy, big facts and illustrations, all in your brand colors.</p>
        <ol>
          <li>Choose a <b>Length</b> (about 2, 4 or 6 minutes) and <b>Tone</b>. Leave <b>AI illustrations</b> on for drawn pictures (each uses AI credits), or turn it off for shapes and diagrams only. If slides have AI video clips, <b>Use my AI video clips</b> lets them play behind scenario scenes.</li>
          <li>Click <b>Write script</b>. Read every scene. You can change the narration, the on-screen words, the scene type, the order, or delete and add scenes. Changes save on their own and don't undo approval.</li>
          <li>For picture scenes, press <b>Draw picture</b>, or <b>Upload my own photo</b>. Choose a focal point on the original photo or with the focal-point sliders, and adjust <b>Zoom</b>. The <b>Video crop</b> preview shows the framing used in MP4 and SCORM exports. <b>Reset photo framing</b> restores the centered view.</li>
          <li>Under each scene's <b>Voiceover</b>, pick an AI voice or press <b>Upload my audio</b> (MP3, WAV, or another browser-playable audio file, under 15 MB). Play it back, replace it, or remove it to return to AI narration. The scene lasts as long as your audio; keep the written narration matched to your recording for captions.</li>
          <li>Pick a <b>Video style</b>. <b>Animated</b> uses motion graphics: the camera drifts, words and diagrams build in time with the narration, numbers count up, photos slowly zoom, and scenes change with slides, wipes and fades. <b>AI video footage</b> gives each scene a short AI clip of a workplace moment with its words animated on top. You can change the style for any single scene with the menu next to its type. For footage scenes press <b>Make footage</b> (or <b>Make clip</b> on one scene); the description is written from the narration unless you type your own. Clips take 1–3 minutes each and use the organization's 20 clips every 30 days. A footage scene without a clip is animated instead. Turn <b>Background music</b> on or off; it gets quieter while the narrator speaks.</li>
          <li>Once the course is approved, click <b>Download MP4</b> (captions are shown on screen) or <b>SCORM package with quiz</b> (captions can be turned on in the player, and learners take the quiz after watching).</li>
        </ol>
        <Tip>Writing a script counts toward the 30 AI generations every 30 days. An explainer can use up to 15 illustrations, and each organization can draw up to 60 every 30 days.</Tip>

        <H id="versions">9. Versions and activity</H>
        <ul>
          <li><b>Versions</b> – in the course editor you can see snapshots (AI draft, approvals) and <b>Restore</b> any of them. Click <b>Save a version now</b> before big changes.</li>
          <li><b>Activity</b> – the <Link to="/activity" className="text-primary underline">Activity</Link> page shows who generated, edited, approved and exported what, and when.</li>
        </ul>

        <H id="limits">10. Limits and troubleshooting</H>
        <ul>
          <li><b>Limits per organization:</b> 30 course generations and 20 scene clips every 30 days.</li>
          <li><b>Export menu greyed out?</b> Approve the course first.</li>
          <li><b>Clip blocked by safety filters?</b> Reword the scene more neutrally and try again.</li>
          <li><b>Clip taking too long?</b> Try again later; only one clip can generate at a time.</li>
          <li><b>"Out of AI credits"?</b> Your workspace needs more credits before AI features work again.</li>
          <li><b>Video export stalls?</b> Use a current version of Chrome, Edge or Safari. If Relay says it's recording in real time, keep the tab in front.</li>
          <li><b>Didn't get an email?</b> Check spam, then use Resend or copy the invite link.</li>
        </ul>
      </article>
    </div>
  );
}
