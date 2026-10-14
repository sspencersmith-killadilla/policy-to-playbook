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

        <H id="brand">2. Set up your brand kit</H>
        <p>Open <Link to="/brand" className="text-primary underline">Brand kit</Link> in the sidebar. Do this once; it applies to every course.</p>
        <ul>
          <li><b>Logo</b> – a PNG or JPG under 400 KB. It appears on every slide.</li>
          <li><b>Colors</b> – primary, accent and background colors for slides.</li>
          <li><b>Heading font / Body font</b> – fonts used on slides and exports.</li>
          <li><b>Narrator voice</b> – the AI voice used for voiceovers and the narrated video.</li>
        </ul>
        <Tip>The slide preview on the page updates as you change things. Click <b>Save brand kit</b> when done.</Tip>

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
          <li><b>Hear voiceover</b> – hear how the notes sound in your chosen voice.</li>
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
          <li><b>Narrated video</b> – slides with voiceover and any scene clips. It records in real time, so a 10-minute course takes about 10 minutes. Keep the tab open and visible. The file downloads as a WebM video.</li>
          <li><b>SCORM 1.2 package</b> – a zip you upload to your LMS (Canvas, Moodle, Cornerstone, etc.). It includes the quiz and reports scores to the LMS.</li>
        </ul>

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
          <li><b>Video export stalls?</b> Keep the tab in front; browsers slow down background tabs.</li>
          <li><b>Didn't get an email?</b> Check spam, then use Resend or copy the invite link.</li>
        </ul>
      </article>
    </div>
  );
}
