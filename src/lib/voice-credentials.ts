export function canManageVoiceConnection(role: string | undefined) {
  return role === "owner";
}