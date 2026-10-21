export type Challenge = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  timezone: string;
  group_min_members: number;
  group_team_bonus: number;
  fudge_penalty: number;
  is_active: boolean;
};

export type Team = {
  id: string;
  challenge_id: string;
  name: string;
  color: string;
  captain_id: string | null;
  moderator_id: string | null;
};

export type Participant = {
  id: string;
  challenge_id: string;
  team_id: string | null;
  /** What the app shows: the member's alias if they set one, otherwise their name. */
  display_name: string;
  /** The name the admin entered. Only set on rows from getParticipants()/getContext(). */
  full_name?: string;
  alias?: string | null;
  avatar_path?: string | null;
  /** Signed link to the profile picture. Only set on rows from getParticipants(). */
  avatar_url?: string | null;
  email: string | null;
  user_id: string | null;
  is_admin: boolean;
};

export type ActivityType = {
  id: string;
  challenge_id: string;
  name: string;
  unit: 'minutes' | 'steps';
  threshold: number;
  enabled: boolean;
  sort: number;
};

export type EntryStatus = 'pending' | 'verified' | 'rejected' | 'flagged';

export type EntryScore = {
  id: string;
  challenge_id: string;
  participant_id: string;
  team_id: string;
  entry_date: string;
  activity_type_id: string;
  quantity: number;
  proof_path: string;
  submitted_at: string;
  submitted_by: string | null;
  status: EntryStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  activity_name: string;
  unit: 'minutes' | 'steps';
  threshold: number;
  points: number;
};

export type GroupWorkoutScore = {
  id: string;
  team_id: string;
  workout_date: string;
  description: string;
  proof_path: string;
  created_by: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'flagged';
  review_note: string | null;
  reviewed_by: string | null;
  participant_count: number;
  team_points: number;
  created_at: string;
};

export type Scorecard = {
  team_id: string;
  score_date: string;
  status: 'submitted' | 'verified';
  submitted_by: string | null;
  submitted_at: string;
  verified_by: string | null;
  verified_at: string | null;
};

export type Penalty = {
  id: string;
  team_id: string;
  points: number;
  reason: string;
  entry_id: string | null;
  issued_by: string | null;
  created_at: string;
};

export type TeamStanding = {
  team_id: string;
  name: string;
  color: string;
  captain_id: string | null;
  moderator_id: string | null;
  individual_points: number;
  bonus_points: number;
  penalty_points: number;
  member_count: number;
  total: number;
  average: number;
  rank: number;
};
