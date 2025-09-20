/*
 * HLStatsNext Formatter Module
 *
 * Formats event data into colored messages
 */

#if defined _hlstatsnext_formatter_included
    #endinput
#endif
#define _hlstatsnext_formatter_included

#include "hlstatsnext_events.inc"
#include "hlstatsnext_colors.inc"

// Format event based on type
stock format_event_message(const EventData:data, output[], maxlen) {
    switch (data[event_type]) {
        case EVT_KILL: format_kill_event(data, output, maxlen);
        case EVT_SUICIDE: format_suicide_event(data, output, maxlen);
        case EVT_TEAMKILL: format_teamkill_event(data, output, maxlen);
        case EVT_ACTION: format_action_event(data, output, maxlen);
        case EVT_TEAM_ACTION: format_team_action_event(data, output, maxlen);
        case EVT_RANK: format_rank_event(data, output, maxlen);
        case EVT_STATS: format_stats_event(data, output, maxlen);
        case EVT_CONNECT: format_connect_event(data, output, maxlen);
        case EVT_DISCONNECT: format_disconnect_event(data, output, maxlen);
        case EVT_MESSAGE: format_generic_message(data, output, maxlen);
        default: format(output, maxlen, "[HLStatsNext]: Unknown event");
    }
}

// Format kill event
stock format_kill_event(const EventData:data, output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16], weapon_str[32];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], killer, charsmax(killer), true);
    format_colored_player(data[victim_name], victim, charsmax(victim), false);
    format_colored_points(data[points], points_str, charsmax(points_str));

    // Format weapon with headshot indicator
    if (data[headshot]) {
        format(weapon_str, charsmax(weapon_str), "%s (headshot)", data[weapon]);
    } else {
        copy(weapon_str, charsmax(weapon_str), data[weapon]);
    }

    // Include skill levels if available
    if (data[killer_skill] > 0 && data[victim_skill] > 0) {
        format(output, maxlen, "%s %s (^3%d^0) eliminated %s (^3%d^0) with %s for %s points",
               tag, killer, data[killer_skill], victim, data[victim_skill],
               weapon_str, points_str);
    } else {
        format(output, maxlen, "%s %s eliminated %s with %s for %s points",
               tag, killer, victim, weapon_str, points_str);
    }
}

// Format suicide event
stock format_suicide_event(const EventData:data, output[], maxlen) {
    new tag[32], player[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[player_name], player, charsmax(player));
    format_colored_points(-data[penalty], points_str, charsmax(points_str));

    if (data[player_skill] > 0) {
        format(output, maxlen, "%s %s (^3%d^0) lost %s points for suicide",
               tag, player, data[player_skill], points_str);
    } else {
        format(output, maxlen, "%s %s lost %s points for suicide",
               tag, player, points_str);
    }
}

// Format teamkill event
stock format_teamkill_event(const EventData:data, output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], killer, charsmax(killer), true);
    format_colored_player(data[victim_name], victim, charsmax(victim), false);
    format_colored_points(-data[penalty], points_str, charsmax(points_str));

    format(output, maxlen, "%s %s lost %s points for team killing %s",
           tag, killer, points_str, victim);
}

// Format action event
stock format_action_event(const EventData:data, output[], maxlen) {
    new tag[32], player[48], points_str[16], action[80];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[player_name], player, charsmax(player));
    format_colored_points(data[points], points_str, charsmax(points_str));
    format_colored_action(data[action_desc], action, charsmax(action));

    if (data[player_skill] > 0) {
        format(output, maxlen, "%s %s (^3%d^0) got %s points for %s",
               tag, player, data[player_skill], points_str, action);
    } else {
        format(output, maxlen, "%s %s got %s points for %s",
               tag, player, points_str, action);
    }
}

// Format team action event
stock format_team_action_event(const EventData:data, output[], maxlen) {
    new tag[32], team[48], points_str[16], action[80];

    format_colored_tag(tag, charsmax(tag));
    format_colored_team(data[team_name], team, charsmax(team));
    format_colored_points(data[points], points_str, charsmax(points_str));
    format_colored_action(data[action_desc], action, charsmax(action));

    if (data[player_count] > 0) {
        format(output, maxlen, "%s Team %s (%d players) got %s points for %s",
               tag, team, data[player_count], points_str, action);
    } else {
        format(output, maxlen, "%s Team %s got %s points for %s",
               tag, team, points_str, action);
    }
}

// Format rank event (response to !rank command)
stock format_rank_event(const EventData:data, output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    format(output, maxlen, "%s You're rank ^3#%d^0 of ^3%d^0 players with a skill of ^2%d^0",
           tag, data[rank], data[total_players], data[player_skill]);
}

// Format stats event (response to !stats command)
stock format_stats_event(const EventData:data, output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    new kdr_str[16];
    format(kdr_str, charsmax(kdr_str), "%.2f", data[kdr]);

    format(output, maxlen, "%s K/D: ^2%d^0/^1%d^0 (^3%s^0) | Accuracy: ^2%d%%^0 | Headshots: ^2%d%%^0 | Rank: ^3#%d^0",
           tag, data[kills], data[deaths], kdr_str, data[accuracy], data[headshots_percent], data[rank]);
}

// Format connect event
stock format_connect_event(const EventData:data, output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[player_name], player, charsmax(player));

    if (data[country][0] != EOS) {
        format(output, maxlen, "%s %s from ^3%s^0 connected",
               tag, player, data[country]);
    } else {
        format(output, maxlen, "%s %s connected",
               tag, player);
    }
}

// Format disconnect event
stock format_disconnect_event(const EventData:data, output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[player_name], player, charsmax(player));

    if (data[session_time] > 0) {
        new hours = data[session_time] / 3600;
        new minutes = (data[session_time] % 3600) / 60;

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

// Format generic message
stock format_generic_message(const EventData:data, output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    format(output, maxlen, "%s %s", tag, data[message]);
}

// Format team name with color
stock format_colored_team(const team[], output[], maxlen) {
    if (!are_colors_enabled()) {
        copy(output, maxlen, team);
        return;
    }

    // Apply team-specific colors
    if (equal(team, "TERRORIST") || equal(team, "T")) {
        format(output, maxlen, "^1%s^0", team); // Red for terrorists
    } else if (equal(team, "CT") || equal(team, "COUNTER-TERRORIST")) {
        format(output, maxlen, "^4%s^0", team); // Blue for CT
    } else {
        format(output, maxlen, "^3%s^0", team); // Yellow for other teams
    }
}