export type BabyType = "boy" | "girl"
export type BabyTone = BabyType | "mixed"
export type MealTrainStatus = "draft" | "published" | "completed"
export type MealDayStatus = "open" | "assigned" | "not_needed"

export interface Signup {
  id: number
  volunteer_key: string | null
  volunteer_name: string
  phone: string
  email: string | null
  meal_type: string | null
  note: string | null
  status: string
  created_at: string
}

export interface MealDay {
  id: number
  date: string
  status: MealDayStatus
  is_default: boolean
  delivery_deadline: string
  display_order: number
  admin_note: string | null
  signup: Signup | null
}

export interface IntakeForm {
  address: string
  household_size: string | null
  children_ages: string | null
  special_requirements: string | null
  kashrut: string | null
  contact_phone: string
  home_phone: string | null
  backup_phone: string | null
  delivery_deadline: string | null
  general_notes: string | null
  submitted_at: string
}

export interface MealTrainSummary {
  id: number
  family_title: string
  mother_name: string | null
  contact_phone: string | null
  baby_type: BabyType | null
  is_twins: boolean
  status: MealTrainStatus
  birth_date: string
  start_date: string
  default_delivery_time: string
  reminder_time: string
  gift_delivered: boolean
  lobby_visible: boolean
  intake_token: string
  public_token: string
  created_at: string
  intake_submitted: boolean
  intake_submitted_at: string | null
  total_days: number
  open_days: number
  assigned_days: number
  end_date: string | null
  is_archived: boolean
  urgent_open_days: number
  completion_rate: number
  risk_level: "healthy" | "watch" | "risk" | "archived"
}

export interface MealTrainDetail {
  id: number
  family_title: string
  mother_name: string | null
  contact_phone: string | null
  baby_type: BabyType | null
  is_twins: boolean
  status: MealTrainStatus
  birth_date: string
  start_date: string
  default_delivery_time: string
  reminder_time: string
  gift_delivered: boolean
  lobby_visible: boolean
  timezone: string
  intake_token: string
  public_token: string
  published_at: string | null
  created_at: string
  updated_at: string
  intake_form: IntakeForm | null
  days: MealDay[]
}

export interface PublicIntakeData {
  family_title: string
  mother_name: string | null
  contact_phone: string | null
  baby_type: BabyType | null
  is_twins: boolean
  status: MealTrainStatus
  public_token: string
  birth_date: string
  start_date: string
  default_delivery_time: string
  reminder_time: string
  days: MealDay[]
}

export interface PublicMealTrainData {
  family_title: string
  mother_name: string | null
  baby_type: BabyType | null
  is_twins: boolean
  birth_date: string
  start_date: string
  default_delivery_time: string
  reminder_time: string
  address: string | null
  household_size: string | null
  children_ages: string | null
  special_requirements: string | null
  kashrut: string | null
  contact_phone: string | null
  days: MealDay[]
  related_trains: PublicMealTrainSuggestion[]
}

export interface PublicMealTrainSuggestion {
  family_title: string
  baby_type: BabyType | null
  is_twins: boolean
  public_token: string
  open_days: number
  next_open_date: string | null
}

export interface PublicLobbyTrain {
  family_title: string
  baby_type: BabyType | null
  is_twins: boolean
  public_token: string
  start_date: string
  end_date: string | null
  open_days: number
  assigned_days: number
  next_open_date: string | null
  stage: "needs_signups" | "ongoing" | "recent"
}

export interface PublicLobbyData {
  active_trains: PublicLobbyTrain[]
  recent_trains: PublicLobbyTrain[]
}

export interface PublicVolunteerSignup {
  family_title: string
  baby_type: BabyType | null
  is_twins: boolean
  public_token: string
  date: string
  delivery_deadline: string
  address: string | null
}

export interface PublicBirthNoticeResponse {
  intake_token: string
  family_title: string
}

export interface AdminIdentity {
  id: number
  email: string
  full_name: string | null
}

export interface AdminAccount {
  id: number
  email: string
  full_name: string | null
}

export interface AdminUpcomingAssignment {
  date: string
  family_title: string
  mother_name: string | null
  baby_type: BabyType | null
  is_twins: boolean
  volunteer_name: string
  phone: string
  meal_type: string | null
  delivery_deadline: string
  address: string | null
  household_size: string | null
  children_ages: string | null
  kashrut: string | null
  special_requirements: string | null
  contact_phone: string | null
}

export interface AdminVolunteerStats {
  volunteer_key: string | null
  volunteer_name: string
  total_signups: number
  active_signups: number
  last_signup_at: string | null
}

export interface AdminAttentionTrain {
  train_id: number
  family_title: string
  mother_name: string | null
  baby_type: BabyType | null
  open_days: number
  urgent_open_days: number
  next_open_date: string | null
  completion_rate: number
}

export interface AdminOverview {
  active_train_count: number
  archived_train_count: number
  total_open_days: number
  urgent_open_days: number
  total_assigned_days: number
  upcoming_assignments: AdminUpcomingAssignment[]
  today_reminders: AdminUpcomingAssignment[]
  reminder_assignments: AdminUpcomingAssignment[]
  volunteer_stats: AdminVolunteerStats[]
  attention_trains: AdminAttentionTrain[]
}

export interface AuthResponse {
  access_token: string
  token_type: string
  admin: AdminIdentity
}
