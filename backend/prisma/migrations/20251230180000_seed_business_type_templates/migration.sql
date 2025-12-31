-- Insert default business type templates (reference data)
-- These templates are required for the application to function properly

INSERT INTO "business_type_templates" (
    "id", "name", "description", "is_default", "is_active",
    "staff_label", "staff_label_singular",
    "patient_label", "patient_label_singular",
    "room_label", "room_label_singular",
    "certification_label", "equipment_label",
    "suggested_certifications", "suggested_room_equipment",
    "created_at", "updated_at"
) VALUES
(
    'tmpl_aba_therapy',
    'ABA Therapy',
    'Applied Behavior Analysis therapy practices',
    true, true,
    'Therapists', 'Therapist',
    'Clients', 'Client',
    'Treatment Rooms', 'Treatment Room',
    'Certifications', 'Equipment',
    '["BCBA", "BCaBA", "RBT", "BCBA-D", "ABA", "Pediatrics"]',
    '["sensory_equipment", "therapy_swing", "quiet_space", "observation_mirror", "reward_station"]',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'tmpl_speech_therapy',
    'Speech Therapy',
    'Speech-Language Pathology practices',
    false, true,
    'Clinicians', 'Clinician',
    'Clients', 'Client',
    'Treatment Rooms', 'Treatment Room',
    'Credentials', 'Equipment',
    '["CCC-SLP", "CF-SLP", "SLPA", "AAC Specialist", "Feeding Specialist"]',
    '["sound_booth", "mirror_wall", "computer_station", "therapy_materials", "articulation_tools"]',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'tmpl_occupational_therapy',
    'Occupational Therapy',
    'Occupational therapy practices',
    false, true,
    'Therapists', 'Therapist',
    'Clients', 'Client',
    'Therapy Spaces', 'Therapy Space',
    'Certifications', 'Features',
    '["OTR/L", "COTA/L", "CHT", "Sensory Integration", "Pediatric OT"]',
    '["sensory_equipment", "therapy_swing", "fine_motor_station", "large_space", "wheelchair_accessible"]',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'tmpl_physical_therapy',
    'Physical Therapy',
    'Physical therapy practices',
    false, true,
    'Therapists', 'Therapist',
    'Patients', 'Patient',
    'Treatment Areas', 'Treatment Area',
    'Specializations', 'Equipment',
    '["DPT", "PTA", "OCS", "NCS", "Pediatric PT", "Sports PT"]',
    '["treatment_table", "exercise_equipment", "parallel_bars", "wheelchair_accessible", "gait_training"]',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
    'tmpl_general_therapy',
    'General Therapy Practice',
    'Multi-discipline therapy practices',
    false, true,
    'Staff', 'Staff Member',
    'Clients', 'Client',
    'Rooms', 'Room',
    'Certifications', 'Capabilities',
    '[]',
    '["wheelchair_accessible", "quiet_space", "computer_station"]',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
