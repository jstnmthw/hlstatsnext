/*
 * HLStatsNext Global Variables
 *
 * Shared global variables for AMX memory optimization
 */

#if defined _hlstatsnext_globals_included
  #endinput
#endif
#define _hlstatsnext_globals_included

// Constants for name length
#define MAX_NAME_LENGTH 32

// Global event data - AMX optimization pattern to avoid stack allocation
new g_steam_id[32];
new g_player_id;
new g_rank;
new g_total_players;
new g_player_skill;
new g_kills;
new g_deaths;
new Float: g_kdr;
new g_accuracy;
new g_headshots_percent;
new g_session_kills;
new g_session_deaths;
new Float: g_session_kdr;
new g_session_time;
new g_killer_id;
new g_victim_id;
new g_killer_name[MAX_NAME_LENGTH];
new g_victim_name[MAX_NAME_LENGTH];
new g_player_name[MAX_NAME_LENGTH];
new g_killer_skill;
new g_victim_skill;
new g_weapon[32];
new g_points;
new bool: g_headshot;  // Used in KILL events but not currently displayed
new g_penalty;
new g_country[64];
new g_team_name[32];
new g_action_code[32];
new g_action_desc[64];
new g_player_count;

// Global temporary string - AMX optimization to avoid repeated local allocations
new g_temp_str[32];

// HUD message globals - AMX optimization pattern to avoid stack allocation
new g_hud_message[HLSTATSNEXT_MAX_MESSAGE_LENGTH];
new g_hud_color_str[16];
new g_hud_r, g_hud_g, g_hud_b;