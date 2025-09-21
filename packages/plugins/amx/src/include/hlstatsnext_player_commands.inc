/*
 * HLStatsNext Player Commands Module
 *
 * Handles player public commands like !rank, !stats, !help, !top10
 */

#if defined _hlstatsnext_player_commands_included
    #endinput
#endif
#define _hlstatsnext_player_commands_included

// Player commands initialization
stock hlstatsnext_player_commands_init() {
    log_amx("[HLStatsNext]: Player commands system initialized");
}

// Handle player say/say_team commands
public handle_say(id) {
    new said[192];
    read_args(said, charsmax(said));
    remove_quotes(said);

    // Check if it's a command (starts with ! or /)
    if (said[0] != '!' && said[0] != '/') {
        return PLUGIN_CONTINUE;
    }

    // Get the command (remove the ! or /)
    new command[32];
    strtok(said[1], command, charsmax(command), said, charsmax(said), ' ');
    strlower(command);

    // Process known commands
    if (equal(command, "help")) {
        client_print(id, print_chat, "[HLStatsNext]: Available commands: !rank !stats !top10 !help");
        return PLUGIN_HANDLED;
    }

    // Log other commands for daemon processing
    new name[32], authid[32], team[16];
    get_user_name(id, name, charsmax(name));
    get_user_authid(id, authid, charsmax(authid));
    get_user_team(id, team, charsmax(team));

    log_to_file("hlstats.log", "\"%s<%d><%s><%s>\" say \"!%s\"", name, id, authid, team, command);

    return PLUGIN_HANDLED;
}