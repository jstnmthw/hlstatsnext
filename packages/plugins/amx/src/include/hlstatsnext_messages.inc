/*
 * HLStatsNext Message Module
 *
 * Handles message formatting and processing
 */

#if defined _hlstatsnext_messages_included
    #endinput
#endif
#define _hlstatsnext_messages_included

// Message type enumeration
enum MessageType {
    MSG_KILL,
    MSG_SUICIDE,
    MSG_TEAMKILL,
    MSG_ACTION,
    MSG_CONNECT,
    MSG_DISCONNECT,
    MSG_GENERAL
}

// Message formatting data structure
enum MessageData {
    MessageType:msg_type,
    killer_name[32],
    victim_name[32],
    action_text[64],
    points,
    bool:has_points
}

// Message module initialization
stock hlstatsnext_messages_init() {
    log_amx("[HLStatsNext] Message system initialized");
}

// Main message formatting function
stock format_hlstatsnext_message(const raw_message[], output[], maxlen) {
    new MessageData:data;

    // Parse the raw message to extract components
    parse_message_data(raw_message, data);

    // Format the message based on type
    switch (data[msg_type]) {
        case MSG_KILL: {
            format_kill_message(data, output, maxlen);
        }
        case MSG_SUICIDE: {
            format_suicide_message(data, output, maxlen);
        }
        case MSG_TEAMKILL: {
            format_teamkill_message(data, output, maxlen);
        }
        case MSG_ACTION: {
            format_action_message(data, output, maxlen);
        }
        case MSG_CONNECT: {
            format_connect_message(data, output, maxlen);
        }
        case MSG_DISCONNECT: {
            format_disconnect_message(data, output, maxlen);
        }
        default: {
            format_general_message(raw_message, output, maxlen);
        }
    }
}

// Parse message data from raw input
stock parse_message_data(const raw_message[], MessageData:data) {
    // Initialize data
    data[msg_type] = MSG_GENERAL;
    data[killer_name][0] = EOS;
    data[victim_name][0] = EOS;
    data[action_text][0] = EOS;
    data[points] = 0;
    data[has_points] = false;

    // Simple parsing logic - this would be enhanced based on actual message formats
    if (containi(raw_message, "killed") != -1) {
        data[msg_type] = MSG_KILL;
        parse_kill_data(raw_message, data);
    } else if (containi(raw_message, "suicide") != -1) {
        data[msg_type] = MSG_SUICIDE;
        parse_suicide_data(raw_message, data);
    } else if (containi(raw_message, "points") != -1) {
        data[msg_type] = MSG_ACTION;
        parse_action_data(raw_message, data);
    }
    // Add more parsing logic as needed
}

// Parse kill event data
stock parse_kill_data(const raw_message[], MessageData:data) {
    // Extract killer and victim names, points
    // This is a simplified implementation
    new temp[128];
    copy(temp, charsmax(temp), raw_message);

    // Parse points if present
    new pos = containi(temp, "points");
    if (pos != -1) {
        data[has_points] = true;
        // Extract points value - simplified
        new points_str[16];
        new scan_pos = pos - 1;
        while (scan_pos > 0 && temp[scan_pos] == ' ') scan_pos--;
        new end_pos = scan_pos;
        while (scan_pos > 0 && (isdigit(temp[scan_pos]) || temp[scan_pos] == '-' || temp[scan_pos] == '+')) scan_pos--;
        if (scan_pos < end_pos) {
            strmid(points_str, temp, scan_pos + 1, end_pos + 1, charsmax(points_str));
            data[points] = str_to_num(points_str);
        }
    }
}

// Parse suicide event data
stock parse_suicide_data(const raw_message[], MessageData:data) {
    // Extract player name and penalty
    // Simplified implementation
    data[has_points] = true;
    data[points] = -2; // Default suicide penalty
}

