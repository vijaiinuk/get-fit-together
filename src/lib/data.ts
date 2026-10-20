import 'server-only';
import { db } from './supabase/admin';
import type { Participant, TeamStanding } from './types';

export async function getStandings(challengeId: string): Promise<TeamStanding[]> {
  const { data, error } = await db().from('team_scores').select('*').eq('challenge_id', challengeId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => {
    const total = r.individual_points + r.bonus_points + r.penalty_points;
    const average = r.member_count > 0 ? total / r.member_count : 0;
    return { ...r, total, average } as Omit<TeamStanding, 'rank'>;
  });
  rows.sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getParticipants(challengeId: string): Promise<Participant[]> {
  const { data, error } = await db()
    .from('participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('display_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Participant[];
}

// Points per participant across the whole challenge.
export async function getPointsByParticipant(challengeId: string): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('entry_scores')
    .select('participant_id, points')
    .eq('challenge_id', challengeId)
    .eq('points', 1);
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set(row.participant_id, (map.get(row.participant_id) ?? 0) + 1);
  return map;
}

export async function signedProofUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await db().storage.from('proofs').createSignedUrls(unique, 60 * 60);
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
