import freshStart from "@/assets/explainer-fresh-start.mp3.asset.json";
import mirrorBed from "@/assets/explainer-mirror-music-bed.mp3.asset.json";
import morningMeditation from "@/assets/explainer-morning-meditation.mp3.asset.json";
import type { ExplainerMusicTrack } from "./course";

export const DEFAULT_MUSIC_TRACK: ExplainerMusicTrack = "mirror-bed";

export const EXPLAINER_MUSIC_TRACKS: { id: ExplainerMusicTrack; name: string; description: string; url: string }[] = [
  { id: "mirror-bed", name: "Focused", description: "Mirror of the Week — a steady, unobtrusive music bed", url: mirrorBed.url },
  { id: "fresh-start", name: "Upbeat", description: "Fresh Start — brighter and more energetic", url: freshStart.url },
  { id: "morning-meditation", name: "Calm", description: "Morning Meditation — slow and reflective", url: morningMeditation.url },
];

export function getExplainerMusicTrack(id: string | null | undefined) {
  return EXPLAINER_MUSIC_TRACKS.find((track) => track.id === id) ?? EXPLAINER_MUSIC_TRACKS[0]!;
}