// Parse action event data
stock parse_action_data(const raw_message[], MessageData:data) {
    // Extract action and points
    new pos = containi(raw_message, "got");
    if (pos != -1) {
        // Simple extraction of points value
        new temp_msg[256];
        copy(temp_msg, charsmax(temp_msg), raw_message[pos + 4]);

        new points_str[16], i = 0;
        while (i < strlen(temp_msg) && !isdigit(temp_msg[i]) && temp_msg[i] != '-' && temp_msg[i] != '+') i++;
        new start = i;
        while (i < strlen(temp_msg) && (isdigit(temp_msg[i]) || temp_msg[i] == '-' || temp_msg[i] == '+')) i++;

        if (i > start) {
            strmid(points_str, temp_msg, start, i, charsmax(points_str));
            data[points] = str_to_num(points_str);
            data[has_points] = true;
        }

        // Extract action text
        pos = containi(temp_msg, "for ");
        if (pos != -1) {
            copy(data[action_text], charsmax(data[action_text]), temp_msg[pos + 4]);
        }
    }
}

// Format kill message
stock format_kill_message(const MessageData:data, output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], killer, charsmax(killer), true);
    format_colored_player(data[victim_name], victim, charsmax(victim), false);

    if (data[has_points]) {
        format_colored_points(data[points], points_str, charsmax(points_str));
        format(output, maxlen, "%s: %s eliminated %s (%s points)", tag, killer, victim, points_str);
    } else {
        format(output, maxlen, "%s: %s eliminated %s", tag, killer, victim);
    }
}

// Format suicide message
stock format_suicide_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player), true);
    format_colored_points(data[points], points_str, charsmax(points_str));

    format(output, maxlen, "%s: %s committed suicide (%s points)", tag, player, points_str);
}

// Format teamkill message
stock format_teamkill_message(const MessageData:data, output[], maxlen) {
    new tag[32], killer[48], victim[48], points_str[16];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], killer, charsmax(killer), true);
    format_colored_player(data[victim_name], victim, charsmax(victim), false);
    format_colored_points(data[points], points_str, charsmax(points_str));

    format(output, maxlen, "%s: %s team-killed %s (%s points)", tag, killer, victim, points_str);
}

// Format action message
stock format_action_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48], points_str[16], action[80];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player));
    format_colored_points(data[points], points_str, charsmax(points_str));
    format_colored_action(data[action_text], action, charsmax(action));

    format(output, maxlen, "%s: %s got %s points for %s", tag, player, points_str, action);
}

// Format connection message
stock format_connect_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player));

    format(output, maxlen, "%s: %s connected to the server", tag, player);
}

// Format disconnection message
stock format_disconnect_message(const MessageData:data, output[], maxlen) {
    new tag[32], player[48];

    format_colored_tag(tag, charsmax(tag));
    format_colored_player(data[killer_name], player, charsmax(player));

    format(output, maxlen, "%s: %s disconnected from the server", tag, player);
}

// Format general message
stock format_general_message(const raw_message[], output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    // Strip any server prefixes from the raw message
    new clean_message[256];
    strip_server_prefix(raw_message, clean_message, charsmax(clean_message));

    format(output, maxlen, "%s: %s", tag, clean_message);
}

// Strip server prefix from message
stock strip_server_prefix(const raw_message[], output[], maxlen) {
    new pos = containi(raw_message, "[HLStatsNext]");
    if (pos != -1) {
        // Find the start of the actual message after the tag
        new start = pos + 13; // Length of "[HLStatsNext]"
        while (raw_message[start] == ':' || raw_message[start] == ' ') {
            start++;
        }
        copy(output, maxlen, raw_message[start]);
    } else {
        // Look for common server prefixes and remove them
        new stripped[256];
        copy(stripped, charsmax(stripped), raw_message);

        // Remove "(ALL)" prefix
        pos = containi(stripped, "(ALL)");
        if (pos == 0) {
            new start = 5;
            while (stripped[start] == ' ') start++;
            copy(stripped, charsmax(stripped), stripped[start]);
        }

        // Remove server name prefixes like "[0x1] Server Name :"
        pos = contain(stripped, "] ");
        if (pos != -1 && stripped[0] == '[') {
            new start = pos + 2;
            pos = containi(stripped[start], " : ");
            if (pos != -1) {
                start = start + pos + 3;
                copy(stripped, charsmax(stripped), stripped[start]);
            }
        }

        copy(output, maxlen, stripped);
    }
}

