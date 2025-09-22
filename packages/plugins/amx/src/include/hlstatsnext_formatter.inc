/*
 * HLStatsNext Formatter Module
 *
 * Formats event data into colored messages
 * Uses global variables for AMX memory optimization
 */

#if defined _hlstatsnext_formatter_included
    #endinput
#endif
#define _hlstatsnext_formatter_included

#include "hlstatsnext_events.inc"
#include "hlstatsnext_colors.inc"
#include "hlstatsnext_globals.inc"

// Format event based on type - now uses global variables
stock format_event_message(EventType:event_type, output[], maxlen) {
    switch (event_type) {
        case EVT_KILL: format_kill_event(output, maxlen);
        case EVT_SUICIDE: format_suicide_event(output, maxlen);
        case EVT_TEAMKILL: format_teamkill_event(output, maxlen);
        case EVT_ACTION: format_action_event(output, maxlen);
        case EVT_TEAM_ACTION: format_team_action_event(output, maxlen);
        case EVT_RANK: format_rank_event(output, maxlen);
        case EVT_STATS: format_stats_event(output, maxlen);
        case EVT_SESSION: format_session_event(output, maxlen);
        case EVT_CONNECT: format_connect_event(output, maxlen);
        case EVT_DISCONNECT: format_disconnect_event(output, maxlen);
        default: format(output, maxlen, "%s: Unknown event", HLSTATSNEXT_TAG);
    }
}

// Format kill event - uses global variables
stock format_kill_event(output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16], weapon_str[32];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(g_killer_name, killer, charsmax(killer), true);
    format_colored_player(g_victim_name, victim, charsmax(victim), false);
    format_colored_points(g_points, points_str, charsmax(points_str));

    // Format weapon with headshot indicator
    if (g_headshot) {
        format(weapon_str, charsmax(weapon_str), "%s (headshot)", g_weapon);
    } else {
        copy(weapon_str, charsmax(weapon_str), g_weapon);
    }

    // Format: [PluginTag] killer (+skill) got +points for killing victim (-skill) with weapon
    if (g_killer_skill > 0 && g_victim_skill > 0) {
        format(output, maxlen, "%s %s (+%d) got %s points for killing %s (-%d) with %s",
               tag, killer, g_killer_skill, points_str, victim, g_victim_skill, weapon_str);
    } else {
        format(output, maxlen, "%s %s got %s points for killing %s with %s",
               tag, killer, points_str, victim, weapon_str);
    }
}

// Format suicide event - uses global variables
stock format_suicide_event(output[], maxlen) {
    new tag[32], player[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(g_player_name, player, charsmax(player), true);
    format_colored_points(g_penalty, points_str, charsmax(points_str));

    format(output, maxlen, "%s %s lost %s points for suicide",
           tag, player, points_str);
}

// Format teamkill event - uses global variables
stock format_teamkill_event(output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(g_killer_name, killer, charsmax(killer), true);
    format_colored_player(g_victim_name, victim, charsmax(victim), false);
    format_colored_points(-g_penalty, points_str, charsmax(points_str));

    format(output, maxlen, "%s %s lost %s points for team killing %s",
           tag, killer, points_str, victim);
}

// Format action event - uses global variables
stock format_action_event(output[], maxlen) {
    new tag[32], player[48], points_str[16], action[80];

    format_colored_tag(tag, charsmax(tag));
    copy(player, charsmax(player), g_player_name);  // No color for action events
    format_colored_points(g_points, points_str, charsmax(points_str));
    format_colored_action(g_action_desc, action, charsmax(action));

    // Format: [PluginTag] player got +points for action
    format(output, maxlen, "%s %s got %s points for %s",
           tag, player, points_str, action);
}

// Format team action event - uses global variables
stock format_team_action_event(output[], maxlen) {
    new tag[32], team[48], points_str[16], action[80];

    format_colored_tag(tag, charsmax(tag));
    format_colored_team(g_team_name, team, charsmax(team));
    format_colored_points(g_points, points_str, charsmax(points_str));
    format_colored_action(g_action_desc, action, charsmax(action));

    if (g_player_count > 0) {
        format(output, maxlen, "%s Team %s (%d players) got %s points for %s",
               tag, team, g_player_count, points_str, action);
    } else {
        format(output, maxlen, "%s Team %s got %s points for %s",
               tag, team, points_str, action);
    }
}

// Format rank event (response to !rank command) - uses global variables
stock format_rank_event(output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    format(output, maxlen, "%s Rank: #%d of %d players (Skill: %d)",
           tag, g_rank, g_total_players, g_player_skill);
}

// Format stats event (response to !stats command) - uses global variables
stock format_stats_event(output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    format(output, maxlen, "%s Stats: #%d/%d | K/D: %d/%d (%.2f) | Skill: %d",
           tag, g_rank, g_total_players, g_kills, g_deaths, g_kdr, g_player_skill);
}

// Format session event (response to !session command) - uses global variables
stock format_session_event(output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    // Use pre-calculated time formatting based on duration
    new hours = g_session_time / 3600;
    new minutes = (g_session_time % 3600) / 60;
    new seconds = g_session_time % 60;

    if (hours > 0) {
        format(output, maxlen, "%s Session: %d kills, %d deaths (%.2f) | Time: %dh %dm %ds",
               tag, g_session_kills, g_session_deaths, g_session_kdr, hours, minutes, seconds);
    } else if (minutes > 0) {
        format(output, maxlen, "%s Session: %d kills, %d deaths (%.2f) | Time: %dm %ds",
               tag, g_session_kills, g_session_deaths, g_session_kdr, minutes, seconds);
    } else {
        format(output, maxlen, "%s Session: %d kills, %d deaths (%.2f) | Time: %ds",
               tag, g_session_kills, g_session_deaths, g_session_kdr, seconds);
    }
}

// Format connect event - uses global variables
stock format_connect_event(output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(g_player_name, player, charsmax(player));

    if (g_country[0] != EOS) {
        format(output, maxlen, "%s %s from %s connected",
               tag, player, g_country);
    } else {
        format(output, maxlen, "%s %s connected",
               tag, player);
    }
}

// Format disconnect event - uses global variables
stock format_disconnect_event(output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(g_player_name, player, charsmax(player));

    if (g_session_time > 0) {
        new hours = g_session_time / 3600;
        new minutes = (g_session_time % 3600) / 60;

        if (hours > 0) {
            format(output, maxlen, "%s %s disconnected (session: %dh %dm)",
                   tag, player, hours, minutes);
        } else {
            format(output, maxlen, "%s %s disconnected (session: %d minutes)",
                   tag, player, minutes);
        }
    } else {
        format(output, maxlen, "%s %s disconnected",
               tag, player);
    }
}

// Format generic message - removed since we don't use EventData message field anymore
// Generic messages would be handled differently now

// Format team name with color
stock format_colored_team(const team[], output[], maxlen) {
    if (!are_colors_enabled()) {
        copy(output, maxlen, team);
        return;
    }

    // Apply team-specific colors using proper client_print_color codes
    if (equal(team, "TERRORIST") || equal(team, "T")) {
        format(output, maxlen, "^3%s^1", team); // Team color for terrorists
    } else if (equal(team, "CT") || equal(team, "COUNTER-TERRORIST")) {
        format(output, maxlen, "^3%s^1", team); // Team color for CT
    } else {
        format(output, maxlen, "^4%s^1", team); // Green for other teams
    }
}