// Format statistics message for hlx_psay command
stock format_statistics_message(const raw_message[], output[], maxlen) {
    new tag[32];
    format_colored_tag(tag, charsmax(tag));

    // Check if message contains rank information
    if (containi(raw_message, "rank") != -1 && containi(raw_message, "of") != -1 && containi(raw_message, "players") != -1) {
        format_rank_message(raw_message, tag, output, maxlen);
    }
    // Check if message contains statistics information
    else if (containi(raw_message, "K/D") != -1 || containi(raw_message, "Accuracy") != -1) {
        format_stats_message(raw_message, tag, output, maxlen);
    }
    // Check if message contains top10 information
    else if (containi(raw_message, "Top 10") != -1) {
        format_top10_message(raw_message, tag, output, maxlen);
    }
    // Default formatting for other statistics messages
    else {
        format(output, maxlen, "%s: %s", tag, raw_message);
    }
}

// Format rank response message
stock format_rank_message(const raw_message[], const tag[], output[], maxlen) {
    // Parse: "You're rank 1 of 1,243 players with a skill of 2,103"
    new rank_str[16], total_str[16], skill_str[16];

    // Extract rank number
    new pos = containi(raw_message, "rank ");
    if (pos != -1) {
        new i = pos + 5;
        new j = 0;
        while (raw_message[i] != EOS && raw_message[i] != ' ' && j < charsmax(rank_str) - 1) {
            if (isdigit(raw_message[i]) || raw_message[i] == ',') {
                rank_str[j++] = raw_message[i];
            }
            i++;
        }
        rank_str[j] = EOS;
    }

    // Extract total players
    pos = containi(raw_message, " of ");
    if (pos != -1) {
        new i = pos + 4;
        new j = 0;
        while (raw_message[i] != EOS && raw_message[i] != ' ' && j < charsmax(total_str) - 1) {
            if (isdigit(raw_message[i]) || raw_message[i] == ',') {
                total_str[j++] = raw_message[i];
            }
            i++;
        }
        total_str[j] = EOS;
    }

    // Extract skill
    pos = containi(raw_message, "skill of ");
    if (pos != -1) {
        new i = pos + 9;
        new j = 0;
        while (raw_message[i] != EOS && j < charsmax(skill_str) - 1) {
            if (isdigit(raw_message[i]) || raw_message[i] == ',') {
                skill_str[j++] = raw_message[i];
            }
            i++;
        }
        skill_str[j] = EOS;
    }

    // Format with colors: rank (yellow), total (yellow), skill (green)
    format(output, maxlen, "%s: You're rank ^3#%s^0 of ^3%s^0 players with a skill of ^2%s^0",
           tag, rank_str, total_str, skill_str);
}

// Format stats response message
stock format_stats_message(const raw_message[], const tag[], output[], maxlen) {
    // Parse: "K/D: 2.5 | Accuracy: 75% | Headshots: 25%"
    new formatted[256];
    copy(formatted, charsmax(formatted), raw_message);

    // Color numerical values in green
    replace_all(formatted, charsmax(formatted), ":", ": ^2");
    replace_all(formatted, charsmax(formatted), " |", "^0 |");
    replace_all(formatted, charsmax(formatted), "%", "%^0");

    format(output, maxlen, "%s: %s", tag, formatted);
}

// Format top10 response message
stock format_top10_message(const raw_message[], const tag[], output[], maxlen) {
    // Parse: "Top 10: 1. ProGamer (2500) 2. Elite (2400) ..."
    new formatted[256];
    copy(formatted, charsmax(formatted), raw_message);

    // Color rank numbers in yellow and player names in red
    replace_all(formatted, charsmax(formatted), "1. ", "^31. ^1");
    replace_all(formatted, charsmax(formatted), "2. ", "^32. ^1");
    replace_all(formatted, charsmax(formatted), "3. ", "^33. ^1");
    replace_all(formatted, charsmax(formatted), "4. ", "^34. ^1");
    replace_all(formatted, charsmax(formatted), "5. ", "^35. ^1");
    replace_all(formatted, charsmax(formatted), "6. ", "^36. ^1");
    replace_all(formatted, charsmax(formatted), "7. ", "^37. ^1");
    replace_all(formatted, charsmax(formatted), "8. ", "^38. ^1");
    replace_all(formatted, charsmax(formatted), "9. ", "^39. ^1");
    replace_all(formatted, charsmax(formatted), "10. ", "^310. ^1");
    replace_all(formatted, charsmax(formatted), ") ", ")^0 ");

    format(output, maxlen, "%s: %s", tag, formatted);
}